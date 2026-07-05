function StatBox({ label, value }) {
    return (
        <s-box padding="base" border="base" borderRadius="base" background="base">
            <s-heading>{label}</s-heading>
            <h3 style={{ marginBlock: "4px 0" }}>{value}</h3>
        </s-box>
    );
}

export function StatsGrid({ customer }) {
    return (
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <StatBox label="Current Points"       value={(customer?.points        ?? 0).toLocaleString()} />
            <StatBox label="Lifetime Points"      value={(customer?.lifetimePoints ?? 0).toLocaleString()} />
            <StatBox label="Activities Completed" value={customer?.transactions?.length ?? 0} />
            <StatBox label="Rewards Claimed"      value={customer?.rewards?.length       ?? 0} />
            <StatBox label="Total Orders"         value={customer?.orderCount            ?? "N/A"} />
            <StatBox label="Referrals Used"       value={customer?.referralsUsed?.status ?? "N/A"} />
        </s-grid>
    );
}
