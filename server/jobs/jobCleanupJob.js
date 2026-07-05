/**
 * @file jobs/jobCleanupJob.js
 * @description Periodically deletes old COMPLETED jobs from the Job table
 * to keep it from growing unbounded.
 *
 * IMPORTANT — retention window:
 * `idempotencyKey` on the Job model is what prevents duplicate processing
 * of a re-delivered Shopify webhook (Shopify guarantees at-least-once
 * delivery, and merchants can also manually resend a webhook from the
 * admin days after the fact). Deleting a COMPLETED job's row removes that
 * protection for that specific job. RETENTION_DAYS must stay comfortably
 * longer than any realistic re-delivery window — do not lower this below
 * ~30 days without a specific reason.
 *
 * Only ever touches status = "COMPLETED". FAILED / CANCELLED / PENDING /
 * PROCESSING rows are never deleted here — FAILED rows in particular need
 * to stay visible in the admin Jobs UI until a human (or the auto-retry
 * job) resolves them.
 */

import prisma from "../../app/db.server.js";
import { logger } from "../../app/utils/logger.js";

/** @constant {string} Module identifier for structured logging */
const MODULE = "jobCleanupJob";

/**
 * How many days a COMPLETED job is kept before being eligible for deletion.
 * See the file-level comment above before changing this.
 *
 * @constant {number}
 */
export const RETENTION_DAYS = 30;

/**
 * Maximum rows deleted in a single cycle, to avoid one giant DELETE
 * locking the table for a long time if a large backlog has built up.
 *
 * @constant {number}
 */
const BATCH_SIZE = 5000;

/**
 * Deletes COMPLETED jobs older than RETENTION_DAYS.
 *
 * @returns {Promise<void>}
 */
export async function runJobCleanupJob() {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // Find a batch of eligible IDs first, then delete by ID — keeps the
    // delete itself fast/targeted and caps how much we touch per cycle.
    const eligible = await prisma.job.findMany({
        where: {
            status: "COMPLETED",
            completedAt: { lte: cutoff },
        },
        select: { id: true },
        take: BATCH_SIZE,
    });

    if (!eligible.length) {
        logger.info(MODULE, "No COMPLETED jobs older than retention window — skipping cycle", {
            retentionDays: RETENTION_DAYS,
        });
        return;
    }

    const { count } = await prisma.job.deleteMany({
        where: { id: { in: eligible.map((j) => j.id) } },
    });

    logger.success(MODULE, `Deleted ${count} COMPLETED job(s) older than ${RETENTION_DAYS} days`);
}
