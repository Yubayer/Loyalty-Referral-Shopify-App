import { useState, useMemo, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Date range helpers (inlined from utils/dateRange.js)
// ─────────────────────────────────────────────────────────────────────────────

export const DATE_PRESETS = [
    { label: "Today",          value: "today" },
    { label: "Yesterday",      value: "yesterday" },
    { label: "Last 3 days",    value: "last_3_days" },
    { label: "Last 7 days",    value: "last_7_days" },
    { label: "This week",      value: "this_week" },
    { label: "Past week",      value: "past_week" },
    { label: "Last 15 days",   value: "last_15_days" },
    { label: "Last 30 days",   value: "last_30_days" },
    { label: "This month",     value: "this_month" },
    { label: "Last month",     value: "last_month" },
    { label: "Last 3 months",  value: "last_3_months" },
    { label: "Last 6 months",  value: "last_6_months" },
    { label: "This year",      value: "this_year" },
    { label: "Last year",      value: "last_year" },
    { label: "Custom range",   value: "custom" },
];

const DEFAULT_PRESET = "last_7_days";

export const TOMORROW_STR = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
})();

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const dayEnd   = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

function getPresetRange(preset) {
    const now   = new Date();
    const today = dayStart(now);
    const end   = dayEnd(now);
    const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };

    switch (preset) {
        case "today":         return { start: today, end };
        case "yesterday":     return { start: daysAgo(1), end: dayEnd(daysAgo(1)) };
        case "last_3_days":   return { start: daysAgo(2), end };
        case "last_7_days":   return { start: daysAgo(6), end };
        case "last_15_days":  return { start: daysAgo(14), end };
        case "last_30_days":  return { start: daysAgo(29), end };
        case "this_week": {
            const s = new Date(today); s.setDate(s.getDate() - s.getDay());
            return { start: s, end };
        }
        case "past_week": {
            const sat = new Date(today); sat.setDate(sat.getDate() - sat.getDay() - 1);
            const sun = new Date(sat);   sun.setDate(sun.getDate() - 6);
            return { start: dayStart(sun), end: dayEnd(sat) };
        }
        case "this_month":
            return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
        case "last_month": {
            const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const e = new Date(now.getFullYear(), now.getMonth(), 0);
            return { start: s, end: dayEnd(e) };
        }
        case "last_3_months":
            return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end };
        case "last_6_months":
            return { start: new Date(now.getFullYear(), now.getMonth() - 5, 1), end };
        case "this_year":
            return { start: new Date(now.getFullYear(), 0, 1), end };
        case "last_year": {
            const y = now.getFullYear() - 1;
            return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59, 999) };
        }
        default:
            return { start: daysAgo(6), end };
    }
}

