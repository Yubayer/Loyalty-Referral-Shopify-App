// =============================================================================
// modules/module-preact/components/ReferralModal.jsx
// Referral modal — purono html.js referralModalHTML()-er pura replacement.
// Sob logic useReferralModal hook-e, eta shudhu render kore.
// =============================================================================

import { h } from 'preact';
import { Icon } from './Icon.jsx';
import { Heading } from './Heading.jsx';
import { Text } from './Text.jsx';
import { Button } from './Button.jsx';
import { formatNumber } from '../utils.js';

function buildFriendRewardRows(pointRules, currencySymbol) {
    const refRule = (pointRules || []).find((r) => r.event && r.event.type === 'REFERRAL');
    const refCond = (refRule && refRule.conditions && refRule.conditions.referral) || {};
    const referrer = refCond.referrer || {};
    const referred = refCond.referred || {};
    const trigger = refCond.trigger || 'oneTime';

    const rows = [];
    if (referred.discountValue) {
        const voucherValue = referred.discountType === 'percentage'
            ? `${referred.discountValue}% discount voucher`
            : `a ${currencySymbol}${formatNumber(referred.discountValue)} discount voucher`;
        const note = referred.minimumOrderValue
            ? ` on orders over ${currencySymbol}${formatNumber(referred.minimumOrderValue)}`
            : trigger === 'subscription' ? ' for your first subscription order'
                : trigger === 'both' ? ' for your first order'
                    : ' for your first one-time purchase';
        rows.push({ iconName: 'gift', text: `You get ${voucherValue}${note}.` });
    }
    if ((trigger === 'subscription' || trigger === 'both') && referred.allowRenewalReward && referred.renewalPoints > 0) {
        rows.push({ iconName: 'refresh', text: `Earn ${formatNumber(referred.renewalPoints)} points every time you renew your subscription.` });
    }
    return rows;
}

function RewardSummary({ rows }) {
    if (!rows.length) return null;
    return (
        <div class="nbl-refer-modal__reward-summary">
            {rows.map((row, i) => (
                <div class="nbl-refer-modal__reward-row" key={i}>
                    <Icon name={row.iconName} extraClass="nbl-icon--unstyled" /> {row.text}
                </div>
            ))}
        </div>
    );
}

function Message({ msg, onRetry }) {
    if (!msg) return null;
    const prefix = msg.type === 'error' ? '❌' : msg.type === 'success' ? '✅' : 'ℹ️';
    return (
        <div class={`nbl-refer-modal__message nbl-refer-modal__message--${msg.type}`}>
            <div>{prefix} {msg.text}</div>
            {msg.retry && onRetry && (
                <Button bare extraClass="nbl-refer-modal__btn nbl-refer-modal__btn--retry" onClick={onRetry}>
                    Try Again
                </Button>
            )}
        </div>
    );
}

export function ReferralModal({ refModal, pointRules, currencySymbol }) {
    if (!refModal.isOpen) return null;

    const {
        step, codeInput, setCodeInput, loading,
        formMessage, successMessage, lockedMessage, discountCode, copied,
        closeModal, handleLogin, handleFinish, handleCopy, handleSubmit, handleRetry,
    } = refModal;

    const rewardRows = buildFriendRewardRows(pointRules, currencySymbol);

    return (
        <div class="nbl-refer-modal-overlay show" role="dialog" aria-modal="true" aria-labelledby="nbl-modal-title">
            <div class="nbl-refer-modal">
                <div class="nbl-refer-modal__close" aria-label="Close" onClick={closeModal}>
                    <Icon name="close" px={16} />
                </div>
                <div class="nbl-refer-modal__content">

                    {step === 'login' && (
                        <div>
                            <div class="nbl-refer-modal__brand">NBL Loyalty</div>
                            <Heading as="h3" bare extraClass="nbl-refer-modal__title" id="nbl-modal-title">Login to Claim Your Referral Discount</Heading>
                            <Text as="p" bare extraClass="nbl-refer-modal__subtitle">Log into your account to unlock your referral discount.</Text>
                            <RewardSummary rows={rewardRows} />
                            <Button bare extraClass="nbl-refer-modal__btn nbl-refer-modal__btn--primary" onClick={handleLogin}>
                                Login / Register
                            </Button>
                        </div>
                    )}

                    {step === 'form' && (
                        <div>
                            <div class="nbl-refer-modal__brand">NBL Loyalty</div>
                            <Heading as="h3" bare extraClass="nbl-refer-modal__title">
                                Get Your Referral Discount <Icon name="gift" px={18} />
                            </Heading>
                            <Text as="p" bare extraClass="nbl-refer-modal__subtitle">Enter your referral code to unlock your discount.</Text>
                            <RewardSummary rows={rewardRows} />
                            <input
                                type="text"
                                class="nbl-refer-modal__input"
                                readonly
                                value={codeInput}
                                onInput={(e) => setCodeInput(e.target.value)}
                            />
                            {loading ? (
                                <div class="nbl-refer-modal__loader">
                                    <span class="nbl-spinner nbl-spinner--modal" />
                                    <Text as="span" bare>Verifying your referral code...</Text>
                                </div>
                            ) : (
                                <Button bare extraClass="nbl-refer-modal__btn nbl-refer-modal__btn--primary" onClick={handleSubmit}>
                                    Request Discount Code
                                </Button>
                            )}
                            <Message msg={formMessage} onRetry={handleRetry} />
                        </div>
                    )}

                    {step === 'success' && (
                        <div>
                            <div class="nbl-refer-modal__brand">NBL Loyalty</div>
                            <Heading as="h3" bare extraClass="nbl-refer-modal__title">
                                <Icon name="sparkles" px={18} /> Your Discount Code
                            </Heading>
                            <div class="nbl-refer-modal__code-box">
                                <div class="nbl-refer-modal__code">{discountCode}</div>
                                <Button bare extraClass="nbl-refer-modal__copy-btn" disabled={copied} onClick={handleCopy}>
                                    {copied ? 'Copied ✓' : 'Copy Code'}
                                </Button>
                            </div>
                            <RewardSummary rows={rewardRows} />
                            <div class="nbl-refer-modal__important">
                                <strong>Important:</strong>
                                <ul>
                                    <li>One-time code — use at checkout.</li>
                                    <li>Use it quickly.</li>
                                </ul>
                            </div>
                            <Button bare extraClass="nbl-refer-modal__btn nbl-refer-modal__btn--finish" onClick={handleFinish}>
                                Finish &amp; Save
                            </Button>
                            <Message msg={successMessage} />
                        </div>
                    )}

                    {step === 'locked' && (
                        <div>
                            <div class="nbl-refer-modal__brand">NBL Loyalty</div>
                            <Heading as="h3" bare extraClass="nbl-refer-modal__title">
                                <Icon name="block" px={18} /> Referral Already Used
                            </Heading>
                            <Text as="p" bare extraClass="nbl-refer-modal__subtitle">Only one referral discount is allowed per customer.</Text>
                            <Button bare extraClass="nbl-refer-modal__btn nbl-refer-modal__btn--finish" onClick={closeModal}>Close</Button>
                            <Message msg={lockedMessage} />
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
