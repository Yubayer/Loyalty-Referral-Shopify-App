import React, { Suspense } from "react";

const ReactApexChart = React.lazy(() => import("react-apexcharts"));

// ─── StatCard ─────────────────────────────────────────────────────────────────

export const StatCard = ({ label, value }) => (
    <s-box padding="base" background="base" border-width="base" border-color="base" border-radius="base">
        <s-stack direction="block" gap="small-200">
            <s-heading tone="subdued">{label}</s-heading>
            <s-text type="strong">
                <s-badge tone="success">{value}</s-badge>
            </s-text>
        </s-stack>
    </s-box>
);

// ─── StatCardNew ──────────────────────────────────────────────────────────────

export const StatCardNew = ({ label, value, color }) => (
    <div style={{
        background:    "var(--p-color-bg-surface-secondary)",
        borderRadius:  "var(--p-border-radius-200)",
        padding:       "1rem",
        borderTop:     `3px solid ${color}`,
    }}>
        <s-heading tone="subdued">{label}</s-heading>
        <s-box paddingBlockEnd="small" />
        <p style={{ fontSize: "22px", fontWeight: 500, margin: 0, color }}>
            {value}
        </p>
    </div>
);

// ─── ChartCard ────────────────────────────────────────────────────────────────

export const ChartCard = ({ heading, chartKey, options, series, type = "bar", height = 300 }) => (
    <s-section heading={heading}>
        <Suspense fallback={
            <s-stack direction="inline" justify-content="center">
                <s-text>Loading chart...</s-text>
                <s-spinner access-label="Loading chart" />
            </s-stack>
        }>
            <ReactApexChart key={chartKey} options={options} series={series} type={type} height={height} />
        </Suspense>
    </s-section>
);
