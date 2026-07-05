// =============================================================================
// modules/components/hooks/useNavChevrons.js
// Nav rail-er left/right chevron visibility — purono widget.js Section 8b-er
// replacement. scrollRef = nav scroll container-er ref.
// =============================================================================

import { useState, useEffect, useCallback } from 'preact/hooks';

export function useNavChevrons(scrollRef, dep) {
    const [atStart, setAtStart] = useState(true);
    const [atEnd, setAtEnd] = useState(true);

    const update = useCallback(function () {
        const el = scrollRef.current;
        if (!el) return;
        setAtStart(el.scrollLeft <= 4);
        setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    }, [scrollRef]);

    useEffect(function () {
        const el = scrollRef.current;
        if (!el) return;

        update();
        const raf1 = requestAnimationFrame(function () {
            requestAnimationFrame(update);
        });

        const onScroll = function () { requestAnimationFrame(update); };
        el.addEventListener('scroll', onScroll, { passive: true });
        return function () {
            cancelAnimationFrame(raf1);
            el.removeEventListener('scroll', onScroll);
        };
    }, [scrollRef, update, dep]); // dep = activeTab, purono 'tab:activated' listener-er moto

    function scrollBy(amount) {
        const el = scrollRef.current;
        if (el) el.scrollBy({ left: amount, behavior: 'smooth' });
    }

    return { atStart, atEnd, scrollBy };
}
