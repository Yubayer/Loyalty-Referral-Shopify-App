import { DS } from "../constants/cssVarsConfig";
import { SimpleColorField } from "./SimpleColorField";
import { SimpleRangeField } from "./SimpleRangeField";
import { SimpleEmojiField } from "./SimpleEmojiField";
import { SimpleIconField } from "./SimpleIconField";
import { SimpleSelectField } from "./SimpleSelectField";
import { SimpleTextField } from "./SimpleTextField";

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE SECTION PANEL
//
// Renders one "Customize" tab section — header + its list of fields,
// dispatching each field to the right Simple*Field component by type.
// ─────────────────────────────────────────────────────────────────────────────

export function SimpleSectionPanel({ section, cssVars, onChange, disabled, notificationPreviewType, onNotificationPreviewChange }) {
    return (
        <div>
            <div style={{ marginBottom: DS.sp20 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: DS.text, lineHeight: 1.2, marginBottom: DS.sp6 }}>{section.label}</div>
                <div style={{ fontSize: 12, color: DS.textMuted }}>{section.description}</div>
                {/* Notification preview toggle — shown below header when in Notifications section */}
                {section.key === "notifications" && onNotificationPreviewChange && (
                    <div style={{ display: "flex", alignItems: "center", gap: DS.sp8, marginTop: DS.sp10 }}>
                        <span style={{ fontSize: 12, color: DS.textMuted, fontWeight: 500 }}>Preview:</span>
                        <div style={{ display: "flex", background: "#ede9fe", borderRadius: DS.r8, padding: 3, gap: 2 }}>
                            {[["reward", "Reward"], ["info", "Info"]].map(([val, label]) => (
                                <button
                                    key={val}
                                    onClick={() => onNotificationPreviewChange(val)}
                                    style={{
                                        padding: "5px 14px", borderRadius: DS.r6, border: "none", fontSize: 12,
                                        background: notificationPreviewType === val ? "#ffffff" : "transparent",
                                        color: notificationPreviewType === val ? DS.text : DS.textMuted,
                                        fontWeight: notificationPreviewType === val ? 600 : 400,
                                        cursor: "pointer",
                                        boxShadow: notificationPreviewType === val ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                                        whiteSpace: "nowrap",
                                    }}
                                >{label}</button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: DS.sp10 }}>
                {section.fields
                    .filter((field) => {
                        if (section.key !== "notifications") return true;
                        const commonKeys = ["notifyBgFrom", "notifyBgTo", "notifyColor"];
                        if (commonKeys.includes(field.key)) return true;
                        if (notificationPreviewType === "reward") return field.key.startsWith("notifyReward");
                        if (notificationPreviewType === "info") return field.key.startsWith("notifyInfo");
                        return true;
                    })
                    .map((field) => {
                        if (field.type === "color") return <SimpleColorField key={field.key} field={field} cssVars={cssVars} onChange={onChange} disabled={disabled} />;
                        if (field.type === "range") return <SimpleRangeField key={field.key} field={field} cssVars={cssVars} onChange={onChange} disabled={disabled} />;
                        if (field.type === "emoji") return <SimpleEmojiField key={field.key} field={field} cssVars={cssVars} onChange={onChange} disabled={disabled} />;
                        if (field.type === "icon") return <SimpleIconField key={field.key} field={field} cssVars={cssVars} onChange={onChange} disabled={disabled} />;
                        if (field.type === "select") return <SimpleSelectField key={field.key} field={field} cssVars={cssVars} onChange={onChange} disabled={disabled} />;
                        return <SimpleTextField key={field.key} field={field} cssVars={cssVars} onChange={onChange} disabled={disabled} />;
                    })}
            </div>
        </div>
    );
}
