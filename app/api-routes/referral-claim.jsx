import { logger } from "app/utils/logger";
import { unauthenticated } from "shopify-server";
import getCorsHeaders from "app/utils/getCorsHeaders";
import { syncCustomerConfig } from "@controller/metafieldsSync/syncCustomerConfig";
import { generateReferralDiscountCode } from "@graphql/mutation/discounts/generateReferralDiscountCode";
import prisma from "db-server";
import { normalizeCustomerGid } from "@controller/customers/normalizeCustomerGid.js";
import { customerOrderCount } from "@graphql/query/customers";
import createTransaction from "@controller/transaction/createTransaction.js";
import { createCustomerReward } from "@controller/customerReward/createCustomerReward.js";
import { withRetry } from "app/utils/retry/withRetry.js";

/** @constant {string} Module identifier for structured logging */
const MODULE = "api.get-referral-discount";

// =====================================================
// CONSTANTS
// =====================================================

const REFERRAL_STATUS = {
    PENDING: "PENDING",
    ACTIVE: "ACTIVE",
    REDEEMED: "REDEEMED",
    EXPIRED: "EXPIRED",
    CANCELLED: "CANCELLED",
};

/**
 * Structured error codes for consistent client-side handling.
 * Each code maps to a specific HTTP status and user-facing message.
 *
 * 400 — Bad Request      : missing/malformed input
 * 404 — Not Found        : referral code or customer not found
 * 409 — Conflict         : duplicate or locked referral state
 * 422 — Unprocessable    : business rule violation (self-referral, ineligible)
 * 500 — Internal Error   : server/DB/Shopify failure
 */
const ERROR_CODES = {
    // 400
    INVALID_INPUT: { code: "INVALID_INPUT", status: 400 },
    // 404
    INVALID_REFERRAL_CODE: { code: "INVALID_REFERRAL_CODE", status: 404 },
    CUSTOMER_NOT_FOUND: { code: "CUSTOMER_NOT_FOUND", status: 404 },
    // 409
    DISCOUNT_ALREADY_USED: { code: "DISCOUNT_ALREADY_USED", status: 409 },
    DISCOUNT_ALREADY_EXISTS: { code: "DISCOUNT_ALREADY_EXISTS", status: 409 },
    REFERRAL_ALREADY_LOCKED: { code: "REFERRAL_ALREADY_LOCKED", status: 409 },
    // 422
    SELF_REFERRAL: { code: "SELF_REFERRAL", status: 422 },
    INELIGIBLE_CUSTOMER_ORDERS: { code: "INELIGIBLE_CUSTOMER_ORDERS", status: 422 },
    // 500
    INTERNAL_ERROR: { code: "INTERNAL_ERROR", status: 500 },
};

// =====================================================
// MAIN ACTION
// =====================================================

/**
 * POST /api/get-referral-discount
 *
 * Validates a referral code and generates a one-time discount code
 * for the referred customer if all eligibility checks pass.
 *
 * Request body: { shop, customerId, referralCode }
 *
 * Success response (200):
 *   { success: true, referralCode, referralDiscountCode, message }
 *
 * Error responses (400 / 404 / 409 / 422 / 500):
 *   { success: false, code, message }
 */
