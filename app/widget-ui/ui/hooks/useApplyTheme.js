// =============================================================================
// modules/module-preact/hooks/useApplyTheme.js
// Dashboard theme CSS variable apply kora — purono theme.js-er applyTheme()
// (NEW cssVars path)-er replacement. document.documentElement-e --nbl-* set kore.
// =============================================================================

import { useEffect } from 'preact/hooks';

export function useApplyTheme(cssVars, hostEl) {
    useEffect(() => {
        if (!cssVars || typeof cssVars !== 'object' || Object.keys(cssVars).length === 0) return;
        // hostEl na thakle (kokhono call hole legacy fallback) document.
        // documentElement-e set hobe — normally shadow host-i pabe.
        const root = hostEl || document.documentElement;
        Object.keys(cssVars).forEach((prop) => {
            if (prop.indexOf('--') === 0) {
                root.style.setProperty(prop, cssVars[prop]);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}