/**
 * @file useChartSeries.js
 *
 * Generic hook that converts any set of records into chart-ready time series.
 *
 * Completely decoupled from data shape — the caller defines what records
 * to pass and how to extract a numeric value from each one.
 * The hook handles granularity, label generation, bucketing, and merging.
 *
 * ─── Adding a new chart series ───────────────────────────────────────────────
 * No changes to this file needed. In the caller:
 *
 *   const { labels, labelCount, data } = useChartSeries({
 *     start, end, preset, interval,
 *     series: [
 *       // existing
 *       { key: "earned",   records: earnTx,   getValue: (t) => t.points },
 *       // new — just add an entry
 *       { key: "myMetric", records: myRecords, getValue: (r) => r.someValue },
 *     ],
 *   });
 *
 *   data.myMetric // → number[]
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo } from "react";
import {
    getGranularity,
    generateLabels,
    bucketRecords,
    mergeBuckets,
} from "@utils/chart/chartUtils.js";

/**
 * @typedef {Object} SeriesConfig
 * @property {string}   key       - Output key in the returned data map
 * @property {Object[]} records   - Records to bucket; each must have a `createdAt` field
 * @property {Function} getValue  - (record) => number to accumulate per bucket
 */

/**
 * Converts record arrays into merged, chart-ready time series.
 *
 * @param {Object}        params
 * @param {Date}          params.start      - Range start (inclusive)
 * @param {Date}          params.end        - Range end (inclusive)
 * @param {string}        params.preset     - Active preset (drives granularity)
 * @param {number|null}   params.interval   - Target bucket count; null = no merge
 * @param {SeriesConfig[]} params.series    - One entry per metric to compute
 *
 * @returns {{
 *   granularity: "hourly"|"daily"|"weekly"|"monthly",
 *   labels:      string[],   // x-axis labels (merged if interval is set)
 *   labelCount:  number,     // raw bucket count before merging (for IntervalSelect)
 *   data:        Record<string, number[]>  // keyed by SeriesConfig.key
 * }}
 *
 * @example
 * const { labels, labelCount, data } = useChartSeries({
 *   start, end, preset, interval,
 *   series: [
 *     { key: "earned",   records: earnTx,   getValue: (t) => t.points        },
 *     { key: "redeemed", records: redeemTx, getValue: (t) => Math.abs(t.points) },
 *     { key: "rewards",  records: rewards,  getValue: () => 1                 },
 *   ],
 * });
 *
 * // data.earned   → [0, 150, 300, ...]
 * // data.redeemed → [0, 50, 0, ...]
 * // data.rewards  → [1, 2, 0, ...]
 */
const useChartSeries = ({ start, end, preset, interval, series }) =>
    useMemo(() => {
        const granularity = getGranularity(start, end, preset);
        const rawLabels = generateLabels(start, end, granularity);
        const len = rawLabels.length;

        // Target merge count — null if no merge needed
        const target = interval && interval < len ? interval : null;

        // Bucket + merge each series. Labels are extracted from the first
        // series merge so they share the exact same boundary calculation —
        // no risk of floating-point drift between separate mergeBuckets calls.
        const data = {};
        let labels = rawLabels;

        for (const { key, records, getValue } of series) {
            const raw = bucketRecords(records, len, start, granularity, getValue);
            const { mergedData, mergedLabels } = mergeBuckets(raw, rawLabels, target);
            data[key] = mergedData;
            if (labels === rawLabels) labels = mergedLabels; // use first series labels
        }

        return { granularity, labels, labelCount: len, data };
    }, [start, end, preset, interval, series]);

export default useChartSeries;