import { getPointsSummary, getAppliestoSummary } from "../_data";

export function RulesTable({
    paginatedRules,
    isDeleting,
    currentPage,
    totalPages,
    setCurrentPage,
    getEventName,
    onEdit,
    onDeleteClick,
}) {
    return (
        <s-section>
            <s-table>
                <s-table-header-row>
                    <s-table-header>Rule Name</s-table-header>
                    <s-table-header>Event</s-table-header>
                    <s-table-header>Earning</s-table-header>
                    <s-table-header>Scope</s-table-header>
                    <s-table-header>Active</s-table-header>
                    <s-table-header>Actions</s-table-header>
                </s-table-header-row>
                <s-table-body>
                    {paginatedRules.length === 0 ? (
                        <s-table-row>
                            <s-table-cell colSpan="6" style={{ textAlign: "center", padding: "3rem" }}>
                                No rules yet. Click "Add New Rule" to get started.
                            </s-table-cell>
                        </s-table-row>
                    ) : (
                        paginatedRules.map((r) => (
                            <s-table-row key={r.id}>
                                <s-table-cell>
                                    {r.name || getEventName(r.eventId)}
                                </s-table-cell>
                                <s-table-cell>
                                    <s-badge>{r.event?.type || "—"}</s-badge>
                                </s-table-cell>
                                <s-table-cell>
                                    <s-text>{getPointsSummary(r)}</s-text>
                                </s-table-cell>
                                <s-table-cell>
                                    <s-text tone="subdued">{getAppliestoSummary(r)}</s-text>
                                </s-table-cell>
                                <s-table-cell>
                                    {r.isActive ? "✅ Yes" : "❌ No"}
                                </s-table-cell>
                                <s-table-cell>
                                    <s-stack direction="inline" gap="small">
                                        <s-button
                                            variant="text"
                                            size="small"
                                            icon="edit"
                                            disabled={isDeleting}
                                            onClick={() => onEdit(r)}
                                        />
                                        <s-button
                                            variant="text"
                                            size="small"
                                            icon="delete"
                                            destructive
                                            disabled={isDeleting}
                                            onClick={() => onDeleteClick(r)}
                                            commandFor="delete-modal"
                                            command="--show"
                                        />
                                    </s-stack>
                                </s-table-cell>
                            </s-table-row>
                        ))
                    )}
                </s-table-body>
            </s-table>

            {/* Pagination */}
            {totalPages > 1 && (
                <s-stack
                    direction="inline"
                    justifyContent="center"
                    gap="small"
                    style={{ marginBlockStart: "1rem" }}
                >
                    <s-button
                        variant="plain"
                        disabled={currentPage === 1 || isDeleting}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                        ← Prev
                    </s-button>
                    <s-text>Page {currentPage} of {totalPages}</s-text>
                    <s-button
                        variant="plain"
                        disabled={currentPage === totalPages || isDeleting}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                        Next →
                    </s-button>
                </s-stack>
            )}
        </s-section>
    );
}
