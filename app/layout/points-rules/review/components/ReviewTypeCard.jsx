// ─────────────────────────────────────────────────────────────────────────────
// ReviewTypeCard
//
// One review type row: label, description, enable/disable toggle,
// and conditional points input.
//
// Props:
//   typeKey   {string}   - "text" | "image" | "video"
//   label     {string}
//   description {string}
//   val       {object}   - { isActive, points }
//   error     {string|null}
//   busy      {boolean}
//   onToggle  {Function} - (checked: boolean) => void
//   onPoints  {Function} - (value: number) => void
// ─────────────────────────────────────────────────────────────────────────────

export function ReviewTypeCard({ typeKey, label, description, val, error, busy, onToggle, onPoints }) {
    return (
        <s-box paddingBlockEnd="base">
            <s-box
                padding="base"
                background="base"
                borderWidth="base"
                borderColor="base"
                borderRadius="base"
                borderStyle="dashed"
                style={{ marginBlockEnd: "var(--s-space-base)" }}
            >
                <s-grid gridTemplateColumns="1fr auto" alignItems="center">
                    <div>
                        <s-text><strong>{label}</strong></s-text>
                        <s-box paddingBlockEnd="small" />
                        <s-text tone="subdued">{description}</s-text>
                    </div>
                    <s-switch
                        labelAccessibilityVisibility="exclusion"
                        label={val.isActive ? "Enabled" : "Disabled"}
                        checked={val.isActive}
                        disabled={busy}
                        onChange={(e) => onToggle(e.target.checked)}
                    />
                </s-grid>

                {val.isActive && (
                    <>
                        <s-box paddingBlockEnd="base" />
                        <s-number-field
                            label="Points"
                            labelAccessibilityVisibility="exclusive"
                            suffix="points"
                            step={1}
                            min={1}
                            value={val.points ?? ""}
                            disabled={busy}
                            onInput={(e) => onPoints(e.target.value ? Number(e.target.value) : 0)}
                        />
                        {error && <s-text tone="critical">{error}</s-text>}
                    </>
                )}
            </s-box>
        </s-box>
    );
}
