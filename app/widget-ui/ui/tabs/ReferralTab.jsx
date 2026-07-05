// =============================================================================
// modules/module-preact/ReferralTab.jsx
// Referral tab — purono html.js referralTabHTML() + tabs/referral.js-er
// combined replacement (static shell + dynamic reward rows + copy/share).
// =============================================================================

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon.jsx';
import { Heading } from '../components/Heading.jsx';
import { Text } from '../components/Text.jsx';
import { Button } from '../components/Button.jsx';

function RewardRow({ who, whoModifier, valueText, noteText }) {
    return (
        <div class={`nbl-referral__reward-row nbl-referral__reward-row--${whoModifier}`}>
            <div class="nbl-referral__reward-who">{who}</div>
            <div class="nbl-referral__reward-info">
                <Text as="span" bare extraClass="nbl-referral__reward-value">{valueText}</Text>
                <Text as="span" bare extraClass="nbl-referral__reward-note">{noteText}</Text>
            </div>
        </div>
    );
}

function RefStep({ num, title, desc }) {
    return (
        <div class="nbl-referral__step">
            <div class="nbl-referral__step-num">{num}</div>
            <div class="nbl-referral__step-content">
                <Heading as="h4" bare>{title}</Heading>
                <Text as="p" bare>{desc}</Text>
            </div>
        </div>
    );
}

export function ReferralTab({ pointRules, referralLink, currencySymbol, onOpenInfo }) {
    const [copied, setCopied] = useState(false);

    const refRule = (pointRules || []).find((r) => r.event && r.event.type === 'REFERRAL');
    const refCond = (refRule && refRule.conditions && refRule.conditions.referral) || {};
    const referrer = refCond.referrer || {};
    const referred = refCond.referred || {};
    const trigger = refCond.trigger || 'oneTime';
    const isSubscription = trigger === 'subscription' || trigger === 'both';
    const currency = currencySymbol || '$';

    // ── Dynamic reward rows ───────────────────────────────────────────────────
    const rewardRows = [];
    if (isSubscription) {
        if (referrer.points > 0) {
            rewardRows.push({ who: 'You', whoModifier: 'you', value: `${referrer.points} points`, note: 'When friend places their first subscription order' });
        }
        if (referrer.allowRenewalReward && referrer.renewalPoints > 0) {
            rewardRows.push({ who: 'You', whoModifier: 'you', value: `${referrer.renewalPoints} points`, note: 'Each time friend renews their subscription' });
        }
    } else if (referrer.points > 0) {
        rewardRows.push({ who: 'You', whoModifier: 'you', value: `${referrer.points} points`, note: "After friend's first one-time purchase" });
    }

    if (referred.discountValue) {
        const voucherLabel = referred.discountType === 'percentage'
            ? `${referred.discountValue}% discount voucher`
            : `${currency}${referred.discountValue} discount voucher`;
        const orderNote = referred.minimumOrderValue
            ? `On orders over ${currency}${referred.minimumOrderValue}`
            : trigger === 'subscription' ? 'On first subscription order'
                : trigger === 'both' ? 'On first order'
                    : 'On first one-time purchase';
        rewardRows.push({ who: 'Friend', whoModifier: 'friend', value: voucherLabel, note: orderNote });

        if (isSubscription && referred.allowRenewalReward && referred.renewalPoints > 0) {
            rewardRows.push({ who: 'Friend', whoModifier: 'friend', value: `${referred.renewalPoints} points`, note: 'Each time they renew their subscription' });
        }
    }

    const step2Title = trigger === 'subscription' ? 'Friend subscribes' : trigger === 'both' ? 'Friend makes a purchase or subscribes' : 'Friend makes a one-time purchase';
    const step2Desc = trigger === 'subscription'
        ? 'They click your link and start a subscription'
        : trigger === 'both'
            ? 'They click your link and place a one-time or subscription order'
            : 'They click your link and place a one-time purchase';

    // ── Copy / share handlers ─────────────────────────────────────────────────

    function handleCopy() {
        const afterCopy = () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            onOpenInfo({ text: '🎉 Referral link copied! Share it with your friends' });
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(referralLink).then(afterCopy).catch(afterCopy);
        } else {
            afterCopy();
        }
    }

    function handleShare(type) {
        const text = 'Use my referral link and get rewards! ' + referralLink;
        if (type === 'whatsapp') window.open('https://wa.me/?text=' + encodeURIComponent(text));
        if (type === 'email') window.open('mailto:?subject=Join me and get rewards&body=' + encodeURIComponent(text));
        if (type === 'messenger') window.open('https://www.facebook.com/dialog/send?link=' + encodeURIComponent(referralLink));
        if (type === 'sms') window.open('sms:?body=' + encodeURIComponent(text));
    }

    return (
        <div class="nbl-referral">
            <div class="nbl-referral__header">
                <Heading as="h2" bare extraClass="nbl-referral__title">Invite Friends &amp; Earn</Heading>
                <Text as="p" bare extraClass="nbl-referral__subtitle">Share your link — you earn points, your friend gets a discount voucher</Text>
            </div>

            {rewardRows.length > 0 && (
                <div id="nbl-referral-rewards">
                    <div class="nbl-referral__reward-list">
                        {rewardRows.map((row, i) => (
                            <RewardRow key={i} who={row.who} whoModifier={row.whoModifier} valueText={row.value} noteText={row.note} />
                        ))}
                    </div>
                </div>
            )}

            <div>
                <Text as="p" bare extraClass="nbl-referral__how-label">How it works</Text>
                <div class="nbl-referral__flow">
                    <RefStep num="1" title="Share your link" desc="Send your unique referral link to friends" />
                    <RefStep num="2" title={step2Title} desc={step2Desc} />
                    <RefStep num="3" title="You both get rewarded" desc="Points for you, a discount voucher for them" />
                </div>
            </div>

            <div class="nbl-referral__section">
                <label>Your Referral Link</label>
                <div class="nbl-referral__input-group">
                    <input class="nbl-referral__input" type="text" value={referralLink} readonly />
                    <Button bare extraClass="nbl-referral__copy-btn" onClick={handleCopy}>{copied ? 'Copied ✓' : 'Copy'}</Button>
                </div>
            </div>

            <div class="nbl-referral__share">
                <Text as="p" bare>Share via</Text>
                <div class="nbl-referral__share-buttons">
                    <Button bare extraClass="nbl-referral__share-btn" onClick={() => handleShare('whatsapp')}>
                        <Icon name="phone" size="sm" /> WhatsApp
                    </Button>
                    <Button bare extraClass="nbl-referral__share-btn" onClick={() => handleShare('email')}>
                        <Icon name="mail" size="sm" /> Email
                    </Button>
                    <Button bare extraClass="nbl-referral__share-btn" onClick={() => handleShare('messenger')}>
                        <Icon name="mail" size="sm" /> Messenger
                    </Button>
                    <Button bare extraClass="nbl-referral__share-btn" onClick={() => handleShare('sms')}>
                        <Icon name="mail" size="sm" /> SMS
                    </Button>
                </div>
            </div>
        </div>
    );
}
