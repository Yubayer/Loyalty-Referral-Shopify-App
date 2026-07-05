// =============================================================================
// modules/hooks/useToastNotifications.js
// Toast notification list — DERIVED CLIENT-SIDE from `transactions`, which
// already arrived for free on this page load via the customer metafield
// (see loyalty.liquid → NBL_v1.customer.config.transactions →
// main.preact.jsx → initialData.transactions). No /notifications GET here.
//
// Why not just fetch(): the metafield sync that populates `transactions` is
// async (webhook → job queue → Admin API write), and "mark-seen" only
// updates Postgres, not the metafield JSON. So a server round-trip that
// re-checks notifiedAt=null right after marking things seen would find
// those same rows already flipped and return nothing — that was the actual
// root cause of the "+N more updates" collapsing after 2-3 seconds bug.
//
// Fix: read everything from the transactions we already have in memory, and
// use a small localStorage set (per customer, this browser only) to avoid
// re-showing a toast the customer already saw here before the metafield has
// had a chance to catch up. The real notifiedAt write to Postgres still
// happens via mark-seen — that's just no longer on the read path.
// =============================================================================

import { useState, useEffect } from 'preact/hooks';

const INITIAL_VISIBLE = 5;
const SEEN_IDS_CAP = 200;
const SEEN_KEY_PREFIX = 'nbl_toast_seen_';

function safeGetLocal(key) {
    try {
        return window.localStorage.getItem(key);
    } catch (e) {
        // Private browsing / storage disabled / quota — just behave as if
        // nothing has ever been seen. Worst case a toast repeats; never crash.
        return null;
    }
}

function safeSetLocal(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (e) { /* same as above — fail silently */ }
}

function getSeenIds(customerId) {
    if (!customerId) return new Set();
    const raw = safeGetLocal(SEEN_KEY_PREFIX + customerId);
    if (!raw) return new Set();
    try {
        const parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
        return new Set();
    }
}

function addSeenIds(customerId, ids) {
    if (!customerId || !ids || !ids.length) return;
    const current = getSeenIds(customerId);
    ids.forEach((id) => current.add(id));
    // Cap so a very active customer's browser doesn't grow this forever —
    // this only trims *how far back* local dedup remembers, it never
    // affects the real notifiedAt state in Postgres. In practice
    // reconcileSeenIds() below keeps this set small on its own, so this cap
    // is mostly a safety net for edge cases (e.g. customerId briefly
    // missing on a render).
    let list = Array.from(current);
    if (list.length > SEEN_IDS_CAP) {
        list = list.slice(list.length - SEEN_IDS_CAP);
    }
    safeSetLocal(SEEN_KEY_PREFIX + customerId, JSON.stringify(list));
}

/**
 * Prunes localStorage down to only the ids we still actually need to
 * remember locally: transactions that (a) still exist in this page's
 * `transactions` batch AND (b) still show notifiedAt == null there.
 *
 * Once the metafield sync catches up and notifiedAt is no longer null, the
 * metafield itself correctly excludes that transaction from the unseen set
 * — we don't need our local override anymore, so we drop it. Same for ids
 * that fell out of the transactions batch entirely (too old / past the
 * server's HARD_CAP). This keeps localStorage naturally small instead of
 * growing until the arbitrary SEEN_IDS_CAP evicts things blindly.
 */
function reconcileSeenIds(customerId, transactions) {
    if (!customerId) return new Set();
    const seen = getSeenIds(customerId);
    if (seen.size === 0) return seen;

    const stillUnseenInMetafield = new Set(
        (transactions || [])
            .filter((t) => t.id != null && t.notifiedAt == null)
            .map((t) => t.id)
    );

    const pruned = new Set();
    seen.forEach((id) => {
        if (stillUnseenInMetafield.has(id)) pruned.add(id);
    });

    if (pruned.size !== seen.size) {
        safeSetLocal(SEEN_KEY_PREFIX + customerId, JSON.stringify(Array.from(pruned)));
    }

    return pruned;
}

