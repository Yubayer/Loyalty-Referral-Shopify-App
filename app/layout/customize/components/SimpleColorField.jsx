import { CSS_DEFAULTS, isHex, DS } from "../constants/cssVarsConfig";
import { FieldWrapper } from "./FieldWrapper";
import { FieldLabel } from "./FieldLabel";

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE COLOR FIELD
// ─────────────────────────────────────────────────────────────────────────────

export function SimpleColorField({ field, cssVars, onChange, disabled }) {
    const rawValue = cssVars[field.maps[0]] ?? field.default;
    const displayHex = isHex(rawValue) ? rawValue : (field.resolvedDefault ?? "#cccccc");
    const isDirty = field.maps.some((v) => cssVars[v] !== CSS_DEFAULTS[v]);

    function handleChange(hex) {
        const updates = {};
        field.maps.forEach((varName) => { updates[varName] = hex; });
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
            <div style={{ display: "flex", alignItems: "center", gap: DS.sp12 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: DS.r10,
                        border: `2px solid ${isDirty ? DS.warnBorder : DS.borderMid}`,
                        background: displayHex, overflow: "hidden",
                        cursor: disabled ? "default" : "pointer",
                        boxShadow: `0 2px 8px ${displayHex}55`,
                    }}>
                        {!disabled && (
                            <input
                                type="color"
                                value={displayHex}
                                onChange={(e) => handleChange(e.target.value)}
                                style={{ opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer", border: "none", padding: 0 }}
                            />
                        )}
                    </div>
                </div>
                <div style={{ flex: 1 }}>
                    <s-text-field
                        value={isHex(rawValue) ? rawValue : displayHex}
                        onInput={(e) => { if (isHex(e.target.value)) handleChange(e.target.value); }}
                        disabled={disabled}
                        auto-complete="off"
                        placeholder="#000000"
                        style={{ fontFamily: "monospace", maxWidth: 140 }}
                    />
                    {/* When the stored value is a CSS var() ref, tell the user what it resolved to */}
                    {!isHex(rawValue) && rawValue && rawValue.startsWith("var(") && (
                        <div style={{ fontSize: 10, color: DS.textHint, marginTop: 4 }}>
                            Using theme default ({displayHex}). Pick a color to override.
                        </div>
                    )}
                </div>
            </div>
        </FieldWrapper>
    );
}
