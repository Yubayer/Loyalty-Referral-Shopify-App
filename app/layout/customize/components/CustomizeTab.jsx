import { DS, PRESETS, SIMPLE_SECTIONS } from "../constants/cssVarsConfig";
import { PresetCard } from "./PresetCard";
import { SidebarNavItem } from "./SidebarNavItem";
import { SimpleSectionPanel } from "./SimpleSectionPanel";

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMIZE TAB
//
// Left sidebar (quick themes + section nav + reset/clear) + center section
// editor for the active Simple-mode section.
// ─────────────────────────────────────────────────────────────────────────────

export function CustomizeTab({
    activePreset,
    onPresetApply,
    activeSimpleSection,
    onSimpleSectionChange,
    simpleSectionDirtyCount,
    activeSimpleSectionDef,
    cssVars,
    onSimpleChange,
    notificationPreviewType,
    onNotificationPreviewChange,
    isNetworkSubmitting,
    onResetAll,
    onClearAll,
}) {
    return (
        <s-grid gridTemplateColumns="280px 1fr 1fr" gap="base">
            {/* LEFT SIDEBAR */}
            <div>
                <div style={{ position: "sticky", top: 16 }}>
                    <s-section>
                        {/* ── Quick Themes ── */}
                        <div style={{ marginBottom: DS.sp14 }}>
                            <div style={{
                                fontSize: 10, fontWeight: 700, color: DS.textHint,
                                letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: DS.sp10,
                            }}>Quick Themes</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: DS.sp6 }}>
                                {PRESETS.map((preset) => (
                                    <PresetCard
                                        key={preset.key}
                                        preset={preset}
                                        isActive={activePreset === preset.key}
                                        onApply={onPresetApply}
                                        disabled={isNetworkSubmitting}
                                    />
                                ))}
                            </div>
                        </div>

                        <div style={{ borderTop: `1px solid ${DS.borderLight}`, margin: `${DS.sp14} 0` }} />

                        {/* ── Section Nav ── */}
                        <div style={{ marginBottom: DS.sp10 }}>
                            <div style={{
                                fontSize: 10, fontWeight: 700, color: DS.textHint,
                                letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: DS.sp8,
                            }}>Customize</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                {SIMPLE_SECTIONS.map((section) => (
                                    <SidebarNavItem
                                        key={section.key}
                                        label={section.label}
                                        isActive={activeSimpleSection === section.key}
                                        badge={simpleSectionDirtyCount(section)}
                                        onClick={() => onSimpleSectionChange(section.key)}
                                        disabled={isNetworkSubmitting}
                                    />
                                ))}
                            </div>
                        </div>

                        <div style={{ borderTop: `1px solid ${DS.borderLight}`, marginTop: DS.sp14, paddingTop: DS.sp12 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: DS.sp6 }}>
                                <button
                                    disabled={isNetworkSubmitting}
                                    onClick={onResetAll}
                                    style={{
                                        background: DS.dangerBg, border: `1px solid #fecaca`, borderRadius: DS.r8,
                                        padding: "7px 12px", fontSize: 12, color: DS.dangerText,
                                        cursor: isNetworkSubmitting ? "default" : "pointer", fontWeight: 500, width: "100%",
                                    }}
                                >Reset all to defaults</button>
                                <button
                                    disabled={isNetworkSubmitting}
                                    onClick={onClearAll}
                                    style={{
                                        background: "none", border: `1px solid ${DS.borderLight}`, borderRadius: DS.r8,
                                        padding: "7px 12px", fontSize: 12, color: DS.textMuted,
                                        cursor: isNetworkSubmitting ? "default" : "pointer", fontWeight: 500, width: "100%",
                                    }}
                                >Clear (use CSS file)</button>
                            </div>
                        </div>
                    </s-section>
                </div>
            </div>

            {/* CENTER — section editor */}
            <s-section>
                <SimpleSectionPanel
                    section={activeSimpleSectionDef}
                    cssVars={cssVars}
                    onChange={onSimpleChange}
                    disabled={isNetworkSubmitting}
                    notificationPreviewType={notificationPreviewType}
                    onNotificationPreviewChange={onNotificationPreviewChange}
                />
            </s-section>
        </s-grid>
    );
}
