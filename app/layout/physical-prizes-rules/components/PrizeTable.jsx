/**
 * Prizes table for the list view — image, title/description, value,
 * points cost, active flag, edit/delete actions, plus pagination.
 */
export function PrizeTable({
    prizes,
    currentPage,
    totalPages,
    isAnyBusy,
    onEdit,
    onRequestDelete,
    onPageChange,
}) {
    return (
        <s-section>
            <s-table>
                <s-table-header-row>
                    <s-table-header>Image</s-table-header>
                    <s-table-header>Title</s-table-header>
                    <s-table-header>Product Value</s-table-header>
                    <s-table-header>Points Cost</s-table-header>
                    <s-table-header>Active</s-table-header>
                    <s-table-header>Actions</s-table-header>
                </s-table-header-row>
                <s-table-body>
                    {prizes.length === 0 ? (
                        <s-table-row>
                            <s-table-cell colSpan="6" style={{ textAlign: "center", padding: "3rem" }}>
                                No prizes yet. Click "Add New Prize" to get started.
                            </s-table-cell>
                        </s-table-row>
                    ) : (
                        prizes.map((p) => (
                            <s-table-row key={p.id}>
                                <s-table-cell>
                                    {p.imageUrl ? (
                                        <img
                                            src={p.imageUrl} alt={p.title}
                                            style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px" }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: "48px", height: "48px", borderRadius: "6px",
                                            background: "#f0f0f0", display: "flex",
                                            alignItems: "center", justifyContent: "center", fontSize: "20px",
                                        }}>🎁</div>
                                    )}
                                </s-table-cell>
                                <s-table-cell>
                                    <s-text variant="headingSm">{p.title}</s-text>
                                    {p.description && (
                                        <s-text tone="subdued" variant="bodySm">
                                            {p.description.length > 60 ? p.description.slice(0, 60) + "…" : p.description}
                                        </s-text>
                                    )}
                                </s-table-cell>
                                <s-table-cell>
                                    {p.productValue ? `$${Number(p.productValue).toLocaleString()}` : "—"}
                                </s-table-cell>
                                <s-table-cell>
                                    <strong>{Number(p.pointsCost).toLocaleString()} pts</strong>
                                </s-table-cell>
                                <s-table-cell>{p.isActive ? "✅ Yes" : "❌ No"}</s-table-cell>
                                <s-table-cell>
                                    <s-stack gap="small" direction="inline">
                                        <s-button
                                            variant="text" size="small" icon="edit"
                                            disabled={isAnyBusy} onClick={() => onEdit(p)}
                                        />
                                        <s-button
                                            variant="text" size="small" icon="delete" destructive
                                            disabled={isAnyBusy}
                                            onClick={() => onRequestDelete(p)}
                                            commandFor="delete-prize-modal" command="--show"
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
                        variant="plain" disabled={currentPage === 1 || isAnyBusy}
                        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    >← Prev</s-button>
                    <s-text>Page {currentPage} of {totalPages}</s-text>
                    <s-button
                        variant="plain" disabled={currentPage === totalPages || isAnyBusy}
                        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    >Next →</s-button>
                </s-stack>
            )}
        </s-section>
    );
}
