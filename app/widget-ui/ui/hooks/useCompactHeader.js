// =============================================================================
// modules/components/hooks/useCompactHeader.js
// Header scroll-e compact hoy — purono widget.js Section 8-er replacement.
// wrapperRef = scrollable '.nbl-widget-wrapper'-er ref.
// =============================================================================

import { useState, useEffect, useRef } from 'preact/hooks';

const COMPACT_AT = 60;
const EXPAND_AT = 15;

export function useCompactHeader(wrapperRef) {
    const [compact, setCompact] = useState(false);
    const lockedRef = useRef(false);
    const rafRef = useRef(null);

    useEffect(function () {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        function onScroll() {
            if (rafRef.current || lockedRef.current) return;
            rafRef.current = requestAnimationFrame(function () {
                rafRef.current = null;
                const scrollTop = wrapper.scrollTop;

                setCompact(function (isCompact) {
                    if (!isCompact && scrollTop > COMPACT_AT) {
                        lockedRef.current = true;
                        setTimeout(function () { lockedRef.current = false; }, 400);
                        return true;
                    }
                    if (isCompact && scrollTop < EXPAND_AT) {
                        lockedRef.current = true;
                        setTimeout(function () { lockedRef.current = false; }, 400);
                        return false;
                    }
                    return isCompact;
                });
            });
        }

        wrapper.addEventListener('scroll', onScroll, { passive: true });
        return function () {
            wrapper.removeEventListener('scroll', onScroll);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [wrapperRef]);

    return compact;
}
