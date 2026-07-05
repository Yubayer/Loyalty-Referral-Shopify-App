/**
 * @file jobs/_action.server.js
 * @description Generic job-transition handlers for the Jobs admin page —
 * every status (PENDING / PROCESSING / FAILED / CANCELLED / COMPLETED) has
 * single, bulk (selected), and group-wise (all-of-type) operations built
 * from the same underlying transition() helper.
 *
 * formData contract (shared by every intent below):
 *   mode        "one" | "many" | "group"
 *   jobId       (mode=one)   — single job id
 *   jobIds      (mode=many)  — comma-separated ids
 *   type        (mode=group) — job type, combined with fromStatus
 *   fromStatus  the status these rows are expected to currently be in —
 *               always included as a safety filter so a bulk/group action
 *               can never accidentally transition a row that has since
 *               moved to a different status (e.g. finished processing
 *               between page load and form submit).
 */

import prisma from "db-server";

// ── Shared transition helper ───────────────────────────────────────────────

/**
 * Builds the `where` clause for one/many/group modes and applies `data`
 * via updateMany (safe for all three modes, and enforces fromStatus as a
 * guard against racing with the poller).
 *
 * @param {FormData} formData
 * @param {object}   data - Prisma update payload
 * @returns {Promise<number>} rows affected
 */
async function transition(formData, data) {
    const mode = formData.get("mode");
    const fromStatus = formData.get("fromStatus");

    let where;
    if (mode === "one") {
        where = { id: Number(formData.get("jobId")), status: fromStatus };
    } else if (mode === "many") {
        const ids = (formData.get("jobIds") || "").split(",").map(Number).filter(Boolean);
        where = { id: { in: ids }, status: fromStatus };
    } else if (mode === "group") {
        where = { type: formData.get("type"), status: fromStatus };
    } else {
        throw new Error(`Unknown mode: "${mode}"`);
    }

    const { count } = await prisma.job.updateMany({ where, data });
    return count;
}

function requeueData() {
    return {
        status: "PENDING",
        attempts: 0,
        lockedAt: null,
        failedAt: null,
        runAt: new Date(),
    };
}

function describeMode(formData, count) {
    const mode = formData.get("mode");
    if (mode === "one") return `Job #${formData.get("jobId")}`;
    if (mode === "many") return `${count} selected job(s)`;
    return `${count} "${formData.get("type")}" job(s)`;
}

// ── CANCEL — from PENDING or FAILED ────────────────────────────────────────

export async function handleCancel({ formData }) {
    const count = await transition(formData, { status: "CANCELLED" });
    return { ok: true, intent: "cancel", message: `${describeMode(formData, count)} cancelled.` };
}

// ── RETRY / REQUEUE — from FAILED or CANCELLED, back to PENDING ───────────

export async function handleRetry({ formData }) {
    const count = await transition(formData, requeueData());
    return { ok: true, intent: "retry", message: `${describeMode(formData, count)} re-queued.` };
}

// ── FORCE RESET — unstick a PROCESSING job manually (normally handled by
//    the automatic stale-lock recovery in each job's requeueStaleJobs(),
//    this is for an admin who doesn't want to wait for that timeout) ───────

export async function handleForceReset({ formData }) {
    const count = await transition(formData, {
        ...requeueData(),
        lastError: "Manually force-reset from PROCESSING via admin UI",
    });
    return { ok: true, intent: "forceReset", message: `${describeMode(formData, count)} reset to PENDING.` };
}

// ── DELETE — from COMPLETED (manual purge ahead of the retention window
//    used by jobCleanupJob.js). Deliberately NOT offered for FAILED/PENDING
//    — those should be retried or explicitly cancelled first so there's a
//    clear audit trail of what happened. ────────────────────────────────────

export async function handleDelete({ formData }) {
    const mode = formData.get("mode");
    const fromStatus = formData.get("fromStatus");

    let where;
    if (mode === "one") {
        where = { id: Number(formData.get("jobId")), status: fromStatus };
    } else if (mode === "many") {
        const ids = (formData.get("jobIds") || "").split(",").map(Number).filter(Boolean);
        where = { id: { in: ids }, status: fromStatus };
    } else if (mode === "group") {
        where = { type: formData.get("type"), status: fromStatus };
    } else {
        return { ok: false, intent: "delete", message: "Unknown mode." };
    }

    const { count } = await prisma.job.deleteMany({ where });
    return { ok: true, intent: "delete", message: `${describeMode(formData, count)} deleted.` };
}