export async function action({ request }) {
    const corsHeaders = getCorsHeaders(request);

    // ── CORS preflight ────────────────────────────────────────────────────────
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse(
            { success: false, message: "Method not allowed.", code: ERROR_CODES.INVALID_INPUT.code },
            405,
            corsHeaders
        );
    }

    let body;

    try {
        body = await request.json();
    } catch {
        return jsonResponse(
            { success: false, message: "Invalid request body.", code: ERROR_CODES.INVALID_INPUT.code },
            400,
            corsHeaders
        );
    }

    const { shop, customerId, referralCode } = body;

    try {
        // ── 1. Validate input ─────────────────────────────────────────────────
        validateInput({ shop, customerId, referralCode });

        // ── 2. Authenticate shop ──────────────────────────────────────────────
        const { admin, session } = await unauthenticated.admin(shop);

        if (!session) {
            throw createError("Valid shop session required.", ERROR_CODES.INVALID_INPUT);
        }

        // ── 3. Eligibility: referred customer must have 0 prior orders ────────
        //
        // Wrapped in withRetry to handle transient Shopify Admin API / network
        // failures. No DB writes have occurred yet, so retrying is safe.
        const referredOrderCount = await withRetry(
            () => customerOrderCount(admin, customerId),
            {
                maxAttempts: 3,
                baseDelayMs: 800,
                retryableErrors: ["fetch failed", "ECONNRESET", "ETIMEDOUT"],
                context: { shop, customerId, module: MODULE },
            }
        );

        logger.info("Checking referral eligibility", {
            shop,
            customerId,
            referralCode,
            referredOrderCount,
        });

        if (referredOrderCount > 0) {
            throw createError(
                "You are not eligible for the referral reward because you have already placed an order.",
                ERROR_CODES.INELIGIBLE_CUSTOMER_ORDERS
            );
        }

        // ── 4. Fetch referrer and referred customer in parallel ───────────────
        const [referrer, referred] = await Promise.all([
            getReferrer(referralCode),
            getReferred(customerId),
        ]);

        validateCustomers(referrer, referred);

        // ── 5. Prevent self-referral ──────────────────────────────────────────
        if (referrer.id === referred.id) {
            throw createError(
                "You cannot use your own referral code.",
                ERROR_CODES.SELF_REFERRAL
            );
        }

        // ── 6. Check for existing referral ────────────────────────────────────
        const existingReferral = await findExistingReferral(referred.id);

        if (existingReferral) {
            return handleExistingReferral({
                existingReferral,
                currentReferrerId: referrer.id,
                referralCode,
                corsHeaders,
            });
        }

        // ── 7. Generate Shopify discount code ─────────────────────────────────
        //
        // Wrapped in withRetry to handle transient Shopify Admin API / network
        // failures. Safe to retry here because no DB writes have occurred yet —
        // retrying cannot cause duplicate referral records or double deductions.
        const discountCode = await withRetry(
            () => generateReferralDiscountCode(admin, customerId, referralCode),
            {
                maxAttempts: 3,
                baseDelayMs: 800,
                retryableErrors: [
                    "fetch failed",
                    "ECONNRESET",
                    "ETIMEDOUT",
                    // generateReferralDiscountCode catches network errors and
                    // re-throws with this message — include it so withRetry can
                    // match and retry accordingly
                    "Something went wrong. Please try again later.",
                ],
                context: { shop, customerId, referralCode, module: MODULE },
            }
        );

        if (!discountCode) {
            throw createError(
                "Failed to generate your discount code. Please try again.",
                ERROR_CODES.INTERNAL_ERROR
            );
        }

        // ── 8. Save referral record ───────────────────────────────────────────
        const newReferral = await createReferral(referrer.id, referred.id, discountCode);

        // ── 9. Transaction — audit trail only, no points movement yet ─────────
        //
        // Points are NOT earned here. They will be earned when the referred
        // customer completes their first order (handled in orders/paid webhook).
        //
        // We use type "EARN" with points: 0 instead of type "REFERRAL" because:
        //   - "REFERRAL" in createTransaction increments lifetimePoints, which
        //     would be incorrect before any actual earning has occurred.
        //   - This entry exists only to give the customer a visible activity log
        //     entry showing their referral discount is ready.
        //
        // status: "PENDING" — reflects that the referral reward is awaiting
        // the first order, not yet earned or completed.
        await createTransaction(
            {
                customerId: referred.id,
                type: "EARN",
                points: 0,
                referralId: newReferral.id,
                status: "PENDING",
                reason: `Referral code ${referralCode} applied — waiting for your first order to confirm the reward`,
                activity: `Referral discount is ready — use it at checkout on your first order`,
                metadata: {
                    referralCode,
                    discountCode,
                    referrerId: referrer.id,
                },
                // The referred customer is live in the widget right now,
                // applying the code themselves, and sees this confirmation
                // on screen immediately — never surface it as a toast later.
                notifiedAt: new Date(),
            },
            session
        );

        // ── 9.1 Reward record for referred customer ───────────────────────────
        //
        // Tracks the discount voucher in the customer's reward history.
        // status: "ACTIVE" — the code is live and ready to use at checkout.
        //
        // NOTE: referralId is intentionally omitted — Reward model does not yet
        // have a referralId field. Uncomment once schema is updated.
        await createCustomerReward({
            customerId: referred.id,
            event: "REFERRAL",
            type: "DEFAULT",
            status: "ACTIVE",
            title: "Referral discount voucher",
            description: `Use code ${discountCode} at checkout to get your referral discount on your first order.`,
            code: discountCode,
            // referralId: newReferral.id, // TODO: uncomment after Reward.referralId added to schema
        });

        // ── 10. Sync customer metafields ──────────────────────────────────────
        //
        // Non-critical — the referral record and discount code are already saved.
        // Retried up to 3 times on transient network errors. If all retries fail,
        // the error is swallowed and null is returned so the success response is
        // still sent to the customer. Metafields will resync on the next request.
        await withRetry(
            () => syncCustomerConfig(admin, customerId),
            {
                maxAttempts: 3,
                baseDelayMs: 800,
                retryableErrors: ["fetch failed", "ECONNRESET", "ETIMEDOUT"],
                context: { shop, customerId, module: MODULE },
            }
        ).catch((err) => {
            logger.error("Metafield sync failed after all retries — referral is still valid", {
                module: MODULE,
                customerId,
                error: err?.message,
            });
            return null;
        });

        logger.success("Referral discount generated", {
            referrerId: referrer.id,
            referredId: referred.id,
            discountCode,
        });

        // ── 11. Return success ────────────────────────────────────────────────
        return jsonResponse(
            {
                success: true,
                referralCode,
                referralDiscountCode: discountCode,
                message: "Your referral discount code is ready! Use it at checkout.",
            },
            200,
            corsHeaders
        );

    } catch (err) {
        const errorDef = err?.errorDef || ERROR_CODES.INTERNAL_ERROR;
        const isClientError = errorDef.status < 500;

        // 4xx → expected business rule rejection (self-referral, ineligible, etc.)
        //        log as WARN so it doesn't pollute the error dashboard
        // 5xx → actual server / Shopify / DB failure → log as ERROR
        if (isClientError) {
            logger.warn("Referral request rejected", {
                error: err?.message,
                code: errorDef.code,
                shop,
                customerId,
                referralCode,
                module: MODULE,
            });
        } else {
            logger.error("Referral API error", {
                error: err?.message,
                code: errorDef.code,
                shop,
                customerId,
                referralCode,
                module: MODULE,
            });
        }

        return jsonResponse(
            {
                success: false,
                message: err.message || "Something went wrong. Please try again.",
                code: errorDef.code,
            },
            errorDef.status,
            corsHeaders
        );
    }
}

