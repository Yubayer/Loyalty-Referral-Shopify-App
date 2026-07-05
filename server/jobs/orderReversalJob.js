import prisma from "../../app/db.server.js";
import { unauthenticated } from "../../app/shopify.server.js";
import { logger } from "../../app/utils/logger.js";
import createTransaction from "../../app/controller/transaction/createTransaction.js";
import { syncCustomerConfig } from "../../app/controller/metafieldsSync/syncCustomerConfig.js";

/** @constant {string} Module identifier for structured logging */
const MODULE = "orderReversalJob";

/**
 * Maximum number of PENDING jobs to process in a single poller cycle.
 *
 * @constant {number}
 */
const BATCH_SIZE = 50;

/**
 * How long (ms) a job may remain in PROCESSING before it is considered
 * stale and re-queued. Covers server crash mid-execution scenarios.
 *
 * @constant {number}
 */
const STALE_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────────────────────────────────────
// Job Entry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main entry point called by jobManager on each cron cycle.
 *
 * Handles ORDER_REVERSED jobs, enqueued by:
 *   - webhooks/orders/cancelled  → reversalType: "CANCEL" (reverse everything left)
 *   - webhooks/refunds/create    → reversalType: "REFUND" (reverse a proportional slice)
 *
 * Same crash-recovery + batching + backoff shape as orderPaidJob.js.
 *
 * @returns {Promise<void>}
 */
