import { useState, useEffect, useRef, memo } from "react";
import { CSS_DEFAULTS, LABEL_DEFAULTS, DS } from "@app/presets/widgetPresets";
import { createPortal } from "react-dom";

// ─────────────────────────────────────────────────────────────────────────────
// LivePreview.jsx
// Standalone live preview panel — renders a phone-frame widget mock.
//
// Props:
//   cssVars       {object}  CSS variable map (--nbl-* keys)
//   previewScene  {string}  "home" | "earn" | "rewards" | "notification-reward"
//                           "notification-info" | "launcher" | "referral" | "modal"
//   widgetConfig  {object}  widgetConfig state (for label overrides)
//   CSS_DEFAULTS  {object}  Fallback CSS variable values
//   LABEL_DEFAULTS {object} Fallback label strings
//   DS            {object}  Design system tokens
// ─────────────────────────────────────────────────────────────────────────────

const LivePreviewPanel = memo(function LivePreviewPanel({
    cssVars,
    previewScene = "home",
    widgetConfig = null,
    hidden = false,
}) {
    // ── Label helper ───────────────────────────────────────────────────────
    const lbl = (key) => (widgetConfig?.labels?.[key]) || LABEL_DEFAULTS[key] || "";

    // ── Token helpers ──────────────────────────────────────────────────────
    const get = (key, fallback = "") => cssVars[key] ?? CSS_DEFAULTS[key] ?? fallback;

    const headerBg = get("--nbl-header-bg", "#8b5cf6");
    const headerColor = get("--nbl-header-color", "#ffffff");
    const navBg = get("--nbl-nav-bg", "#ffffff");
    const navBorderColor = get("--nbl-nav-border-color", "#e9e7f0");
    const navActiveColor = get("--nbl-nav-active-color", "#8b5cf6");
    const navItemColor = get("--nbl-nav-item-color", "#6b7280");
    const surface = get("--nbl-surface", "#ffffff");
    const textColor = get("--nbl-text", "#1a1a1a");
    const textMuted = get("--nbl-text-muted", "#6b7280");
    const border = get("--nbl-border", "#e9e7f0");
    const btnBg = get("--nbl-btn-bg", "#4ecba8");
    const btnColor = get("--nbl-btn-color", "#ffffff");
    const btnRadius = get("--nbl-btn-radius", "10px");
    const hscHeaderBg = get("--nbl-hsc-header-bg", "#f8f7ff");
    const radius = get("--nbl-radius", "16px");
    const cardRadius = get("--nbl-card-radius", "12px");
    const rewardItemBg = get("--nbl-reward-item-bg", "#f8f7ff");
    const rewardItemBorder = get("--nbl-reward-item-border", "#e9e7f0");
    const homeNavColor = get("--nbl-home-nav-color", "#ffffff");
    const activityPositive = get("--nbl-activity-positive-color", "#16a34a");
    const activityNegative = get("--nbl-activity-negative-color", "#dc2626");

    // Notification tokens
    const notifyBgFrom = get("--nbl-notify-bg-from", "#15803d");
    const notifyBgTo = get("--nbl-notify-bg-to", "#22c55e");
    const notifyColor = get("--nbl-notify-color", "#ffffff");
    const notifyRewardCodeBg = get("--nbl-notify-reward-code-bg", "rgba(255,255,255,0.22)");
    const notifyRewardBtnBg = get("--nbl-notify-reward-btn-bg", "#4ecba8");
    const notifyRewardBtnColor = get("--nbl-notify-reward-btn-color", "#16a34a");
    const notifyRewardBtnBorder = get("--nbl-notify-reward-btn-border", notifyRewardBtnBg);
    const notifyInfoBtnBg = get("--nbl-notify-info-btn-bg", "#4ecba8");
    const notifyInfoBtnColor = get("--nbl-notify-info-btn-color", "#ffffff");
    const notifyInfoBtnBorder = get("--nbl-notify-info-btn-border", notifyInfoBtnBg);

    // Modal tokens
    const modalBg = get("--nbl-modal-bg", "#ffffff");
    const modalTitleColor = get("--nbl-modal-title-color", "#111827");
    const modalTextColor = get("--nbl-modal-text-color", "#374151");
    const modalMutedColor = get("--nbl-modal-muted-color", "#9ca3af");
    const modalInputBg = get("--nbl-modal-input-bg", "#f9fafb");
    const modalInputBorder = get("--nbl-modal-input-border", "#e5e7eb");
    const modalBtnBg = get("--nbl-modal-btn-primary-bg", "#111827");
    const modalBrandBg = get("--nbl-modal-brand-bg", "#ecfdf5");
    const modalBrandColor = get("--nbl-modal-brand-color", "#15803d");

    // Launcher tokens
    const resolveLauncherToken = (raw, fallback) => (!raw || raw.startsWith("var(")) ? fallback : raw;
    const launcherBg = resolveLauncherToken(get("--nbl-launcher-bg"), btnBg);
    const launcherColor = resolveLauncherToken(get("--nbl-launcher-color"), btnColor);
    const launcherTitle = lbl("launcherTitle");
    const launcherIcon = get("--nbl-launcher-icon", "'🎁'").replace(/^'|'$/g, "");
    const launcherPosition = get("--nbl-launcher-position", "right");
    const isLeft = launcherPosition === "left";

    // ── Tab ↔ scene sync ───────────────────────────────────────────────────
    const sceneToTab = { home: 0, earn: 1, rewards: 2 };
    const overlayScenes = new Set(["notification-reward", "notification-info", "launcher", "referral"]);

    const [manualTab, setManualTab] = useState(null);
    const prevScene = useRef(previewScene);
    useEffect(() => {
        if (prevScene.current !== previewScene) {
            setManualTab(null);
            prevScene.current = previewScene;
        }
    }, [previewScene]);

    const resolvedTabIndex = manualTab !== null ? manualTab : (sceneToTab[previewScene] ?? 0);
    const isOverlay = overlayScenes.has(previewScene) && manualTab === null;
    const navTabs = [lbl("navHome"), lbl("navEarn"), lbl("navRewards")];

    const [widgetOpen, setWidgetOpen] = useState(true);
    useEffect(() => {
        if (previewScene !== "launcher") setWidgetOpen(true);
    }, [previewScene]);

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    const sceneLabels = {
        "home": "Home tab", "earn": "Earn tab", "rewards": "Rewards tab",
        "notification-reward": "Reward notification", "notification-info": "Info notification",
        "launcher": "Launcher button", "referral": "Referral claim", "modal": "Referral modal",
    };

    // ── Widget popup ───────────────────────────────────────────────────────
    const widgetPopup = widgetOpen && (
        <div data-nbl-preview style={{
            position: "fixed", bottom: 95,
            ...(isLeft ? { left: 24 } : { right: 24 }),
            width: 390, height: 520,
            display: "flex", flexDirection: "column",
            background: surface, borderRadius: radius, overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)",
            zIndex: 9999998,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: "14px", lineHeight: 1.5, color: "#1a1a1a", boxSizing: "border-box",
            animation: "nblWidgetIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
        }}>
            {/* Header */}
            <div style={{ background: headerBg, padding: "18px 16px 16px", position: "relative" }}>
                <div onClick={() => setWidgetOpen(false)} style={{
                    position: "absolute", top: 10, right: 10,
                    width: 28, height: 28, borderRadius: "50%",
                    background: "rgba(255,255,255,0.18)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, color: headerColor, fontWeight: 700, cursor: "pointer",
                }}>✕</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: headerColor, marginBottom: 10, letterSpacing: "-0.02em" }}>
                    {lbl("headerLabel").replace("[name]", "Dev 21")}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", background: "rgba(255,255,255,0.18)", borderRadius: 99, padding: "5px 16px", border: "1px solid rgba(255,255,255,0.28)" }}>
                    <span style={{ fontSize: 12, color: headerColor, fontWeight: 500 }}>
                        {lbl("pointsLabel").replace("[points]", "1,425")}
                    </span>
                </div>
            </div>

            {/* Nav */}
            <div style={{ background: navBg, borderBottom: `1.5px solid ${navBorderColor}`, display: "flex", alignItems: "stretch", padding: "0 10px" }}>
                {navTabs.map((tab, i) => (
                    <button key={tab} onClick={() => setManualTab(i)} style={{
                        background: "none", border: "none", cursor: "pointer",
                        padding: "12px 8px 10px", fontSize: 12,
                        fontWeight: resolvedTabIndex === i ? 600 : 400,
                        color: resolvedTabIndex === i ? navActiveColor : navItemColor,
                        borderBottom: resolvedTabIndex === i ? `2.5px solid ${navActiveColor}` : "2.5px solid transparent",
                        marginBottom: -1.5, transition: "all 0.15s", flex: 1, textAlign: "center",
                    }}>{tab}</button>
                ))}
                <div style={{ display: "flex", alignItems: "center", padding: "0 4px" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: navBg, border: `1.5px solid ${navBorderColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: navItemColor, fontWeight: 700 }}>›</div>
                </div>
            </div>

            {/* Tab body */}
            <div style={{ background: surface, padding: "12px 10px", position: "relative", overflowY: "auto", flex: 1 }}>

                {/* HOME TAB */}
                {resolvedTabIndex === 0 && !isOverlay && (
                    <>
                        {[
                            { icon: "🛍️", label: lbl("homeCardBrowse") },
                            { icon: "⚡", label: lbl("homeCardEarn") },
                            { icon: "👥", label: lbl("homeCardRefer") },
                        ].map((item) => (
                            <div key={item.label} style={{ background: headerBg, borderRadius: cardRadius, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: homeNavColor }}>{item.label}</span>
                                </div>
                                <span style={{ fontSize: 15, color: homeNavColor, opacity: 0.75 }}>›</span>
                            </div>
                        ))}
                        <div style={{ height: 8 }} />
                        {/* Active Rewards */}
                        <div style={{ border: `1.5px solid ${border}`, borderRadius: cardRadius, overflow: "hidden", marginBottom: 8 }}>
                            <div style={{ background: hscHeaderBg, padding: "9px 12px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 7 }}>
                                <span>🎁</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: textColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>{lbl("sectionActiveRewards")}</span>
                            </div>
                            {[{ label: "Voucher $5" }, { label: "Voucher $10" }].map((v, i) => (
                                <div key={i} style={{ background: surface, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: i === 0 ? `1px solid ${border}` : "none" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{ fontSize: 16 }}>🎁</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{v.label}</span>
                                    </div>
                                    <span style={{ fontSize: 14, color: navActiveColor }}>›</span>
                                </div>
                            ))}
                        </div>
                        {/* Recent Activity */}
                        <div style={{ border: `1.5px solid ${border}`, borderRadius: cardRadius, overflow: "hidden" }}>
                            <div style={{ background: hscHeaderBg, padding: "9px 12px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 7 }}>
                                <span>⚡</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: textColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>{lbl("sectionRecentActivity")}</span>
                            </div>
                            <div style={{ padding: "2px 0" }}>
                                <div style={{ display: "flex", padding: "5px 12px" }}>
                                    {[lbl("activityColDate").toUpperCase(), lbl("activityColActivity").toUpperCase(), lbl("activityColPoints").toUpperCase()].map((h) => (
                                        <span key={h} style={{ flex: 1, fontSize: 10, fontWeight: 700, color: textMuted, letterSpacing: "0.06em" }}>{h}</span>
                                    ))}
                                </div>
                                {[
                                    { date: "Jun 01", label: "Voucher $5 redeemed", pts: "-10", pos: false },
                                    { date: "May 31", label: "Direct purchase", pts: "+50", pos: true },
                                ].map((row, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", padding: "6px 12px", borderTop: `1px solid ${border}` }}>
                                        <span style={{ flex: 1, fontSize: 11, color: textMuted }}>{row.date}</span>
                                        <span style={{ flex: 2, fontSize: 11, color: textMuted }}>{row.label}</span>
                                        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: row.pos ? activityPositive : activityNegative, textAlign: "right" }}>{row.pts}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* EARN TAB */}
                {resolvedTabIndex === 1 && !isOverlay && (
                    <div>
                        {[
                            { icon: "👥", label: "Refer a Friend", sub: "100 points (first order)" },
                            { icon: "🛒", label: "Direct Purchase", sub: "50 points per $1" },
                            { icon: "⭐", label: "Loox Review Written", sub: "10 points text · 20 points photo" },
                        ].map((item, i) => (
                            <div key={i} style={{ background: rewardItemBg, border: `1.5px solid ${rewardItemBorder}`, borderRadius: cardRadius, padding: "12px 13px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: textColor }}>{item.label}</div>
                                    <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>{item.sub}</div>
                                </div>
                                <span style={{ fontSize: 14, color: navActiveColor }}>›</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* REWARDS TAB */}
                {resolvedTabIndex === 2 && !isOverlay && (
                    <div>
                        {[
                            { label: "Voucher $5", pts: "10 points" },
                            { label: "Voucher $30", pts: "300 points" },
                            { label: "Voucher $10", pts: "200 points" },
                        ].map((item, i) => (
                            <div key={i} style={{ background: rewardItemBg, border: `1.5px solid ${rewardItemBorder}`, borderRadius: cardRadius, padding: "12px 13px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 22, flexShrink: 0 }}>🎁</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: textColor }}>{item.label}</div>
                                    <div style={{ fontSize: 12, color: navActiveColor, fontWeight: 600, marginTop: 2 }}>{item.pts}</div>
                                </div>
                                <span style={{ fontSize: 14, color: navActiveColor }}>›</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* OVERLAY — Reward notification */}
                {previewScene === "notification-reward" && isOverlay && (
                    <>
                        <div style={{ opacity: 0.28, pointerEvents: "none" }}>
                            {[{ icon: "🛍️", label: lbl("homeCardBrowse") }, { icon: "⚡", label: lbl("homeCardEarn") }].map((item) => (
                                <div key={item.label} style={{ background: headerBg, borderRadius: cardRadius, padding: "10px 12px", marginBottom: 7, display: "flex", alignItems: "center", gap: 10 }}>
                                    <span>{item.icon}</span><span style={{ fontSize: 12, color: homeNavColor }}>{item.label}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: `linear-gradient(135deg, ${notifyBgFrom} 0%, ${notifyBgTo} 100%)`, borderRadius: `0 0 ${radius} ${radius}`, padding: "16px 14px 20px" }}>
                            <div style={{ position: "absolute", top: 10, right: 10, width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: notifyColor, fontWeight: 700 }}>✕</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: notifyColor, marginBottom: 10 }}>{lbl("notifyRewardHeading")}</div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <div style={{ flex: 1, background: notifyRewardCodeBg, borderRadius: cardRadius, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: notifyColor, letterSpacing: "0.12em" }}>NBL_TWTFGQE</span>
                                </div>
                                <button style={{ background: notifyRewardBtnBg, border: `1px solid ${notifyRewardBtnBorder}`, borderRadius: cardRadius, padding: "10px 16px", fontSize: 13, fontWeight: 700, color: notifyRewardBtnColor, cursor: "pointer", flexShrink: 0 }}>{lbl("notifyRewardCopyBtn")}</button>
                            </div>
                        </div>
                    </>
                )}

                {/* OVERLAY — Info notification */}
                {previewScene === "notification-info" && isOverlay && (
                    <>
                        <div style={{ opacity: 0.28, pointerEvents: "none" }}>
                            {[{ icon: "👥", label: "Refer a Friend", sub: "100 pts" }, { icon: "🛒", label: "Direct Purchase", sub: "50 pts/$1" }].map((item, i) => (
                                <div key={i} style={{ background: rewardItemBg, border: `1px solid ${border}`, borderRadius: cardRadius, padding: "10px 12px", marginBottom: 7, display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: textColor }}>{item.label}</div>
                                        <div style={{ fontSize: 11, color: textMuted }}>{item.sub}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: `linear-gradient(135deg, ${notifyBgFrom} 0%, ${notifyBgTo} 100%)`, borderRadius: `0 0 ${radius} ${radius}`, padding: "16px 14px 20px" }}>
                            <div style={{ position: "absolute", top: 10, right: 10, width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: notifyColor, fontWeight: 700 }}>✕</div>
                            <p style={{ fontSize: 13, color: notifyColor, lineHeight: 1.55, margin: "0 0 12px 0", paddingRight: 24 }}>Earn 100 points when your friend places their first subscription order. Your friend gets $10 off on their first order.</p>
                            <button style={{ background: notifyInfoBtnBg, border: `1px solid ${notifyInfoBtnBorder}`, borderRadius: btnRadius, padding: "9px 22px", fontSize: 13, fontWeight: 700, color: notifyInfoBtnColor, cursor: "pointer" }}>{lbl("notifyInfoClaimBtn")}</button>
                        </div>
                    </>
                )}

                {/* OVERLAY — Referral confirm */}
                {previewScene === "referral" && isOverlay && (
                    <>
                        <div style={{ opacity: 0.28, pointerEvents: "none" }}>
                            {[{ label: "Voucher $5", pts: "10 points" }, { label: "Voucher $30", pts: "300 points" }].map((item, i) => (
                                <div key={i} style={{ background: rewardItemBg, border: `1px solid ${border}`, borderRadius: cardRadius, padding: "10px 12px", marginBottom: 7, display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 20 }}>🎁</span>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: textColor }}>{item.label}</div>
                                        <div style={{ fontSize: 12, color: navActiveColor, fontWeight: 600 }}>{item.pts}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#0f172a", borderRadius: `0 0 ${radius} ${radius}`, padding: "16px 14px 20px" }}>
                            <div style={{ position: "absolute", top: 10, right: 10, width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>✕</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 12 }}>Spend 10 points for this reward?</div>
                            <button style={{ background: btnBg, border: "none", borderRadius: btnRadius, padding: "9px 22px", fontSize: 13, fontWeight: 700, color: btnColor, cursor: "pointer" }}>Claim</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    // ── Launcher button ────────────────────────────────────────────────────
    const launcherButton = (
        <div onClick={() => setWidgetOpen((o) => !o)} style={{
            position: "fixed", bottom: 24,
            ...(isLeft ? { left: 24 } : { right: 24 }),
            display: "flex", alignItems: "center", gap: 10,
            background: launcherBg, borderRadius: 999, padding: "9px 18px 9px 9px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.24), 0 2px 8px rgba(0,0,0,0.12)",
            zIndex: 9999999, cursor: "pointer", userSelect: "none",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            boxSizing: "border-box",
            outline: previewScene === "launcher" ? `3px solid ${launcherBg}` : "none",
            outlineOffset: previewScene === "launcher" ? "4px" : "0",
            transition: "outline 0.15s, outline-offset 0.15s, transform 0.12s",
        }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(0,0,0,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{launcherIcon}</div>
            <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: launcherColor, lineHeight: 1.2, whiteSpace: "nowrap" }}>{launcherTitle}</div>
                <div style={{ fontSize: 10, color: launcherColor, opacity: 0.8 }}>{lbl("launcherSubtitle").replace("[points]", "1,425")}</div>
            </div>
        </div>
    );

    // ── Referral Modal preview ─────────────────────────────────────────────
    const modalPreview = (
        <div data-nbl-preview style={{
            position: "fixed", bottom: 95,
            ...(isLeft ? { left: 24 } : { right: 24 }),
            width: 390, borderRadius: "20px", background: modalBg,
            boxShadow: "0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.10)",
            zIndex: 9999998, overflow: "hidden",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            boxSizing: "border-box", animation: "nblWidgetIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
            padding: "28px 24px 24px",
        }}>
            <div style={{ position: "absolute", top: 16, right: 18, width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: modalMutedColor, cursor: "pointer", fontWeight: 300 }}>×</div>
            <div style={{ marginBottom: 16 }}>
                <span style={{ background: modalBrandBg, color: modalBrandColor, fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 99 }}>NBL Loyalty</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: modalTitleColor, marginBottom: 6, lineHeight: 1.25 }}>Get Your Referral Discount 🎁</div>
            <div style={{ fontSize: 13, color: modalTextColor, marginBottom: 22, lineHeight: 1.5 }}>Enter your referral code to unlock your discount.</div>
            <div style={{ background: modalInputBg, border: `1.5px solid ${modalInputBorder}`, borderRadius: "12px", padding: "13px 16px", fontSize: 14, color: modalTitleColor, fontWeight: 500, marginBottom: 12, letterSpacing: "0.04em" }}>NBL_0IVCLVE</div>
            <div style={{ background: modalBtnBg, borderRadius: "12px", padding: "14px", textAlign: "center", fontSize: 14, fontWeight: 700, color: "#ffffff", cursor: "pointer", marginBottom: 14 }}>Request Discount Code</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: "12px", padding: "11px 14px", fontSize: 13, color: "#dc2626", fontWeight: 500 }}>
                <span style={{ fontSize: 15 }}>❌</span>
                Invalid referral code. Please check the code and try again.
            </div>
        </div>
    );

    const keyframes = (
        <style>{`
            @keyframes nblWidgetIn {
                from { opacity: 0; transform: translateY(16px) scale(0.97); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            [data-nbl-preview] * { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box; }
            [data-nbl-preview] button { font-family: inherit; }
        `}</style>
    );

    // ── Render ─────────────────────────────────────────────────────────────
    // hidden=true (config tab): render nothing — no chip, no portal
    if (hidden) return null;
    
    return (
        <>
            {/* Scene indicator chip */}
            {/* <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: '12px',
                padding: "8px 12px", background: DS.bgCard,
                border: `1.5px solid ${DS.accentBorder}`, borderRadius: DS.r10,
                marginTop: '15px'
            }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 600, color: DS.textMuted }}>
                    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 2px #bbf7d0", flexShrink: 0 }} />
                    Live Preview
                </span>
                <span style={{
                    fontSize: 10, fontWeight: 700, color: DS.accentText,
                    background: DS.accentBg, border: `1px solid ${DS.accentBorder}`,
                    borderRadius: 99, padding: "2px 9px", letterSpacing: "0.04em", textTransform: "uppercase",
                }}>
                    {sceneLabels[previewScene] ?? "Home tab"}
                </span>
            </div> */}
            <div style={{ marginTop: 8, fontSize: 11, color: DS.textHint, textAlign: "center" }}>
                Launcher (bottom-right) · click to open/close
            </div>

            {/* Portal */}
            {isMounted && !hidden && createPortal(
                <>
                    {keyframes}
                    {previewScene === "modal" ? modalPreview : (
                        <>{launcherButton}{widgetPopup}</>
                    )}
                </>,
                document.body
            )}
        </>
    );
});

export default LivePreviewPanel;