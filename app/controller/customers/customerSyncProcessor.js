import prisma from "../../db.server.js";
import syncCustomersFromStore from "./syncCustomersFromStore.js";
import { logger } from "../../utils/logger.js";

const MODULE = "customerSyncProcessor";

const STALE_LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ─────────────────────────────────────────────────────────────────────────────
// Stale Lock Recovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resets CUSTOMER_SYNC jobs stuck in PROCESSING back to PENDING.
 * Called at the start of every cron cycle as a crash-recovery guard.
 */
export async function requeueStaleCustomerSyncJobs() {
    const staleThreshold = new Date(Date.now() - STALE_LOCK_TIMEOUT_MS);

    const { count } = await prisma.job.updateMany({
        where: {
            type: "CUSTOMER_SYNC",
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
        logger.warn(MODULE, `Re-queued ${count} stale CUSTOMER_SYNC job(s)`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Processor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes a single CUSTOMER_SYNC job end-to-end.
 *
 * Used by both:
 *   - The action (immediate trigger via setImmediate) — admin/session already available
 *   - The cron job (recovery path) — admin/session resolved via unauthenticated.admin
 *
 * @param {Object} admin   - Shopify Admin GraphQL client
 * @param {Object} session - Shopify session
 * @param {number} jobId   - Job DB id
 */
export async function processCustomerSync(admin, session, jobId) {
    // ── Mark as PROCESSING ────────────────────────────────────────────────────
    await prisma.job.update({
        where: { id: jobId },
        data: { status: "PROCESSING", lockedAt: new Date(), attempts: { increment: 1 } },
    });

    logger.info(MODULE, "Customer sync started", { shop: session.shop, jobId });

    try {
        const result = await syncCustomersFromStore(admin, session);

        await prisma.job.update({
            where: { id: jobId },
            data: {
                status: "COMPLETED",
                completedAt: new Date(),
                lockedAt: null,
                payload: {
                    shop: session.shop,
                    sessionId: session.id,
                    result: { total: result.total, success: result.success, failed: result.failed },
                },
            },
        });

        logger.success(MODULE, "Customer sync completed", {
            shop: session.shop,
            jobId,
            total: result.total,
            success: result.success,
            failed: result.failed,
        });

    } catch (err) {
        await prisma.job.update({
            where: { id: jobId },
            data: {
                status: "FAILED",
                lockedAt: null,
                lastError: err?.message ?? "Unknown error",
                failedAt: new Date(),
            },
        });

        logger.error(MODULE, "Customer sync failed", {
            shop: session.shop,
            jobId,
            error: err?.message,
        });

        throw err;
    }
}
