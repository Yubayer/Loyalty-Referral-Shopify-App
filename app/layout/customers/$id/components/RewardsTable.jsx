import Pagination from "@components/pagination/Pagination";

export function RewardsTable({ pagination }) {
    const { paginatedData: rewards } = pagination;

    return (
        <s-section>
            <h3 style={{ marginTop: 0 }}>Rewards History</h3>
            <s-table>
                <s-table-header-row>
                    <s-table-header>Date</s-table-header>
                    <s-table-header>Title</s-table-header>
                    <s-table-header>Type</s-table-header>
                    <s-table-header>Points Cost</s-table-header>
                    <s-table-header>Status</s-table-header>
                </s-table-header-row>
                <s-table-body>
                    {rewards.length === 0 ? (
                        <s-table-row>
                            <s-table-cell colSpan={5} style={{ textAlign: "center", color: "var(--p-color-text-secondary, #6d7175)" }}>
                                No rewards found.
                            </s-table-cell>
                        </s-table-row>
                    ) : rewards.map((rw) => (
                        <s-table-row key={rw.id}>
                            <s-table-cell>{new Date(rw.createdAt).toLocaleDateString()}</s-table-cell>
                            <s-table-cell>{rw.title ?? "—"}</s-table-cell>
                            <s-table-cell>{rw.type  ?? "—"}</s-table-cell>
                            <s-table-cell>{(rw.pointsCost ?? 0).toLocaleString()}</s-table-cell>
                            <s-table-cell>{rw.status ?? "—"}</s-table-cell>
                        </s-table-row>
                    ))}
                </s-table-body>
            </s-table>
            <Pagination {...pagination} label="rewards" />
        </s-section>
    );
}
