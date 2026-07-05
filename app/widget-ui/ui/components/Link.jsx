// =============================================================================
// modules/components/Link.jsx
// Shared anchor primitive — for real navigational links (track order,
// contact us, etc). Mirrors Button's prop shape (variant/size/icon/extraClass)
// so call sites can reach for Button or Link interchangeably depending on
// whether the action navigates (<a>) or runs a handler (<button>).
//
// `bare` skips the nbl-link base class entirely — for retrofitting onto an
// element with its own fully-styled class (via extraClass), since .nbl-link
// is declared late in the stylesheet and would otherwise win the cascade
// over an earlier bespoke class (e.g. color/text-decoration).
// =============================================================================

import { h } from 'preact';

export function Link({
    variant,
    size,
    bare = false,
    full = false,
    icon,
    extraClass,
    children,
    href,
    ...rest
}) {
    if (bare) {
        const classes = extraClass || '';
        return (
            <a class={classes} href={href} {...rest}>
                {icon && <span class="nbl-link__icon">{icon}</span>}
                {children}
            </a>
        );
    }

    const classes =
        'nbl-link' +
        (variant ? ` nbl-link--${variant}` : '') +
        (size ? ` nbl-link--${size}` : '') +
        (full ? ' nbl-link--full' : '') +
        (extraClass ? ' ' + extraClass : '');

    return (
        <a class={classes} href={href} {...rest}>
            {icon && <span class="nbl-link__icon">{icon}</span>}
            {children}
        </a>
    );
}
