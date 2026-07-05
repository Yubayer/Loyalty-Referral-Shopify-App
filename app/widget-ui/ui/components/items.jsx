// =============================================================================
// modules/module-preact/items.jsx
// Shared item renderers — ekta item-shape, multiple jaiga-y reuse (Home
// preview, full tabs). Sob-i Item.jsx shell use kore, joto jaigai icon/image
// ace sob jaigai Icon/Image component use kore.
// =============================================================================

import { h } from 'preact';
import { formatNumber, formatDate, formatPointsDisplay } from '../utils.js';
import { Item } from './Item.jsx';
import { Icon } from './Icon.jsx';
import { Image } from './Image.jsx';
import { Text } from './Text.jsx';

// ── Active reward (voucher) item — Home preview + Rewards tab + Active Rewards tab ──

export function ActiveRewardItem({ reward, onOpenVoucher, cardStyle = false }) {
    return (
        <Item
            variant={cardStyle ? 'card' : 'voucher-row'}
            selfSpaced={cardStyle}
            active={cardStyle ? true : undefined}
            onClick={() => onOpenVoucher(reward.code)}
            leading={<Icon name="reward-discount" px={26} />}
            content={
                <div class="nbl-item__content">
                    <div class="nbl-item__title">{reward.title || 'Voucher'}</div>
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

// ── Prize claim item — Home preview + Prizes tab active claims + My Prizes tab ──

const PRIZE_STATUS_LABELS = {
    PENDING: 'Pending',
    FULFILLED: 'Fulfilled',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
};

export function PrizeClaimItem({ claim, physicalPrizes, onOpenClaim, onViewImage, lbl, cardStyle = false }) {
    const prize = (physicalPrizes || []).find((p) => Number(p.id) === Number(claim.physicalPrizeId));
    const title = prize ? prize.title : `Prize request #${claim.id}`;
    const status = claim.status || 'PENDING';
    const statusKey = status.toLowerCase();

    const statusLabelKeys = {
        PENDING: 'prizeStatusPending',
        FULFILLED: 'prizeStatusFulfilled',
        COMPLETED: 'prizeStatusCompleted',
        CANCELLED: 'prizeStatusCancelled',
    };
    const statusLabel = (lbl && lbl(statusLabelKeys[status])) || PRIZE_STATUS_LABELS[status] || status;
    const statusModifierClass = statusKey === 'fulfilled' ? ' nbl-prize-status--fulfilled'
        : statusKey === 'cancelled' ? ' nbl-prize-status--cancelled' : '';

    return (
        <Item
            variant={cardStyle ? 'card' : 'row'}
            selfSpaced={cardStyle}
            active={cardStyle ? true : undefined}
            clickable={!cardStyle}
            onClick={() => onOpenClaim(claim)}
            leading={<Image src={prize && prize.imageUrl} alt={title} size="sm" onView={onViewImage} />}
            content={
                <div class="nbl-item__content">
                    <Text as="span" bare extraClass="nbl-item__title">{title}</Text>
                    {claim.pointsCost ? <Text as="span" bare extraClass="nbl-item__meta">{formatNumber(claim.pointsCost)} pts</Text> : null}
                </div>
            }
            trailing={
                <Text as="span" bare extraClass={`nbl-item__status${statusModifierClass}`}>{statusLabel}</Text>
            }
        />
    );
}

// ── Activity table row — Home preview + full Activities tab ─────────────────

export function ActivityRow({ entry, isNew }) {
    return (
        <div class={`nbl-activity-row${isNew ? ' nbl-item-new' : ''}`}>
            <div class="nbl-activity-row__cell">{formatDate(entry.createdAt)}</div>
            <div class="nbl-activity-row__cell">{entry.activity || entry.reason || '—'}</div>
            <div
                class="nbl-activity-row__cell"
                dangerouslySetInnerHTML={{ __html: formatPointsDisplay(entry.points) }}
            />
        </div>
    );
}
