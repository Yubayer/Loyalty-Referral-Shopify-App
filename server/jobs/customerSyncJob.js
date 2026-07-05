import prisma from "../../app/db.server.js";
import { unauthenticated } from "../../app/shopify.server.js";
import { logger } from "../../app/utils/logger.js";
import {
    processCustomerSync,
    requeueStaleCustomerSyncJobs,
} from "../../app/controller/customers/customerSyncProcessor.js";

const MODULE = "customerSyncJob";

/**
 * Cron entry point — called by jobManager on each scheduled cycle.
 *
 * This is a RECOVERY path only. The primary trigger is setImmediate
 * in the action (_action.server.js), which fires immediately on button click.
 *
 * This cron handles:
 *   1. Stale PROCESSING jobs (server crash recovery)
 *   2. Any PENDING jobs the immediate trigger may have missed
 *
 * Running every 5 minutes is sufficient — merchants won't notice a 5-minute
 * delay on the recovery path since the immediate trigger handles the common case.
 */
export async function runCustomerSyncJob() {
    // ── 1. Stale lock recovery ────────────────────────────────────────────────
    await requeueStaleCustomerSyncJobs();

    // ── 2. Find pending jobs ──────────────────────────────────────────────────
    const jobs = await prisma.job.findMany({
        where: {
            type:   "CUSTOMER_SYNC",
            status: "PENDING",
            runAt:  { lte: new Date() },
        },
        orderBy: { runAt: "asc" },
        take: 1, // only one sync per shop at a time
    });

    if (!jobs.length) {
        logger.info(MODULE, "No pending CUSTOMER_SYNC jobs — skipping cycle");
        return;
    }

    const job = jobs[0];

    logger.info(MODULE, `Processing CUSTOMER_SYNC job #${job.id}`, { shop: job.shop });

    try {
        const { admin, session } = await unauthenticated.admin(job.shop);

        if (!session) {
            throw new Error(`No active session for shop: ${job.shop}`);
        }

        await processCustomerSync(admin, session, job.id);

    } catch (err) {
        logger.error(MODULE, `CUSTOMER_SYNC job #${job.id} failed`, {
            shop:  job.shop,
            error: err?.message,
        });
    }
}
