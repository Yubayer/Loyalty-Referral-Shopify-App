// ─────────────────────────────────────────────────────────────────────────────
// DescriptionField
//
// Optional description textarea section.
// Identical across all three rule pages.
//
// Props:
//   value    {string}
//   onChange {Function} - (value: string) => void
//   busy     {boolean}
// ─────────────────────────────────────────────────────────────────────────────

export function DescriptionField({ value, onChange, busy }) {
    return (
        <s-section>
            <s-heading>Description (Optional)</s-heading>
            <s-box paddingBlockEnd="small" />
            <s-text-area
                label="Description"
                labelAccessibilityVisibility="exclusive"
                placeholder="Describe this rule..."
                value={value}
                disabled={busy}
                onInput={(e) => onChange(e.target.value)}
            />
        </s-section>
    );
}
