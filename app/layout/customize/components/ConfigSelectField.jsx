import { DS } from "../constants/cssVarsConfig";
import { getConfigValue, getConfigDefault } from "../_data";
import { FieldWrapper } from "./FieldWrapper";
import { FieldLabel } from "./FieldLabel";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG SELECT FIELD
// ─────────────────────────────────────────────────────────────────────────────

export function ConfigSelectField({ field, widgetConfig, onChange, disabled }) {
    const value = getConfigValue(widgetConfig, field.configKey, field.default);
    const isDirty = value !== getConfigDefault(field.configKey);

    function handleRevert() { onChange(field.configKey, getConfigDefault(field.configKey)); }

    return (
        <FieldWrapper isDirty={isDirty} onRevert={handleRevert} disabled={disabled}>
            <FieldLabel label={field.label} hint={field.hint} isDirty={isDirty} />
            <div style={{ display: "flex", gap: DS.sp6, flexWrap: "wrap" }}>
                {field.options.map((opt) => {
                    const isActive = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            disabled={disabled}
                            onClick={() => onChange(field.configKey, opt.value)}
                            style={{
                                padding: "7px 14px", fontSize: 12, fontWeight: isActive ? 700 : 500,
                                borderRadius: DS.r10,
                                border: `2px solid ${isActive ? "#7c3aed" : DS.borderLight}`,
                                background: isActive ? "#f5f3ff" : DS.bgCard,
                                color: isActive ? "#5b21b6" : DS.textSub,
                                cursor: disabled ? "default" : "pointer",
                                transition: "all 0.15s",
                            }}
                        >{opt.label}</button>
                    );
                })}
            </div>
        </FieldWrapper>
    );
}
