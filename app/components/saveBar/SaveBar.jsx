/**
 * @fileoverview SaveBar — Floating fixed-position action bar component
 *
 * A fully reusable, accessible, animated floating notification/action bar.
 * Stays fixed on screen regardless of page scroll.
 * Designed to match the Dark Gold UI design system.
 *
 * ─── Supported positions ───────────────────────────────────────────────────
 *
 *   "top-left"      "top-center"      "top-right"
 *   "bottom-left"   "bottom-center"   "bottom-right"
 *
 *   Shorthand aliases:
 *   "top"    → "top-center"
 *   "bottom" → "bottom-center"
 *
 * ─── Features ──────────────────────────────────────────────────────────────
 *  - Fixed viewport position — never moves on scroll
 *  - Direction-aware animation (slides in from nearest edge)
 *  - Loading spinner on the primary button
 *  - Disabled state for both buttons
 *  - Custom icon slot
 *  - "default" and "danger" visual variants
 *  - Keyboard: Escape fires onSecondary
 *  - Fully CSS-variable driven
 *
 * ─── Example 1 — Unsaved changes (bottom-center) ───────────────────────────
 *
 *   const [dirty, setDirty]   = useState(false);
 *   const [saving, setSaving] = useState(false);
 *
 *   async function handleSave() {
 *     setSaving(true);
 *     await saveProject();
 *     setSaving(false);
 *     setDirty(false);
 *   }
 *
 *   <SaveBar
 *     visible={dirty}
 *     position="bottom-center"
 *     message="You have unsaved changes"
 *     primaryLabel="Save Project"
 *     secondaryLabel="Discard"
 *     onPrimary={handleSave}
 *     onSecondary={() => setDirty(false)}
 *     loading={saving}
 *   />
 *
 * ─── Example 2 — Delete confirmation (top-right, danger) ───────────────────
 *
 *   <SaveBar
 *     visible={pendingDelete}
 *     position="top-right"
 *     variant="danger"
 *     message="3 items selected — this cannot be undone"
 *     primaryLabel="Delete Selected"
 *     secondaryLabel="Cancel"
 *     onPrimary={handleBulkDelete}
 *     onSecondary={() => setPendingDelete(false)}
 *     loading={deleting}
 *   />
 *
 * ─── Example 3 — Custom actions slot ───────────────────────────────────────
 *
 *   When you pass `actions`, the built-in primary/secondary buttons are
 *   suppressed and your nodes render instead. `primaryLabel`,
 *   `secondaryLabel`, `onPrimary`, `onSecondary`, and `loading` no longer
 *   drive any UI — you're fully in charge of what's on the right side.
 *
 *   <SaveBar
 *     visible={hasChanges}
 *     position="bottom-center"
 *     message="Unsaved changes"
 *     actions={
 *       <>
 *         <Button variant="ghost" onClick={handlePreview}>Preview</Button>
 *         <Button variant="secondary" onClick={handleDiscard}>Discard</Button>
 *         <Button onClick={handleSave} loading={saving}>Save</Button>
 *       </>
 *     }
 *   />
 *
 * ─── Example 4 — All props ─────────────────────────────────────────────────
 *
 *   <SaveBar
 *     visible={true}
 *     position="bottom-right"
 *     variant="default"
 *     message="You have unsaved changes"
 *     icon={<MyIcon />}
 *     primaryLabel="Save"
 *     secondaryLabel="Discard"
 *     onPrimary={handleSave}
 *     onSecondary={handleDiscard}
 *     loading={false}
 *     disabled={false}
 *     closeOnEscape={true}
 *     className="my-savebar"
 *     actions={null} // omit to use built-in buttons
 *   />
 *
 * @module SaveBar
 */

import React, { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import "./saveBar.css";

/* ═══════════════════════════════════════════════════════════════════════════
   POSITION UTILITIES
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Normalize shorthand aliases → full position string.
 * "top" → "top-center"  |  "bottom" → "bottom-center"
 * @param {string} pos
 * @returns {string}
 */
function normalizePosition(pos) {
    if (pos === "top") return "top-center";
    if (pos === "bottom") return "bottom-center";
    return pos;
}

/**
 * Map normalized position → CSS modifier class.
 * Each class sets the fixed coordinates + correct slide animation.
 * @param {string} pos
 * @returns {string}
 */
function positionClass(pos) {
    const map = {
        "top-left": "savebar--top-left",
        "top-center": "savebar--top-center",
        "top-right": "savebar--top-right",
        "bottom-left": "savebar--bottom-left",
        "bottom-center": "savebar--bottom-center",
        "bottom-right": "savebar--bottom-right",
    };
    return map[pos] ?? "savebar--bottom-center";
}

/* ═══════════════════════════════════════════════════════════════════════════
   ICONS — inline SVG, zero dependencies
═══════════════════════════════════════════════════════════════════════════ */

/** Diamond warning icon — default for "default" variant */
const IconDiamond = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2L2 9l10 13L22 9 12 2zm0 2.5L20 9l-8 10.4L4 9l8-6.5z" />
        <path d="M12 5.5L5.5 9.5 12 17.5l6.5-8L12 5.5z" opacity="0.35" />
    </svg>
);

/** Alert triangle — default for "danger" variant */
const IconAlert = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

/** Spinner — shown inside primary button while loading */
const Spinner = () => <span className="savebar-spinner" aria-hidden="true" />;

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

