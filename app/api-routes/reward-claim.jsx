import { logger } from "app/utils/logger.js";
import { unauthenticated } from "shopify-server";
import getCorsHeaders from "app/utils/getCorsHeaders.js";
import prisma from "db-server";
import { generateRewardVoucher } from "app/graphql/mutation/discounts/generateRewardVoucher.js";
import createTransaction from "app/controller/transaction/createTransaction";
import { createCustomerReward } from "@app/controller/customerReward/createCustomerReward.js";
import { syncCustomerConfig } from "app/controller/metafieldsSync/syncCustomerConfig.js";
import { withRetry } from "app/utils/retry/withRetry.js";

/** @constant {string} Module identifier for structured logging */
const MODULE = "api.get-voucher.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/get-voucher
 *
 * Validates the customer and reward rule, deducts points, generates a
 * discount voucher, and returns the voucher code with redemption details.
 *
 * @param {{ request: Request }} args - Remix action arguments
 * @returns {Promise<Response>} JSON response with voucher and redemption details
 */
export async function action({ request }) {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") return corsResponse(null, 204, corsHeaders);
    if (request.method !== "POST") return corsResponse({ error: "Method not allowed" }, 405, corsHeaders);

    try {
        const body = await request.json();
        validateRequestBody(body);

        const { shop, customerId, customerIndex, rewardRuleId, title } = body;

        logger.info("Received get-voucher request", { module: MODULE, shop, rewardRuleId, customerIndex });

        // Fetch customer and authenticated shop session in parallel
        const [customer, { admin, session }] = await Promise.all([
            getValidCustomer(customerIndex),
            unauthenticated.admin(shop),
        ]);

        if (!session) throw new AppError("Valid shop session required", 401);
        if (!customer) throw new AppError("Customer not found", 404);

        const rewardRule = await getValidRewardRule(rewardRuleId);
        if (!rewardRule) throw new AppError("Reward rule not found", 404);
        if (!rewardRule.isActive) throw new AppError("Reward is no longer active", 422);

        // Guard: global usage cap
        if (rewardRule.usageLimit && rewardRule.usageCount >= rewardRule.usageLimit) {
            throw new AppError("Reward usage limit reached", 422);
        }

        // Guard: per-customer usage cap
        if (rewardRule.usagePerUser) {
            const usedCount = await prisma.reward.count({
                where: {
                    customerId: customer.id,
                    rewardRuleId: rewardRule.id,
                    status: { in: ["ACTIVE", "USED"] },
                },
            });
            if (usedCount >= rewardRule.usagePerUser) {
                throw new AppError("You have reached the usage limit for this reward", 422);
            }
        }

        // Guard: sufficient points balance
        if (rewardRule.pointsCost > customer.points) {
            throw new AppError(
                `Insufficient points. Required: ${rewardRule.pointsCost}, Available: ${customer.points}`,
                422
            );
        }

        const { voucherCode, pointsCost, rewardTitle, activity, createdAt } = await redeemReward({
            admin,
            session,
            customer,
            rewardRule,
            title,
            customerId,
        });

        // Sync updated customer config back to metafields — non-critical, but retried
        // up to 3 times on network failure. If all retries fail, the redemption and
        // points deduction are still committed in DB.
        const updatedCustomer = await withRetry(
            () => syncCustomerConfig(admin, customerId),
            {
                maxAttempts: 3,
                baseDelayMs: 800,
                retryableErrors: ["fetch failed", "ECONNRESET", "ETIMEDOUT"],
                context: { shop, module: MODULE },
            }
        ).catch((err) => {
            logger.error("Metafield sync failed after all retries — redemption is still valid", {
                module: MODULE,
                error: err?.message,
            });
            return null;
        });

        logger.info("Reward redeemed successfully", {
            module: MODULE,
            customerId,
            customerIndex,
            rewardRuleId,
            voucherCode,
        });

        return corsResponse(
            {
                shop,
                voucherCode,
                title: title || rewardTitle,
                points: updatedCustomer?.points ?? null,
                pointsCost: -pointsCost,
                activity,
                createdAt,
            },
            200,
            corsHeaders
        );
    } catch (err) {
        const statusCode = err instanceof AppError ? err.statusCode : 500;
        logger.error("Get voucher api error", err, { module: MODULE });
        return corsResponse({ error: "Get voucher api error", details: err.message }, statusCode, corsHeaders);
    }
}

/**
 * GET /api/get-voucher
 *
 * Health-check endpoint. Also handles CORS preflight for OPTIONS requests.
 *
 * @param {{ request: Request }} args - Remix loader arguments
 * @returns {Promise<Response>} JSON status response
 */
