// =============================================================================
// modules/components/hooks/usePointsBump.js
// Points change hole ekta CSS class briefly retrigger kore (bump animation) —
// purono widget.js-er uiRender.pointsUpdate()-er bump part-er replacement.
// =============================================================================

import { useState, useEffect, useRef } from 'preact/hooks';

export function usePointsBump(points) {
    const [bump, setBump] = useState(false);
    const prevRef = useRef(points);

    useEffect(function () {
        if (prevRef.current !== points) {
            setBump(false);
            // ekta frame wait kore re-add kora, jate CSS animation restart hoy
            // (purono code-e: classList.remove() + void offsetWidth + classList.add())
            const raf = requestAnimationFrame(function () { setBump(true); });
            prevRef.current = points;
            return function () { cancelAnimationFrame(raf); };
        }
    }, [points]);

    return bump;
}