export async function runOrderReversalJob() {
    await requeueStaleJobs();

    const jobs = await prisma.job.findMany({
        where: {
            type: "ORDER_REVERSED",
            status: "PENDING",
            runAt: { lte: new Date() },
        },
        orderBy: { runAt: "asc" },
        take: BATCH_SIZE,
    });

    if (!jobs.length) {
        logger.info(MODULE, "No pending ORDER_REVERSED jobs — skipping cycle");
        return;
    }

    logger.info(MODULE, `Processing ${jobs.length} ORDER_REVERSED job(s)`);

    for (const job of jobs) {
        await processJob(job);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stale Lock Recovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resets ORDER_REVERSED jobs stuck in PROCESSING back to PENDING.
 *
 * @returns {Promise<void>}
 */
async function requeueStaleJobs() {
    const staleThreshold = new Date(Date.now() - STALE_LOCK_TIMEOUT_MS);

    const { count } = await prisma.job.updateMany({
        where: {
            type: "ORDER_REVERSED",
            status: "PROCESSING",
            lockedAt: { lte: staleThreshold },
        },
        data: {
            status: "PENDING",
            lockedAt: null,
            lastError: "Re-queued after stale lock detected (possible server crash)",
        },
    });

    if (count > 0) {
        logger.warn(MODULE, `Re-queued ${count} stale ORDER_REVERSED job(s)`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-Job Processor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes a single ORDER_REVERSED job end-to-end.
 *
 * @param {{ id: number, shop: string, payload: object, attempts: number, maxAttempts: number }} job
 * @returns {Promise<void>}
 */
async function processJob(job) {
    const { id, shop, payload, attempts, maxAttempts } = job;
    const { orderId, reversalType, refundId, refundAmount } = payload;

    // ── 1. Claim ──────────────────────────────────────────────────────────────
    await prisma.job.update({
        where: { id },
        data: { status: "PROCESSING", lockedAt: new Date() },
    });

    logger.info(MODULE, `Processing job #${id}`, { shop, orderId, reversalType, attempt: attempts + 1, maxAttempts });

    try {
        // ── 2. Authenticate + process ─────────────────────────────────────────
        const { admin, session } = await unauthenticated.admin(shop);

        if (!session) throw new Error(`No active session for shop: ${shop}`);

        await mainHandler({ admin, session, shop, orderId, reversalType, refundId, refundAmount });

        // ── 3a. Success ───────────────────────────────────────────────────────
        await prisma.job.update({
            where: { id },
            data: {
                status: "COMPLETED",
                lockedAt: null,
                completedAt: new Date(),
                attempts: attempts + 1,
            },
        });

        logger.success(MODULE, `Job #${id} completed`, { shop, orderId, reversalType });
    } catch (err) {
        const nextAttempt = attempts + 1;
        const exhausted = nextAttempt >= maxAttempts;

        // ── 3b. Failure — exponential backoff: 2min → 4min → 8min ────────────
        const backoffMs = exhausted
            ? 0
            : Math.min(2 ** nextAttempt * 60 * 1000, 30 * 60 * 1000);

        await prisma.job.update({
            where: { id },
            data: {
                status: exhausted ? "FAILED" : "PENDING",
                lockedAt: null,
                attempts: nextAttempt,
                lastError: err?.message,
                failedAt: exhausted ? new Date() : null,
                runAt: exhausted ? undefined : new Date(Date.now() + backoffMs),
            },
        });

        if (exhausted) {
            logger.error(MODULE, `Job #${id} permanently failed`, { shop, orderId, reversalType, error: err?.message });
        } else {
            logger.warn(MODULE, `Job #${id} failed — retrying in ${Math.round(backoffMs / 1000)}s`, {
                shop, orderId, reversalType, attempt: nextAttempt, error: err?.message,
            });
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reverses points earned for a cancelled or refunded order.
 *
 * Logic per customer who earned points on this order:
 *   1. totalEarned    = sum of all EARN transactions tagged with this orderId
 *   2. alreadyReversed = sum of all REVERSAL transactions already tagged with this orderId
 *   3. remaining       = totalEarned - alreadyReversed  (nothing to do if <= 0)
 *   4. CANCEL  → reverse `remaining` in full
 *      REFUND  → reverse round(totalEarned * (refundAmount / orderTotal)), capped at `remaining`
 *                (orderTotal is read from the original EARN transaction's metadata,
 *                 so no extra Shopify API call is needed)
 *   5. Balance is floored at 0 by createTransaction's REVERSAL case — a customer
 *      who already redeemed the points can never go negative. Any shortfall is
 *      simply not recovered (accepted as the simplest policy — see chat).
 *
 * A single order can have multiple earners (e.g. the buyer + a referrer), so
 * every customer with EARN transactions on this orderId gets processed.
 *
 * @param {Object} args
 * @param {Object} args.admin          - Shopify Admin API client
 * @param {Object} args.session        - Shopify session (session.id required by createTransaction)
 * @param {string} args.shop           - Shop domain
 * @param {string} args.orderId        - Order GID, e.g. "gid://shopify/Order/1234"
 * @param {"CANCEL"|"REFUND"} args.reversalType
 * @param {number} [args.refundId]     - Shopify refund id (REFUND only, stored on metadata)
 * @param {number} [args.refundAmount] - Amount refunded in THIS refund event (REFUND only)
 * @returns {Promise<void>}
 */
async function mainHandler({ admin, session, shop, orderId, reversalType, refundId, refundAmount }) {
    // ── 1. Find every EARN transaction tagged with this order ──────────────────
    const earnTransactions = await prisma.transaction.findMany({
        where: {
            type: "EARN",
            status: "COMPLETED",
            metadata: { path: ["orderId"], equals: orderId },
        },
        select: { customerId: true, points: true, metadata: true },
    });

    if (!earnTransactions.length) {
        logger.info(MODULE, "No EARN transactions found for this order — nothing to reverse", { shop, orderId });
        return;
    }

    const orderTotal = Number(earnTransactions[0]?.metadata?.orderTotal || 0);

    // Group by customer — an order can have earners on both sides of a referral
    const byCustomer = new Map();
    for (const t of earnTransactions) {
        byCustomer.set(t.customerId, (byCustomer.get(t.customerId) || 0) + t.points);
    }

    for (const [customerId, totalEarned] of byCustomer.entries()) {
        // ── 2. How much of this customer's points on this order were already reversed ──
        const priorReversals = await prisma.transaction.findMany({
            where: {
                customerId,
                type: "REVERSAL",
                metadata: { path: ["orderId"], equals: orderId },
            },
            select: { points: true },
        });
        const alreadyReversed = priorReversals.reduce((sum, t) => sum - t.points, 0); // points stored negative

        const remaining = totalEarned - alreadyReversed;
        if (remaining <= 0) {
            logger.info(MODULE, "Nothing left to reverse for this customer", { shop, orderId, customerId });
            continue;
        }

        // ── 3. Work out how much to reverse ────────────────────────────────────
        let reverseAmount;
        if (reversalType === "CANCEL") {
            reverseAmount = remaining;
        } else {
            // REFUND — proportional to what fraction of the order this refund covers
            if (!orderTotal) {
                logger.warn(MODULE, "orderTotal missing on EARN metadata — reversing in full instead of proportionally", {
                    shop, orderId, customerId,
                });
                reverseAmount = remaining;
            } else {
                const ratio = Math.min(1, Number(refundAmount || 0) / orderTotal);
                reverseAmount = Math.min(Math.round(totalEarned * ratio), remaining);
            }
        }

        if (reverseAmount <= 0) continue;

        // ── 4. Reverse it — balance floors at 0, never goes negative ───────────
        await createTransaction(
            {
                customerId,
                type: "REVERSAL",
                points: -reverseAmount,
                status: "COMPLETED",
                reason: reversalType === "CANCEL"
                    ? `Order cancelled — points reversed`
                    : `Order refunded — points reversed`,
                activity: `-${reverseAmount} points (${reversalType === "CANCEL" ? "order cancelled" : "order refunded"})`,
                metadata: { orderId, refundId: refundId ?? null, reversalType },
            },
            session
        );

        logger.info(MODULE, "Points reversed", { shop, orderId, customerId, reverseAmount, reversalType });

        // Non-critical — points already reversed. Swallowed on failure.
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: { shopifyId: true },
        });
        if (customer?.shopifyId) {
            await syncCustomerConfig(admin, customer.shopifyId).catch((err) => {
                logger.error(MODULE, "Metafield sync failed — reversal already saved", {
                    shop, customerId, error: err?.message,
                });
            });
        }
    }

    logger.success(MODULE, "Order reversal handled", { shop, orderId, reversalType });
}