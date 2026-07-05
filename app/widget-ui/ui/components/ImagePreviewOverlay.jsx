// =============================================================================
// modules/components/ImagePreviewOverlay.jsx
// Full-size image preview — rendered inside the widget container the same
// way NotificationModal is (App.jsx owns the state, WidgetShell renders this
// as an absolute sibling slot). Opened by clicking the eye icon on any
// viewable Image.
// =============================================================================

import { h, Fragment } from 'preact';
import { Button } from './Button.jsx';
import { Icon } from './Icon.jsx';

export function ImagePreviewOverlay({ preview, onClose }) {
    const isActive = !!preview;

    return (
        <>
            <div
                class={`nbl-image-preview-overlay${isActive ? ' active' : ''}`}
                onClick={onClose}
            />
            <div class={`nbl-image-preview-panel${isActive ? ' active' : ''}`}>
                {isActive && (
                    <>
                        <Button bare extraClass="nbl-image-preview-panel__close" onClick={onClose}>
                            <Icon name="close" px={14} />
                        </Button>
                        <img class="nbl-image-preview-panel__img" src={preview.src} alt={preview.alt || ''} />
                    </>
                )}
            </div>
        </>
    );
}
