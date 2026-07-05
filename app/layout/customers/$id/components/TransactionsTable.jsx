import Pagination from "@components/pagination/Pagination";

export function TransactionsTable({ pagination }) {
    const { paginatedData: transactions } = pagination;

    return (
        <s-section>
            <h3 style={{ marginTop: 0 }}>Transaction History</h3>
            <s-table>
                <s-table-header-row>
                    <s-table-header>Date</s-table-header>
                    <s-table-header>Type</s-table-header>
                    <s-table-header>Points</s-table-header>
                    <s-table-header>Balance After</s-table-header>
                    <s-table-header>Note</s-table-header>
                </s-table-header-row>
                <s-table-body>
                    {transactions.length === 0 ? (
                        <s-table-row>
                            <s-table-cell colSpan={5} style={{ textAlign: "center", color: "var(--p-color-text-secondary, #6d7175)" }}>
                                No transactions found.
                            </s-table-cell>
                        </s-table-row>
                    ) : transactions.map((tx) => (
                        <s-table-row key={tx.id}>
                            <s-table-cell>{new Date(tx.createdAt).toLocaleDateString()}</s-table-cell>
                            <s-table-cell>{tx.event?.type ?? tx.type}</s-table-cell>
                            <s-table-cell style={{ color: tx.points >= 0 ? "#1D9E75" : "#E24B4A", fontWeight: 500 }}>
                                {tx.points >= 0 ? "+" : ""}{tx.points.toLocaleString()}
                            </s-table-cell>
                            <s-table-cell>{tx.balanceAfter.toLocaleString()}</s-table-cell>
                            <s-table-cell>{tx.reason ?? "—"}</s-table-cell>
                        </s-table-row>
                    ))}
                </s-table-body>
            </s-table>
            <Pagination {...pagination} label="transactions" />
        </s-section>
    );
}
