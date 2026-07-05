// =============================================================================
// modules/components/Text.jsx
// Shared body-copy primitive. Size and color always come from props, never
// from a surrounding context selector — the same single-source-of-truth
// principle as Icon's size prop.
//
// `bare` skips the forced inline font-size/nbl-text classes — for retrofitting
// onto an element that already has its own fully-styled class (via extraClass)
// and shouldn't have its size/color overridden by Text's defaults.
// =============================================================================

import { h } from 'preact';

const SIZE_VAR = {
    xs: 'var(--nbl-text-xs)',
    sm: 'var(--nbl-text-sm)',
    base: 'var(--nbl-text-base)',
    md: 'var(--nbl-text-md)',
    lg: 'var(--nbl-text-lg)',
};

export function Text({
    as: Tag = 'p',
    size = 'base',
    color = 'default',
    bold = false,
    center = false,
    truncate = false,
    bare = false,
    extraClass,
    style,
    children,
    ...rest
}) {
    if (bare) {
        const classes = extraClass || '';
        return (
            <Tag class={classes} style={style} {...rest}>
                {children}
            </Tag>
        );
    }

    const colorClass = color !== 'default' ? ` nbl-text--${color}` : '';
    const classes =
        'nbl-text' +
        colorClass +
        (bold ? ' nbl-text--bold' : '') +
        (center ? ' nbl-text--center' : '') +
        (truncate ? ' nbl-text--truncate' : '') +
        (extraClass ? ' ' + extraClass : '');

    const fontSize = SIZE_VAR[size] || SIZE_VAR.base;
    const mergedStyle = { fontSize, ...(style || {}) };

    return (
        <Tag class={classes} style={mergedStyle} {...rest}>
            {children}
        </Tag>
    );
}
