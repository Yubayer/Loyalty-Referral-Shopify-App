/**
 * One shared modal for fulfill / complete / cancel / revert confirmations.
 * All heading/body copy is derived from `confirmTarget` (set by openConfirm
 * in _hooks.js as `{ claim, action }`).
 */
export function ConfirmActionModal({
    modalRef,
    confirmTarget,
    trackingInput,
    onTrackingInputChange,
    isSubmitting,
    onConfirm,
    onHide,
}) {
    const confirmAction = confirmTarget?.action;
    const isCancelling = confirmAction === "CANCELLED";
    const isReverting = confirmAction === "REVERT";
    const isFulfilling = confirmAction === "FULFILLED";
    const isCompleting = confirmAction === "COMPLETED";
    const pts = Number(confirmTarget?.claim?.pointsCost ?? 0).toLocaleString();
    const prizeTitle = confirmTarget?.claim?.prize?.title ?? "this prize";
    const customerName = confirmTarget?.claim?.customer?.name
        || [confirmTarget?.claim?.customer?.firstName, confirmTarget?.claim?.customer?.lastName].filter(Boolean).join(" ")
        || "the customer";
    const customerPoints = Number(confirmTarget?.claim?.customer?.points ?? 0);
    const revertCost = Number(confirmTarget?.claim?.pointsCost ?? 0);
    const isCancelledRevert = confirmTarget?.claim?.status === "CANCELLED";
    const notEnoughPoints = isReverting && isCancelledRevert && customerPoints < revertCost;

    const revertLabel = confirmTarget?.claim?.status === "COMPLETED"
        ? "Revert to Fulfilled"
        : "Revert to Pending";

    const modalHeading = isCancelling ? "Cancel Prize Request"
        : isReverting ? revertLabel
            : isCompleting ? "Mark as Completed"
                : "Mark as Fulfilled";

    return (
        <s-modal
            ref={modalRef}
            id="confirm-claim-modal"
            heading={modalHeading}
            accessibilityLabel={modalHeading}
            onHide={onHide}
        >
            <s-stack direction="block" gap="base">
                {isCancelling && (
                    <s-banner tone="warning" heading="Points will be refunded">
                        {pts} points will be returned to {customerName}'s account automatically.
                    </s-banner>
                )}
                {isReverting && isCancelledRevert && notEnoughPoints && (
                    <s-banner tone="critical" heading="Insufficient points">
                        {customerName} only has {customerPoints.toLocaleString()} pts but {revertCost.toLocaleString()} pts are needed. Cannot revert.
                    </s-banner>
                )}
                {isReverting && isCancelledRevert && !notEnoughPoints && (
                    <s-banner tone="warning" heading="Points will be deducted">
                        {pts} points will be deducted from {customerName}'s account again.
                    </s-banner>
                )}
                {isCompleting && (
                    <s-banner tone="success" heading="Final confirmation">
                        This will mark the prize as fully delivered and completed.
                    </s-banner>
                )}
                <s-text>
                    {isCancelling
                        ? `Are you sure you want to cancel the request for "${prizeTitle}"? Points will be refunded.`
                        : isReverting
                            ? confirmTarget?.claim?.status === "COMPLETED"
                                ? `Revert "${prizeTitle}" back to fulfilled?`
                                : confirmTarget?.claim?.status === "FULFILLED"
                                    ? `Revert "${prizeTitle}" back to pending?`
                                    : `Revert "${prizeTitle}" back to pending? ${pts} points will be deducted from ${customerName}.`
                            : isCompleting
                                ? `Mark "${prizeTitle}" by ${customerName} as completed?`
                                : `Mark "${prizeTitle}" by ${customerName} as fulfilled?`
                    }
                </s-text>
                {isFulfilling && (
                    <s-text-field
                        label="Notes / License key / Download link (optional)"
                        placeholder="e.g. License key: XXXX-XXXX-XXXX"
                        value={trackingInput}
                        onChange={(e) => onTrackingInputChange(e.currentTarget.value)}
                    />
                )}
            </s-stack>
            <s-button slot="secondary-actions" variant="secondary" commandFor="confirm-claim-modal" command="--hide" disabled={isSubmitting}>
                Go Back
            </s-button>
            <s-button
                slot="primary-action"
                variant="primary"
                tone={isCancelling ? "critical" : undefined}
                onClick={onConfirm}
                loading={isSubmitting}
                disabled={isSubmitting || notEnoughPoints}
            >
                {isCancelling
                    ? `Cancel & Refund ${pts} pts`
                    : isReverting
                        ? isCancelledRevert ? `Revert & Deduct ${pts} pts` : revertLabel
                        : isCompleting
                            ? "Mark as Completed"
                            : "Mark as Fulfilled"
                }
            </s-button>
        </s-modal>
    );
}
