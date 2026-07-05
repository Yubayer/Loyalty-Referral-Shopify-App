// =============================================================================
// modules/module-preact/HomeTab.jsx
// Home tab — nav cards + active rewards/prize-requests/activities preview.
// Purono tabs/home.js-er replacement. Pratiটা section-er nijer pagination
// instance ache (home-rewards, home-prize-requests, home-activities) —
// purono pagination.js-er moto.
// =============================================================================

import { h } from 'preact';
import { Icon } from '../components/Icon.jsx';
import { Text } from '../components/Text.jsx';
import { ItemList } from '../components/ItemList.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { usePagination } from '../hooks/usePagination.js';
import { ActiveRewardItem, PrizeClaimItem, ActivityRow } from '../components/items.jsx';

function HomeNavCard({ navKey, iconName, label, onNavigate }) {
    return (
        <div data-nav={navKey} class="nbl-home-nav__item" onClick={() => onNavigate(navKey)}>
            <div class="nbl-home-nav__icon">
                <Icon size='md' name={iconName} />
            </div>
            <Text as="span" bare extraClass="nbl-home-nav__label" size="md">{label}</Text>
            <div class="nbl-home-nav__chevron">
                <Icon name="chevron-right" size="sm" />
            </div>
        </div>
    );
}

function SectionHeader({ iconName, title }) {
    return (
        <div class="nbl-section-header">
            <Icon name={iconName} px={16} />
            <Text as="span" bare extraClass="nbl-section-title">{title}</Text>
        </div>
    );
}

export function HomeTab({
    showRewardsSection,
    showPrizeRequestsSection,
    showActivitiesSection,
    customerRewards,
    prizeClaims,
    physicalPrizes,
    transactions,
    homeRewardsPerPage,
    homePrizeRequestsPerPage,
    homeActivitiesPerPage,
    paginationMode,
    onNavigate,
    onOpenVoucher,
    onOpenClaim,
    onViewImage,
    lbl,
}) {
    const activeRewards = (customerRewards || []).filter((r) => r.discountUsed === false && r.status === 'ACTIVE');

    const rewardsPagination = usePagination(activeRewards, homeRewardsPerPage || 5, paginationMode || 'pagination');
    const prizeRequestsPagination = usePagination(prizeClaims || [], homePrizeRequestsPerPage || 5, paginationMode || 'pagination');
    const activitiesPagination = usePagination(transactions || [], homeActivitiesPerPage || 5, paginationMode || 'pagination');

    return (
        <div class="nbl-home-tab">
            <div class="nbl-home-nav">
                <HomeNavCard navKey="rewards" iconName="rewards" label={lbl('homeCardBrowse') || 'Browse rewards'} onNavigate={onNavigate} />
                <HomeNavCard navKey="points" iconName="lightning" label={lbl('homeCardEarn') || 'Earn points'} onNavigate={onNavigate} />
                <HomeNavCard navKey="referral" iconName="referral" label={lbl('homeCardRefer') || 'Refer a friend'} onNavigate={onNavigate} />
            </div>

            <div class="nbl-home-sections">
                {showRewardsSection && (
                    <div class="nbl-home-section-card" data-home-section="rewards">
                        <SectionHeader iconName="reward-discount" title={lbl('sectionActiveRewards') || 'Active Rewards'} />
                        <div class="nbl-item-list--divided nbl-home-section-card__body--padded">
                            <ItemList
                                items={rewardsPagination.pageItems}
                                emptyText={lbl('emptyRewards')}
                                renderItem={(reward) => <ActiveRewardItem reward={reward} onOpenVoucher={onOpenVoucher} />}
                            />
                        </div>
                        <Pagination pagination={rewardsPagination} lbl={lbl} />
                    </div>
                )}

                {showPrizeRequestsSection && (
                    <div class="nbl-home-section-card" data-home-section="prize-requests">
                        <SectionHeader iconName="reward-discount" title={lbl('sectionPrizeRequests') || 'Prize Requests'} />
                        <div class="nbl-item-rows nbl-home-section-card__body--padded">
                            <ItemList
                                items={prizeRequestsPagination.pageItems}
                                emptyText={lbl('emptyMyPrizes')}
                                renderItem={(claim) => (
                                    <PrizeClaimItem claim={claim} physicalPrizes={physicalPrizes} onOpenClaim={onOpenClaim} onViewImage={onViewImage} lbl={lbl} />
                                )}
                            />
                        </div>
                        <Pagination pagination={prizeRequestsPagination} lbl={lbl} />
                    </div>
                )}

                {showActivitiesSection && (
                    <div class="nbl-home-section-card" data-home-section="activities">
                        <SectionHeader iconName="lightning" title={lbl('sectionRecentActivity') || 'Recent Activity'} />
                        <div class="nbl-activity-table nbl-home-section-card__body--padded">
                            <div class="nbl-activity-table__head">
                                <div class="nbl-activity-table__head-cell">{lbl('activityColDate')}</div>
                                <div class="nbl-activity-table__head-cell">{lbl('activityColActivity')}</div>
                                <div class="nbl-activity-table__head-cell">{lbl('activityColPoints')}</div>
                            </div>
                            <div>
                                {activitiesPagination.pageItems.length ? (
                                    activitiesPagination.pageItems.map((entry, i) => <ActivityRow key={i} entry={entry} />)
                                ) : (
                                    <div class="nbl-activity-table__empty">{lbl('emptyActivity')}</div>
                                )}
                            </div>
                        </div>
                        <Pagination pagination={activitiesPagination} lbl={lbl} />
                    </div>
                )}
            </div>
        </div>
    );
}
