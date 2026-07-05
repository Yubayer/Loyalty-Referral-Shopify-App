/**
 * @file app.dashboard/route.jsx
 *
 * Thin composition layer — loader + page layout only.
 *
 *   _loader.server.js  → prisma queries
 *   _hooks.js          → all state, chart logic, date range helpers (self-contained)
 *   components/
 *     Cards.jsx              → StatCard, StatCardNew, ChartCard
 *     DateRangePicker.jsx    → preset picker + calendar
 *     OverviewSection.jsx    → points / rewards / customers stat cards
 *     PrizeStatsSection.jsx  → physical prize claim stat cards
 *     ChartsSection.jsx      → points activity + rewards charts
 *     PrizeChartsSection.jsx → prize claim volume + points spent chart
 */

import { useLoaderData } from "react-router";
import { authenticate } from "shopify-server";

import { loadDashboardData } from "./_loader.server";
import { useDashboardPage } from "./_hooks";
import { DateRangePicker } from "./components/DateRangePicker";
import { OverviewSection } from "./components/OverviewSection";
import { PrizeStatsSection } from "./components/PrizeStatsSection";
import { ChartsSection } from "./components/ChartsSection";
import { PrizeChartsSection } from "./components/PrizeChartsSection";

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    return loadDashboardData(session.id);
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
    const loaderData = useLoaderData();
    const page = useDashboardPage(loaderData);

    return (
        <s-page>

            <DateRangePicker
                preset={page.preset}           onPresetChange={page.setPreset}
                customStart={page.customStart} customEnd={page.customEnd}
                onCustomApply={page.handleCustomApply}
                granularity={page.granularity}
                labelCount={page.labelCount}
                interval={page.interval}       onIntervalChange={page.handleIntervalChange}
            />

            <OverviewSection  stats={page.overviewStats} />

            <PrizeStatsSection stats={page.prizeStats} />

            <ChartsSection
                chartData={page.chartData}
                rangeKey={page.rangeKey}
                chartOptions={page.chartOptions}
            />

            <PrizeChartsSection
                chartData={page.chartData}
                rangeKey={page.rangeKey}
                chartOptions={page.chartOptions}
            />

        </s-page>
    );
}
