/**
 * Six stat tiles summarizing claims by status. Counts always come from the
 * loader's unfiltered query, so they stay accurate regardless of the
 * current filter selection.
 */
export function StatsBar({ stats }) {
    const tiles = [
        { label: "Total", tone: "info", value: stats.total ?? 0, sub: "All claims" },
        { label: "New", tone: "info", value: stats.new ?? 0, sub: "Since last visit" },
        { label: "Pending", tone: "warning", value: stats.pending ?? 0, sub: "Awaiting action" },
        { label: "Fulfilled", tone: "info", value: stats.fulfilled ?? 0, sub: "Sent to customer" },
        { label: "Completed", tone: "success", value: stats.completed ?? 0, sub: "Fully delivered" },
        { label: "Cancelled", tone: "critical", value: stats.cancelled ?? 0, sub: "Points refunded" },
    ];

    return (
        <s-grid gridTemplateColumns="1fr 1fr 1fr 1fr 1fr 1fr" gap="base">
            {tiles.map(({ label, tone, value, sub }) => (
                <s-box key={label} padding="base" background="base" borderWidth="base" borderColor="base" borderRadius="base">
                    <s-stack direction="block" gap="small-200">
                        <s-badge tone={tone}>{label}</s-badge>
                        <s-heading>{value}</s-heading>
                        <s-text variant="bodySm" tone="subdued">{sub}</s-text>
                    </s-stack>
                </s-box>
            ))}
        </s-grid>
    );
}
