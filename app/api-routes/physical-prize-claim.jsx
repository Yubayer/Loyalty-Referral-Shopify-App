import { logger } from "app/utils/logger.js";
import { unauthenticated } from "shopify-server";
import getCorsHeaders from "app/utils/getCorsHeaders.js";
import prisma from "db-server";
import createTransaction from "app/controller/transaction/createTransaction";
import { syncCustomerConfig } from "app/controller/metafieldsSync/syncCustomerConfig.js";
import { withRetry } from "app/utils/retry/withRetry.js";

const MODULE = "api.claim-prize.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/claim-prize
 *
 * Validates the customer and prize, deducts points, creates a
 * PhysicalPrizeClaim record with status PENDING, and returns the claim details.
 */
export async function action({ request }) {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") return corsResponse(null, 204, corsHeaders);
    if (request.method !== "POST") return corsResponse({ error: "Method not allowed" }, 405, corsHeaders);

    try {
        const body = await request.json();
        validateRequestBody(body);

        const { shop, customerId, customerIndex, prizeId } = body;

        const [customer, { admin, session }] = await Promise.all([
            getValidCustomer(customerIndex),
            unauthenticated.admin(shop),
        ]);

        if (!session) throw new AppError("Valid shop session required", 401);
        if (!customer) throw new AppError("Customer not found", 404);

        const prize = await getValidPrize(prizeId);
        if (!prize) throw new AppError("Prize not found", 404);
        if (!prize.isActive) throw new AppError("This prize is no longer available", 422);

        // Guard: sufficient points
        if (prize.pointsCost > customer.points) {
            throw new AppError(
                `Insufficient points. Required: ${prize.pointsCost}, Available: ${customer.points}`,
                422
            );
        }

        const { claim, pointsCost } = await claimPrize({ session, customer, prize });

        // Sync metafields — non-critical, but retried up to 3 times on network failure.
        // If all retries fail, the claim and points deduction are still committed in DB.
        // The metafield will reflect the correct state on next successful sync.
        const updatedCustomer = await withRetry(
            () => syncCustomerConfig(admin, customerId),
            {
                maxAttempts: 3,
                baseDelayMs: 800,
                retryableErrors: [
                    "fetch failed",
                    "ECONNRESET",
                    "ETIMEDOUT",
                    "Something went wrong. Please try again later.",
                ],
                context: { module: MODULE, claimId: claim.id, shop },
            }
        ).catch((err) => {
            logger.error("Metafield sync failed after all retries — claim is still valid", {
                module: MODULE,
                claimId: claim.id,
                error: err?.message,
            });
            return null;
        });

        logger.info("Prize claimed successfully", {
            module: MODULE,
            customerId,
            customerIndex,
            prizeId,
            claimId: claim.id,
        });

        return corsResponse(
            {
                shop,
                claimId: claim.id,
                prizeId: prize.id,
                status: claim.status,
                title: prize.title,
                points: updatedCustomer?.points ?? null,
                pointsCost: -pointsCost,
                createdAt: claim.createdAt,
            },
            200,
            corsHeaders
        );
    } catch (err) {
        const statusCode = err instanceof AppError ? err.statusCode : 500;
        logger.error("Claim prize api error", err, { module: MODULE });
        return corsResponse({ error: "Claim prize api error", details: err.message }, statusCode, corsHeaders);
    }
}

/**
 * GET /api/claim-prize — health check
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
 * Executes the full prize claim flow:
 * 1. Creates a PhysicalPrizeClaim record with status PENDING
 * 2. Records a debit Transaction for the points spent
 *    (createTransaction handles points deduction atomically)
 * 3. If transaction fails, the claim is cancelled to keep state consistent.
 */
async function claimPrize({ session, customer, prize }) {
    const pointsCost = Math.abs(Number(prize.pointsCost) || 0);

    // 1. Create the claim record
    const claim = await prisma.physicalPrizeClaim.create({
        data: {
            status: "PENDING",
            pointsCost,
            customer: { connect: { id: customer.id } },
            prize: { connect: { id: prize.id } },
        },
    });

    // 2. Deduct points + record transaction atomically via createTransaction.
    // If this fails, cancel the claim so the customer does not get a free prize.
    const transaction = await createTransaction(
        {
            customerId: customer.id,
            type: "REDEEM",
            reason: `${pointsCost} points redeemed for prize: ${prize.title}`,
            activity: `-${pointsCost} points redeemed for prize: ${prize.title}`,
            points: pointsCost,
            status: "COMPLETED",
            // Customer is live in the widget right now and sees the claim
            // confirmation on screen immediately — never surface this as a
            // toast on a later visit.
            notifiedAt: new Date(),
        },
        session
    );

    if (!transaction) {
        logger.error("Transaction failed — cancelling prize claim", {
            module: MODULE,
            claimId: claim.id,
            customerId: customer.id,
            prizeId: prize.id,
        });

        await prisma.physicalPrizeClaim.update({
            where: { id: claim.id },
            data: { status: "CANCELLED" },
        });

        throw new AppError("Points deduction failed. Please try again.", 500);
    }

    // 3. Link transaction to claim
    await prisma.physicalPrizeClaim.update({
        where: { id: claim.id },
        data: { transactionId: transaction.id },
    });

    return { claim, pointsCost };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

function validateRequestBody({ shop, customerId, customerIndex, prizeId }) {
    if (!shop) throw new AppError("Valid shop required", 400);
    if (!customerId || !customerIndex) throw new AppError("Valid customer required", 400);
    if (!prizeId) throw new AppError("Valid prizeId required", 400);
}

// ─────────────────────────────────────────────────────────────────────────────
// DB Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getValidPrize(id) {
    try {
        return await prisma.physicalPrize.findFirst({ where: { id: Number(id) } });
    } catch (error) {
        logger.error("Failed to fetch prize", { module: MODULE, prizeId: id, error: error?.message });
        return null;
    }
}

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

function corsResponse(body, status, corsHeaders) {
    return new Response(body !== null ? JSON.stringify(body) : null, {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
    });
}

class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
    }
}