// =============================================================================
// modules/module-preact/EarnTab.jsx
// Earn Points tab — purono tabs/earn.js-er replacement.
// =============================================================================

import { h } from 'preact';
import { formatNumber, formatPoints, formatDiscount } from '../utils.js';
import { Item } from '../components/Item.jsx';
import { Icon } from '../components/Icon.jsx';
import { ItemList } from '../components/ItemList.jsx';

function buildLabel(rule, currencySymbol) {
    const type = rule.event && rule.event.type;
    const ruleConditions = rule.conditions || {};
    const order = ruleConditions.order || {};
    const referralConditions = ruleConditions.referral || {};
    const review = ruleConditions.review || {};

    if (type === 'REVIEW') {
        const parts = [];
        if (review.text && review.text.isActive && review.text.points > 0) parts.push(formatPoints(review.text.points) + ' for text review');
        if (review.image && review.image.isActive && review.image.points > 0) parts.push(formatPoints(review.image.points) + ' for photo review');
        if (review.video && review.video.isActive && review.video.points > 0) parts.push(formatPoints(review.video.points) + ' for video review');
        return parts.join('. ') || 'Earn points for reviews';
    }

    if (type === 'ORDER') {
        if (order.type === 'incremental' && order.rate) return 'Get ' + formatPoints(order.rate.points) + ' for every ' + currencySymbol + formatNumber(order.rate.amount) + ' spent';
        if (order.type === 'fixed') return 'Get ' + formatPoints(order.fixedPoints) + ' for every order';
    }

    if (type === 'REFERRAL') {
        const referrer = referralConditions.referrer || {};
        const referred = referralConditions.referred || {};
        const trigger = referralConditions.trigger || 'oneTime';
        const parts = [];
        if (trigger === 'subscription') {
            if (referrer.points > 0) parts.push('Earn ' + formatPoints(referrer.points) + " when your friend places their first subscription order");
            if (referrer.allowRenewalReward && referrer.renewalPoints > 0) parts.push('Earn ' + formatPoints(referrer.renewalPoints) + ' for each renewal');
        } else if (trigger === 'both') {
            if (referrer.points > 0) parts.push('Earn ' + formatPoints(referrer.points) + " when your friend places their first order");
            if (referrer.allowRenewalReward && referrer.renewalPoints > 0) parts.push('Earn ' + formatPoints(referrer.renewalPoints) + ' for each subscription renewal');
        } else if (referrer.points > 0) {
            parts.push('Earn ' + formatPoints(referrer.points) + " when your friend makes their first one-time purchase");
        }
        if (referred.discountValue) {
            const note = trigger === 'subscription' ? ' on their first subscription order' : trigger === 'both' ? ' on their first order' : ' on their first one-time purchase';
            parts.push('Your friend gets ' + formatDiscount(referred.discountValue, referred.discountType, currencySymbol) + note);
        }
        return parts.length ? parts.join('. ') : 'Earn points by referring friends';
    }

    return 'Earn ' + formatPoints(order.fixedPoints || rule.pointsCost || 0) + ' for completing this action';
}

function buildPointsText(rule, currencySymbol) {
    const type = rule.event && rule.event.type;
    const ruleConditions = rule.conditions || {};
    const order = ruleConditions.order || {};
    const referralConditions = ruleConditions.referral || {};
    const review = ruleConditions.review || {};

    if (type === 'REVIEW') {
        const parts = [];
        if (review.text && review.text.isActive && review.text.points > 0) parts.push(formatPoints(review.text.points) + ' text');
        if (review.image && review.image.isActive && review.image.points > 0) parts.push(formatPoints(review.image.points) + ' photo');
        if (review.video && review.video.isActive && review.video.points > 0) parts.push(formatPoints(review.video.points) + ' video');
        return parts.join(' · ') || '—';
    }

    if (type === 'REFERRAL') {
        const referrer = referralConditions.referrer || {};
        const trigger = referralConditions.trigger || 'oneTime';
        if (trigger === 'subscription' || trigger === 'both') {
            const parts = [];
            if (referrer.points > 0) parts.push(formatPoints(referrer.points) + ' (first subscription order)');
            if (referrer.allowRenewalReward && referrer.renewalPoints > 0) parts.push(formatPoints(referrer.renewalPoints) + ' (renewals)');
            return parts.length ? parts.join(' + ') : '—';
        }
        if (referrer.points > 0) return formatPoints(referrer.points) + ' (one-time purchase)';
        return '—';
    }

    if (type === 'ORDER') {
        if (order.type === 'incremental' && order.rate) return formatPoints(order.rate.points) + ' per ' + currencySymbol + formatNumber(order.rate.amount);
        if (order.type === 'fixed') return formatPoints(order.fixedPoints) + ' per order';
    }

    return formatPoints(order.fixedPoints || rule.pointsCost || 0);
}

const ICON_MAP = { REVIEW: 'review', REFERRAL: 'referral', ORDER: 'purchase' };

function PointRuleItem({ rule, currencySymbol, onOpenInfo }) {
    const type = rule.event && rule.event.type;
    const title = (rule.event && rule.event.name) || rule.title || 'Earn Points';
    const label = buildLabel(rule, currencySymbol);

    return (
        <Item
            lift
            accentHover
            onClick={() => onOpenInfo({ text: label })}
            leading={<Icon name={ICON_MAP[type] || 'earn-points'} size="lg" />}
            content={
                <div class="nbl-item__content">
                    <div class="nbl-item__title">{title}</div>
                    <div class="nbl-item__meta">{buildPointsText(rule, currencySymbol)}</div>
                </div>
            }
            trailing={
                <div class="nbl-item__trailing">
                    <Icon name="chevron-right" size="sm" />
                </div>
            }
        />
    );
}

export function EarnTab({ pointRules, currencySymbol, onOpenInfo }) {
    const activeRules = (pointRules || []).filter((r) => r.isActive);

    return (
        <div class="nbl-item-list">
            <ItemList
                items={activeRules}
                emptyText="No earn rules available"
                renderItem={(rule) => <PointRuleItem rule={rule} currencySymbol={currencySymbol || '$'} onOpenInfo={onOpenInfo} />}
            />
        </div>
    );
}
