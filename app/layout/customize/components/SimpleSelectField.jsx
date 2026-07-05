import { CSS_DEFAULTS, DS } from "../constants/cssVarsConfig";
import { FieldWrapper } from "./FieldWrapper";
import { FieldLabel } from "./FieldLabel";

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE SELECT FIELD
// ─────────────────────────────────────────────────────────────────────────────

export function SimpleSelectField({ field, cssVars, onChange, disabled }) {
    const rawValue = cssVars[field.maps[0]] ?? field.default;
    const isDirty = field.maps.some((v) => cssVars[v] !== CSS_DEFAULTS[v]);

    function handleChange(val) {
        const updates = {};
        field.maps.forEach((varName) => { updates[varName] = val; });
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
            <div style={{ display: "flex", gap: DS.sp8 }}>
                {field.options.map((opt) => {
                    const isActive = rawValue === opt.value;
                    return (
                        <button
                            key={opt.value}
                            disabled={disabled}
                            onClick={() => handleChange(opt.value)}
                            style={{
                                flex: 1, padding: "9px 16px", fontSize: 13, fontWeight: isActive ? 700 : 500,
                                borderRadius: DS.r10,
                                border: `2px solid ${isActive ? "#7c3aed" : DS.borderLight}`,
                                background: isActive ? "#f5f3ff" : DS.bgCard,
                                color: isActive ? "#5b21b6" : DS.textSub,
                                cursor: disabled ? "default" : "pointer",
                                transition: "all 0.15s",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: DS.sp6,
                            }}
                        >
                            <span style={{
                                width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                                border: `2px solid ${isActive ? "#7c3aed" : DS.borderMid}`,
                                background: isActive ? "#7c3aed" : "transparent",
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                                {isActive && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
                            </span>
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </FieldWrapper>
    );
}