/**
 * SaveBar
 *
 * @param {object}   props
 * @param {boolean}  props.visible
 *   Show / hide the bar.
 *
 * @param {string}   [props.position="bottom-center"]
 *   Fixed viewport position. Accepted values:
 *   "top-left" | "top-center" | "top-right" |
 *   "bottom-left" | "bottom-center" | "bottom-right" |
 *   "top" (→ top-center) | "bottom" (→ bottom-center)
 *
 * @param {string}   [props.message="You have unsaved changes"]
 *   Status message shown on the left side.
 *
 * @param {React.ReactNode} [props.icon]
 *   Override the default icon. Receives the raw JSX node.
 *
 * @param {'default'|'danger'} [props.variant="default"]
 *   "default" = gold accent. "danger" = red accent.
 *
 * @param {string}   [props.primaryLabel="Save"]
 *   Primary (right) button label.
 *
 * @param {string}   [props.secondaryLabel="Discard"]
 *   Secondary (left) button label.
 *
 * @param {function} [props.onPrimary]
 *   Callback fired when the primary button is clicked.
 *
 * @param {function} [props.onSecondary]
 *   Callback fired when secondary button is clicked or Escape is pressed.
 *
 * @param {boolean}  [props.loading=false]
 *   Show spinner + "Saving…" text, disables primary button.
 *
 * @param {boolean}  [props.disabled=false]
 *   Disables both buttons.
 *
 * @param {boolean}  [props.closeOnEscape=true]
 *   Whether pressing Escape fires onSecondary.
 *   Ignored when `actions` is provided (custom UI handles its own keys).
 *
 * @param {React.ReactNode} [props.actions]
 *   Custom action slot. When set, completely replaces the built-in
 *   primary + secondary buttons. The following props become inert and
 *   have NO effect on the right side of the bar:
 *     • primaryLabel, secondaryLabel
 *     • onPrimary, onSecondary
 *     • loading (no spinner is rendered by SaveBar itself)
 *   You're expected to handle button states, loading indicators, and
 *   click handlers inside your own component(s).
 *
 * @param {string}   [props.className=""]
 *   Additional CSS classes appended to the root element.
 */
export function SaveBar({
    visible = false,
    position = "bottom-center",
    message = "You have unsaved changes",
    icon,
    variant = "default",
    primaryLabel = "Save",
    secondaryLabel = "Discard",
    onPrimary,
    onSecondary,
    loading = false,
    disabled = false,
    closeOnEscape = true,
    actions = null,
    className = "",
}) {
    const pos = normalizePosition(position);

    /*
     * portalTarget is null on the server and during the first render.
     * useEffect only runs in the browser — document.body is safe here.
     * createPortal is called only after mount: no "document is not defined".
     */
    const [portalTarget, setPortalTarget] = useState(null);
    useEffect(() => { setPortalTarget(document.body); }, []);

    /* ── Keyboard: Escape → onSecondary (skipped when custom actions are used) ── */
    const handleKeyDown = useCallback((e) => {
        if (!visible || !closeOnEscape || actions) return;
        if (e.key === "Escape") { e.preventDefault(); onSecondary?.(); }
    }, [visible, closeOnEscape, onSecondary, actions]);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    /* ── Resolved icon ───────────────────────────────────────────────────── */
    const resolvedIcon = icon ?? (variant === "danger" ? <IconAlert /> : <IconDiamond />);

    /* ── Class list ─────────────────────────────────────────────────────── */
    const classes = [
        "savebar",
        positionClass(pos),                             // position + animation
        visible ? "savebar--visible" : "savebar--hidden",
        variant === "danger" ? "savebar--danger" : "",
        loading && !actions ? "savebar--loading" : "",  // loading style only for built-in primary
        actions ? "savebar--custom-actions" : "",
        className,
    ].filter(Boolean).join(" ");

    /*
     * createPortal renders directly into document.body — completely outside
     * the React component tree. This guarantees position: fixed always works,
     * no matter what transform / filter / will-change any parent has applied.
     */
    /* SSR / pre-mount: render nothing until document.body is available */
    if (!portalTarget) return null;

    return createPortal(
        <>
            {/* Accessible live region */}
            <div role="status" aria-live="polite" aria-atomic="true" className="savebar-sr-only">
                {visible ? message : ""}
            </div>

            <div className={classes} role="region" aria-label="Action notification bar">

                {/* Decorative shimmer line */}
                <span className="savebar-shimmer" aria-hidden="true" />

                {/* Left: icon + message */}
                <div className="savebar-left">
                    <span className="savebar-icon">{resolvedIcon}</span>
                    <span className="savebar-message">{message}</span>
                </div>

                {/* Right: action buttons (built-in) OR custom actions slot */}
                <div className="savebar-actions">
                    {actions ? (
                        actions
                    ) : (
                        <>
                            <button
                                type="button"
                                className="savebar-btn savebar-btn--secondary"
                                onClick={onSecondary}
                                disabled={disabled || loading}
                                aria-label={secondaryLabel}
                            >
                                {secondaryLabel}
                            </button>

                            <button
                                type="button"
                                className="savebar-btn savebar-btn--primary"
                                onClick={onPrimary}
                                disabled={disabled || loading}
                                aria-label={loading ? "Loading…" : primaryLabel}
                                aria-busy={loading}
                            >
                                {loading ? <><Spinner /><span>Saving…</span></> : primaryLabel}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </>,
        document.body  // always available here — guarded above
    );
}

export default SaveBar;