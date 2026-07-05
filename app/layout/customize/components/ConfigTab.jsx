import { DS, WIDGET_CONFIG_DEFAULTS, WIDGET_CONFIG_SECTIONS } from "../constants/cssVarsConfig";
import { SidebarNavItem } from "./SidebarNavItem";
import { ConfigSectionPanel } from "./ConfigSectionPanel";

const CONFIG_SECTIONS = WIDGET_CONFIG_SECTIONS.filter((s) => s.key !== "labels");

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG TAB
//
// Left section nav (excludes "labels" — that's its own tab) + right section
// editor for the active Config section.
// ─────────────────────────────────────────────────────────────────────────────

export function ConfigTab({
    activeConfigSection,
    onConfigSectionChange,
    configSectionDirtyCount,
    widgetConfig,
    onConfigChange,
    onResetConfig,
    isNetworkSubmitting,
}) {
    const activeSection = CONFIG_SECTIONS.find((s) => s.key === activeConfigSection) ?? CONFIG_SECTIONS[0];

    return (
        <s-grid gridTemplateColumns="280px 1fr 1fr" gap="base">
            {/* LEFT — config section nav */}
            <div>
                <div style={{ position: "sticky", top: 16 }}>
                    <s-section>
                        <div style={{ marginBottom: DS.sp8 }}>
                            <div style={{
                                fontSize: 10, fontWeight: 700, color: DS.textHint,
                                letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: DS.sp8,
                            }}>Config</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                {CONFIG_SECTIONS.map((section) => (
                                    <SidebarNavItem
                                        key={section.key}
                                        label={section.label}
                                        isActive={activeConfigSection === section.key}
                                        badge={configSectionDirtyCount(section)}
                                        onClick={() => onConfigSectionChange(section.key)}
                                        disabled={isNetworkSubmitting}
                                    />
                                ))}
                            </div>
                        </div>
                        <div style={{ borderTop: `1px solid ${DS.borderLight}`, marginTop: DS.sp14, paddingTop: DS.sp12 }}>
                            <button
                                disabled={isNetworkSubmitting}
                                onClick={() => onResetConfig({ ...WIDGET_CONFIG_DEFAULTS })}
                                style={{
                                    background: DS.dangerBg, border: `1px solid #fecaca`, borderRadius: DS.r8,
                                    padding: "7px 12px", fontSize: 12, color: DS.dangerText,
                                    cursor: isNetworkSubmitting ? "default" : "pointer", fontWeight: 500, width: "100%",
                                }}
                            >Reset config to defaults</button>
                        </div>
                    </s-section>
                </div>
            </div>

            {/* RIGHT — config section editor */}
            <s-section>
                <ConfigSectionPanel
                    section={activeSection}
                    widgetConfig={widgetConfig}
                    onChange={onConfigChange}
                    disabled={isNetworkSubmitting}
                />
            </s-section>
        </s-grid>
    );
}
