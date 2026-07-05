// =============================================================================
// modules/module-preact/rewards.jsx
// Rewards tab — reward rules list + Active Rewards card (paginated, same
// pattern as PrizesTab-er active-prizes card). Purono tabs/rewards.js-er
// pura replacement.
// =============================================================================

import { h, Fragment } from 'preact';
import { formatNumber } from '../utils.js';
import { Item } from '../components/Item.jsx';
import { Icon } from '../components/Icon.jsx';
import { Text } from '../components/Text.jsx';
import { Button } from '../components/Button.jsx';
import { ItemList } from '../components/ItemList.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { usePagination } from '../hooks/usePagination.js';
import { ActiveRewardItem } from '../components/items.jsx';

function RewardRuleItem({ reward, customerPoints, onOpenInfo }) {
    const isFixed = reward.discountType === 'fixed';
    const title = 'Voucher ' + (isFixed ? '$' : '') + reward.rewardValue + (isFixed ? '' : '%');
    const cost = Number(reward.pointsCost) || 0;
    const canRedeem = cost > 0 && customerPoints >= cost;

    function handleClick() {
        if (!canRedeem) return;
        onOpenInfo({
            text: 'Spend ' + formatNumber(cost) + ' points for this reward?',
            claim: true,
            data: { rewardRule: reward, title },
        });
    }

    return (
        <Item
            lift
            active={canRedeem}
            onClick={handleClick}
            leading={<Icon name="reward-discount" size="lg" />}
            content={
                <div class="nbl-item__content">
                    <div class="nbl-item__title">{title}</div>
                    <div class="nbl-item__meta">{formatNumber(cost)} points</div>
                </div>
            }
            trailing={
                <div class="nbl-item__trailing">
                    <Button bare extraClass="nbl-item__action" disabled={!canRedeem}>
                        {canRedeem ? (
                            <Icon name="chevron-right" size="sm" />
                        ) : (
                            <Text as="span" bare extraClass="nbl-item__status">Not enough points</Text>
                        )}
                    </Button>
                </div>
            }
        />
    );
}

export function RewardsTab({ rewardRules, points, customerRewards, perPage, paginationMode, lbl, onOpenInfo, onOpenVoucher }) {
    const rules = rewardRules || [];
    const activeRewards = (customerRewards || []).filter((r) => r.discountUsed === false && r.status === 'ACTIVE');
    const pagination = usePagination(activeRewards, perPage || 5, paginationMode || 'pagination');

    return (
        <>
            <div class="nbl-item-list">
                <ItemList
                    items={rules}
                    emptyText="No rewards available"
                    renderItem={(reward) => (
                        <RewardRuleItem reward={reward} customerPoints={points} onOpenInfo={onOpenInfo} />
                    )}
                />
            </div>

            <div class="nbl-home-section-card nbl-home-section-card--standalone" data-home-section="rewards-tab-active-rewards">
                <div class="nbl-section-header">
                    <Icon name="reward-discount" px={16} />
                    <Text as="span" bare extraClass="nbl-section-title">{lbl('sectionActiveRewards') || 'Active Rewards'}</Text>
                </div>
                <div class="nbl-item-list--divided nbl-home-section-card__body--padded">
                    <ItemList
                        items={pagination.pageItems}
                        emptyText={lbl('emptyRewards')}
                        renderItem={(reward) => <ActiveRewardItem reward={reward} onOpenVoucher={onOpenVoucher} />}
                    />
                </div>
                <Pagination pagination={pagination} lbl={lbl} />
            </div>
        </>
    );
}
