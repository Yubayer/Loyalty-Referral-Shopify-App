// =============================================================================
// modules/components/Item.jsx
// Generic clickable "card" shell — reusable for reward item, points item,
// prize item, active reward item, prize claim item, etc. All of these are
// the SAME visual component; styling differences are expressed as variant
// modifier classes (variant="card" | "row" | "voucher-row"), never as
// separate per-context class names.
// =============================================================================

import { h } from 'preact';

export function Item({
    variant = 'card',
    lift = false,
    accentHover = false,
    selfSpaced = false,
    clickable = false,
    extraClass,
    active,
    leading,
    content,
    trailing,
    onClick,
    dataAttrs,
}) {
    const stateClass = active === true ? ' active' : active === false ? ' inactive' : '';

    const variantClass =
        variant === 'row' ? ' nbl-item--row' :
        variant === 'voucher-row' ? ' nbl-item--voucher-row' :
        ' nbl-item--card';

    const classes =
        'nbl-item' +
        variantClass +
        (lift ? ' nbl-item--lift' : '') +
        (accentHover ? ' nbl-item--accent-hover' : '') +
        (selfSpaced ? ' nbl-item--self-spaced' : '') +
        (clickable ? ' nbl-item--clickable' : '') +
        stateClass +
        (extraClass ? ' ' + extraClass : '');

    return (
        <div class={classes} onClick={onClick} {...(dataAttrs || {})}>
            {leading}
            {content}
            {trailing}
        </div>
    );
}
