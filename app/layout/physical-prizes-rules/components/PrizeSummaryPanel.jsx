/**
 * Right-column summary of the in-progress prize, plus the active/inactive
 * switch. Read-only reflection of current form state.
 */
export function PrizeSummaryPanel({ fs, imageFile, busy }) {
    return (
        <s-box>
            <s-section>
                <s-text variant="headingSm">Summary</s-text>
                <s-box paddingBlockEnd="small" />
                <s-text><strong>Title:</strong> {fs.form.title || "—"}</s-text>
                <s-box paddingBlockEnd="small" />
                <s-text>
                    <strong>Product value:</strong>{" "}
                    {fs.form.productValue ? `$${Number(fs.form.productValue).toLocaleString()}` : "—"}
                </s-text>
                <s-box paddingBlockEnd="small" />
                <s-text>
                    <strong>Points cost:</strong>{" "}
                    {fs.form.pointsCost ? `${Number(fs.form.pointsCost).toLocaleString()} pts` : "—"}
                </s-text>
                <s-box paddingBlockEnd="small" />
                <s-text>
                    <strong>Image:</strong>{" "}
                    {imageFile
                        ? `✅ ${imageFile.name}`
                        : fs.form.imageUrl
                            ? "✅ Uploaded"
                            : "❌ None"}
                </s-text>
                <s-box paddingBlockEnd="small" />
                <s-text>
                    <strong>Status:</strong>{" "}
                    {fs.form.isActive ? "Active ✅" : "Inactive ❌"}
                </s-text>
            </s-section>

            <s-box paddingBlockEnd="base" />

            <s-section>
                <s-text variant="headingSm">Active Status</s-text>
                <s-text tone="subdued" variant="bodySm">
                    Inactive prizes will not be shown to customers in the widget.
                </s-text>
                <s-box paddingBlockEnd="small" />
                <s-switch
                    labelAccessibilityVisibility="exclusion"
                    label={fs.form.isActive ? "Active" : "Inactive"}
                    checked={fs.form.isActive}
                    disabled={busy}
                    onChange={(e) => fs.set("isActive", e.target.checked)}
                />
            </s-section>
        </s-box>
    );
}
