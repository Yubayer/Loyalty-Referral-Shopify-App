import { DS } from "../constants/cssVarsConfig";

// ─────────────────────────────────────────────────────────────────────────────
// PRESET CARD — compact card in the sidebar
// ─────────────────────────────────────────────────────────────────────────────

export function PresetCard({ preset, isActive, onApply, disabled }) {
    return (
        <div style={{
            background: isActive ? DS.accentBg : DS.bgCard,
            border: `2px solid ${isActive ? "#7c3aed" : DS.borderLight}`,
            borderRadius: DS.r12,
            overflow: "hidden",
            transition: "all 0.18s",
            boxShadow: isActive ? "0 0 0 3px #ede9fe" : "none",
        }}>
            {/* Card header / apply row */}
            <div style={{
                padding: `${DS.sp10} ${DS.sp12}`,
                display: "flex", alignItems: "center", gap: DS.sp8,
                cursor: disabled ? "default" : "pointer",
            }}
                onClick={() => !disabled && onApply(preset)}
            >
                <div style={{
                    width: 18, height: 18, borderRadius: "50%",
                    border: isActive ? "5px solid #7c3aed" : `2px solid ${DS.borderMid}`,
                    background: isActive ? "#fff" : "transparent",
                    flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? "#5b21b6" : DS.text }}>{preset.label}</div>
                    <div style={{ fontSize: 10, color: isActive ? "#7c3aed" : DS.textHint }}>{preset.tagline}</div>
                </div>
                {/* swatches */}
                <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                    {preset.swatches.map((color, i) => (
                        <div key={i} style={{
                            width: 12, height: 12, borderRadius: "50%", background: color,
                            border: "1px solid rgba(0,0,0,0.1)",
                        }} />
                    ))}
                </div>
            </div>
        </div>
    );
}
