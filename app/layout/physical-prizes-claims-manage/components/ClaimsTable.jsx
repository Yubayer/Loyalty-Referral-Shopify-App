import Pagination from "@app/components/pagination/Pagination";
import { STATUS_CONFIG, formatDate } from "../_data";

/**
 * Main claims table — selection checkboxes (PENDING/FULFILLED rows only),
 * prize/customer/points/date columns, status badges (including New /
 * Unreviewed / Note indicators), a "View" action, and pagination.
 */
export function ClaimsTable({
    claims,
    selectablePage,
    allPageSelected,
    onToggleSelectAllPage,
    selectedIds,
    onToggleSelect,
    isSubmitting,
    isBusy,
    newClaimIds,
    optimisticViewedIds,
    onOpenCustomer,
    onView,
    currentPage,
    totalPages,
    totalItems,
    perPage,
    startIndex,
    setCurrentPage,
    setPerPage,
}) {
    return (
        <s-section padding="none">
            <s-table>
                <s-table-header-row>
                    <s-table-header>
                        {selectablePage.length > 0 && (
                            <input
                                type="checkbox"
                                checked={allPageSelected}
                                onChange={onToggleSelectAllPage}
                                title="Select all pending/fulfilled on this page"
                            />
                        )}
                    </s-table-header>
                    <s-table-header>Prize</s-table-header>
                    <s-table-header>Customer</s-table-header>
                    <s-table-header>Points Spent</s-table-header>
                    <s-table-header>Claimed On</s-table-header>
                    <s-table-header>Fulfilled On</s-table-header>
                    <s-table-header>Completed On</s-table-header>
                    <s-table-header>Status</s-table-header>
                    <s-table-header>Actions</s-table-header>
                </s-table-header-row>
                <s-table-body>
                    {claims.length === 0 ? (
                        <s-table-row>
                            <s-table-cell colSpan="9">
                                <s-text tone="subdued">No claims found.</s-text>
                            </s-table-cell>
                        </s-table-row>
                    ) : (
                        claims.map((claim) => {
                            const sc = STATUS_CONFIG[claim.status] || STATUS_CONFIG.PENDING;
                            const busy = isBusy(claim.id);
                            const { customer, prize } = claim;
                            const fullName = customer?.name || [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "Unknown";
                            const isPending = claim.status === "PENDING";
                            const isFulfilled = claim.status === "FULFILLED";
                            const isSelectable = isPending || isFulfilled;
                            const isNew = newClaimIds.current.has(claim.id);

                            return (
                                <s-table-row key={claim.id}>

                                    {/* Checkbox */}
                                    <s-table-cell>
                                        {isSelectable && (
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(claim.id)}
                                                onChange={() => onToggleSelect(claim.id)}
                                                disabled={isSubmitting}
                                            />
                                        )}
                                    </s-table-cell>

                                    {/* Prize */}
                                    <s-table-cell>
                                        <s-stack direction="inline" gap="small" alignItems="center">
                                            {prize?.imageUrl
                                                ? <s-thumbnail src={prize.imageUrl} size="small" alt={prize.title ?? "Prize"} />
                                                : <s-thumbnail alt="No image" size="small" />
                                            }
                                            <s-stack direction="block" gap="none">
                                                <s-text variant="headingSm">{prize?.title ?? "—"}</s-text>
                                                {prize?.productValue && (
                                                    <s-text tone="subdued" variant="bodySm">
                                                        Value: ${Number(prize.productValue).toLocaleString()}
                                                    </s-text>
                                                )}
                                            </s-stack>
                                        </s-stack>
                                    </s-table-cell>

                                    {/* Customer */}
                                    <s-table-cell>
                                        <s-stack direction="block" gap="none">
                                            <s-stack direction="inline" gap="small" alignItems="center">
                                                <s-text variant="headingSm">{fullName}</s-text>
                                                {customer?.shopifyId && (
                                                    <s-button variant="plain" disabled={busy} onClick={() => onOpenCustomer(customer.shopifyId)}>
                                                        View profile
                                                    </s-button>
                                                )}
                                            </s-stack>
                                            <s-text tone="subdued" variant="bodySm">{customer?.email ?? "—"}</s-text>
                                        </s-stack>
                                    </s-table-cell>

                                    {/* Points */}
                                    <s-table-cell>
                                        <s-text variant="headingSm">
                                            {Number(claim.pointsCost).toLocaleString()} pts
                                        </s-text>
                                    </s-table-cell>

                                    {/* Claimed date */}
                                    <s-table-cell>
                                        <s-text tone="subdued" variant="bodySm">{formatDate(claim.createdAt)}</s-text>
                                    </s-table-cell>

                                    {/* Fulfilled date */}
                                    <s-table-cell>
                                        <s-text tone="subdued" variant="bodySm">{formatDate(claim.fulfilledAt)}</s-text>
                                    </s-table-cell>

                                    {/* Completed date */}
                                    <s-table-cell>
                                        <s-text tone="subdued" variant="bodySm">{formatDate(claim.completedAt)}</s-text>
                                    </s-table-cell>

                                    {/* Status */}
                                    <s-table-cell>
                                        <s-stack direction="block" gap="small-300">
                                            <s-badge tone={sc.tone}>{sc.icon} {sc.label}</s-badge>
                                            {isNew && <s-badge tone="info" size="small">New</s-badge>}
                                            {!claim.viewedByAdmin && !optimisticViewedIds.has(claim.id) && !isNew && <s-badge tone="warning" size="small">👁 Unreviewed</s-badge>}
                                            {claim.adminNote && <s-badge tone="attention" size="small">📝 Note</s-badge>}
                                        </s-stack>
                                    </s-table-cell>

                                    {/* Actions */}
                                    <s-table-cell>
                                        <s-button variant="plain" onClick={() => onView(claim)}>
                                            {isNew ? "👁 View (New)" : "👁 View"}
                                        </s-button>
                                    </s-table-cell>

                                </s-table-row>
                            );
                        })
                    )}
                </s-table-body>
            </s-table>

            <s-divider />

            <s-box paddingBlockEnd="base" paddingInline="base">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    perPage={perPage}
                    startIndex={startIndex}
                    setCurrentPage={setCurrentPage}
                    setPerPage={setPerPage}
                    label="claims"
                />
            </s-box>
        </s-section>
    );
}
