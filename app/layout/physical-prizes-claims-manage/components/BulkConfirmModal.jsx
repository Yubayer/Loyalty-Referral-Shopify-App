/**
 * Confirmation modal for bulk fulfill / complete / cancel actions across
 * every selected claim.
 */
export function BulkConfirmModal({
    modalRef,
    bulkAction,
    selectedIds,
    isSubmitting,
    onConfirm,
    onHide,
}) {
    return (
        <s-modal
            ref={modalRef}
            id="bulk-claim-modal"
            heading={
                bulkAction === "FULFILLED" ? "Bulk Mark Fulfilled" :
                    bulkAction === "COMPLETED" ? "Bulk Mark Completed" :
                        "Bulk Cancel & Refund"
            }
            accessibilityLabel="Bulk action"
            onHide={onHide}
        >
            <s-stack direction="block" gap="base">
                {bulkAction === "CANCELLED" && (
                    <s-banner tone="warning" heading="Points will be refunded">
                        Points will be refunded to all selected customers automatically.
                    </s-banner>
                )}
                <s-text>
                    {bulkAction === "FULFILLED"
                        ? `Mark ${selectedIds.size} pending claim${selectedIds.size > 1 ? "s" : ""} as fulfilled?`
                        : bulkAction === "COMPLETED"
                            ? `Mark ${selectedIds.size} fulfilled claim${selectedIds.size > 1 ? "s" : ""} as completed?`
                            : `Cancel ${selectedIds.size} claim${selectedIds.size > 1 ? "s" : ""} and refund points?`
                    }
                </s-text>
                <s-text tone="subdued" variant="bodySm">
                    {bulkAction === "FULFILLED" ? "Only PENDING claims will be updated. Others will be skipped." :
                        bulkAction === "COMPLETED" ? "Only FULFILLED claims will be updated. Others will be skipped." :
                            "Only PENDING and FULFILLED claims will be cancelled. Others will be skipped."}
                </s-text>
            </s-stack>
            <s-button slot="secondary-actions" variant="secondary" commandFor="bulk-claim-modal" command="--hide" disabled={isSubmitting}>
                Go Back
            </s-button>
            <s-button
                slot="primary-action"
                variant="primary"
                tone={bulkAction === "CANCELLED" ? "critical" : undefined}
                onClick={onConfirm}
                loading={isSubmitting}
                disabled={isSubmitting}
            >
                {bulkAction === "FULFILLED"
                    ? `Fulfill ${selectedIds.size} Claims`
                    : bulkAction === "COMPLETED"
                        ? `Complete ${selectedIds.size} Claims`
                        : `Cancel ${selectedIds.size} Claims`
                }
            </s-button>
        </s-modal>
    );
}
