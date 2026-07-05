// =============================================================================
// modules/module-preact/hooks/useCustomerProvision.js
// Silent customer auto-provisioning — kichu logged-in customer Shopify-te
// ache kintu app DB-te nai (e.g. install-er age customer ছিল, ba webhook
// miss hoyeche). Eta detect kore background-e provision kore, then reload.
// =============================================================================

import { useState, useEffect, useRef } from 'preact/hooks';

const SESSION_GUARD_KEY = 'NBL_ProvisionAttempted';

// Hard cutoff — customer ke kokhono lomba shomoy dhore overlay-te lock kore
// rakha jabe na. Eita ekta circuit breaker: backend slow/unreachable hole,
// silently give up, overlay hide kore daw, widget normal state-e render
// hote dao. Real loop-protection backend-e (idempotent upsert + shouldReload
// flag) — eta sudhu "customer ke besi shomoy spinner dekhano jabe na" ensure kore.
const HARD_CUTOFF_MS = 7000;

function hasAttemptedThisSession() {
    try { return sessionStorage.getItem(SESSION_GUARD_KEY) === '1'; } catch (e) { return false; }
}
function markAttemptedThisSession() {
    try { sessionStorage.setItem(SESSION_GUARD_KEY, '1'); } catch (e) { /* ignore */ }
}

/**
 * @param {Object} params
 * @param {boolean} params.isLoggedIn
 * @param {Object|null} params.customer  - widget-er customer data. customer.id
 *                                          ekhane Shopify customer GID (referralModal/api.js
 *                                          eki convention follow kore) — even if
 *                                          customer.config missing thake, customer.id thakte pare.
 * @param {Object} params.appConfig      - appConfig.appUrl, appConfig.autoProvisionCustomer
 *                                          (default true — static flag, explicit false e off hoy),
 *                                          appConfig.showProvisionLoadingOverlay
 * @returns {{ provisioning: boolean, provisionNeeded: boolean, inFlight: boolean }}
 *          provisioning     - true jokhon OVERLAY dekhano dorkar (in-flight AND showOverlay on).
 *                              UI render-er jonno — ReferralModal-er overlay slot eta use kore.
 *          provisionNeeded  - synchronous, render-time true/false — "ei customer-er
 *                              provisioning lagbe naki lagbe na" — sibling hooks (jemon
 *                              useReferralModal) eta diye nijeder boot-time API call defer korte pare.
 *          inFlight         - true jotokkhon call ta actually pending, showOverlay flag
 *                              nirbishese. Sibling hooks-er deferral logic-er jonno EI flag
 *                              use kora uchit, `provisioning` na — karon showOverlay false
 *                              thakle `provisioning` kokhono true hobei na, kintu call tobu
 *                              pending thakte pare.
 */
export function useCustomerProvision({ isLoggedIn, customer, appConfig }) {
    const [provisioning, setProvisioning] = useState(false); // overlay visibility only
    const [inFlight, setInFlight] = useState(false); // true whenever a provision call is outstanding, regardless of overlay setting
    const ranRef = useRef(false);

    const cfg = appConfig || {};
    // Default true — eta static feature flag, dashboard toggle na. Only an
    // EXPLICIT false in config turns it off; missing/undefined still means on.
    const featureEnabled = cfg.autoProvisionCustomer !== false;

    // ── Synchronous, render-time derived flag ─────────────────────────────────
    // Available immediately on first render (no useEffect delay), so sibling
    // hooks like useReferralModal can check "is this customer mid-provision?"
    // and defer their own boot-time API calls instead of racing ahead and
    // hitting the backend before the DB record even exists.
    const shopifyCustomerId = customer && customer.id;
    const provisionNeeded = !!(
        featureEnabled
        && isLoggedIn
        && shopifyCustomerId
        && (!customer.config || !customer.config.id)
    );

    useEffect(() => {
        if (!provisionNeeded) return;
        if (ranRef.current) return;
        if (hasAttemptedThisSession()) return; // circuit breaker — max once per tab session
        ranRef.current = true;
        markAttemptedThisSession();

        const showOverlay = cfg.showProvisionLoadingOverlay !== false;
        setInFlight(true);
        if (showOverlay) setProvisioning(true);

        let settled = false;
        const cutoff = setTimeout(() => {
            if (settled) return;
            settled = true;
            // eslint-disable-next-line no-console
            console.error('[NBL Provision] hard cutoff reached — giving up silently');
            setProvisioning(false);
            setInFlight(false);
        }, HARD_CUTOFF_MS);

        let signal;
        if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
            signal = AbortSignal.timeout(HARD_CUTOFF_MS);
        }

        fetch(cfg.appUrl + '/api/provision-customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shop: window.Shopify && window.Shopify.shop,
                customerId: shopifyCustomerId,
            }),
            signal,
        })
            .then((res) => res.json().catch(() => ({})))
            .then((data) => {
                if (settled) return;
                settled = true;
                clearTimeout(cutoff);

                if (data && data.success && data.shouldReload) {
                    // Don't bother hiding the overlay first — a reload is coming
                    // immediately, and leaving it up avoids a one-frame flash of
                    // the stale/guest state right before the page reloads.
                    window.location.reload();
                    return;
                }
                setProvisioning(false);
                setInFlight(false);
            })
            .catch((err) => {
                if (settled) return;
                settled = true;
                clearTimeout(cutoff);
                // eslint-disable-next-line no-console
                console.error('[NBL Provision] failed:', err);
                setProvisioning(false);
                setInFlight(false);
            });

        return () => {
            settled = true;
            clearTimeout(cutoff);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [provisionNeeded]);

    return { provisioning, provisionNeeded, inFlight };
}