/**
 * @file useDateRange.js
 *
 * Resolves the active { start, end } date range from either a named preset
 * or a custom date pair. Used by Dashboard to feed into useChartSeries.
 */

import { useMemo } from "react";
import { getPresetRange } from "@utils/chart/dateRange.js";

/**
 * Returns the active date range for the dashboard.
 *
 * Prefers the custom range when preset === "custom" and both dates are set.
 * Falls back to the preset range otherwise.
 *
 * @param {Object} params
 * @param {string} params.preset       - Active preset value
 * @param {string} params.customStart  - YYYY-MM-DD (empty string if not set)
 * @param {string} params.customEnd    - YYYY-MM-DD (empty string if not set)
 * @returns {{ start: Date, end: Date }}
 *
 * @example
 * const { start, end } = useDateRange({ preset, customStart, customEnd });
 */
const useDateRange = ({ preset, customStart, customEnd }) =>
    useMemo(() => {
        if (preset === "custom" && customStart && customEnd) {
            return {
                start: new Date(`${customStart}T00:00:00`),
                end: new Date(`${customEnd}T23:59:59.999`),
            };
        }
        return getPresetRange(preset);
    }, [preset, customStart, customEnd]);

export default useDateRange;