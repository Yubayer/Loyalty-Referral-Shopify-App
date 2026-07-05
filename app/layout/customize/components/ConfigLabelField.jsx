import { FieldWrapper } from "./FieldWrapper";
import { FieldLabel } from "./FieldLabel";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG LABEL FIELD
//
// Used on the "Labels & Text" tab. Reads widgetConfig.labels directly (not
// via getConfigValue/getConfigDefault) since the dirty check here is simply
// "does this label differ from its own field.default", not the shared
// nested-config-key resolution used by the other Config*Field components.
// ─────────────────────────────────────────────────────────────────────────────

export function ConfigLabelField({ field, widgetConfig, onChange, disabled }) {
    const labelKey = field.configKey.startsWith("labels.") ? field.configKey.slice(7) : field.configKey;
    const value = (widgetConfig.labels?.[labelKey]) ?? field.default;
    const isDirty = value !== field.default;

    function handleRevert() { onChange(field.configKey, field.default); }

    return (
        <FieldWrapper isDirty={isDirty} onRevert={handleRevert} disabled={disabled}>
            <FieldLabel label={field.label} hint={field.hint} isDirty={isDirty} />
            <s-text-field
                value={value}
                onInput={(e) => onChange(field.configKey, e.target.value)}
                disabled={disabled}
                auto-complete="off"
                placeholder={field.default}
            />
        </FieldWrapper>
    );
}
