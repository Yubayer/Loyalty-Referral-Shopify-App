/**
 * @file jobs/jobAutoRetryJob.js
 * @description Periodically re-queues FAILED jobs whose last error looks
 * transient (network-related), so a temporary Shopify API blip doesn't
 * require manual intervention.
 *
 * Deliberately narrow scope — this is NOT a blanket "retry everything that
 * failed" job. A job only reaches FAILED after exhausting its normal
 * in-cycle retries (see processJob() in orderPaidJob.js etc. — exponential
 * backoff across maxAttempts). If it's still failing after that, it's
 * more likely a real/structural problem (bad payload, a code bug, a
 * deleted Shopify resource) than a network hiccup — those should surface
 * in the admin Jobs UI for a human to look at, not get silently retried
 * on a loop forever.
 *
 * So this job only revives a FAILED job when BOTH are true:
 *   1. lastError matches one of TRANSIENT_ERROR_PATTERNS
 *   2. autoRetryCount < AUTO_RETRY_CAP (each revival increments this)
 *
 * Anything else — including jobs that exhaust AUTO_RETRY_CAP — stays
 * FAILED and shows up in the admin Jobs UI for manual retry/review.
 */

import prisma from "../../app/db.server.js";
import { logger } from "../../app/utils/logger.js";

/** @constant {string} Module identifier for structured logging */
const MODULE = "jobAutoRetryJob";

/**
 * Substrings checked (case-insensitive) against `lastError` to decide
 * whether a failure looks transient/network-related rather than a real
 * bug. Mirrors the `retryableErrors` patterns already used throughout
 * orderPaidJob.js (e.g. via withRetry calls).
 *
 * @constant {string[]}
 */
const TRANSIENT_ERROR_PATTERNS = [
    "fetch failed",
    "econnreset",
    "etimedout",
    "timed out",
    "no response available",
    "socket hang up",
];

/**
 * Max number of times this job will revive a given FAILED job. Once a job
 * hits this cap, it's left FAILED permanently for manual review — this is
 * the circuit breaker that stops a genuinely broken job from being
 * silently retried forever.
 *
 * @constant {number}
 */
export const AUTO_RETRY_CAP = 2;

/**
 * Max jobs revived per cycle, to keep each run bounded.
 *
 * @constant {number}
 */
const BATCH_SIZE = 200;

function looksTransient(lastError) {
    if (!lastError) return false;
    const msg = lastError.toLowerCase();
    return TRANSIENT_ERROR_PATTERNS.some((pattern) => msg.includes(pattern));
}

/**
 * Finds FAILED jobs eligible for auto-retry and requeues them as PENDING.
 *
 * @returns {Promise<void>}
 */
export async function runJobAutoRetryJob() {
    const candidates = await prisma.job.findMany({
        where: {
            status: "FAILED",
            autoRetryCount: { lt: AUTO_RETRY_CAP },
        },
        select: { id: true, type: true, shop: true, lastError: true, autoRetryCount: true },
        take: BATCH_SIZE,
    });

    const eligible = candidates.filter((job) => looksTransient(job.lastError));

    if (!eligible.length) {
        logger.info(MODULE, "No FAILED jobs with a transient-looking error — skipping cycle", {
            candidatesChecked: candidates.length,
        });
        return;
    }

    for (const job of eligible) {
        await prisma.job.update({
            where: { id: job.id },
            data: {
                status: "PENDING",
                attempts: 0,
                lockedAt: null,
                failedAt: null,
                runAt: new Date(),
                autoRetryCount: job.autoRetryCount + 1,
            },
        });

        logger.info(MODULE, `Auto-retried job #${job.id}`, {
            type: job.type,
            shop: job.shop,
            autoRetryCount: job.autoRetryCount + 1,
            cap: AUTO_RETRY_CAP,
        });
    }

    logger.success(MODULE, `Auto-retried ${eligible.length} job(s) with transient errors`, {
        skipped: candidates.length - eligible.length,
    });
}
