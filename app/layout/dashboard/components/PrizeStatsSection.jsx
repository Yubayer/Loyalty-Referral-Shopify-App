import { StatCardNew } from "./Cards";

const COLORS = {
    total:     "#534AB7",
    pending:   "#BA7517",
    fulfilled: "#378ADD",
    completed: "#1D9E75",
    cancelled: "#E24B4A",
};

export function PrizeStatsSection({ stats }) {
    return (
        <s-section heading="Physical Prizes">
            <s-query-container>
                <s-grid
                    gridTemplateColumns="@container (inline-size > 600px) 1fr 1fr 1fr 1fr 1fr, 1fr"
                    gap="base"
                >
                    <s-grid-item><StatCardNew label="Total claims" value={stats.total.toLocaleString()}     color={COLORS.total}     /></s-grid-item>
                    <s-grid-item><StatCardNew label="Pending"      value={stats.pending.toLocaleString()}   color={COLORS.pending}   /></s-grid-item>
                    <s-grid-item><StatCardNew label="Fulfilled"    value={stats.fulfilled.toLocaleString()} color={COLORS.fulfilled} /></s-grid-item>
                    <s-grid-item><StatCardNew label="Completed"    value={stats.completed.toLocaleString()} color={COLORS.completed} /></s-grid-item>
                    <s-grid-item><StatCardNew label="Cancelled"    value={stats.cancelled.toLocaleString()} color={COLORS.cancelled} /></s-grid-item>
                </s-grid>
            </s-query-container>
        </s-section>
    );
}
