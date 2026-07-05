import { CSS_DEFAULTS } from "../constants/cssVarsConfig";
import { FieldWrapper } from "./FieldWrapper";
import { FieldLabel } from "./FieldLabel";

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE TEXT FIELD
// ─────────────────────────────────────────────────────────────────────────────

export function SimpleTextField({ field, cssVars, onChange, disabled }) {
    const rawValue = cssVars[field.maps[0]] ?? field.default;
    const display = field.displayValue ? field.displayValue(rawValue) : rawValue;
    const isDirty = field.maps.some((v) => cssVars[v] !== CSS_DEFAULTS[v]);

    function handleChange(val) {
        const cssVal = field.parseValue ? field.parseValue(val) : val;
        const updates = {};
        field.maps.forEach((varName) => { updates[varName] = cssVal; });
        onChange(updates);
    }
    function handleRevert() {
        const updates = {};
        field.maps.forEach((varName) => { updates[varName] = CSS_DEFAULTS[varName]; });
        onChange(updates);
    }

    return (
        <FieldWrapper isDirty={isDirty} onRevert={handleRevert} disabled={disabled}>
            <FieldLabel label={field.label} hint={field.hint} isDirty={isDirty} />
            <s-text-field
                value={display}
                onInput={(e) => handleChange(e.target.value)}
                disabled={disabled}
                auto-complete="off"
            />
        </FieldWrapper>
    );
}
