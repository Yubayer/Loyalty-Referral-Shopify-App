import { previewTitle, formatDiscount } from "../_data";

// ─────────────────────────────────────────────────────────────────────────────
// RULES TABLE
//
// Paginated list of reward rules with edit / delete row actions.
// ─────────────────────────────────────────────────────────────────────────────

export function RulesTable({
    paginatedRules,
    isAnyBusy,
    currentPage,
    totalPages,
    setCurrentPage,
    onEdit,
    onDelete,
}) {
    return (
        <s-section>
            <s-table>
                <s-table-header-row>
                    <s-table-header>Title</s-table-header>
                    <s-table-header>Points Cost</s-table-header>
                    <s-table-header>Discount Type</s-table-header>
                    <s-table-header>Value</s-table-header>
                    <s-table-header>Active</s-table-header>
                    <s-table-header>Actions</s-table-header>
                </s-table-header-row>
                <s-table-body>
                    {paginatedRules.length === 0 ? (
                        <s-table-row>
                            <s-table-cell colSpan="6" style={{ textAlign: "center", padding: "3rem" }}>
                                No reward rules yet. Click "Create New Rule" to get started.
                            </s-table-cell>
                        </s-table-row>
                    ) : (
                        paginatedRules.map((r) => (
                            <s-table-row key={r.id}>
                                <s-table-cell>
                                    <s-heading>{previewTitle(r.title, r.discountType, r.rewardValue)}</s-heading>
                                </s-table-cell>
                                <s-table-cell>{r.pointsCost} pts</s-table-cell>
                                <s-table-cell>{r.discountType}</s-table-cell>
                                <s-table-cell>{formatDiscount(r.discountType, r.rewardValue)}</s-table-cell>
                                <s-table-cell>{r.isActive ? "✅ Yes" : "❌ No"}</s-table-cell>
                                <s-table-cell>
                                    <s-stack gap="small" direction="inline">
                                        <s-button
                                            variant="text" size="small" icon="edit"
                                            disabled={isAnyBusy}
                                            onClick={() => onEdit(r)}
                                        />
                                        <s-button
                                            variant="text" size="small" icon="delete" destructive
                                            disabled={isAnyBusy}
                                            onClick={() => onDelete(r)}
                                            commandFor="delete-reward-modal"
                                            command="--show"
                                        />
                                    </s-stack>
                                </s-table-cell>
                            </s-table-row>
                        ))
                    )}
                </s-table-body>
            </s-table>

            {totalPages > 1 && (
                <s-stack direction="inline" justifyContent="center" gap="small" style={{ marginBlockStart: "1rem" }}>
                    <s-button
                        variant="plain"
                        disabled={currentPage === 1 || isAnyBusy}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                        ← Prev
                    </s-button>
                    <s-text>Page {currentPage} of {totalPages}</s-text>
                    <s-button
                        variant="plain"
                        disabled={currentPage === totalPages || isAnyBusy}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                        Next →
                    </s-button>
                </s-stack>
            )}
        </s-section>
    );
}
