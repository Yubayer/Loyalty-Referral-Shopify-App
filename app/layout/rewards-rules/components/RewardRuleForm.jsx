import { formatDiscount } from "../_data";

// ─────────────────────────────────────────────────────────────────────────────
// REWARD RULE FORM
//
// Two-column create/edit form: left column has the actual fields, right
// column has a live Summary panel + the Active toggle.
// ─────────────────────────────────────────────────────────────────────────────

export function RewardRuleForm({ fs, busy, titlePreview }) {
    const { form } = fs;

    return (
        <s-grid gridTemplateColumns="2fr 1fr" gap="base">
            {/* ── Left column ─────────────────────────────────────────── */}
            <s-box>
                {/* Reward Type */}
                <s-box paddingBlockEnd="base">
                    <s-section>
                        <s-select
                            label="Reward Type"
                            placeholder="Select reward type"
                            value={form.rewardType}
                            disabled={busy}
                            error={fs.errorFor("rewardType") ?? undefined}
                            onInput={(e) => fs.set("rewardType", e.target.value)}
                            onBlur={() => fs.touchField("rewardType")}
                        >
                            <s-option value="orderDiscount">
                                Order Discount — discount the total order amount
                            </s-option>
                            {/* More types can be uncommented when supported:
                            <s-option value="productDiscount">Product Discount</s-option>
                            <s-option value="freeProduct">Free Product</s-option>
                            <s-option value="freeShipping">Free Shipping</s-option> */}
                        </s-select>
                    </s-section>
                </s-box>

                {/* Discount config — shown when orderDiscount is selected */}
                {form.rewardType === "orderDiscount" && (
                    <s-box paddingBlockEnd="base">
                        <s-section>
                            <s-grid gridTemplateColumns="2fr 1fr" gap="base">
                                {/* Discount Type */}
                                <s-select
                                    label={`Discount Type (${form.discountType})`}
                                    value={form.discountType}
                                    disabled={busy}
                                    onInput={(e) => fs.set("discountType", e.target.value)}
                                >
                                    <s-option value="fixed">Fixed Amount</s-option>
                                    <s-option value="percentage">Percentage</s-option>
                                </s-select>

                                {/* Discount Value */}
                                <s-number-field
                                    label="Value"
                                    prefix={form.discountType === "fixed" ? "$" : ""}
                                    suffix={form.discountType === "percentage" ? "%" : ""}
                                    step={1} min={0}
                                    value={form.rewardValue ?? ""}
                                    disabled={busy}
                                    error={fs.errorFor("rewardValue") ?? undefined}
                                    onInput={(e) => fs.set("rewardValue", Number(e.target.value))}
                                    onBlur={() => fs.touchField("rewardValue")}
                                />
                            </s-grid>

                            {/* Points Cost */}
                            <s-box paddingBlockEnd="base" />
                            <s-number-field
                                label="Points Cost"
                                suffix="points"
                                step={1} min={1}
                                value={form.pointsCost ?? ""}
                                disabled={busy}
                                error={fs.errorFor("pointsCost") ?? undefined}
                                onInput={(e) => fs.set("pointsCost", e.target.value)}
                                onBlur={() => fs.touchField("pointsCost")}
                            />
                        </s-section>
                    </s-box>
                )}

                {/* Display Title */}
                <s-box paddingBlockEnd="base">
                    <s-section>
                        <s-text-field
                            label="Display Title"
                            placeholder="e.g. Voucher {{currency_value}}"
                            value={form.title ?? ""}
                            disabled={busy}
                            details="Use {{currency_value}} to auto-insert the formatted discount amount."
                            error={fs.errorFor("title") ?? undefined}
                            onInput={(e) => fs.set("title", e.target.value)}
                            onBlur={() => fs.touchField("title")}
                        />
                        {/* Live preview when placeholder is present */}
                        {form.title?.includes("{{currency_value}}") && (
                            <s-box paddingBlockStart="small">
                                <s-text tone="subdued">Preview: {titlePreview}</s-text>
                            </s-box>
                        )}
                    </s-section>
                </s-box>

                {/* Description */}
                <s-section>
                    <s-text-area
                        label="Description"
                        placeholder="Describe this reward rule..."
                        value={form.description ?? ""}
                        rows={3}
                        disabled={busy}
                        onInput={(e) => fs.set("description", e.target.value)}
                    />
                </s-section>
            </s-box>

            {/* ── Right column ─────────────────────────────────────────── */}
            <s-box>
                {/* Summary */}
                <s-section>
                    <s-heading>Summary</s-heading>
                    <s-box paddingBlockEnd="small" />
                    {form.rewardType ? (
                        <>
                            <s-text><strong>Type:</strong> {form.rewardType}</s-text>
                            <s-box paddingBlockEnd="small" />
                            <s-text>
                                <strong>Discount:</strong> {formatDiscount(form.discountType, form.rewardValue)}
                            </s-text>
                            <s-box paddingBlockEnd="small" />
                            <s-text><strong>Cost:</strong> {form.pointsCost} points</s-text>
                            <s-box paddingBlockEnd="small" />
                            <s-text><strong>Status:</strong> {form.isActive ? "Active ✅" : "Inactive ❌"}</s-text>
                        </>
                    ) : (
                        <s-text tone="subdued">Select a reward type to see a summary.</s-text>
                    )}
                </s-section>

                <s-box paddingBlockEnd="base" />

                {/* Active Status */}
                <s-section>
                    <s-heading>Active Status</s-heading>
                    <s-box paddingBlockEnd="small" />
                    <s-switch
                        labelAccessibilityVisibility="exclusion"
                        label={form.isActive ? "Active" : "Inactive"}
                        checked={form.isActive}
                        disabled={busy}
                        onChange={(e) => fs.set("isActive", e.target.checked)}
                    />
                </s-section>
            </s-box>
        </s-grid>
    );
}
