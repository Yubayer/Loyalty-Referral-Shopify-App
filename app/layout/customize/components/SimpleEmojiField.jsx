import { CSS_DEFAULTS, DS } from "../constants/cssVarsConfig";
import { FieldWrapper } from "./FieldWrapper";
import { FieldLabel } from "./FieldLabel";

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE EMOJI FIELD
// ─────────────────────────────────────────────────────────────────────────────

export function SimpleEmojiField({ field, cssVars, onChange, disabled }) {
    const rawValue = cssVars[field.maps[0]] ?? field.default;
    const current = field.displayValue ? field.displayValue(rawValue) : rawValue;
    const isDirty = field.maps.some((v) => cssVars[v] !== CSS_DEFAULTS[v]);

    function handlePick(emoji) {
        const cssVal = field.parseValue ? field.parseValue(emoji) : emoji;
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
            <div style={{ display: "flex", gap: DS.sp8, flexWrap: "wrap" }}>
                {field.options.map((emoji) => (
                    <button
                        key={emoji}
                        disabled={disabled}
                        onClick={() => handlePick(emoji)}
                        style={{
                            fontSize: 22, width: 46, height: 46,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            borderRadius: DS.r10,
                            border: current === emoji ? "2.5px solid #7c3aed" : `1.5px solid ${DS.borderLight}`,
                            background: current === emoji ? "#f5f3ff" : DS.bgCard,
                            cursor: disabled ? "default" : "pointer",
                            transform: current === emoji ? "scale(1.08)" : "scale(1)",
                        }}
                    >{emoji}</button>
                ))}
            </div>
        </FieldWrapper>
    );
}
