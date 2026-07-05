import { DS } from "../constants/cssVarsConfig";
import { getConfigValue, getConfigDefault } from "../_data";
import { FieldWrapper } from "./FieldWrapper";
import { FieldLabel } from "./FieldLabel";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG TOGGLE FIELD
// ─────────────────────────────────────────────────────────────────────────────

export function ConfigToggleField({ field, widgetConfig, onChange, disabled }) {
    const value = getConfigValue(widgetConfig, field.configKey, field.default);
    const isDirty = value !== getConfigDefault(field.configKey);

    function handleRevert() { onChange(field.configKey, getConfigDefault(field.configKey)); }

    return (
        <FieldWrapper isDirty={isDirty} onRevert={handleRevert} disabled={disabled}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <FieldLabel label={field.label} hint={field.hint} isDirty={isDirty} />
                <button
                    disabled={disabled}
                    onClick={() => onChange(field.configKey, !value)}
                    style={{
                        flexShrink: 0, width: 44, height: 24, borderRadius: DS.r99,
                        background: value ? "#7c3aed" : DS.borderMid,
                        border: "none", cursor: disabled ? "default" : "pointer",
                        position: "relative", transition: "background 0.2s", marginLeft: DS.sp12,
                    }}
                >
                    <span style={{
                        position: "absolute", top: 3, left: value ? 22 : 2,
                        width: 18, height: 18, borderRadius: "50%", background: "#fff",
                        transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                    }} />
                </button>
            </div>
        </FieldWrapper>
    );
}