function resolveDateRange(preset, customStart, customEnd) {
    if (preset === "custom" && customStart && customEnd) {
        return {
            start: new Date(`${customStart}T00:00:00`),
            end:   new Date(`${customEnd}T23:59:59.999`),
        };
    }
    return getPresetRange(preset);
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart computation helpers (inlined from utils/chartUtils.js)
// ─────────────────────────────────────────────────────────────────────────────

function getGranularity(start, end, preset) {
    switch (preset) {
        case "today":
        case "yesterday":
            return "hourly";
        case "last_3_days":
        case "last_7_days":
        case "this_week":
        case "past_week":
        case "last_15_days":
        case "last_30_days":
        case "this_month":
        case "last_month":
            return "daily";
        case "last_3_months":
        case "last_6_months":
            return "weekly";
        case "this_year":
        case "last_year":
            return "monthly";
        default: {
            const days = (end - start) / 864e5;
            if (days <= 1)   return "hourly";
            if (days <= 90)  return "daily";
            if (days <= 365) return "weekly";
            return "monthly";
        }
    }
}

function generateLabels(start, end, granularity) {
    if (granularity === "hourly") {
        return Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
    }

    const labels = [];
    const cursor = new Date(start);
    const fmtDay = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const fmtMon = (d) => d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    if (granularity === "daily") {
        cursor.setHours(0, 0, 0, 0);
        while (cursor <= end) { labels.push(fmtDay(new Date(cursor))); cursor.setDate(cursor.getDate() + 1); }
    } else if (granularity === "weekly") {
        cursor.setHours(0, 0, 0, 0);
        while (cursor <= end) { labels.push(fmtDay(new Date(cursor))); cursor.setDate(cursor.getDate() + 7); }
    } else {
        cursor.setDate(1); cursor.setHours(0, 0, 0, 0);
        while (cursor <= end) { labels.push(fmtMon(new Date(cursor))); cursor.setMonth(cursor.getMonth() + 1); }
    }

    return labels;
}

function getBucketIndex(date, start, granularity) {
    if (granularity === "hourly") return date.getHours();
    if (granularity === "daily")  return Math.floor((dayStart(date) - dayStart(start)) / 864e5);
    if (granularity === "weekly") return Math.floor((date - start) / (864e5 * 7));
    return (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
}

function bucketRecords(records, length, start, granularity, getValue) {
    const buckets = Array(length).fill(0);
    for (const r of records) {
        const idx = getBucketIndex(new Date(r.createdAt), start, granularity);
        if (idx >= 0 && idx < length) buckets[idx] += getValue(r);
    }
    return buckets;
}

function mergeBuckets(buckets, labels, targetCount) {
    if (!targetCount || targetCount >= buckets.length) {
        return { mergedData: buckets, mergedLabels: labels };
    }
    const total = buckets.length;
    const mergedData   = [];
    const mergedLabels = [];
    for (let i = 0; i < targetCount; i++) {
        const s = Math.floor((i / targetCount) * total);
        const e = Math.floor(((i + 1) / targetCount) * total);
        mergedData.push(buckets.slice(s, e).reduce((a, v) => a + v, 0));
        mergedLabels.push(labels[s]);
    }
    return { mergedData, mergedLabels };
}

export function makeChartOptions(colors, labels) {
    return {
        chart: {
            toolbar: { show: false },
            zoom: { enabled: false },
            fontFamily: "inherit",
            animations: { enabled: true, speed: 400 },
        },
        colors,
        xaxis: { categories: labels, labels: { style: { fontSize: "11px" } } },
        yaxis: { labels: { style: { fontSize: "11px" } } },
        dataLabels: { enabled: false },
        grid: { borderColor: "#e8e8e8", strokeDashArray: 4 },
        tooltip: { shared: true, intersect: false },
        legend: { position: "top", fontSize: "13px" },
        stroke: { curve: "smooth", width: 2 },
    };
}

function buildChartSeries({ start, end, preset, interval, series }) {
    const granularity = getGranularity(start, end, preset);
    const rawLabels   = generateLabels(start, end, granularity);
    const len         = rawLabels.length;
    const target      = interval && interval < len ? interval : null;

    const data = {};
    let labels = rawLabels;

    for (const { key, records, getValue } of series) {
        const raw = bucketRecords(records, len, start, granularity, getValue);
        const { mergedData, mergedLabels } = mergeBuckets(raw, rawLabels, target);
        data[key] = mergedData;
        if (labels === rawLabels) labels = mergedLabels;
    }

    return { granularity, labels, labelCount: len, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// useDashboardPage
// ─────────────────────────────────────────────────────────────────────────────

export function useDashboardPage(loaderData) {
    const {
        transactions = [],
        rewards      = [],
        customerCount = 0,
        prizeClaims  = [],
    } = loaderData ?? {};

    // ── Date range state ──────────────────────────────────────────────────────
    const [preset,      setPreset]      = useState(DEFAULT_PRESET);
    const [customStart, setCustomStart] = useState("");
    const [customEnd,   setCustomEnd]   = useState("");
    const [interval,    setInterval]    = useState(null);

    const handleCustomApply = useCallback(({ start, end }) => {
        setCustomStart(start);
        setCustomEnd(end);
    }, []);

    const handleIntervalChange = useCallback((e) => {
        const v = e.target.value;
        setInterval(v === "" ? null : Number(v));
    }, []);

    // ── Active date range ─────────────────────────────────────────────────────
    const { start, end } = useMemo(
        () => resolveDateRange(preset, customStart, customEnd),
        [preset, customStart, customEnd]
    );

    // ── Filter records to active range ────────────────────────────────────────
    const inRange = useCallback(
        (r) => { const d = new Date(r.createdAt); return d >= start && d <= end; },
        [start, end]
    );

    const tx = useMemo(() => transactions.filter(inRange), [transactions, inRange]);
    const rw = useMemo(() => rewards.filter(inRange),      [rewards,      inRange]);
    const pc = useMemo(() => prizeClaims.filter(inRange),  [prizeClaims,  inRange]);

    const earnTx      = useMemo(() => tx.filter((t) => ["EARN", "REFERRAL"].includes(t.type) && t.points > 0), [tx]);
    const redeemTx    = useMemo(() => tx.filter((t) => t.type === "REDEEM"), [tx]);

    // ── Prize stat cards (derived from filtered pc — matches chart range) ──────
    const prizeStats = useMemo(() => ({
        total:     pc.length,
        pending:   pc.filter((c) => c.status === "PENDING").length,
        fulfilled: pc.filter((c) => c.status === "FULFILLED").length,
        completed: pc.filter((c) => c.status === "COMPLETED").length,
        cancelled: pc.filter((c) => c.status === "CANCELLED").length,
    }), [pc]);

    // ── Overview stat cards ───────────────────────────────────────────────────
    const overviewStats = useMemo(() => ({
        pointsEarned:    earnTx.reduce((s, t) => s + t.points, 0),
        pointsRedeemed:  redeemTx.reduce((s, t) => s + Math.abs(t.points), 0),
        rewardsIssued:   rw.length,
        activeRewards:   rw.filter((r) => r.status === "ACTIVE").length,
        activeCustomers: customerCount,
    }), [earnTx, redeemTx, rw, customerCount]);

    // ── Chart series ──────────────────────────────────────────────────────────
    const { granularity, labels, labelCount, data: chartData } = useMemo(
        () => buildChartSeries({
            start, end, preset, interval,
            series: [
                { key: "earned",      records: earnTx,       getValue: (t) => t.points },
                { key: "redeemed",    records: redeemTx,     getValue: (t) => Math.abs(t.points) },
                { key: "rewards",     records: rw,           getValue: () => 1 },
                { key: "prizePending",   records: pc.filter((c) => c.status === "PENDING"),   getValue: () => 1 },
                { key: "prizeFulfilled", records: pc.filter((c) => c.status === "FULFILLED"), getValue: () => 1 },
                { key: "prizeCompleted", records: pc.filter((c) => c.status === "COMPLETED"), getValue: () => 1 },
                { key: "prizeCancelled", records: pc.filter((c) => c.status === "CANCELLED"), getValue: () => 1 },
            ],
        }),
        [start, end, preset, interval, earnTx, redeemTx, rw, pc]
    );

    const rangeKey     = `${preset}-${customStart}-${customEnd}-${interval ?? "auto"}`;
    const chartOptions = useCallback((colors) => makeChartOptions(colors, labels), [labels]);

    return {
        // Date range controls
        preset, setPreset,
        customStart, customEnd,
        handleCustomApply,
        granularity, labelCount,
        interval, handleIntervalChange,

        // Stats
        overviewStats,
        prizeStats,

        // Charts
        chartData,
        rangeKey,
        chartOptions,
    };
}
