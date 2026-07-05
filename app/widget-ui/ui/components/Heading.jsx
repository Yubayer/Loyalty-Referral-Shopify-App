// =============================================================================
// modules/components/Heading.jsx
// Shared title primitive. size="sm|md|lg" maps to a fixed scale; `as` picks
// the semantic tag (h1-h6) independently of visual size.
//
// `bare` skips the nbl-heading/nbl-heading--size classes — for retrofitting
// onto an element whose bespoke class is declared earlier in the stylesheet
// than .nbl-heading, where the generic size class would otherwise win the
// cascade and override the bespoke font-size.
// =============================================================================

import { h } from 'preact';

export function Heading({
    as: Tag = 'h3',
    size = 'sm',
    center = false,
    bare = false,
    extraClass,
    children,
    ...rest
}) {
    if (bare) {
        const classes = extraClass || '';
        return (
            <Tag class={classes} {...rest}>
                {children}
            </Tag>
        );
    }

    const classes =
        `nbl-heading nbl-heading--${size}` +
        (center ? ' nbl-heading--center' : '') +
        (extraClass ? ' ' + extraClass : '');

    return (
        <Tag class={classes} {...rest}>
            {children}
        </Tag>
    );
}
