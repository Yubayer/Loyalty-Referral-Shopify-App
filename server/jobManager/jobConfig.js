import { runOrderPaidJob } from "../jobs/orderPaidJob.js";
import { runOrderReversalJob } from "../jobs/orderReversalJob.js";
import { runCustomerSyncJob } from "../jobs/customerSyncJob.js";
import { runJobCleanupJob } from "../jobs/jobCleanupJob.js";
import { runJobAutoRetryJob } from "../jobs/jobAutoRetryJob.js";
import { logger } from "../../app/utils/logger.js";

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default values applied to every job unless overridden in JOB_CONFIGS.
 *
 * @property {number}     lockTimeout  - Max ms a job lock is considered valid.
 *                                       If a job is still "running" after this
 *                                       duration, the lock is treated as stale
 *                                       and the next cycle may re-acquire it.
 * @property {boolean}    immediate    - Whether to run the job once on startup
 *                                       before handing off to the cron schedule.
 * @property {Function[]} preHooks     - Async functions run in parallel before handlers.
 * @property {Function[]} postHooks    - Async functions run in parallel after handlers.
 * @property {object}     retry        - withRetry options passed to every hook and handler.
 * @property {number}     jobTimeout   - Hard timeout (ms) for the full job execution.
 *                                       Prevents a hung job from holding the lock forever.
 */
export const DEFAULTS = {
    lockTimeout: 60 * 60 * 1000,   // 1 hour
    immediate: false,
    preHooks: [],
    postHooks: [],
    retry: { maxAttempts: 3 },
    jobTimeout: 30 * 60 * 1000,   // 30 minutes
};

// ─────────────────────────────────────────────────────────────────────────────
// Job Configurations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registry of all background jobs.
 *
 * Each entry is picked up by initJobs() which:
 *   - Creates a JobLock row on startup
 *   - Optionally runs the job immediately (immediate: true)
 *   - Schedules the job via node-cron using the cron expression
 *
 * Job execution order per cycle:
 *   preHooks (parallel) → handlers (sequential) → postHooks (parallel)
 *
 * @type {Array<{
 *   name:        string,
 *   cron:        string,
 *   lockTimeout: number,
 *   immediate:   boolean,
 *   jobTimeout:  number,
 *   preHooks:    Function[],
 *   handlers:    Function[],
 *   postHooks?:  Function[],
 *   retry:       object,
 * }>}
 */
export const JOB_CONFIGS = [
    // ── Customer Sync ────────────────────────────────────────────────────────
    // Safety-net cron for CUSTOMER_SYNC jobs. The primary trigger is setImmediate
    // in the action which fires immediately on button click.
    // This cron only handles stale/missed jobs — e.g. server crash mid-sync.
    {
        name: "customer_sync",
        cron: "*/5 * * * *",
        lockTimeout: 35 * 60 * 1000,
        immediate: false,
        jobTimeout: 30 * 60 * 1000,
        preHooks: [
            async () => logger.info("customer_sync", "Pre-hook: customer sync cycle starting"),
        ],
        handlers: [
            async () => runCustomerSyncJob(),
        ],
        retry: { maxAttempts: 1 },
    },

    // ── Order Paid ───────────────────────────────────────────────────────────
    // Processes pending ORDER_PAID jobs enqueued by the orders/paid webhook.
    // Runs every 2 minutes. Each cycle picks up all PENDING jobs and processes
    // them sequentially — points awarding, referral handling, voucher updates.
    // lockTimeout is short (5 min) so a stale lock from a crash is recovered
    // quickly and the next cycle can re-process any unfinished jobs.
    {
        name: "order_paid",
        // cron: "*/2 * * * *",           // every 2 minutes
        // cron: "* * * * *",             // every 1 minute
        cron: "*/30 * * * * *",  // every 30 seconds
        lockTimeout: 5 * 60 * 1000,           // 5 minute stale-lock threshold
        immediate: true,                     // run once on server startup
        jobTimeout: 4 * 60 * 1000,           // 4 minutes hard timeout per cycle
        preHooks: [
            async () => logger.info("order_paid", "Pre-hook: order paid job cycle starting"),
        ],
        handlers: [
            async () => runOrderPaidJob(),
        ],
        retry: { maxAttempts: 3 },
    },

    // ── Order Reversal (Cancel / Refund) ────────────────────────────────────
    // Processes pending ORDER_REVERSED jobs enqueued by the orders/cancelled
    // and refunds/create webhooks. Reverses (partially or fully) the points
    // earned on the original order. Same cadence/shape as order_paid.
    {
        name: "order_reversal",
        cron: "*/30 * * * * *",  // every 30 seconds
        lockTimeout: 5 * 60 * 1000,           // 5 minute stale-lock threshold
        immediate: true,                     // run once on server startup
        jobTimeout: 4 * 60 * 1000,           // 4 minutes hard timeout per cycle
        preHooks: [
            async () => logger.info("order_reversal", "Pre-hook: order reversal job cycle starting"),
        ],
        handlers: [
            async () => runOrderReversalJob(),
        ],
        retry: { maxAttempts: 3 },
    },

    // ── Job Cleanup ──────────────────────────────────────────────────────────
    // Deletes old COMPLETED jobs to keep the Job table from growing
    // unbounded. See jobCleanupJob.js for the retention-window reasoning
    // (must stay well clear of Shopify's webhook re-delivery window since
    // idempotencyKey protection depends on the row still existing).
    // Runs once a day at 03:00 — this is bulk housekeeping, not
    // time-sensitive, so a low-traffic hour keeps it off the DB during
    // peak order-processing.
    {
        name: "job_cleanup",
        cron: "0 3 * * *",                    // every day at 03:00
        lockTimeout: 30 * 60 * 1000,          // 30 minute stale-lock threshold
        immediate: false,
        jobTimeout: 10 * 60 * 1000,           // 10 minutes hard timeout
        preHooks: [
            async () => logger.info("job_cleanup", "Pre-hook: job cleanup cycle starting"),
        ],
        handlers: [
            async () => runJobCleanupJob(),
        ],
        retry: { maxAttempts: 2 },
    },

    // ── Job Auto-Retry ───────────────────────────────────────────────────────
    // Revives FAILED jobs whose last error looks transient/network-related
    // (see TRANSIENT_ERROR_PATTERNS in jobAutoRetryJob.js), capped at
    // AUTO_RETRY_CAP revivals per job. Everything else stays FAILED for
    // manual review/retry in the admin Jobs UI.
    {
        name: "job_auto_retry",
        cron: "*/15 * * * *",                 // every 15 minutes
        lockTimeout: 15 * 60 * 1000,          // 15 minute stale-lock threshold
        immediate: false,
        jobTimeout: 5 * 60 * 1000,            // 5 minutes hard timeout
        preHooks: [
            async () => logger.info("job_auto_retry", "Pre-hook: job auto-retry cycle starting"),
        ],
        handlers: [
            async () => runJobAutoRetryJob(),
        ],
        retry: { maxAttempts: 2 },
    },
];