// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** event type → manage route */
export const EVENT_ROUTES = {
    ORDER: "/app/points-rules/order",
    REFERRAL: "/app/points-rules/referral",
    REVIEW: "/app/points-rules/review",
};

export const PER_PAGE = 10;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
//
// Pure — no server-only imports.
// ─────────────────────────────────────────────────────────────────────────────

/** Human-readable earning summary for a rule row, phrased the same way as
 *  each rule type's own "Summary" panel so merchants see consistent wording
 *  across the list page and the edit page. */
export const getPointsSummary = (r) => {
    const c = r.conditions;
    const type = r.event?.type?.toUpperCase();
    if (!c) return "—";

    if (type === "ORDER") {
        // conditions.order — new structure
        const ord = c.order;
        if (!ord) return "—";
        if (ord.type === "incremental") {
            return `${ord.rate?.points ?? 0} pt for every $${ord.rate?.amount ?? 0} spent`;
        }
        return `${ord.fixedPoints ?? 0} pts flat per order`;
    }

    if (type === "REFERRAL") {
        // conditions.referral — referrer AND friend both earn points, and
        // the friend also gets a discount on top. All three need to show
        // up here, or merchants will think the friend gets nothing.
        const ref = c.referral;
        if (!ref) return "—";

        const referrerPts = ref.referrer?.points ?? 0;
        const friendPts = ref.referred?.points ?? 0;
        const friendDiscount = ref.referred?.discountValue
            ? (ref.referred.discountType === "percentage"
                ? `${ref.referred.discountValue}% off`
                : `$${ref.referred.discountValue} off`)
            : null;

        const friendParts = [
            friendPts ? `${friendPts} pts` : null,
            friendDiscount,
        ].filter(Boolean);

        const parts = [
            `Referrer: ${referrerPts} pts`,
            friendParts.length ? `Friend: ${friendParts.join(" + ")}` : null,
        ].filter(Boolean);

        return parts.length ? parts.join(" · ") : "—";
    }

    if (type === "REVIEW") {
        // conditions.review.text/image/video are now objects { isActive, points }
        const rev = c.review;
        if (!rev) return "—";
        const parts = [
            rev.text?.isActive ? `Text: ${rev.text.points}` : null,
            rev.image?.isActive ? `Photo: ${rev.image.points}` : null,
            rev.video?.isActive ? `Video: ${rev.video.points}` : null,
        ].filter(Boolean);
        return parts.length ? `${parts.join(" · ")} pts` : "—";
    }

    return "—";
};

/** Short trigger label for the Scope column (full sentences live in the
 *  per-rule Summary panels — this is the compact table-cell version). */
const TRIGGER_SHORT = {
    oneTime: "One-time orders",
    subscription: "Subscriptions only",
    both: "All orders",
};

/** Compact label for a review rule's reward mode (mirrors REWARD_MODES in
 *  app.points-rules.review._index/_data.js). */
const REVIEW_MODE_SHORT = {
    once: "Once per product",
    per_type: "Once per review type",
    unlimited: "Every submission",
};

/** Human-readable scope summary for a rule row — which orders/products/
 *  reviews it actually applies to. Previously this only covered ORDER
 *  rules and skipped the trigger (one-time vs subscription) entirely, so
 *  REFERRAL/REVIEW rows always showed "—" and ORDER rows were missing the
 *  most basic scope question: which orders does this even apply to? */
export const getAppliestoSummary = (r) => {
    const type = r.event?.type?.toUpperCase();
    const c = r.conditions;
    if (!c) return "—";

    if (type === "ORDER") {
        const ord = c.order;
        if (!ord) return "—";
        const groupCount = ord.groups?.length ?? 0;
        const excludedCount = ord.excludedProducts?.length ?? 0;

        const parts = [TRIGGER_SHORT[ord.trigger] ?? "All orders"];
        if (groupCount > 0) parts.push(`${groupCount} group${groupCount !== 1 ? "s" : ""}`);
        if (excludedCount > 0) parts.push(`${excludedCount} excluded`);
        if (groupCount === 0 && excludedCount === 0) parts.push("all products");
        return parts.join(", ");
    }

    if (type === "REFERRAL") {
        const ref = c.referral;
        if (!ref) return "—";
        const groupCount = ref.groups?.length ?? 0;

        const parts = [TRIGGER_SHORT[ref.trigger] ?? "All orders"];
        if (groupCount > 0) parts.push(`${groupCount} product group${groupCount !== 1 ? "s" : ""}`);
        return parts.join(", ");
    }

    if (type === "REVIEW") {
        const rev = c.review;
        if (!rev) return "—";
        return REVIEW_MODE_SHORT[rev.rewardMode] ?? "—";
    }

    return "—";
};
