import { SaveBar } from "@app/components/saveBar/SaveBar";
import { ImageUploadField } from "./ImageUploadField";
import { PricingFields } from "./PricingFields";
import { MultiplierCalculator } from "./MultiplierCalculator";
import { PrizeSummaryPanel } from "./PrizeSummaryPanel";

/**
 * Create / edit form for a single physical prize. Submits as multipart
 * form data (image is sent directly on save, no pre-upload step).
 */
export function PrizeForm({
    formRef,
    fs,
    isEdit,
    busy,
    multiplier, onMultiplierChange,
    pointsPerDollar, onPointsPerDollarChange,
    suggestedPoints,
    onPrimary,
    onDiscard,
}) {
    const imageFile = fs.pendingFiles?.image?.[0] ?? null;
    const imagePreviewUrl = imageFile ? URL.createObjectURL(imageFile) : null;

    return (
        <form ref={formRef}>
            <s-grid gridTemplateColumns="2fr 1fr" gap="base">

                {/* ── Left ───────────────────────────────────────────── */}
                <s-box>

                    {/* Title + Description */}
                    <s-box paddingBlockEnd="base">
                        <s-section>
                            <s-text-field
                                label="Prize Title"
                                placeholder="e.g. SanDisk CFexpress Card"
                                value={fs.form.title}
                                disabled={busy}
                                error={fs.errorFor("title") ?? undefined}
                                onInput={(e) => fs.set("title", e.target.value)}
                                onBlur={() => fs.touchField("title")}
                            />
                            <s-box paddingBlockEnd="base" />
                            <s-text-area
                                label="Description / Notes (Optional)"
                                placeholder="e.g. Aspirational prize. Set value to your cost."
                                value={fs.form.description}
                                rows={3}
                                disabled={busy}
                                onInput={(e) => fs.set("description", e.target.value)}
                            />
                        </s-section>
                    </s-box>

                    {/* Image Upload */}
                    <s-box paddingBlockEnd="base">
                        <ImageUploadField fs={fs} imageFile={imageFile} imagePreviewUrl={imagePreviewUrl} busy={busy} />
                    </s-box>

                    {/* Points Cost + Product Value */}
                    <s-box paddingBlockEnd="base">
                        <PricingFields fs={fs} busy={busy} suggestedPoints={suggestedPoints} />
                    </s-box>

                    {/* Multiplier Calculator */}
                    <MultiplierCalculator
                        productValue={fs.form.productValue}
                        multiplier={multiplier}
                        onMultiplierChange={onMultiplierChange}
                        pointsPerDollar={pointsPerDollar}
                        onPointsPerDollarChange={onPointsPerDollarChange}
                        suggestedPoints={suggestedPoints}
                    />

                    <s-box paddingBlockEnd="base" />
                </s-box>

                {/* ── Right ──────────────────────────────────────────── */}
                <PrizeSummaryPanel fs={fs} imageFile={imageFile} busy={busy} />
            </s-grid>

            {/* ── SaveBar ──────────────────────────────────────────── */}
            <SaveBar
                visible={fs.isDirty || busy}
                position="bottom-center"
                message={isEdit ? "You have unsaved changes" : "New prize — not saved yet"}
                primaryLabel={isEdit ? "Update Prize" : "Save Prize"}
                secondaryLabel="Discard"
                loading={busy}
                disabled={busy}
                onPrimary={onPrimary}
                onSecondary={onDiscard}
            />
        </form>
    );
}
