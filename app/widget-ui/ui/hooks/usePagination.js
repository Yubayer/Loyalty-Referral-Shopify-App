// =============================================================================
// modules/module-preact/usePagination.js
// Purono pagination.js engine-er replacement. Duইটা mode support kore:
// 'pagination' (prev/next + dots) ar 'loadmore' (button, progressively load).
// =============================================================================

import { useState, useMemo } from 'preact/hooks';

export function usePagination(items, perPage = 5, mode = 'pagination') {
    const [page, setPage] = useState(1);
    const [loaded, setLoaded] = useState(perPage);

    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    const isLoadMore = mode === 'loadmore';
    const visibleCount = Math.min(loaded, items.length);
    const safePage = Math.min(page, totalPages);

    // Single useMemo, called unconditionally on every render regardless of
    // `mode`. Previously this branched into two separate useMemo() calls
    // (one per mode) with an early return in between — a Rules-of-Hooks
    // violation. It "worked" as long as `mode` never changed after mount,
    // but `mode` comes from the dashboard's "Pagination style" setting,
    // which the live preview CAN change at runtime (bridge → setWidgetConfig
    // → paginationMode) without a remount. Switching modes there would flip
    // which useMemo call site runs on a given render, desyncing Preact's
    // hook-slot bookkeeping for this component. A single call site sidesteps
    // that entirely.
    const pageItems = useMemo(() => {
        if (isLoadMore) return items.slice(0, visibleCount);
        const start = (safePage - 1) * perPage;
        return items.slice(start, start + perPage);
    }, [items, isLoadMore, visibleCount, safePage, perPage]);

    if (isLoadMore) {
        function loadMore() {
            setLoaded((l) => Math.min(l + perPage, items.length));
        }

        return {
            mode: 'loadmore',
            pageItems,
            hasMore: loaded < items.length,
            loadMore,
            loaded: visibleCount,
            total: items.length,
            perPage,
        };
    }

    function nextPage() { setPage((p) => Math.min(p + 1, totalPages)); }
    function prevPage() { setPage((p) => Math.max(p - 1, 1)); }
    function goToPage(p) { setPage(Math.min(Math.max(1, p), totalPages)); }

    return {
        mode: 'pagination',
        pageItems,
        page: safePage,
        totalPages,
        nextPage,
        prevPage,
        goToPage,
        total: items.length,
        perPage,
    };
}