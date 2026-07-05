export function EventsTable({
    paginatedEvents,
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
                    <s-table-header>Name</s-table-header>
                    <s-table-header>Type</s-table-header>
                    <s-table-header>Description</s-table-header>
                    <s-table-header>Active</s-table-header>
                    <s-table-header>Created</s-table-header>
                    <s-table-header>Actions</s-table-header>
                </s-table-header-row>
                <s-table-body>
                    {paginatedEvents.length === 0 ? (
                        <s-table-row>
                            <s-table-cell colSpan="6" style={{ textAlign: "center", padding: "3rem" }}>
                                No events yet. Click "Add New Event" to create one.
                            </s-table-cell>
                        </s-table-row>
                    ) : (
                        paginatedEvents.map((ev) => (
                            <s-table-row key={ev.id}>
                                <s-table-cell>{ev.name}</s-table-cell>
                                <s-table-cell>{ev.type}</s-table-cell>
                                <s-table-cell>{ev.description || "—"}</s-table-cell>
                                <s-table-cell>{ev.isActive ? "✅ Yes" : "❌ No"}</s-table-cell>
                                <s-table-cell>
                                    {new Date(ev.createdAt).toLocaleDateString()}
                                </s-table-cell>
                                <s-table-cell>
                                    <s-stack gap="small" direction="inline">
                                        <s-button
                                            variant="text" size="small" icon="edit"
                                            disabled={isAnyBusy}
                                            onClick={() => onEdit(ev)}
                                            commandFor="edit-event-modal"
                                            command="--show"
                                        />
                                        <s-button
                                            variant="text" size="small" icon="delete" destructive
                                            disabled={isAnyBusy}
                                            onClick={() => onDelete(ev)}
                                            commandFor="delete-event-modal"
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
