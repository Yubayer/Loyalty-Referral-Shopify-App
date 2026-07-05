// ─────────────────────────────────────────────────────────────────────────────
// EarningFields
//
// Fixed vs incremental points input.
// Reused at P1 (global), P2 (global interval), P3 (group), P4 (group interval).
//
// Props:
//   val              {object}   - { fixedPoints, rate: { points, amount } }
//   orderType        {string}   - "fixed" | "incremental"
//   onChangeFixed    {Function} - (value) => void
//   onChangeRatePoints {Function} - (value) => void
//   onChangeRateAmount {Function} - (value) => void
//   busy             {boolean}
// ─────────────────────────────────────────────────────────────────────────────

export function EarningFields({
    val,
    orderType,
    onChangeFixed,
    onChangeRatePoints,
    onChangeRateAmount,
    busy,
}) {
    if (orderType === "incremental") {
        return (
            <s-grid gridTemplateColumns="1fr auto 1fr" gap="large" alignItems="center">
                <s-number-field
                    label="Points"
                    labelAccessibilityVisibility="exclusive"
                    suffix="points"
                    step={1}
                    min={1}
                    value={val?.rate?.points ?? ""}
                    disabled={busy}
                    onInput={(e) => onChangeRatePoints(e.target.value ? Number(e.target.value) : 0)}
                />
                <s-text>for every</s-text>
                <s-number-field
                    label="Amount"
                    labelAccessibilityVisibility="exclusive"
                    prefix="$"
                    suffix="spent"
                    step={1}
                    min={1}
                    value={val?.rate?.amount ?? ""}
                    disabled={busy}
                    onInput={(e) => onChangeRateAmount(e.target.value ? Number(e.target.value) : 0)}
                />
            </s-grid>
        );
    }

    return (
        <s-number-field
            label="Points"
            labelAccessibilityVisibility="exclusive"
            suffix="points"
            value={val?.fixedPoints ?? ""}
            disabled={busy}
            onInput={(e) => onChangeFixed(e.target.value ? Number(e.target.value) : 0)}
        />
    );
}
