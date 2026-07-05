/**
 * @file dateRange.js
 * Preset definitions and date math helpers.
 *
 * To add a new preset:
 *   1. Add an entry to DATE_PRESETS
 *   2. Add a case in getPresetRange()
 *   3. Add a case in getGranularity() in chartUtils.js
 *
 * Timezone strategy:
 *   - DB stores all timestamps in UTC.
 *   - Use getPresetRange() start/end as-is for DB queries (UTC).
 *   - Use formatLocalLabel() / toLocalDate() to convert to the
 *     user's local timezone for display and chart axis labels.
 */

// ─── Presets ──────────────────────────────────────────────────────────────────

/**
 * All available date range presets.
 * @typedef {{ label: string, value: string }} DatePreset
 * @type {DatePreset[]}
 */
export const DATE_PRESETS = [
    { label: "Today", value: "today" },
    { label: "Yesterday", value: "yesterday" },
    { label: "Last 3 days", value: "last_3_days" },
    { label: "Last 7 days", value: "last_7_days" },
    { label: "This week", value: "this_week" },
    { label: "Past week", value: "past_week" },
    { label: "Last 15 days", value: "last_15_days" },
    { label: "Last 30 days", value: "last_30_days" },
    { label: "This month", value: "this_month" },
    { label: "Last month", value: "last_month" },
    { label: "Last 3 months", value: "last_3_months" },
    { label: "Last 6 months", value: "last_6_months" },
    { label: "This year", value: "this_year" },
    { label: "Last year", value: "last_year" },
    { label: "Custom range", value: "custom" },
];

export const DEFAULT_PRESET = "last_7_days";

/** Today as YYYY-MM-DD — used for s-date-picker disallow. */
export const TODAY_STR = new Date().toISOString().split("T")[0];

/**
 * Tomorrow as YYYY-MM-DD.
 * Passed to s-date-picker disallow so today stays selectable
 * while future dates are blocked.
 */
export const TOMORROW_STR = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
})();

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns a new Date at 00:00:00.000 for the given date. */
export const dayStart = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

/** Returns a new Date at 23:59:59.999 for the given date. */
export const dayEnd = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

// ─── Preset range resolver ────────────────────────────────────────────────────

/**
 * Returns { start, end } for a named preset. Both endpoints are inclusive.
 * Falls back to "last 7 days" for unknown values.
 *
 * start/end are plain JS Date objects — pass them directly to your
 * DB/API query as UTC. Do NOT adjust for timezone here.
 *
 * @param {string} preset
 * @returns {{ start: Date, end: Date }}
 */
export const getPresetRange = (preset) => {
    const now = new Date();
    const today = dayStart(now);
    const end = dayEnd(now);
    const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };

    switch (preset) {
        case "today": return { start: today, end };
        case "yesterday": return { start: daysAgo(1), end: dayEnd(daysAgo(1)) };
        case "last_3_days": return { start: daysAgo(2), end };
        case "last_7_days": return { start: daysAgo(6), end };
        case "last_15_days": return { start: daysAgo(14), end };
        case "last_30_days": return { start: daysAgo(29), end };
        case "this_week": {
            const s = new Date(today); s.setDate(s.getDate() - s.getDay());
            return { start: s, end };
        }
        case "past_week": {
            const sat = new Date(today); sat.setDate(sat.getDate() - sat.getDay() - 1);
            const sun = new Date(sat); sun.setDate(sun.getDate() - 6);
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
};

// ─── Timezone helpers ─────────────────────────────────────────────────────────

/**
 * The user's local IANA timezone string, e.g. "Asia/Dhaka".
 * Falls back to "UTC" if the browser does not support Intl.
 *
 * @type {string}
 */
export const USER_TIMEZONE =
    typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC";

/**
 * Converts a UTC Date (as stored in DB) to a display label in the
 * user's local timezone.
 *
 * @param {Date}    utcDate     - Raw UTC timestamp from the DB.
 * @param {"hour"|"day"|"month"} granularity
 * @param {string}  [tz]        - IANA timezone (defaults to USER_TIMEZONE).
 * @returns {string}            - Human-readable local label, e.g. "May 7, 14:00"
 *
 * @example
 * // DB row: { created_at: "2026-05-07T08:30:00Z" }
 * const label = formatLocalLabel(new Date("2026-05-07T08:30:00Z"), "hour");
 * // Asia/Dhaka → "May 7, 14:00"  (UTC+6)
 */
export const formatLocalLabel = (utcDate, granularity, tz = USER_TIMEZONE) => {
    /** @type {Intl.DateTimeFormatOptions} */
    const opts = { timeZone: tz };

    if (granularity === "hour") {
        opts.month = "short";
        opts.day = "numeric";
        opts.hour = "2-digit";
        opts.hour12 = false;
    } else if (granularity === "day") {
        opts.month = "short";
        opts.day = "numeric";
    } else {
        opts.year = "numeric";
        opts.month = "short";
    }

    return new Intl.DateTimeFormat("en-US", opts).format(utcDate);
};

/**
 * Returns the local calendar date parts (year, month, day, hour) for a
 * UTC timestamp in a given timezone. Useful for grouping DB rows by
 * local day/hour without pulling everything into JS.
 *
 * @param {Date}   utcDate
 * @param {string} [tz] - IANA timezone (defaults to USER_TIMEZONE).
 * @returns {{ year: number, month: number, day: number, hour: number, weekday: string }}
 *
 * @example
 * const parts = toLocalDateParts(new Date("2026-05-07T20:00:00Z")); // UTC 20:00
 * // Asia/Dhaka (UTC+6) → { year: 2026, month: 5, day: 8, hour: 2, weekday: "Fri" }
 */
export const toLocalDateParts = (utcDate, tz = USER_TIMEZONE) => {
    const fmt = (opts) =>
        new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts })
            .formatToParts(utcDate)
            .reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});

    const date = fmt({ year: "numeric", month: "numeric", day: "numeric" });
    const time = fmt({ hour: "numeric", hour12: false });
    const weekday = fmt({ weekday: "short" }).weekday;

    return {
        year: parseInt(date.year, 10),
        month: parseInt(date.month, 10),
        day: parseInt(date.day, 10),
        hour: parseInt(time.hour, 10),
        weekday,
    };
};

/**
 * Groups an array of DB rows (each with a UTC `timestamp` field) into
 * buckets keyed by local time label.
 *
 * @template {{ timestamp: Date|string, [key: string]: any }} T
 * @param {T[]}                         rows
 * @param {"hour"|"day"|"month"}        granularity
 * @param {(row: T) => number}          valueFn   - Extracts the numeric value to sum.
 * @param {string}                      [tz]
 * @returns {{ label: string, value: number }[]}   - Sorted chronologically.
 *
 * @example
 * const grouped = groupByLocalTime(dbRows, "day", (r) => r.event_count);
 * // → [{ label: "May 1", value: 42 }, { label: "May 2", value: 38 }, ...]
 */
export const groupByLocalTime = (rows, granularity, valueFn, tz = USER_TIMEZONE) => {
    const map = new Map();

    for (const row of rows) {
        const utcDate = row.timestamp instanceof Date
            ? row.timestamp
            : new Date(row.timestamp);

        const label = formatLocalLabel(utcDate, granularity, tz);
        map.set(label, (map.get(label) ?? 0) + valueFn(row));
    }

    return Array.from(map, ([label, value]) => ({ label, value }));
};