// =====================================================
// HEALTH CHECK
// =====================================================

export async function loader({ request }) {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    return jsonResponse(
        { status: "ok", timestamp: new Date().toISOString() },
        200,
        corsHeaders
    );
}

// =====================================================
// RESPONSE HELPER
// =====================================================

/**
 * Returns a JSON Response with the given data, status, and headers.
 *
 * @param {Object} data
 * @param {number} status - HTTP status code
 * @param {Object} headers - CORS or other headers
 * @returns {Response}
 */
function jsonResponse(data, status, headers) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });
}

// =====================================================
// ERROR FACTORY
// =====================================================

/**
 * Creates a structured Error with an attached errorDef for HTTP status mapping.
 *
 * @param {string} message       - User-facing error message
 * @param {{ code: string, status: number }} errorDef - From ERROR_CODES
 * @returns {Error}
 */
function createError(message, errorDef) {
    const err = new Error(message);
    err.errorDef = errorDef;
    return err;
}

// =====================================================
// INPUT VALIDATION
// =====================================================

/**
 * Validates required request fields.
 * Throws a 400 error for any missing field.
 *
 * @param {{ shop: string, customerId: string, referralCode: string }} input
 */
function validateInput({ shop, customerId, referralCode }) {
    if (!shop) throw createError("Shop is required.", ERROR_CODES.INVALID_INPUT);
    if (!customerId) throw createError("Customer ID is required.", ERROR_CODES.INVALID_INPUT);
    if (!referralCode) throw createError("Referral code is required.", ERROR_CODES.INVALID_INPUT);
}

// =====================================================
// DB QUERIES
// =====================================================

/**
 * Finds the referrer customer by their unique referral code.
 *
 * @param {string} referralCode
 * @returns {Promise<{ id: number, referralCode: string }|null>}
 */
