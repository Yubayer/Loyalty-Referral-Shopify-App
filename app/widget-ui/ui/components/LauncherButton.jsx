// =============================================================================
// modules/components/LauncherButton.jsx
// Floating open/close button — purono html.js-er btnHTML replacement.
// =============================================================================

import { h } from 'preact';
import { launcherIcon } from '../icons.js';
import { Button } from './Button.jsx';
import { Text } from './Text.jsx';
import { formatNumber } from '../utils.js';

export function LauncherButton({ isLoggedIn, points, position, launcherIconName, onClick, lbl }) {
    const subtitleTemplate = lbl('launcherSubtitle') || '';
    const [subBefore, subAfter] = subtitleTemplate.split('[points]');

    return (
        <div class={`nbl-launcher pos-${position}`}>
            <Button
                bare
                extraClass={`nbl-launcher__button${isLoggedIn ? '' : ' guest'}`}
                aria-label="Open loyalty widget"
                onClick={onClick}
            >
                <div class="nbl-launcher__icon" dangerouslySetInnerHTML={{ __html: launcherIcon(launcherIconName) }} />
                <div class="nbl-launcher__label">
                    <Text as="span" bare extraClass="nbl-launcher__title">{lbl('launcherTitle')}</Text>
                    {isLoggedIn && (
                        <Text as="span" bare extraClass="nbl-launcher__sub">
                            {subBefore}
                            <Text as="span" bare extraClass="nbl-customer-points">{formatNumber(points)}</Text>
                            {subAfter || ''}
                        </Text>
                    )}
                </div>
            </Button>
        </div>
    );
}
