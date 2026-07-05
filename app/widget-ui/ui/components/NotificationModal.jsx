// =============================================================================
// modules/components/NotificationModal.jsx
// Reward panel + Info panel (claim confirmation, status, errors) — purono
// notifications.js-er pura replacement. State-driven, kono DOM query/bus nei.
// =============================================================================

import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { Button } from './Button.jsx';
import { Text } from './Text.jsx';
import { Link } from './Link.jsx';

export function NotificationModal({ notification, claimState, claimErrorMsg, onClose, onClaim, lbl }) {
    const [copied, setCopied] = useState(false);

    // Panel change hole copied state reset
    useEffect(() => { setCopied(false); }, [notification]);

    if (!notification) return null;

    function handleOverlayClick() {
        if (claimState === 'loading') return; // processing-er shomoy close kora jabe na
        onClose();
    }

    function handleCopy(code) {
        if (navigator.clipboard) navigator.clipboard.writeText(code);
        setCopied(true);
    }

    return (
        <>
            <div class="nbl-notify-overlay active" onClick={handleOverlayClick} />

            {notification.type === 'reward' && (
                <RewardPanel
                    code={notification.code}
                    copied={copied}
                    onCopy={handleCopy}
                    onClose={onClose}
                    lbl={lbl}
                />
            )}

            {notification.type === 'info' && (
                <InfoPanel
                    payload={notification.payload}
                    claimState={claimState}
                    claimErrorMsg={claimErrorMsg}
                    onClose={onClose}
                    onClaim={onClaim}
                    lbl={lbl}
                />
            )}
        </>
    );
}

// ── Reward panel — voucher code + copy button ────────────────────────────────

function RewardPanel({ code, copied, onCopy, onClose, lbl }) {
    return (
        <div class="nbl-notify-panel__reward nbl-notify-panel active">
            <Button bare extraClass="nbl-notify-panel__close" onClick={onClose}>
                <Icon name="close" px={12} />
            </Button>
            <div class="nbl-notify-reward__heading">{lbl('notifyRewardHeading')}</div>
            <div class="nbl-notify-reward__copy-row">
                {copied ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                        <Text as="span" bare>✔ Copied!</Text>
                        <Button
                            bare
                            extraClass="nbl-notify-reward__copy-btn"
                            style={{ marginLeft: 'auto', padding: '6px 14px' }}
                            onClick={onClose}
                        >
                            Close
                        </Button>
                    </div>
                ) : (
                    <>
                        <div class="nbl-notify-reward__code">{code}</div>
                        <Button bare extraClass="nbl-notify-reward__copy-btn" onClick={() => onCopy(code)}>
                            {lbl('notifyRewardCopyBtn')}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

// ── Info panel — claim confirmation / status / error ─────────────────────────

function InfoPanel({ payload, claimState, claimErrorMsg, onClose, onClaim, lbl }) {
    const {
        text = '',
        isHtml = false,
        claim = false,
        data = null,
        title: titleText = '',
        badge = '',
        badgeType = 'pending',
        sub: subText = '',
        rows = [],
        msg: msgText = '',
        msgClass = '',
        note: noteText = '',
        trackingUrl = '',
        trackingLabel = 'Track your order',
        trackingText = '',
        contactUrl = '',
        contactText = 'Contact us',
    } = payload || {};

    const isLoading = claimState === 'loading';
    const isError = claimState === 'error';

    return (
        <div class="nbl-notify-panel__info nbl-notify-panel active">
            <Button bare extraClass="nbl-notify-panel__close" onClick={onClose}>
                <Icon name="close" px={12} />
            </Button>
            <div class="nbl-notify-info__body">
                {(titleText || badge) && (
                    <div class="nbl-notify-info__body-title">
                        {titleText && <Text as="span" bare extraClass="nbl-notify-info__title-text">{titleText}</Text>}
                        {badge && (
                            <Text as="span" bare extraClass={`nbl-notify-info__badge nbl-notify-info__badge--${badgeType}`}>{badge}</Text>
                        )}
                    </div>
                )}

                {subText && <div class="nbl-notify-info__sub">{subText}</div>}

                {rows.length > 0 && (
                    <div class="nbl-notify-info__rows">
                        {rows.map((row, i) => (
                            <div class="nbl-notify-info__row" key={i}>
                                <Text as="span" bare extraClass="nbl-notify-info__row-key">{row.key}</Text>
                                <Text as="span" bare extraClass="nbl-notify-info__row-val">{row.val}</Text>
                            </div>
                        ))}
                    </div>
                )}

                {text &&
                    (isHtml ? (
                        <div class="nbl-notify-info__text" dangerouslySetInnerHTML={{ __html: text }} />
                    ) : (
                        <div class="nbl-notify-info__text">{text}</div>
                    ))}

                {msgText && (
                    <div
                        class={`nbl-notify-info__msg${msgClass ? ` nbl-notify-info__msg--${msgClass}` : ''}`}
                        dangerouslySetInnerHTML={{ __html: msgText }}
                    />
                )}

                {noteText && <div class="nbl-notify-info__note">{noteText}</div>}

                {(trackingUrl || trackingText) && (
                    <div class="nbl-notify-info__tracking">
                        <Icon name="purchase" px={15} />
                        {trackingUrl ? (
                            <Link bare href={trackingUrl} target="_blank" rel="noopener">
                                {trackingLabel}
                            </Link>
                        ) : (
                            trackingText
                        )}
                    </div>
                )}

                {isError && <div class="nbl-notify-info__error active">{claimErrorMsg}</div>}

                {claim && (
                    <Button
                        bare
                        extraClass={`nbl-notify-info__claim-btn${isError ? ' error' : ''}`}
                        disabled={isLoading}
                        loading={isLoading}
                        loadingLabel={lbl('claimingLabel') || 'Processing...'}
                        onClick={() => onClaim(data)}
                    >
                        {isError ? (
                            lbl('claimRetryLabel') || 'Try again'
                        ) : (
                            lbl('notifyInfoClaimBtn') || 'Claim'
                        )}
                    </Button>
                )}

                {contactUrl && (
                    <Link bare extraClass="nbl-notify-info__contact-btn" href={contactUrl} target="_blank" rel="noopener">
                        {contactText}
                    </Link>
                )}
            </div>
        </div>
    );
}
