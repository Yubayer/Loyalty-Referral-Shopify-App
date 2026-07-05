// =============================================================================
// modules/components/GuestPanel.jsx
// Logged-out (guest) view — hero card + perks strip + Create Account / Sign In.
// Purono modules-main/html.js guestBodyHTML()-er Preact component replacement.
// Renders full-bleed (no .nbl-widget-body padding) — see WidgetShell.jsx.
// =============================================================================

import { h } from 'preact';
import { Icon } from './Icon.jsx';
import { Heading } from './Heading.jsx';
import { Text } from './Text.jsx';
import { Link } from './Link.jsx';

function GuestPerk({ iconName, label }) {
    return (
        <div class="nbl-guest-perk">
            <span class="nbl-guest-perk__icon">
                <Icon name={iconName} px={18} />
            </span>
            <Text as="span" bare extraClass="nbl-guest-perk__label">{label}</Text>
        </div>
    );
}

export function GuestPanel({ loginUrl, signupUrl, lbl }) {
    const title = lbl('guestTitle') || 'Earn & Redeem Rewards';
    const subtitle = lbl('guestSubtitle') || 'Join the loyalty program and start earning points on every purchase.';

    return (
        <div class="nbl-guest">
            <div class="nbl-guest__hero">
                <div class="nbl-guest__icon-wrap">
                    <span class="nbl-guest__ring" />
                    <span class="nbl-guest__ring nbl-guest__ring--2" />
                    <div class="nbl-guest__icon">
                        <Icon name="gift" px={42} />
                    </div>
                </div>
                <Heading as="h2" bare extraClass="nbl-guest__title">{title}</Heading>
                <Text as="p" bare extraClass="nbl-guest__subtitle">{subtitle}</Text>
            </div>

            <div class="nbl-guest__perks">
                <GuestPerk iconName="lightning" label={lbl('guestPerkEarn') || 'Earn on every order'} />
                <div class="nbl-guest__perk-divider" />
                <GuestPerk iconName="tag" label={lbl('guestPerkRedeem') || 'Redeem for discounts'} />
                <div class="nbl-guest__perk-divider" />
                <GuestPerk iconName="referral" label={lbl('guestPerkRefer') || 'Refer & earn more'} />
            </div>

            <div class="nbl-guest__actions">
                <Link bare extraClass="nbl-guest__btn nbl-guest__btn--primary" href={signupUrl}>
                    <span class="nbl-guest__btn-label">{lbl('guestCreateAccount') || 'Create Account'}</span>
                    <span class="nbl-guest__btn-hint">{lbl('guestCreateAccountHint') || 'Free & takes 30 seconds'}</span>
                </Link>
                <Link bare extraClass="nbl-guest__btn nbl-guest__btn--secondary" href={loginUrl}>
                    <span class="nbl-guest__btn-label">{lbl('guestSignIn') || 'Sign In'}</span>
                    <span class="nbl-guest__btn-hint">{lbl('guestSignInHint') || 'Already have an account?'}</span>
                </Link>
            </div>
        </div>
    );
}