export async function loader({ request }) {
    const corsHeaders = getCorsHeaders(request);
    if (request.method === "OPTIONS") return corsResponse(null, 204, corsHeaders);
    return corsResponse({ status: "ok", timestamp: new Date().toISOString() }, 200, corsHeaders);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Business Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Executes the full reward redemption flow:
 * 1. Generates a discount voucher code via the Shopify Admin API
 * 2. Creates a Reward record and increments the rule's usage count (parallel)
 * 3. Records a debit Transaction for the points spent
 *
 * @param {object}  args
 * @param {object}  args.admin       - Authenticated Shopify Admin API client
 * @param {object}  args.session     - Shopify session object
 * @param {object}  args.customer    - Prisma Customer record
 * @param {object}  args.rewardRule  - Prisma RewardRule record
 * @param {string}  args.customerId  - Shopify customer GID
 * @param {string}  [args.title]     - Optional display title override
 *
 * @returns {Promise<{
 *   voucherCode: string,
 *   pointsCost:  number,
 *   rewardTitle: string,
 *   activity:    string,
 *   createdAt:   Date,
 * }>} Redemption result with display-ready fields
 *
 * @throws {AppError} If voucher generation fails
 */
async function redeemReward({ admin, session, customer, rewardRule, customerId, title }) {
    const shop = session?.shop;
    // Retry voucher generation on transient Shopify API / network failures.
    // generateRewardVoucher is idempotent-safe here because no DB writes have
    // happened yet — retrying cannot cause duplicate points deductions.
    const voucherCode = await withRetry(
        () => generateRewardVoucher(admin, customerId, rewardRule),
        {
            maxAttempts: 3,
            baseDelayMs: 800,
            retryableErrors: [
                "fetch failed",
                "ECONNRESET",
                "ETIMEDOUT",
                // generateRewardVoucher.js catches network errors and re-throws
                // with this message — include it so withRetry can match and retry
                "Something went wrong. Please try again later.",
            ],
            context: { shop, module: MODULE, customerId, rewardRuleId: rewardRule.id },
        }
    );
    if (!voucherCode) throw new AppError("Voucher generation failed", 500);

    const pointsCost = Math.abs(Number(rewardRule.pointsCost) || 0);

    // Create the Reward record and bump global usage count in parallel
    const [newReward] = await Promise.all([
        createCustomerReward({
            customerId: customer.id,
            rewardRuleId: rewardRule.id,
            event: "MANUAL",
            type: "REDEEM",
            title: title || rewardRule.title || "Points redemption",
            description: rewardRule.description || "Redeemed points for a discount voucher",
            code: voucherCode,
            pointsCost,
            status: "ACTIVE",
        }),
        prisma.rewardRule.update({
            where: { id: rewardRule.id },
            data: { usageCount: { increment: 1 } },
        }),
    ]);

    // Deduct points + record transaction atomically via createTransaction.
    // If this fails (e.g. Shopify session flap), cancel the reward record so
    // the customer cannot use a voucher without paying points.
    const transaction = await createTransaction(
        {
            customerId: customer.id,
            type: "REDEEM",
            reason: `${pointsCost} points redeemed for reward: ${rewardRule.title}`,
            activity: `-${pointsCost} points redeemed for reward: ${rewardRule.title}`,
            points: pointsCost,
            rewardId: newReward?.id,
            status: "COMPLETED",
            // Customer is live in the widget right now and sees the voucher
            // code on screen immediately — this should never also surface
            // as a toast notification on a later visit.
            notifiedAt: new Date(),
        },
        session
    );

    if (!transaction) {
        // createTransaction returned null — points were NOT deducted.
        // Cancel the reward and roll back the usage counter so the state is consistent.
        logger.error("Transaction failed — cancelling reward and rolling back usage count", {
            module: MODULE,
            customerId: customer.id,
            rewardRuleId: rewardRule.id,
            rewardId: newReward?.id,
        });

        await Promise.allSettled([
            newReward?.id
                ? prisma.reward.update({
                    where: { id: newReward.id },
                    data: { status: "CANCELLED" },
                })
                : Promise.resolve(),
            prisma.rewardRule.update({
                where: { id: rewardRule.id },
                data: { usageCount: { decrement: 1 } },
            }),
        ]);

        throw new AppError("Points deduction failed. Please try again.", 500);
    }

    return {
        voucherCode,
        pointsCost,
        rewardTitle: rewardRule.title,
        activity: `-${pointsCost} points redeemed for reward: ${rewardRule.title}`,
        createdAt: newReward?.createdAt ?? new Date(),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates required POST body fields and throws early if any are missing.
 *
 * @param {{ shop: string, customerId: string, customerIndex: string, rewardRuleId: string }} body
 * @throws {AppError} 400 if any required field is absent
 */
function validateRequestBody({ shop, customerId, customerIndex, rewardRuleId }) {
    if (!shop) throw new AppError("Valid shop required", 400);
    if (!customerId || !customerIndex) throw new AppError("Valid customer required", 400);
    if (!rewardRuleId) throw new AppError("Valid rewardRuleId required", 400);
}

// ─────────────────────────────────────────────────────────────────────────────
// DB Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches a RewardRule by its numeric ID.
 *
 * @param {number|string} id - RewardRule primary key
 * @returns {Promise<object|null>} Prisma RewardRule record, or null on failure
 */
async function getValidRewardRule(id) {
    try {
        return await prisma.rewardRule.findFirst({ where: { id: Number(id) } });
    } catch (error) {
        logger.error("Failed to fetch reward rule", { module: MODULE, rewardRuleId: id, error: error?.message });
        return null;
    }
}

/**
 * Fetches a Customer by its numeric internal ID (customerIndex).
 *
 * @param {number|string} id - Customer primary key
 * @returns {Promise<object|null>} Prisma Customer record, or null on failure
 */
async function getValidCustomer(id) {
    try {
        return await prisma.customer.findFirst({ where: { id: Number(id) } });
    } catch (error) {
        logger.error("Failed to fetch customer", { module: MODULE, customerIndex: id, error: error?.message });
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a JSON Response with CORS headers attached.
 *
 * @param {object|null} body        - Response payload (null for 204)
 * @param {number}      status      - HTTP status code
 * @param {object}      corsHeaders - CORS headers object
 * @returns {Response}
 */
function corsResponse(body, status, corsHeaders) {
    return new Response(body !== null ? JSON.stringify(body) : null, {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
    });
}

/**
 * Domain-specific error class that carries an HTTP status code.
 * Allows the action handler to distinguish expected business errors
 * from unexpected runtime exceptions.
 */
class AppError extends Error {
    /**
     * @param {string} message    - Human-readable error description
     * @param {number} statusCode - HTTP status code to return (default 500)
     */
    constructor(message, statusCode = 500) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
    }
}