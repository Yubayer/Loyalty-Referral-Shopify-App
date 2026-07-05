import { DS } from "../constants/cssVarsConfig";

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR NAV ITEM
// ─────────────────────────────────────────────────────────────────────────────

export function SidebarNavItem({ label, isActive, badge, onClick, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: `${DS.sp8} ${DS.sp12}`, borderRadius: DS.r10,
                border: isActive ? `1.5px solid ${DS.accentBorder}` : "1.5px solid transparent",
                background: isActive ? DS.accentBg : "transparent",
                cursor: disabled ? "default" : "pointer", textAlign: "left", transition: "all 0.15s",
            }}
        >
            <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? DS.accentText : DS.textSub }}>{label}</span>
            {badge > 0 && (
                <span style={{
                    background: isActive ? DS.accentText : "#f59e0b", color: "#fff",
                    fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: DS.r99, minWidth: 18, textAlign: "center",
                }}>{badge}</span>
            )}
        </button>
    );
}