function getReferrer(referralCode) {
    return prisma.customer.findFirst({
        where: { referralCode },
        select: { id: true, referralCode: true },
    });
}

/**
 * Finds the referred customer by their Shopify GID.
 *
 * @param {string} customerId - Shopify customer GID or numeric ID
 * @returns {Promise<{ id: number }|null>}
 */
function getReferred(customerId) {
    return prisma.customer.findFirst({
        where: { shopifyId: normalizeCustomerGid(customerId) },
        select: { id: true },
    });
}

/**
 * Validates that both referrer and referred customers were found.
 * Throws appropriate 404 errors if either is missing.
 *
 * @param {Object|null} referrer
 * @param {Object|null} referred
 */
function validateCustomers(referrer, referred) {
    if (!referrer) {
        throw createError(
            "Invalid referral code. Please check the code and try again.",
            ERROR_CODES.INVALID_REFERRAL_CODE
        );
    }

    if (!referred) {
        throw createError(
            "Customer account not found. Please log in and try again.",
            ERROR_CODES.CUSTOMER_NOT_FOUND
        );
    }
}

/**
 * Finds an existing referral record for the referred customer.
 * Each customer can only be referred once (enforced by DB unique constraint).
 *
 * @param {number} referredId
 * @returns {Promise<{ id: number, referrerId: number, discountCode: string, discountUsed: boolean }|null>}
 */
function findExistingReferral(referredId) {
    return prisma.referral.findUnique({
        where: { referredId },
        select: {
            id: true,
            referrerId: true,
            discountCode: true,
            discountUsed: true,
        },
    });
}

// =====================================================
// REFERRAL LOGIC
// =====================================================

/**
 * Handles all scenarios where a referral record already exists for the referred customer.
 *
 * Three possible outcomes:
 *   1. Discount already used    → 409 DISCOUNT_ALREADY_USED
 *   2. Different referrer       → 409 REFERRAL_ALREADY_LOCKED
 *   3. Same referrer, not used  → 200 return existing code
 *
 * @param {Object} params
 * @param {Object} params.existingReferral
 * @param {number} params.currentReferrerId
 * @param {string} params.referralCode
 * @param {Object} params.corsHeaders
 * @returns {Response}
 */
function handleExistingReferral({ existingReferral, currentReferrerId, referralCode, corsHeaders }) {

    // ── Already redeemed at checkout ─────────────────────────────────────────
    if (existingReferral.discountUsed) {
        return jsonResponse(
            {
                success: false,
                code: ERROR_CODES.DISCOUNT_ALREADY_USED.code,
                message: "You have already used your referral discount. It can only be used once.",
            },
            ERROR_CODES.DISCOUNT_ALREADY_USED.status,
            corsHeaders
        );
    }

    // ── Locked to a different referrer — cannot switch ────────────────────────
    if (existingReferral.referrerId !== currentReferrerId) {
        return jsonResponse(
            {
                success: false,
                code: ERROR_CODES.REFERRAL_ALREADY_LOCKED.code,
                message: "You already have a referral discount from another person. You cannot switch referral codes.",
            },
            ERROR_CODES.REFERRAL_ALREADY_LOCKED.status,
            corsHeaders
        );
    }

    // ── Same referrer, code not yet used — return existing code ───────────────
    return jsonResponse(
        {
            success: true,
            referralCode,
            referralDiscountCode: existingReferral.discountCode,
            message: "Your referral discount code is still valid. Use it at checkout!",
        },
        200,
        corsHeaders
    );
}

/**
 * Creates a new referral record in the database.
 * Handles Prisma P2002 unique constraint violation (race condition safe).
 *
 * @param {number} referrerId
 * @param {number} referredId
 * @param {string} discountCode
 * @returns {Promise<{ id: number }>}
 */
async function createReferral(referrerId, referredId, discountCode) {
    try {
        return await prisma.referral.create({
            data: {
                status: REFERRAL_STATUS.ACTIVE,
                discountCode,
                discountInfo: "Referral discount code generated",
                referrerId,
                referredId,
            },
            select: { id: true },
        });
    } catch (err) {
        // P2002 = unique constraint violation — concurrent request already created this referral
        if (err.code === "P2002") {
            throw createError(
                "A referral discount has already been generated for your account.",
                ERROR_CODES.DISCOUNT_ALREADY_EXISTS
            );
        }
        throw err;
    }
}