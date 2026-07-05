// =============================================================================
// modules/module-preact/Pagination.jsx
// Pagination/load-more UI controls — purono html.js paginationHTML()-er
// replacement. usePagination() hook-er return value direct props hisebe nay.
// =============================================================================

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Button } from './Button.jsx';
import { Text } from './Text.jsx';

const LOAD_MORE_DELAY = 600;

export function Pagination({ pagination, lbl }) {
    const [isLoading, setIsLoading] = useState(false);

    if (pagination.mode === 'loadmore') {
        const { loaded, total, hasMore, loadMore, perPage } = pagination;
        if (total <= 0) return null;
        if (perPage != null && total <= perPage) return null;

        function handleLoadMore() {
            setIsLoading(true);
            setTimeout(() => {
                loadMore();
                setIsLoading(false);
            }, LOAD_MORE_DELAY);
        }

        return (
            <div class="nbl-pagination" style={{ display: total > 0 ? 'flex' : 'none' }}>
                <div class="nbl-pagination__info">
                    {hasMore ? `${loaded} of ${total} loaded • ${total - loaded} remaining` : `${loaded} of ${total} loaded`}
                </div>
                <Button
                    bare
                    extraClass={`nbl-pagination__loadmore-btn${!hasMore ? ' done' : ''}${isLoading ? ' loading' : ''}`}
                    disabled={!hasMore || isLoading}
                    onClick={handleLoadMore}
                >
                    <Text as="span" bare extraClass="nbl-pagination__loadmore-text">{lbl('loadMoreBtn') || 'Load more'}</Text>
                    {hasMore ? (
                        <span class="nbl-pagination__loadmore-dots">
                            <span></span><span></span><span></span>
                        </span>
                    ) : (
                        <Text as="span" bare extraClass="nbl-pagination__loadmore-done">✓ {lbl('loadMoreDone') || 'All loaded'}</Text>
                    )}
                </Button>
            </div>
        );
    }

    const { page, totalPages, total, perPage, nextPage, prevPage, goToPage } = pagination;
    if (totalPages <= 1) return null;

    const rangeStart = (page - 1) * perPage + 1;
    const rangeEnd = Math.min(page * perPage, total);

    const maxDots = 5;
    const dotsStart = Math.max(1, Math.min(page - 2, totalPages - maxDots + 1));
    const dotsEnd = Math.min(totalPages, dotsStart + maxDots - 1);
    const dots = [];
    for (let i = dotsStart; i <= dotsEnd; i++) dots.push(i);

    return (
        <div class="nbl-pagination" style={{ display: 'flex' }}>
            <Button bare extraClass="nbl-pagination__btn" disabled={page <= 1} onClick={prevPage}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
            </Button>
            <div class="nbl-pagination__info">{`Showing ${rangeStart}–${rangeEnd} of ${total}`}</div>
            <div class="nbl-pagination__dots">
                {dots.map((i) => (
                    <span
                        key={i}
                        class={`nbl-pagination__dot${i === page ? ' active' : ''}`}
                        onClick={() => goToPage(i)}
                    />
                ))}
            </div>
            <Button bare extraClass="nbl-pagination__btn" disabled={page >= totalPages} onClick={nextPage}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                </svg>
            </Button>
        </div>
    );
}
