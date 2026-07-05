// =============================================================================
// modules/components/Image.jsx
// Generic image wrapper with a fallback placeholder — reusable everywhere a
// photo is shown with an icon fallback (prize item, prize-claim item).
//
// `viewable` (default true) shows an eye icon centered on hover; clicking it
// calls `onView(src, alt)` instead of bubbling to the row's own onClick, so
// the caller (App.jsx) can open a full-size preview inside the widget.
// Placeholder (no src) never shows the eye — nothing to preview.
// =============================================================================

import { h } from 'preact';
import { Icon } from './Icon.jsx';

export function Image({ src, alt, size, placeholderIcon = 'reward-discount', viewable = false, onView }) {
    const sizeClass = size === 'sm' ? ' nbl-image--sm' : ' nbl-image--md';
    const classes = 'nbl-image' + sizeClass;
    const iconPx = size === 'sm' ? 16 : 24;
    const showEye = viewable && !!src && typeof onView === 'function';

    function handleViewClick(e) {
        e.stopPropagation();
        onView(src, alt);
    }

    return (
        <div class={classes}>
            {src ? (
                <img class="nbl-image__photo" src={src} alt={alt} />
            ) : (
                <div class="nbl-image__placeholder">
                    <Icon name={placeholderIcon} px={iconPx} />
                </div>
            )}
            {showEye && (
                <button
                    type="button"
                    class="nbl-image__view-btn"
                    aria-label="View full image"
                    onClick={handleViewClick}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                </button>
            )}
        </div>
    );
}
