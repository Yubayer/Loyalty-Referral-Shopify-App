/**
 * @file chartUtils.js
 * Pure chart computation utilities — no React, no side effects.
 * Safe to import in hooks, tests, or server code.
 */

import { dayStart } from "./dateRange";

// ─── Granularity ──────────────────────────────────────────────────────────────

/**
 * Returns the bucket granularity for a preset + date range.
 *
 * Named presets use a fixed granularity so the chart always matches
 * the user's mental model. Custom ranges derive granularity from span.
 *
 * To add a new preset: add a case here + in dateRange.js.
 *
 * @param {Date}   start
 * @param {Date}   end
 * @param {string} [preset]
 * @returns {"hourly"|"daily"|"weekly"|"monthly"}
 */
export const getGranularity = (start, end, preset) => {
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
            if (days <= 1) return "hourly";
            if (days <= 90) return "daily";
            if (days <= 365) return "weekly";
            return "monthly";
        }
    }
};

// ─── Label generation ─────────────────────────────────────────────────────────

/**
 * Generates x-axis label strings for a date range at a given granularity.
 *
 * @param {Date}   start
 * @param {Date}   end
 * @param {"hourly"|"daily"|"weekly"|"monthly"} granularity
 * @returns {string[]}
 */
export const generateLabels = (start, end, granularity) => {
    if (granularity === "hourly") {
        return Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
    }

    const labels = [];
    const cursor = new Date(start);
    const fmtDay = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const fmtMon = (d) => d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    if (granularity === "daily") {
        cursor.setHours(0, 0, 0, 0);
        while (cursor <= end) {
            labels.push(fmtDay(new Date(cursor)));
            cursor.setDate(cursor.getDate() + 1);
        }
    } else if (granularity === "weekly") {
        cursor.setHours(0, 0, 0, 0);
        while (cursor <= end) {
            labels.push(fmtDay(new Date(cursor)));
            cursor.setDate(cursor.getDate() + 7);
        }
    } else {
        cursor.setDate(1); cursor.setHours(0, 0, 0, 0);
        while (cursor <= end) {
            labels.push(fmtMon(new Date(cursor)));
            cursor.setMonth(cursor.getMonth() + 1);
        }
    }

    return labels;
};

// ─── Bucket slotting ──────────────────────────────────────────────────────────

/**
 * Returns the 0-based bucket index for a date.
 *
 * @param {Date}   date
 * @param {Date}   start
 * @param {string} granularity
 * @returns {number}
 */
export const getBucketIndex = (date, start, granularity) => {
    if (granularity === "hourly") return date.getHours();
    if (granularity === "daily") return Math.floor((dayStart(date) - dayStart(start)) / 864e5);
    if (granularity === "weekly") return Math.floor((date - start) / (864e5 * 7));
    return (date.getFullYear() - start.getFullYear()) * 12
        + (date.getMonth() - start.getMonth());
};

/**
 * Slots records into a numeric bucket array by summing getValue(record)
 * into the correct time bucket. Records outside the range are ignored.
 *
 * @param {Object[]} records
 * @param {number}   length      - Number of buckets
 * @param {Date}     start
 * @param {string}   granularity
 * @param {Function} getValue    - (record) => number
 * @returns {number[]}
 */
export const bucketRecords = (records, length, start, granularity, getValue) => {
    const buckets = Array(length).fill(0);
    for (const r of records) {
        const idx = getBucketIndex(new Date(r.createdAt), start, granularity);
        if (idx >= 0 && idx < length) buckets[idx] += getValue(r);
    }
    return buckets;
};

// ─── Bucket merging ───────────────────────────────────────────────────────────

/**
 * Merges full-resolution buckets + labels down to targetCount by
 * summing consecutive groups. Labels use the first date of each group.
 *
 * Returns originals unchanged when targetCount is null or >= buckets.length.
 *
 * @param {number[]}    buckets
 * @param {string[]}    labels
 * @param {number|null} targetCount
 * @returns {{ mergedData: number[], mergedLabels: string[] }}
 */
export const mergeBuckets = (buckets, labels, targetCount) => {
    if (!targetCount || targetCount >= buckets.length) {
        return { mergedData: buckets, mergedLabels: labels };
    }

    const total = buckets.length;
    const mergedData = [];
    const mergedLabels = [];

    // Math.floor gives stable, deterministic boundaries.
    // Boundaries are computed once and shared between data and labels
    // so they are guaranteed to be identical — no floating-point drift
    // between separate merge calls.
    for (let i = 0; i < targetCount; i++) {
        const sliceStart = Math.floor((i / targetCount) * total);
        const sliceEnd = Math.floor(((i + 1) / targetCount) * total);
        const slice = buckets.slice(sliceStart, sliceEnd);

        mergedData.push(slice.reduce((s, v) => s + v, 0));
        mergedLabels.push(labels[sliceStart]);
    }

    return { mergedData, mergedLabels };
};

// ─── Chart options factory ────────────────────────────────────────────────────

/**
 * Builds a base ApexCharts options object.
 *
 * @param {string[]} colors
 * @param {string[]} labels
 * @returns {Object}
 */
export const makeChartOptions = (colors, labels) => ({
    chart: {
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: "inherit",
        animations: { enabled: true, speed: 400 },
    },
    colors,
    xaxis: {
        categories: labels,
        labels: { style: { fontSize: "11px" } },
    },
    yaxis: { labels: { style: { fontSize: "11px" } } },
    dataLabels: { enabled: false },
    grid: { borderColor: "#e8e8e8", strokeDashArray: 4 },
    tooltip: { shared: true, intersect: false },
    legend: { position: "top", fontSize: "13px" },
    stroke: { curve: "smooth", width: 2 },
});