// =============================================================================
// modules/module-preact/ActivitiesTab.jsx
// Full Activities tab + Full Active Rewards tab — purono tabs/activities.js-er
// replacement. Ekhon pagination hook use kore, click-router lagе na (eই
// duই class-er sob producer ekhon Preact, tai onClick safely use kora jay).
// =============================================================================

import { h } from 'preact';
import { ItemList } from '../components/ItemList.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { usePagination } from '../hooks/usePagination.js';
import { ActivityRow, ActiveRewardItem } from '../components/items.jsx';

export function ActivitiesTab({ transactions, perPage, paginationMode, lbl }) {
    const pagination = usePagination(transactions || [], perPage || 10, paginationMode || 'pagination');

    return (
        <div class="nbl-tab-content nbl-tab-content--flush">
            <div class="nbl-activity-table nbl-home-section-card__body--padded">
                <div class="nbl-activity-table__head">
                    <div class="nbl-activity-table__head-cell">{lbl('activityColDate')}</div>
                    <div class="nbl-activity-table__head-cell">{lbl('activityColActivity')}</div>
                    <div class="nbl-activity-table__head-cell">{lbl('activityColPoints')}</div>
                </div>
                <div>
                    {pagination.pageItems.length ? (
                        pagination.pageItems.map((entry, i) => <ActivityRow key={i} entry={entry} />)
                    ) : (
                        <div class="nbl-activity-table__empty">{lbl('emptyActivity')}</div>
                    )}
                </div>
            </div>
            <Pagination pagination={pagination} lbl={lbl} />
        </div>
    );
}

export function ActiveRewardsTab({ customerRewards, perPage, paginationMode, lbl, onOpenVoucher }) {
    const active = (customerRewards || []).filter((r) => r.discountUsed === false && r.status === 'ACTIVE');
    const pagination = usePagination(active, perPage || 8, paginationMode || 'pagination');

    return (
        <div class="nbl-tab-content nbl-tab-content--flush">
            <div class="nbl-home-section-card__body--padded">
                <ItemList
                    items={pagination.pageItems}
                    emptyText={lbl('emptyRewards')}
                    renderItem={(reward) => <ActiveRewardItem reward={reward} onOpenVoucher={onOpenVoucher} cardStyle />}
                />
            </div>
            <Pagination pagination={pagination} lbl={lbl} />
        </div>
    );
}
