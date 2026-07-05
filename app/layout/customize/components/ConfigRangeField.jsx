import { DS } from "../constants/cssVarsConfig";
import { getConfigValue, getConfigDefault } from "../_data";
import { FieldWrapper } from "./FieldWrapper";
import { FieldLabel } from "./FieldLabel";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG RANGE FIELD
// ─────────────────────────────────────────────────────────────────────────────

export function ConfigRangeField({ field, widgetConfig, onChange, disabled }) {
    const raw = getConfigValue(widgetConfig, field.configKey, field.default);
    const display = field.displayValue ? field.displayValue(raw) : Number(raw);
    const isDirty = raw !== getConfigDefault(field.configKey);

    function handleChange(v) {
        onChange(field.configKey, field.parseValue ? field.parseValue(v) : v);
    }
    function handleRevert() { onChange(field.configKey, getConfigDefault(field.configKey)); }

    const safeNum = isNaN(display) ? field.min : display;

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
