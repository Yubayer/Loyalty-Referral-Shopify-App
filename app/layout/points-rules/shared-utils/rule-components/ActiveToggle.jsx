// ─────────────────────────────────────────────────────────────────────────────
// ActiveToggle
//
// "Active Status" section with a single on/off switch.
// Identical across all three rule pages.
//
// Props:
//   checked  {boolean}
//   onChange {Function} - (checked: boolean) => void
//   busy     {boolean}
// ─────────────────────────────────────────────────────────────────────────────

export function ActiveToggle({ checked, onChange, busy }) {
    return (
        <s-section>
            <s-heading>Active Status</s-heading>
            <s-box paddingBlockEnd="small" />
            <s-switch
                labelAccessibilityVisibility="exclusion"
                label={checked ? "Active" : "Inactive"}
                checked={checked}
                disabled={busy}
                onChange={(e) => onChange(e.target.checked)}
            />
        </s-section>
    );
}
