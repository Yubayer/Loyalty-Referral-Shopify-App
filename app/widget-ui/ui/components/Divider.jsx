// =============================================================================
// modules/components/Divider.jsx
// Horizontal (or vertical) rule / separator. spacing="none|sm|md|lg"
// controls margin; orientation="horizontal|vertical".
// =============================================================================

import { h } from 'preact';

export function Divider({ orientation = 'horizontal', spacing = 'md', extraClass, ...rest }) {
    const spacingClass = spacing !== 'md' ? ` nbl-divider--spacing-${spacing}` : '';
    const orientationClass = orientation === 'vertical' ? ' nbl-divider--vertical' : '';
    const classes = 'nbl-divider' + spacingClass + orientationClass + (extraClass ? ' ' + extraClass : '');

    return <hr class={classes} {...rest} />;
}
