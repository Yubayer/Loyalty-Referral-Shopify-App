// ─────────────────────────────────────────────────────────────────────────────
// INTERVAL OPTIONS
// Used by: referral (global intervals + group intervals)
//          order    (global intervals + group intervals)
// ─────────────────────────────────────────────────────────────────────────────

export const INTERVAL_OPTIONS = [
    { value: "weekly", label: "Weekly" },
    { value: "every_two_weeks", label: "Every Two Weeks" },
    { value: "monthly", label: "Monthly" },
    { value: "every_two_months", label: "Every Two Months" },
    { value: "every_three_months", label: "Every Three Months" },
    { value: "every_six_months", label: "Every Six Months" },
    { value: "yearly", label: "Yearly" },
];

/**
 * Resolves an interval value (e.g. "monthly") to its display label.
 * Falls back to the raw value if not found.
 */
export const getIntervalLabel = (intervalValue) =>
    INTERVAL_OPTIONS.find((o) => o.value === intervalValue)?.label ?? intervalValue;

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER DESCRIPTIONS
// Human-readable labels for trigger values.
// Used by: referral SummaryPanel, order SummaryPanel
// ─────────────────────────────────────────────────────────────────────────────

export const TRIGGER_DESCRIPTIONS = {
    oneTime: "One-time purchases only",
    subscription: "Subscription orders only",
    both: "All orders (one-time + subscription)",
};
