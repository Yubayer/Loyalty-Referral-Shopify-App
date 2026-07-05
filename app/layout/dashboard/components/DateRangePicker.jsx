import React, { useState, useEffect, useCallback } from "react";
import { DATE_PRESETS, TOMORROW_STR } from "../_hooks";

// ─── IntervalSelect ───────────────────────────────────────────────────────────

export const IntervalSelect = ({ labelCount, interval, onChange }) => {
    if (labelCount <= 4) return null;

    const candidates = [2, 4, 6, 8, 10, 12, 15, 20, 30];
    const options    = candidates.filter((n) => n < labelCount);

    return (
        <s-box>
            <s-heading>Select Date Range</s-heading>
            <s-box paddingBlockEnd="small" />
            <s-select
                label="Interval"
                labelAccessibilityVisibility="exclusive"
                value={interval === null ? "" : String(interval)}
                onChange={onChange}
            >
                <s-option value="">Auto</s-option>
                {options.map((n) => (
                    <s-option key={n} value={String(n)}>{n} ticks</s-option>
                ))}
                <s-option value={String(labelCount)}>All ({labelCount})</s-option>
            </s-select>
        </s-box>
    );
};

// ─── DateRangePicker ──────────────────────────────────────────────────────────

export const DateRangePicker = ({
    preset, onPresetChange,
    customStart, customEnd, onCustomApply,
    granularity,
    labelCount, interval, onIntervalChange,
}) => {
    const [pendingStart,  setPendingStart]  = useState(customStart);
    const [pendingEnd,    setPendingEnd]    = useState(customEnd);
    const [showCalendar,  setShowCalendar]  = useState(!(customStart && customEnd));

    useEffect(() => {
        if (preset === "custom") {
            setPendingStart(customStart);
            setPendingEnd(customEnd);
            setShowCalendar(!(customStart && customEnd));
        }
    }, [preset]);

    const handleDatePickerChange = useCallback((e) => {
        const parts = (e.target?.value || "").split("--");
        if (parts.length === 2 && parts[0] && parts[1]) {
            setPendingStart(parts[0]);
            setPendingEnd(parts[1]);
        }
    }, []);

    const handleApply = useCallback(() => {
        if (pendingStart && pendingEnd) {
            onCustomApply({ start: pendingStart, end: pendingEnd });
            setShowCalendar(false);
        }
    }, [pendingStart, pendingEnd, onCustomApply]);

    const activeLabel     = DATE_PRESETS.find((p) => p.value === preset)?.label ?? "";
    const calendarValue   = pendingStart && pendingEnd ? `${pendingStart}--${pendingEnd}` : "";
    const canApply        = !!(pendingStart && pendingEnd);
    const hasAppliedRange = !!(customStart && customEnd);

    return (
        <s-section>
            <s-stack direction="block" gap="base">

                <s-query-container>
                    <s-grid
                        gridTemplateColumns="@container (inline-size > 500px) 1fr 1fr, 1fr"
                        gap="base"
                        align-items="end"
                    >
                        <s-grid-item>
                            <s-heading>Select Date Range</s-heading>
                            <s-box paddingBlockEnd="small" />
                            <s-select
                                label="Date range"
                                labelAccessibilityVisibility="exclusive"
                                value={preset}
                                onChange={(e) => onPresetChange(e.target.value)}
                            >
                                {DATE_PRESETS.map((p) => (
                                    <s-option key={p.value} value={p.value}>{p.label}</s-option>
                                ))}
                            </s-select>
                        </s-grid-item>
                        <s-grid-item>
                            <IntervalSelect
                                labelCount={labelCount}
                                interval={interval}
                                onChange={onIntervalChange}
                            />
                        </s-grid-item>
                    </s-grid>
                </s-query-container>

                <s-stack direction="inline" gap="base" align-items="center">
                    {preset !== "custom" && <s-badge>{activeLabel}</s-badge>}
                    <s-badge tone="info">{granularity} view</s-badge>
                    {preset === "custom" && hasAppliedRange && !showCalendar && (
                        <s-stack direction="inline" gap="small-200" align-items="center">
                            <s-badge tone="success">{customStart} to {customEnd}</s-badge>
                            <s-button variant="plain" onClick={() => setShowCalendar(true)}>Edit</s-button>
                        </s-stack>
                    )}
                </s-stack>

                {preset === "custom" && showCalendar && (
                    <s-stack direction="block" gap="base">
                        <s-date-picker
                            type="range"
                            value={calendarValue}
                            disallow={`${TOMORROW_STR}--`}
                            onChange={handleDatePickerChange}
                        />
                        <s-stack direction="inline" gap="base" align-items="center">
                            <s-button
                                variant="primary"
                                disabled={canApply ? undefined : true}
                                onClick={handleApply}
                            >
                                Apply
                            </s-button>
                            {hasAppliedRange && (
                                <s-button variant="plain" onClick={() => setShowCalendar(false)}>
                                    Cancel
                                </s-button>
                            )}
                        </s-stack>
                    </s-stack>
                )}

            </s-stack>
        </s-section>
    );
};
