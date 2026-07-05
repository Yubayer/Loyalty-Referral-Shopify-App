/**
 * @file Cards.jsx
 * Reusable display components — StatCard and ChartCard.
 * Both are purely presentational with no state or data fetching.
 */

import React, { Suspense } from "react";

const ReactApexChart = React.lazy(() => import("react-apexcharts"));

// ─── StatCard ─────────────────────────────────────────────────────────────────

/**
 * A single summary metric card.
 *
 * @param {Object} props
 * @param {string} props.label - Metric name (e.g. "Points earned")
 * @param {string} props.value - Pre-formatted value (e.g. "3,300")
 *
 * @example
 * <StatCard label="Points earned" value={stats.pointsEarned.toLocaleString()} />
 */
export const StatCard = ({ label, value }) => (
    <s-box
        padding="base"
        background="base"
        border-width="base"
        border-color="base"
        border-radius="base"
    >
        <s-stack direction="block" gap="small-200">
            <s-heading tone="subdued">{label}</s-heading>
            <s-text type="strong">
                <s-badge tone="success">{value}</s-badge>
            </s-text>
        </s-stack>
    </s-box>
);


export const StatCardNew = ({ label, value, color }) => {
    return (
        <div style={{
            background: "var(--p-color-bg-surface-secondary)",
            borderRadius: "var(--p-border-radius-200)",
            padding: "1rem",
            borderTop: `3px solid ${color}`,
        }}>
            <s-heading tone="subdued">{label}</s-heading>
            <s-box paddingBlockEnd="small" />
            <p style={{ fontSize: "22px", fontWeight: 500, margin: 0, color }}>
                {value}
            </p>
        </div>
    );
}

// ─── ChartCard ────────────────────────────────────────────────────────────────

/**
 * Reusable chart container wrapped in an <s-section>.
 *
 * The `chartKey` prop forces ApexCharts to fully remount when the range
 * or interval changes, preventing stale series renders.
 *
 * @param {Object}   props
 * @param {string}   props.heading    - Section heading
 * @param {string}   props.chartKey   - Unique remount key
 * @param {Object}   props.options    - ApexCharts options (from makeChartOptions)
 * @param {Object[]} props.series     - ApexCharts series [{ name, data }]
 * @param {string}   [props.type]     - Chart type (default: "bar")
 * @param {number}   [props.height]   - Height in px (default: 300)
 *
 * @example
 * <ChartCard
 *   heading="Points activity"
 *   chartKey={`points-${rangeKey}`}
 *   options={makeChartOptions(["#1D9E75", "#E24B4A"], labels)}
 *   series={[
 *     { name: "Earned",   data: chartData.earned   },
 *     { name: "Redeemed", data: chartData.redeemed },
 *   ]}
 *   type="bar"
 *   height={320}
 * />
 */
export const ChartCard = ({
    heading,
    chartKey,
    options,
    series,
    type = "bar",
    height = 300,
}) => (
    <s-section heading={heading}>
        <Suspense fallback={
            <s-stack direction="inline" justify-content="center">
                <s-text>Loading chart...</s-text>
                <s-spinner access-label="Loading chart" />
            </s-stack>
        }>
            <ReactApexChart
                key={chartKey}
                options={options}
                series={series}
                type={type}
                height={height}
            />
        </Suspense>
    </s-section>
);