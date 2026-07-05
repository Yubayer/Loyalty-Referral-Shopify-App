/**
 * Prize image upload — shows the existing image (edit mode), or a local
 * preview of a newly-selected file, plus the drop zone itself.
 */
export function ImageUploadField({ fs, imageFile, imagePreviewUrl, busy }) {
    return (
        <s-section>
            <s-stack direction="block" gap="200">
                <s-text variant="headingSm">Prize Image (Optional)</s-text>
                <s-text tone="subdued" variant="bodySm">
                    Upload an image to show customers what they can win. JPG, PNG, WebP or GIF. Max 5 MB.
                </s-text>

                {/* Existing image preview in edit mode */}
                {fs.form.imageUrl && !imageFile && (
                    <s-stack direction="inline" gap="base" alignItems="center">
                        <img
                            src={fs.form.imageUrl}
                            alt="Current prize image"
                            style={{
                                width: "72px", height: "72px",
                                objectFit: "cover", borderRadius: "8px",
                                border: "1px solid #e0e0e0",
                            }}
                        />
                        <s-stack direction="block" gap="100">
                            <s-text variant="bodySm" tone="subdued">Current image</s-text>
                            <s-button
                                variant="plain" destructive size="small"
                                disabled={busy}
                                onClick={() => {
                                    fs.set("imageUrl", null);
                                    fs.removeMedia("imageUrl");
                                }}
                            >
                                Remove
                            </s-button>
                        </s-stack>
                    </s-stack>
                )}

                {/* New file selected — show local preview */}
                {imageFile && imagePreviewUrl && (
                    <s-stack direction="inline" gap="base" alignItems="center">
                        <img
                            src={imagePreviewUrl}
                            alt="Selected image preview"
                            style={{
                                width: "72px", height: "72px",
                                objectFit: "cover", borderRadius: "8px",
                                border: "2px solid var(--nbl-primary, #0284c7)",
                            }}
                        />
                        <s-stack direction="block" gap="100">
                            <s-text variant="bodySm" tone="subdued">
                                {imageFile.name} — {(imageFile.size / 1024).toFixed(0)} KB
                            </s-text>
                            <s-button
                                variant="plain" destructive size="small"
                                disabled={busy}
                                onClick={() => fs.clearPendingFilesFor("image")}
                            >
                                Remove
                            </s-button>
                        </s-stack>
                    </s-stack>
                )}

                {/* Drop zone */}
                <s-drop-zone
                    name="image"
                    label="Prize image"
                    accessibilityLabel="Upload prize image"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple={false}
                    disabled={busy}
                    onChange={(e) => {
                        const file = e.currentTarget?.files?.[0] ?? null;
                        if (file) fs.fileSetterFor("image")([file]);
                    }}
                />
            </s-stack>
        </s-section>
    );
}
