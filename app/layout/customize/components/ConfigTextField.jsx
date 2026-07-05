import { getConfigValue, getConfigDefault } from "../_data";
import { FieldWrapper } from "./FieldWrapper";
import { FieldLabel } from "./FieldLabel";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG TEXT FIELD
// ─────────────────────────────────────────────────────────────────────────────

export function ConfigTextField({ field, widgetConfig, onChange, disabled }) {
    const value = getConfigValue(widgetConfig, field.configKey, field.default);
    const isDirty = value !== getConfigDefault(field.configKey);

    function handleRevert() { onChange(field.configKey, getConfigDefault(field.configKey)); }

    return (
        <FieldWrapper isDirty={isDirty} onRevert={handleRevert} disabled={disabled}>
            <FieldLabel label={field.label} hint={field.hint} isDirty={isDirty} />
            <s-text-field
                value={value ?? ""}
                onInput={(e) => onChange(field.configKey, e.target.value)}
                disabled={disabled}
                auto-complete="off"
                placeholder={field.default ?? ""}
            />
        </FieldWrapper>
    );
}
