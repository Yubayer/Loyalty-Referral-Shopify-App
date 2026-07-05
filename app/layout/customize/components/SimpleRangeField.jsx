import { CSS_DEFAULTS, DS } from "../constants/cssVarsConfig";
import { FieldWrapper } from "./FieldWrapper";
import { FieldLabel } from "./FieldLabel";

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE RANGE FIELD
// ─────────────────────────────────────────────────────────────────────────────

export function SimpleRangeField({ field, cssVars, onChange, disabled }) {
    const rawValue = cssVars[field.maps[0]] ?? field.default;
    const numValue = field.displayValue ? field.displayValue(rawValue) : parseInt(rawValue);
    const isDirty = field.maps.some((v) => cssVars[v] !== CSS_DEFAULTS[v]);

    function handleChange(num) {
        const cssVal = field.parseValue ? field.parseValue(num) : `${num}px`;
        const updates = {};
        field.maps.forEach((varName) => { updates[varName] = cssVal; });
        onChange(updates);
    }
    function handleRevert() {
        const updates = {};
        field.maps.forEach((varName) => { updates[varName] = CSS_DEFAULTS[varName]; });
        onChange(updates);
    }

    const safeNum = isNaN(numValue) ? field.min : numValue;

    return (
        <FieldWrapper isDirty={isDirty} onRevert={handleRevert} disabled={disabled}>
            <FieldLabel label={field.label} hint={field.hint} isDirty={isDirty} />
            <div style={{ display: "flex", alignItems: "center", gap: DS.sp12 }}>
                <div style={{ flex: 1 }}>
                    <input
                        type="range" min={field.min} max={field.max} step={1} value={safeNum}
                        disabled={disabled}
                        onChange={(e) => handleChange(parseInt(e.target.value))}
                        style={{ width: "100%", accentColor: "#6d28d9", height: 4 }}
                    />
                </div>
                <div style={{
                    minWidth: 52, textAlign: "center",
                    background: DS.accentBg, borderRadius: DS.r8,
                    padding: "4px 10px", fontSize: 13, fontWeight: 700, color: DS.accentText,
                    border: `1px solid ${DS.accentBorder}`,
                }}>
                    {safeNum}{field.unit}
                </div>
            </div>
        </FieldWrapper>
    );
}
