/**
 * Product Value + Points Cost fields, plus the "use suggested points"
 * shortcut derived from the multiplier calculator below it.
 */
export function PricingFields({ fs, busy, suggestedPoints }) {
    return (
        <s-section>
            <s-text variant="headingSm">Pricing</s-text>
            <s-text tone="subdued" variant="bodySm">
                Set the product value and use the multiplier calculator below to work out the right points cost.
            </s-text>
            <s-box paddingBlockEnd="small" />
            <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-number-field
                    label="Product Value ($)"
                    prefix="$"
                    step={1} min={0}
                    value={fs.form.productValue}
                    disabled={busy}
                    details="Estimated retail value of this prize."
                    onInput={(e) => fs.set("productValue", e.target.value)}
                    onBlur={() => fs.touchField("productValue")}
                />
                <s-number-field
                    label="Points Cost"
                    suffix="pts"
                    step={1} min={1}
                    value={fs.form.pointsCost}
                    disabled={busy}
                    details="How many points a customer needs to claim this prize."
                    error={fs.errorFor("pointsCost") ?? undefined}
                    onInput={(e) => fs.set("pointsCost", e.target.value)}
                    onBlur={() => fs.touchField("pointsCost")}
                />
            </s-grid>

            {/* Suggested points from calculator */}
            {suggestedPoints !== null && (
                <s-box paddingBlockStart="small">
                    <s-stack direction="inline" gap="small" alignItems="center">
                        <s-text tone="subdued" variant="bodySm">
                            Suggested: <strong>{suggestedPoints.toLocaleString()} pts</strong>
                        </s-text>
                        <s-button
                            variant="plain" size="small" disabled={busy}
                            onClick={() => fs.set("pointsCost", String(suggestedPoints))}
                        >
                            Use this
                        </s-button>
                    </s-stack>
                </s-box>
            )}
        </s-section>
    );
}
