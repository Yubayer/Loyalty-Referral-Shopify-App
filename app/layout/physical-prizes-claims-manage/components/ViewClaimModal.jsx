import { STATUS_CONFIG, formatDate } from "../_data";

/**
 * Full claim detail modal, plus contextual secondary actions that route
 * into the note modal or the confirm modal (hiding itself first, matching
 * the original inline `() => { viewModalRef.current?.hideOverlay(); ... }`
 * behavior).
 */
export function ViewClaimModal({
    modalRef,
    viewTarget,
    onHide,
    isSubmitting,
    pendingSubmit,
    isBusy,
    onOpenCustomer,
    onOpenNote,
    onOpenConfirm,
}) {
    const hideThenRun = (fn) => () => { modalRef.current?.hideOverlay(); fn(); };

    return (
        <s-modal
            ref={modalRef}
            id="view-claim-modal"
            heading="Claim Details"
            accessibilityLabel="Claim Details"
            onHide={onHide}
        >
            {viewTarget && (() => {
                const vc = viewTarget;
                const sc = STATUS_CONFIG[vc.status] || STATUS_CONFIG.PENDING;
                const customer = vc.customer;
                const prize = vc.prize;
                const fullName = customer?.name || [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "Unknown";

                return (
                    <s-stack direction="block" gap="base">

                        <s-stack direction="inline" gap="base" alignItems="center">
                            {prize?.imageUrl
                                ? <s-thumbnail src={prize.imageUrl} size="large" alt={prize?.title ?? "Prize"} />
                                : <s-thumbnail alt="No image" size="large" />
                            }
                            <s-stack direction="block" gap="small">
                                <s-text variant="headingMd">{prize?.title ?? "—"}</s-text>
                                {prize?.productValue && (
                                    <s-text tone="subdued" variant="bodySm">
                                        Product Value: ${Number(prize.productValue).toLocaleString()}
                                    </s-text>
                                )}
                            </s-stack>
                        </s-stack>

                        <s-divider />

                        <s-stack direction="block" gap="small-200">
                            <s-text variant="headingSm">Customer</s-text>
                            <s-stack direction="inline" gap="small" alignItems="center">
                                <s-text variant="bodyMd">{fullName}</s-text>
                                {customer?.shopifyId && (
                                    <s-button variant="plain" onClick={() => onOpenCustomer(customer.shopifyId)}>
                                        View profile
                                    </s-button>
                                )}
                            </s-stack>
                            <s-text tone="subdued" variant="bodySm">{customer?.email ?? "—"}</s-text>
                            <s-text tone="subdued" variant="bodySm">
                                Current Balance: {Number(customer?.points ?? 0).toLocaleString()} pts
                            </s-text>
                        </s-stack>

                        <s-divider />

                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                            <s-stack direction="block" gap="small-200">
                                <s-text tone="subdued" variant="bodySm">Points Spent</s-text>
                                <s-text variant="headingSm">{Number(vc.pointsCost).toLocaleString()} pts</s-text>
                            </s-stack>
                            <s-stack direction="block" gap="small-200">
                                <s-text tone="subdued" variant="bodySm">Status</s-text>
                                <s-badge tone={sc.tone}>{sc.icon} {sc.label}</s-badge>
                            </s-stack>
                            <s-stack direction="block" gap="small-200">
                                <s-text tone="subdued" variant="bodySm">Claimed On</s-text>
                                <s-text variant="bodySm">{formatDate(vc.createdAt)}</s-text>
                            </s-stack>
                            <s-stack direction="block" gap="small-200">
                                <s-text tone="subdued" variant="bodySm">Fulfilled On</s-text>
                                <s-text variant="bodySm">{formatDate(vc.fulfilledAt)}</s-text>
                            </s-stack>
                            <s-stack direction="block" gap="small-200">
                                <s-text tone="subdued" variant="bodySm">Completed On</s-text>
                                <s-text variant="bodySm">{formatDate(vc.completedAt)}</s-text>
                            </s-stack>
                            <s-stack direction="block" gap="small-200">
                                <s-text tone="subdued" variant="bodySm">First Reviewed</s-text>
                                <s-text variant="bodySm">
                                    {vc.viewedByAdmin ? formatDate(vc.viewedAt) : <s-badge tone="warning" size="small">👁 Not yet reviewed</s-badge>}
                                </s-text>
                            </s-stack>
                        </s-grid>

                        {vc.trackingInfo && (
                            <>
                                <s-divider />
                                <s-stack direction="block" gap="small-200">
                                    <s-text variant="headingSm">🔑 Notes / License / Link</s-text>
                                    <s-text variant="bodySm">{vc.trackingInfo}</s-text>
                                </s-stack>
                            </>
                        )}

                        {vc.adminNote && (
                            <>
                                <s-divider />
                                <s-stack direction="block" gap="small-200">
                                    <s-text variant="headingSm">📝 Admin Note</s-text>
                                    <s-text variant="bodySm" tone="subdued">{vc.adminNote}</s-text>
                                </s-stack>
                            </>
                        )}

                    </s-stack>
                );
            })()}

            <s-button slot="secondary-actions" variant="secondary" commandFor="view-claim-modal" command="--hide">
                Close
            </s-button>

            {/* Secondary action buttons — revert, cancel, note */}
            {viewTarget && (() => {
                const vt = viewTarget;
                const vtBusy = isBusy(vt.id);
                const vtPending = vt.status === "PENDING";
                const vtFulfilled = vt.status === "FULFILLED";
                const vtCompleted = vt.status === "COMPLETED";
                const vtCancelled = vt.status === "CANCELLED";

                return (
                    <>
                        {/* Note button always visible */}
                        <s-button
                            slot="secondary-actions"
                            variant="secondary"
                            disabled={vtBusy}
                            onClick={hideThenRun(() => onOpenNote(vt))}
                        >
                            {vt.adminNote ? "Edit Note" : "Add Note"}
                        </s-button>

                        {/* Cancel — PENDING or FULFILLED */}
                        {(vtPending || vtFulfilled) && (
                            <s-button
                                slot="secondary-actions"
                                variant="secondary"
                                tone="critical"
                                disabled={vtBusy || isSubmitting}
                                onClick={hideThenRun(() => onOpenConfirm(vt, "CANCELLED"))}
                            >
                                Cancel & Refund
                            </s-button>
                        )}

                        {/* Revert buttons */}
                        {vtFulfilled && (
                            <s-button
                                slot="secondary-actions"
                                variant="plain"
                                disabled={vtBusy || isSubmitting}
                                onClick={hideThenRun(() => onOpenConfirm(vt, "REVERT"))}
                            >
                                Revert to Pending
                            </s-button>
                        )}
                        {vtCompleted && (
                            <s-button
                                slot="secondary-actions"
                                variant="plain"
                                disabled={vtBusy || isSubmitting}
                                onClick={hideThenRun(() => onOpenConfirm(vt, "REVERT"))}
                            >
                                Revert to Fulfilled
                            </s-button>
                        )}
                        {vtCancelled && (
                            <s-button
                                slot="secondary-actions"
                                variant="plain"
                                disabled={vtBusy || isSubmitting}
                                onClick={hideThenRun(() => onOpenConfirm(vt, "REVERT"))}
                            >
                                Revert to Pending
                            </s-button>
                        )}

                        {/* Primary action */}
                        {vtPending && (
                            <s-button
                                slot="primary-action"
                                variant="primary"
                                loading={vtBusy && pendingSubmit === "updateClaimStatus"}
                                disabled={vtBusy || isSubmitting}
                                onClick={hideThenRun(() => onOpenConfirm(vt, "FULFILLED"))}
                            >
                                Mark Fulfilled
                            </s-button>
                        )}
                        {vtFulfilled && (
                            <s-button
                                slot="primary-action"
                                variant="primary"
                                loading={vtBusy && pendingSubmit === "updateClaimStatus"}
                                disabled={vtBusy || isSubmitting}
                                onClick={hideThenRun(() => onOpenConfirm(vt, "COMPLETED"))}
                            >
                                Mark Completed
                            </s-button>
                        )}
                    </>
                );
            })()}
        </s-modal>
    );
}
