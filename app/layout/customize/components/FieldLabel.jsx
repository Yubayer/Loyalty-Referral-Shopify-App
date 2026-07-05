import { DS } from "../constants/cssVarsConfig";

// ─────────────────────────────────────────────────────────────────────────────
// FIELD LABEL
//
// Shared label row used inside FieldWrapper — shows a "Modified" badge
// when the field differs from its default.
// ─────────────────────────────────────────────────────────────────────────────

export function FieldLabel({ label, hint, isDirty }) {
    return (
        <div style={{ marginBottom: DS.sp10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: DS.sp8, marginBottom: DS.sp2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: DS.text }}>{label}</span>
                {isDirty && (
                    <span style={{
                        background: "#fef3c7", color: "#92400e",
                        fontSize: 10, fontWeight: 600, padding: "1px 7px",
                        borderRadius: DS.r99, border: "1px solid #fde68a",
                    }}>Modified</span>
                )}
            </div>
            {hint && <p style={{ fontSize: 12, color: DS.textMuted, margin: 0, lineHeight: 1.4 }}>{hint}</p>}
        </div>
    );
}
