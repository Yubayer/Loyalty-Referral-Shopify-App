/**
 * Appears once at least one row is selected. Available bulk actions are
 * derived from the statuses present in the current selection.
 */
export function BulkActionBar({ claims, selectedIds, isSubmitting, onBulkAction, onClearSelection }) {
    if (selectedIds.size === 0) return null;

    const selected = claims.filter((c) => selectedIds.has(c.id));
    const hasAnyPending = selected.some((c) => c.status === "PENDING");
    const hasAnyFulfilled = selected.some((c) => c.status === "FULFILLED");
    const hasAnyCancellable = selected.some((c) => ["PENDING", "FULFILLED"].includes(c.status));

    return (
        <s-section>
            <s-banner tone="info" heading={`${selectedIds.size} claim${selectedIds.size > 1 ? "s" : ""} selected`}>
                <s-stack direction="inline" gap="small" alignItems="center">
                    {hasAnyPending && (
                        <s-button variant="primary" disabled={isSubmitting} onClick={() => onBulkAction("FULFILLED")}>
                            Mark All Fulfilled
                        </s-button>
                    )}
                    {hasAnyFulfilled && (
                        <s-button variant="primary" disabled={isSubmitting} onClick={() => onBulkAction("COMPLETED")}>
                            Mark All Completed
                        </s-button>
                    )}
                    {hasAnyCancellable && (
                        <s-button variant="secondary" tone="critical" disabled={isSubmitting} onClick={() => onBulkAction("CANCELLED")}>
                            Cancel All & Refund
                        </s-button>
                    )}
                    <s-button variant="plain" onClick={onClearSelection}>
                        Clear selection
                    </s-button>
                </s-stack>
            </s-banner>
        </s-section>
    );
}
