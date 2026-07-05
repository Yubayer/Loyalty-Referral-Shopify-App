const STATUS_TONE = {
    PENDING: "info",
    PROCESSING: "attention",
    COMPLETED: "success",
    FAILED: "critical",
    CANCELLED: "neutral",
};

// Must match MODAL_ID in route.jsx — every trigger button opens the same
// shared modal declaratively via commandFor.
const MODAL_ID = "jobs-confirm-modal";

const SELECTABLE_STATUSES = ["PENDING", "PROCESSING", "FAILED", "CANCELLED", "COMPLETED"];

function formatDate(dt) {
    if (!dt) return "—";
    try {
        return new Date(dt).toLocaleString(undefined, {
            year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    } catch {
        return "—";
    }
}

// Each row action calls onRequestAction(...) instead of submitting directly —
// route.jsx opens the shared confirm modal, and only submits on confirm.
function RowActions({ job, onRequestAction }) {
    const base = { mode: "one", jobId: String(job.id), fromStatus: job.status };

    switch (job.status) {
        case "PENDING":
            return (
                <s-button
                    variant="tertiary"
                    tone="critical"
                    commandFor={MODAL_ID}
                    command="--show"
                    onClick={() => onRequestAction({
                        ...base,
                        intent: "cancel",
                        confirmHeading: "Cancel this job?",
                        confirmText: `Job #${job.id} (${job.type}) will be marked CANCELLED and will not run.`,
                    })}
                >
                    Cancel
                </s-button>
            );
        case "PROCESSING":
            return (
                <s-button
                    variant="tertiary"
                    commandFor={MODAL_ID}
                    command="--show"
                    onClick={() => onRequestAction({
                        ...base,
                        intent: "forceReset",
                        confirmHeading: "Force reset this job?",
                        confirmText: `Job #${job.id} (${job.type}) will be reset to PENDING immediately. Only do this if you're sure it's actually stuck, not genuinely still running.`,
                    })}
                >
                    Force reset
                </s-button>
            );
        case "FAILED":
            return (
                <s-stack direction="inline" gap="small-200">
                    <s-button
                        variant="tertiary"
                        commandFor={MODAL_ID}
                        command="--show"
                        onClick={() => onRequestAction({
                            ...base,
                            intent: "retry",
                            confirmHeading: "Retry this job?",
                            confirmText: `Job #${job.id} (${job.type}) will be re-queued as PENDING and picked up on the next poller cycle.`,
                        })}
                    >
                        Retry
                    </s-button>
                    <s-button
                        variant="tertiary"
                        tone="critical"
                        commandFor={MODAL_ID}
                        command="--show"
                        onClick={() => onRequestAction({
                            ...base,
                            intent: "cancel",
                            confirmHeading: "Cancel this job?",
                            confirmText: `Job #${job.id} (${job.type}) will be marked CANCELLED permanently (until manually requeued).`,
                        })}
                    >
                        Cancel
                    </s-button>
                </s-stack>
            );
        case "CANCELLED":
            return (
                <s-button
                    variant="tertiary"
                    commandFor={MODAL_ID}
                    command="--show"
                    onClick={() => onRequestAction({
                        ...base,
                        intent: "retry",
                        confirmHeading: "Requeue this job?",
                        confirmText: `Job #${job.id} (${job.type}) will be set back to PENDING and processed again.`,
                    })}
                >
                    Requeue
                </s-button>
            );
        case "COMPLETED":
            return (
                <s-button
                    variant="tertiary"
                    tone="critical"
                    commandFor={MODAL_ID}
                    command="--show"
                    onClick={() => onRequestAction({
                        ...base,
                        intent: "delete",
                        confirmHeading: "Delete this job permanently?",
                        confirmText: `Job #${job.id} (${job.type}) will be permanently deleted. This cannot be undone, and removes its idempotency protection against a re-delivered webhook.`,
                    })}
                >
                    Delete
                </s-button>
            );
        default:
            return null;
    }
}

export function JobsTable({
    jobs,
    selectedIds,
    onToggleSelect,
    onToggleSelectAllPage,
    allPageSelected,
    onRequestAction,
}) {
    const anySelectableOnPage = jobs.some((j) => SELECTABLE_STATUSES.includes(j.status));

    return (
        <s-section padding="none">
            <s-table>
                <s-table-header-row>
                    <s-table-header>
                        {anySelectableOnPage && (
                            <s-checkbox
                                checked={allPageSelected}
                                onChange={onToggleSelectAllPage}
                                accessibilityLabel="Select all jobs on this page"
                            ></s-checkbox>
                        )}
                    </s-table-header>
                    <s-table-header>ID</s-table-header>
                    <s-table-header>Type</s-table-header>
                    <s-table-header>Shop</s-table-header>
                    <s-table-header>Status</s-table-header>
                    <s-table-header>Attempts</s-table-header>
                    <s-table-header>Last Error</s-table-header>
                    <s-table-header>Failed At</s-table-header>
                    <s-table-header>Updated</s-table-header>
                    <s-table-header>Actions</s-table-header>
                </s-table-header-row>
                <s-table-body>
                    {jobs.length === 0 ? (
                        <s-table-row>
                            <s-table-cell colSpan="10">
                                <s-text tone="subdued">No jobs found for this filter.</s-text>
                            </s-table-cell>
                        </s-table-row>
                    ) : (
                        jobs.map((job) => (
                            <s-table-row key={job.id}>
                                <s-table-cell>
                                    {SELECTABLE_STATUSES.includes(job.status) && (
                                        <s-checkbox
                                            checked={selectedIds.includes(job.id)}
                                            onChange={() => onToggleSelect(job.id)}
                                            accessibilityLabel={`Select job #${job.id}`}
                                        ></s-checkbox>
                                    )}
                                </s-table-cell>
                                <s-table-cell>#{job.id}</s-table-cell>
                                <s-table-cell>{job.type}</s-table-cell>
                                <s-table-cell>{job.shop}</s-table-cell>
                                <s-table-cell>
                                    <s-badge tone={STATUS_TONE[job.status] || "neutral"}>
                                        {job.status}
                                    </s-badge>
                                </s-table-cell>
                                <s-table-cell>
                                    {job.attempts} / {job.maxAttempts}
                                    {job.autoRetryCount > 0 && (
                                        <s-text tone="subdued"> (auto x{job.autoRetryCount})</s-text>
                                    )}
                                </s-table-cell>
                                <s-table-cell>
                                    {job.lastError ? (
                                        <s-text tone="critical">
                                            {job.lastError.length > 60
                                                ? job.lastError.slice(0, 60) + "…"
                                                : job.lastError}
                                        </s-text>
                                    ) : (
                                        <s-text tone="subdued">—</s-text>
                                    )}
                                </s-table-cell>
                                <s-table-cell>{formatDate(job.failedAt)}</s-table-cell>
                                <s-table-cell>{formatDate(job.updatedAt)}</s-table-cell>
                                <s-table-cell>
                                    <RowActions job={job} onRequestAction={onRequestAction} />
                                </s-table-cell>
                            </s-table-row>
                        ))
                    )}
                </s-table-body>
            </s-table>
        </s-section>
    );
}
