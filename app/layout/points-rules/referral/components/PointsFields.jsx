// ─────────────────────────────────────────────────────────────────────────────
// PointsFields
//
// Referrer + Referred points pair in a 2-column grid.
// Reused at every priority level: P1 (global), P2 (global interval),
// P3 (group), P4 (group interval).
//
// Props:
//   referrerVal        {object}   - { points, allowRenewalReward, renewalPoints }
//   referredVal        {object}   - { points, allowRenewalReward, renewalPoints }
//   onReferrer         {Function} - (field, value) => void
//   onReferred         {Function} - (field, value) => void
//   showRenewal        {boolean}  - master switch — show renewal UI at all
//                                   (only for subscription trigger)
//   showRenewalToggle  {boolean}  - show the allowRenewalReward toggle per side;
//                                   when true, renewalPoints shows only if toggle is on
//   tooltipPrefix      {string}   - unique prefix for tooltip IDs to avoid collision
//   busy               {boolean}
// ─────────────────────────────────────────────────────────────────────────────

export function PointsFields({
    referrerVal,
    referredVal,
    onReferrer,
    onReferred,
    showRenewal = true,
    showRenewalToggle = false,
    tooltipPrefix = "points",
    busy,
}) {
    return (
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <Side
                label="Referrer"
                val={referrerVal}
                onChange={onReferrer}
                showRenewal={showRenewal}
                showRenewalToggle={showRenewalToggle}
                tooltipId={`${tooltipPrefix}-referrer-tooltip`}
                tooltipText="Turn this on to also reward the referrer each time the new customer renews their subscription — not just the first order."
                busy={busy}
            />
            <Side
                label="Referred"
                val={referredVal}
                onChange={onReferred}
                showRenewal={showRenewal}
                showRenewalToggle={showRenewalToggle}
                tooltipId={`${tooltipPrefix}-referred-tooltip`}
                tooltipText="Turn this on to also reward the new customer each time they renew their own subscription — not just their first order."
                busy={busy}
            />
        </s-grid>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Side — one column (Referrer or Referred)
// ─────────────────────────────────────────────────────────────────────────────

function Side({ label, val, onChange, showRenewal, showRenewalToggle, tooltipId, tooltipText, busy }) {
    const showRenewalPoints = showRenewal && (showRenewalToggle ? val?.allowRenewalReward : true);

    return (
        <s-box
            padding="base"
            background="base"
            borderWidth="base"
            borderColor="base"
            borderRadius="base"
        >
            <s-text><strong>{label}</strong></s-text>
            <s-box paddingBlockEnd="small" />

            <s-number-field
                label="Points"
                labelAccessibilityVisibility="exclusive"
                suffix="points"
                step={1}
                min={0}
                value={val?.points ?? ""}
                disabled={busy}
                onInput={(e) => onChange("points", e.target.value ? Number(e.target.value) : 0)}
            />

            {showRenewal && showRenewalToggle && (
                <>
                    <s-box paddingBlockEnd="small" />
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <s-switch
                            labelAccessibilityVisibility="visible"
                            label={val?.allowRenewalReward ? "Renewal bonus: On" : "Renewal bonus: Off"}
                            checked={val?.allowRenewalReward ?? false}
                            disabled={busy}
                            onChange={(e) => onChange("allowRenewalReward", e.target.checked)}
                        />
                        <s-tooltip id={tooltipId}>{tooltipText}</s-tooltip>
                        <s-icon type="info" tone="info" interestFor={tooltipId} />
                    </div>
                </>
            )}

            {showRenewalPoints && (
                <>
                    <s-box paddingBlockEnd="small" />
                    <s-number-field
                        label="Renewal Points"
                        labelAccessibilityVisibility="exclusive"
                        suffix="points"
                        step={1}
                        min={0}
                        value={val?.renewalPoints ?? ""}
                        disabled={busy}
                        details="Points earned each time the subscription renews."
                        onInput={(e) => onChange("renewalPoints", e.target.value ? Number(e.target.value) : 0)}
                    />
                </>
            )}
        </s-box>
    );
}
