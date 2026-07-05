// =============================================================================
// modules/components/Icon.jsx
// Generic icon wrapper — reusable everywhere an icon() SVG is rendered
// (item leading icons, chevrons, section headers, nav, share buttons,
// launcher icon, modal icons). Sizing is controlled via CSS classes
// (.nbl-icon, .nbl-icon--sm, .nbl-icon--lg) for the three common sizes;
// `px` overrides for the handful of one-off contexts that don't land on
// that scale, via a CSS variable rather than a new per-context class.
// =============================================================================

import { h } from 'preact';
import { icon } from '../icons.js';

export function Icon({ name, size, px, extraClass, onClick }) {
    const sizeClass = size === 'sm' ? ' nbl-icon--sm' : size === 'lg' ? ' nbl-icon--lg' : '';
    const classes = 'nbl-icon' + sizeClass + (extraClass ? ' ' + extraClass : '');
    const style = px ? { '--nbl-icon-size-override': px + 'px' } : undefined;

    return (
        <span
            class={classes}
            style={style}
            onClick={onClick}
            dangerouslySetInnerHTML={{ __html: icon(name) }}
        />
    );
}
