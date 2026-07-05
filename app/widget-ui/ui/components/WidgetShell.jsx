// =============================================================================
// modules/module-preact/WidgetShell.jsx
// Widget container + scroll wrapper + header + body — purono html.js-er
// widgetHTML structure-er replacement.
// =============================================================================

import { h } from 'preact';
import { useRef } from 'preact/hooks';
import { Header } from './Header.jsx';
import { useCompactHeader } from '../hooks/useCompactHeader.js';

export function WidgetShell({ isOpen, isLoggedIn, customerName, points, position, activeTab, onNavChange, onClose, lbl, children, notificationSlot, previewSlot, provisionSlot }) {
    const wrapperRef = useRef(null);
    const compact = useCompactHeader(wrapperRef);

    return (
        <div class={`nbl-widget-container${isOpen ? ' active' : ''} pos-${position}`}>
            <div class="nbl-widget-scroll-area">
                <div class="nbl-widget-wrapper" ref={wrapperRef}>
                    <Header
                        isLoggedIn={isLoggedIn}
                        customerName={customerName}
                        points={points}
                        compact={compact}
                        activeTab={activeTab}
                        onNavChange={onNavChange}
                        onClose={onClose}
                        lbl={lbl}
                    />
                    {/* Guest body full-bleed — no .nbl-widget-body side padding.
                        Logged-in tabs keep the padded body as before. Mixing the
                        two in one wrapper caused the guest hero/orbs to render
                        with an extra 14px gap on the sides (right-edge "padding"
                        bug) and clipped the decorative orb circles at that edge. */}
                    {isLoggedIn ? (
                        <div class="nbl-widget-body">
                            <div>{children}</div>
                        </div>
                    ) : (
                        children
                    )}
                </div>
            </div>
            {/* notification-er positioning context eta-i — onClick overlay, claim panel,
                shob eই container-er bhitorে thakar kotha (age html.js-eo eikhane chilo) */}
            <div class="nbl-notification-slot" id="nbl-notification-wrapper">
                {notificationSlot}
            </div>
            {/* image preview-o eki convention follow kore — notification-er moto
                shei container-er bhitore-i absolute sibling, alada z-index-e stack hoy */}
            {previewSlot}
            {/* provision overlay — pura widget cover kore rakhe jotokkhon silent
                customer-provisioning চলে। Highest z-index, sob kichur upore. */}
            {provisionSlot}
        </div>
    );
}
