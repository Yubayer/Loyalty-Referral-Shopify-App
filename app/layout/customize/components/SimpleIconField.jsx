import { CSS_DEFAULTS, DS } from "../constants/cssVarsConfig";
import { FieldWrapper } from "./FieldWrapper";
import { FieldLabel } from "./FieldLabel";
import { Icon } from "./Icon";

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE ICON FIELD
//
// SVG equivalent of SimpleEmojiField — lets the merchant pick one of a small
// set of SVG icons (by name) instead of a raw emoji character. Used for the
// launcher "Button icon" field; storefront modules/icons.js renders the same
// icon names via launcherIcon().
// ─────────────────────────────────────────────────────────────────────────────

export function SimpleIconField({ field, cssVars, onChange, disabled }) {
    const rawValue = cssVars[field.maps[0]] ?? field.default;
    const current = field.displayValue ? field.displayValue(rawValue) : rawValue;
    const isDirty = field.maps.some((v) => cssVars[v] !== CSS_DEFAULTS[v]);

    function handlePick(iconName) {
        const cssVal = field.parseValue ? field.parseValue(iconName) : iconName;
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
                {field.options.map((iconName) => (
                    <button
                        key={iconName}
                        disabled={disabled}
                        onClick={() => handlePick(iconName)}
                        aria-label={iconName}
                        style={{
                            width: 46, height: 46,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            borderRadius: DS.r10,
                            border: current === iconName ? "2.5px solid #7c3aed" : `1.5px solid ${DS.borderLight}`,
                            background: current === iconName ? "#f5f3ff" : DS.bgCard,
                            color: current === iconName ? "#7c3aed" : DS.textSub,
                            cursor: disabled ? "default" : "pointer",
                            transform: current === iconName ? "scale(1.08)" : "scale(1)",
                            transition: "all 0.12s",
                        }}
                    ><Icon name={iconName} size={20} /></button>
                ))}
            </div>
        </FieldWrapper>
    );
}
