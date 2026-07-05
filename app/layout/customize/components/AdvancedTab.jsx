import { useMemo, useState } from "react";
import { DS, CSS_DEFAULTS, isHex } from "../constants/cssVarsConfig";

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED TAB
//
// Raw power-user editor — every key in CSS_DEFAULTS gets its own row, no
// grouping/curation like Simple-mode's SIMPLE_SECTIONS. For CSS vars that
// don't have a dedicated Simple-mode field (or when a merchant just wants
// direct access), this is the escape hatch.
//
// Deliberately reuses the same `onChange` shape Simple-mode fields already
// use — { [varName]: value } — so it plugs straight into the existing
// handleSimpleChange / dirty-tracking / save pipeline. No new state, no new
// wiring on the _hooks.js side.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Splits a `--nbl-some-thing` var name into a human-ish label — purely
 * cosmetic, the raw var name (shown separately, monospace) stays the
 * source of truth so this never needs a lookup table to stay in sync.
 */
function humanize(varName) {
    return varName
        .replace(/^--nbl-/, "")
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

const ALL_VAR_NAMES = Object.keys(CSS_DEFAULTS).sort();

function AdvancedRow({ varName, cssVars, onChange, disabled }) {
    const rawValue = cssVars[varName] ?? CSS_DEFAULTS[varName] ?? "";
    const isDirty = cssVars[varName] !== CSS_DEFAULTS[varName];
    const looksLikeColor = isHex(rawValue) || (typeof rawValue === "string" && rawValue.startsWith("var(--nbl-"));
    // Resolve var(--nbl-x) refs to *something* paintable for the swatch —
    // falls back to a neutral gray rather than trying to resolve the chain.
    const swatchColor = isHex(rawValue) ? rawValue : "#cccccc";

    function handleChange(val) {
        onChange({ [varName]: val });
    }
    function handleRevert() {
        onChange({ [varName]: CSS_DEFAULTS[varName] });
    }

    return (
        <div style={{
            display: "flex", alignItems: "center", gap: DS.sp10,
            padding: `${DS.sp10} ${DS.sp12}`,
            background: isDirty ? DS.warnBg : DS.bgCard,
            border: `1px solid ${isDirty ? DS.warnBorder : DS.borderLight}`,
            borderRadius: DS.r8,
        }}>
            {/* Swatch — only meaningful for color-ish values, otherwise a spacer */}
            {looksLikeColor ? (
                <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{
                        width: 28, height: 28, borderRadius: DS.r6,
                        border: `1.5px solid ${isDirty ? DS.warnBorder : DS.borderMid}`,
                        background: swatchColor, overflow: "hidden",
                        cursor: disabled ? "default" : "pointer",
                    }}>
                        {!disabled && (
                            <input
                                type="color"
                                value={isHex(rawValue) ? rawValue : "#cccccc"}
                                onChange={(e) => handleChange(e.target.value)}
                                style={{ opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer", border: "none", padding: 0 }}
                            />
                        )}
                    </div>
                </div>
            ) : (
                <div style={{ width: 28, flexShrink: 0 }} />
            )}

            {/* Name + human label */}
            <div style={{ flex: "0 0 220px", minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: DS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {humanize(varName)}
                    {isDirty && (
                        <span style={{
                            marginLeft: 6, background: "#fef3c7", color: "#92400e",
                            fontSize: 9, fontWeight: 600, padding: "1px 6px",
                            borderRadius: DS.r99, border: "1px solid #fde68a",
                        }}>Modified</span>
                    )}
                </div>
                <div style={{ fontSize: 10, color: DS.textHint, fontFamily: "monospace" }}>{varName}</div>
            </div>

            {/* Value input */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <s-text-field
                    value={rawValue}
                    onInput={(e) => handleChange(e.target.value)}
                    disabled={disabled}
                    auto-complete="off"
                    style={{ fontFamily: "monospace" }}
                />
            </div>

            {/* Revert */}
            <button
                disabled={disabled || !isDirty}
                onClick={handleRevert}
                title="Revert to default"
                style={{
                    flexShrink: 0, background: "none", border: `1px solid ${isDirty ? DS.warnBorder : "transparent"}`,
                    borderRadius: DS.r6, padding: "4px 8px", fontSize: 11,
                    color: isDirty ? DS.warnText : DS.textHint,
                    cursor: disabled || !isDirty ? "default" : "pointer",
                    opacity: isDirty ? 1 : 0.4,
                }}
            >↩</button>
        </div>
    );
}

export function AdvancedTab({ cssVars, onSimpleChange, isNetworkSubmitting }) {
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return ALL_VAR_NAMES;
        return ALL_VAR_NAMES.filter((v) => v.toLowerCase().includes(q) || humanize(v).toLowerCase().includes(q));
    }, [query]);

    const dirtyCount = useMemo(
        () => ALL_VAR_NAMES.filter((v) => cssVars[v] !== CSS_DEFAULTS[v]).length,
        [cssVars]
    );

    return (
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <s-section>
                <div style={{ marginBottom: DS.sp14 }}>
                    <s-banner tone="warning" heading="Advance mode">
                        <p>Advanced mode edits raw CSS variables directly — no grouping or guardrails. If you're not sure what a variable does, check the Customize tab first.</p>
                    </s-banner>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: DS.sp10, marginBottom: DS.sp12 }}>
                    <div style={{ flex: 1 }}>
                        <s-text-field
                            placeholder="Search variables (e.g. 'button', '--nbl-item-bg')"
                            value={query}
                            onInput={(e) => setQuery(e.target.value)}
                            auto-complete="off"
                        />
                    </div>
                    <span style={{ fontSize: 12, color: DS.textMuted, flexShrink: 0 }}>
                        {filtered.length} of {ALL_VAR_NAMES.length}
                        {dirtyCount > 0 && ` · ${dirtyCount} modified`}
                    </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: DS.sp6, maxHeight: 640, overflowY: "auto" }}>
                    {filtered.length === 0 && (
                        <div style={{ padding: DS.sp16, textAlign: "center", fontSize: 13, color: DS.textHint }}>
                            No variables match "{query}".
                        </div>
                    )}
                    {filtered.map((varName) => (
                        <AdvancedRow
                            key={varName}
                            varName={varName}
                            cssVars={cssVars}
                            onChange={onSimpleChange}
                            disabled={isNetworkSubmitting}
                        />
                    ))}
                </div>
            </s-section>
        </s-grid>
    );
}