/**
 * @param {Object}  params
 * @param {boolean} params.isLoggedIn
 * @param {boolean} params.enabled       - merchant's enableToastNotifications toggle
 * @param {Array}   params.transactions  - initialData.transactions (already on the page)
 * @param {string|number} params.customerId - Shopify customer id, for localStorage scoping
 * @param {string}  params.proxyPath
 * @param {boolean} params.isPreview     - true inside the admin dashboard's Live Preview
 *   (same signal as `!!bridgeRef` in App.jsx — production never sets this).
 *   Live Preview isn't reached through Shopify's storefront App Proxy, so
 *   `proxyPath` (e.g. "/apps/widget/...") doesn't resolve to any real route
 *   there — it 404s. There's no real customer/DB in preview anyway, so we
 *   just skip the network call entirely and only update local UI state.
 */
export function useToastNotifications({ isLoggedIn, enabled, transactions, customerId, proxyPath, isPreview }) {
    const [allToasts, setAllToasts] = useState([]);
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

    function markNotificationsSeen(ids) {
        if (isPreview) return;
        // Fire-and-forget, idempotent. ids omitted → server marks ALL unseen
        // rows for the customer. ids: [id] → only that one (toast's own
        // close button). Only ever writes to Postgres — never touches the
        // metafield JSON, which is why the read side above doesn't depend
        // on this having finished.
        const hasIds = Array.isArray(ids) && ids.length > 0;
        fetch(proxyPath + '/notifications/mark-seen', {
            method: 'POST',
            headers: hasIds ? { 'Content-Type': 'application/json' } : undefined,
            body: hasIds ? JSON.stringify({ ids }) : undefined,
        }).catch(() => { });
    }

    useEffect(() => {
        if (!isLoggedIn || enabled === false) {
            setAllToasts([]);
            return;
        }

        // Prune first: drop any locally-remembered id whose transaction has
        // either synced (notifiedAt no longer null) or aged out of the
        // batch entirely — we only need to keep tracking ids the metafield
        // itself hasn't caught up on yet.
        const seenLocally = reconcileSeenIds(customerId, transactions);
        const unseen = (transactions || [])
            // id != null guards against optimistic, client-only entries
            // (e.g. App.jsx's setTransactions((prev) => [{ activity, points,
            // createdAt }, ...prev]) right after a redeem succeeds) — those
            // have no real id yet and no notifiedAt, so `notifiedAt == null`
            // would otherwise match them and (a) flash a toast for an action
            // the customer just did themselves and already got direct
            // confirmation for, and (b) write `undefined` into localStorage,
            // which would never match the real id once it syncs in later.
            .filter((t) => t.id != null && t.notifiedAt == null && !seenLocally.has(t.id))
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setAllToasts(unseen);
        setVisibleCount(INITIAL_VISIBLE);

        if (unseen.length) {
            // Optimistic + immediate: this browser won't show these again on
            // the next page load even if the metafield/Postgres sync is slow.
            addSeenIds(customerId, unseen.map((t) => t.id));
            markNotificationsSeen();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn, enabled, customerId, transactions]);

    function dismissToast(id) {
        // Remove from the in-memory list immediately — no network wait.
        setAllToasts((prev) => prev.filter((t) => t.id !== id));
        addSeenIds(customerId, [id]);
        markNotificationsSeen([id]);
    }

    function expandToasts() {
        // "+N more updates" click — purely a client-side reveal of the array
        // already held in `allToasts`. No fetch, so nothing can race with
        // mark-seen and collapse the list.
        setVisibleCount(allToasts.length);
    }

    function clearAll() {
        // Widget being opened (via the launcher button OR by clicking any
        // individual toast — both call the same toggleWidget in App.jsx) —
        // clear the whole stack immediately and mark everything currently
        // shown as seen across all three layers at once: memory (below),
        // localStorage (so it stays gone on this browser even before sync
        // catches up), and Postgres via markNotificationsSeen (which will
        // flow into the metafield on the next natural sync).
        addSeenIds(customerId, allToasts.map((t) => t.id));
        setAllToasts([]);
        setVisibleCount(INITIAL_VISIBLE);
        markNotificationsSeen();
    }

    const toasts = allToasts.slice(0, visibleCount);
    const moreCount = Math.max(0, allToasts.length - visibleCount);

    return { toasts, moreCount, dismissToast, expandToasts, clearAll };
}