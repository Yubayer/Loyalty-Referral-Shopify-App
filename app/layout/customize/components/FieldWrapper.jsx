import { DS } from "../constants/cssVarsConfig";

// ─────────────────────────────────────────────────────────────────────────────
// FIELD WRAPPER
//
// Shared card-style wrapper for every Simple-mode and Config field. Shows a
// "Revert to default" button when the field is dirty.
// ─────────────────────────────────────────────────────────────────────────────

export function FieldWrapper({ isDirty, children, onRevert, disabled }) {
    return (
        <div style={{
            background: isDirty ? DS.warnBg : DS.bgCard,
            border: `1.5px solid ${isDirty ? DS.warnBorder : DS.borderLight}`,
            borderRadius: DS.r12,
            padding: `${DS.sp14} ${DS.sp16}`,
            transition: "all 0.18s",
        }}>
            {children}
            {isDirty && (
                <div style={{ marginTop: DS.sp10, display: "flex", justifyContent: "flex-end" }}>
                    <button
                        disabled={disabled}
                        onClick={onRevert}
                        style={{
                            background: "none", border: `1px solid ${DS.warnBorder}`, borderRadius: DS.r6,
                            padding: "3px 10px", fontSize: 11, color: DS.warnText,
                            cursor: disabled ? "default" : "pointer", fontWeight: 500,
                            display: "flex", alignItems: "center", gap: 4,
                        }}
                    >↩ Revert to default</button>
                </div>
            )}
        </div>
    );
}
