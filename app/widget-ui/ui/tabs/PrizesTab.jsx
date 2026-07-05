// =============================================================================
// modules/module-preact/PrizesTab.jsx
// Prizes tab — physical prize list + active prize claims (paginated).
// Purono tabs/prizes.js-er replacement.
// =============================================================================

import { h, Fragment } from 'preact';
import { Icon } from '../components/Icon.jsx';
import { Image } from '../components/Image.jsx';
import { Text } from '../components/Text.jsx';
import { formatNumber } from '../utils.js';
import { Item } from '../components/Item.jsx';
import { ItemList } from '../components/ItemList.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { usePagination } from '../hooks/usePagination.js';
import { PrizeClaimItem } from '../components/items.jsx';

function PrizeItem({ prize, customerPoints, onClaim, onViewImage }) {
    const cost = Number(prize.pointsCost) || 0;
    const canClaim = cost > 0 && customerPoints >= cost;

    function handleClick() {
        if (!canClaim) return;
        onClaim(prize);
    }

    return (
        <Item
            selfSpaced
            active={canClaim}
            onClick={handleClick}
            leading={<Image src={prize.imageUrl} alt={prize.title} onView={onViewImage} />}
            content={
                <div class="nbl-item__content">
                    <div class="nbl-item__title">{prize.title}</div>
                    <div class="nbl-item__meta">{formatNumber(cost)} pts</div>
                </div>
            }
            trailing={
                <div class="nbl-item__trailing">
                    {canClaim ? (
                        <Icon name="chevron-right" size="sm" />
                    ) : (
                        <Text as="span" bare extraClass="nbl-item__status">Not enough pts</Text>
                    )}
                </div>
            }
        />
    );
}

export function PrizesTab({ physicalPrizes, points, prizeClaims, perPage, paginationMode, lbl, onOpenInfo, onOpenClaim, onViewImage }) {
    const activePrizes = (physicalPrizes || []).filter((p) => p.isActive);
    const pagination = usePagination(prizeClaims || [], perPage || 5, paginationMode || 'pagination');

    function handleClaimClick(prize) {
        const customerPts = points;
        const cost = Number(prize.pointsCost) || 0;
        const sub = prize.productValue
            ? `$${Number(prize.productValue).toLocaleString()} value  ·  ${formatNumber(cost)} pts to claim`
            : `${formatNumber(cost)} pts to claim`;

        onOpenInfo({
            title: prize.title,
            sub,
            rows: [
                { key: 'Points cost', val: `${formatNumber(cost)} pts` },
                { key: 'Your balance', val: `${formatNumber(customerPts)} pts` },
                { key: 'Balance after', val: `${formatNumber(customerPts - cost)} pts` },
            ],
            claim: true,
            data: { prize: { id: prize.id, pointsCost: cost }, title: prize.title, isPrize: true },
        });
    }

    return (
        <>
            <div class="nbl-prize-list">
                <ItemList
                    items={activePrizes}
                    emptyText={lbl('emptyPrizes') || 'No prizes available'}
                    renderItem={(prize) => (
                        <PrizeItem prize={prize} customerPoints={points} onClaim={handleClaimClick} onViewImage={onViewImage} />
                    )}
                />
            </div>

            <div class="nbl-home-section-card nbl-home-section-card--standalone" data-home-section="prizes-tab-active-prizes">
                <div class="nbl-section-header">
                    <Icon name="reward-discount" px={16} />
                    <Text as="span" bare extraClass="nbl-section-title">{lbl('sectionPrizeRequests')}</Text>
                </div>
                <div class="nbl-item-rows nbl-home-section-card__body--padded">
                    <ItemList
                        items={pagination.pageItems}
                        emptyText={lbl('emptyMyPrizes')}
                        renderItem={(claim) => (
                            <PrizeClaimItem
                                claim={claim}
                                physicalPrizes={physicalPrizes}
                                onOpenClaim={onOpenClaim}
                                onViewImage={onViewImage}
                                lbl={lbl}
                            />
                        )}
                    />
                </div>
                <Pagination pagination={pagination} lbl={lbl} />
            </div>
        </>
    );
}
