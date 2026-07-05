// =============================================================================
// modules/components/Button.jsx
// Shared button primitive. variant="primary|accent|outline|ghost",
// size="sm|md|lg". `loading` shows a bounce-dots indicator in place of the
// label and auto-disables the button — same visual language as the
// pagination load-more dots, just generalized for any button.
//
// `bare` skips the nbl-button base class and variant/size classes entirely —
// for retrofitting onto an element with its own fully-styled class (via
// extraClass). Needed because .nbl-button is declared late in the stylesheet
// and would otherwise win the cascade over an earlier bespoke class on any
// shared property (border-radius, display, gap, etc). Structural behavior
// (disabled, loading, icon slot) still applies either way.
//
// bare still renders a native <button>, so it always also gets
// .nbl-button--bare-reset — a pure reset (no visual styling) that strips the
// browser's default button border/outline/background/font. Without it, the
// bespoke extraClass border could visually clash with (or get hidden behind)
// the native button chrome in some browsers — e.g. the notification close
// button showing a dark double-ring instead of its intended subtle border.
// =============================================================================

import { h, Fragment } from 'preact';

export function Button({
    variant = 'primary',
    size = 'md',
    bare = false,
    full = false,
    icon,
    disabled = false,
    loading = false,
    loadingLabel,
    extraClass,
    children,
    onClick,
    ...rest
}) {
    const classes = bare
        ? 'nbl-button--bare-reset' + (extraClass ? ' ' + extraClass : '') + (loading ? ' nbl-button--loading' : '')
        : 'nbl-button' +
          ` nbl-button--${variant} nbl-button--${size}` +
          (full ? ' nbl-button--full' : '') +
          (loading ? ' nbl-button--loading' : '') +
          (extraClass ? ' ' + extraClass : '');

    return (
        <button class={classes} disabled={disabled || loading} onClick={onClick} {...rest}>
            {loading ? (
                <span class="nbl-button__loading">
                    <span class="nbl-button__dots">
                        <span></span><span></span><span></span>
                    </span>
                    {loadingLabel && <span class="nbl-button__loading-label">{loadingLabel}</span>}
                </span>
            ) : (
                <>
                    {icon && <span class="nbl-button__icon">{icon}</span>}
                    {children}
                </>
            )}
        </button>
    );
}
