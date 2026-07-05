// =============================================================================
// modules/components/Nav.jsx
// Nav rail — purono html.js-er navHTML + widget.js Section 5/8b-er replacement.
// =============================================================================

import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { useNavChevrons } from '../hooks/useNavChevrons.js';

const NAV_ITEMS = [
    { key: 'home', labelKey: 'navHome' },
    { key: 'points', labelKey: 'navEarn' },
    { key: 'rewards', labelKey: 'navRewards' },
    { key: 'prizes', labelKey: 'navPrizes' },
    { key: 'referral', labelKey: 'navReferral', fallback: 'Referral' },
    { key: 'activities', labelKey: 'navActivity' },
    { key: 'active-rewards', labelKey: 'navMyRewards' },
    { key: 'my-prizes', labelKey: 'navMyPrizes' },
];

export function Nav({ activeTab, onChange, lbl }) {
    const scrollRef = useRef(null);
    const { atStart, atEnd, scrollBy } = useNavChevrons(scrollRef, activeTab);

    const showChevrons = NAV_ITEMS.length > 3;

    useEffect(() => {
        const scrollEl = scrollRef.current;
        if (!scrollEl) return;
        const activeEl = scrollEl.querySelector('[data-nav="' + activeTab + '"]');
        if (!activeEl) return;
        const itemCenter = activeEl.offsetLeft + activeEl.offsetWidth / 2;
        const scrollCenter = scrollEl.clientWidth / 2;
        scrollEl.scrollTo({ left: Math.max(0, itemCenter - scrollCenter), behavior: 'smooth' });
    }, [activeTab]);

    return (
        <div class="nbl-nav">
            <button
                class={`nbl-nav__chevron${!showChevrons ? ' hidden' : ''}${showChevrons && atStart ? ' disabled' : ''}`}
                aria-label="Scroll nav left"
                disabled={showChevrons && atStart}
                onClick={() => scrollBy(-100)}
                dangerouslySetInnerHTML={{
                    __html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
                }}
            />
            <div class="nbl-nav__scroll" ref={scrollRef}>
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.key}
                        class={`nbl-nav__item${activeTab === item.key ? ' active' : ''}`}
                        data-nav={item.key}
                        role="tab"
                        onClick={() => onChange(item.key)}
                    >
                        {lbl(item.labelKey) || item.fallback || item.key}
                    </button>
                ))}
            </div>
            <button
                class={`nbl-nav__chevron${!showChevrons ? ' hidden' : ''}${showChevrons && atEnd ? ' disabled' : ''}`}
                aria-label="Scroll nav right"
                disabled={showChevrons && atEnd}
                onClick={() => scrollBy(100)}
                dangerouslySetInnerHTML={{
                    __html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
                }}
            />
        </div>
    );
}
