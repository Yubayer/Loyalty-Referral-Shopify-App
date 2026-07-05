// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const VALID_STATUSES = ["ALL", "NEW", "PENDING", "FULFILLED", "COMPLETED", "CANCELLED"];
export const VALID_SORT_OPTIONS = ["date_desc", "date_asc", "points_desc", "points_asc"];
export const VALID_PER_PAGE = [5, 10, 25, 50];
export const DEFAULT_PER_PAGE = 10;
export const MAX_PER_PAGE = 50;

export const STATUS_CONFIG = {
    PENDING: { label: "Pending", tone: "warning", icon: "🕐" },
    FULFILLED: { label: "Fulfilled", tone: "info", icon: "📦" },
    COMPLETED: { label: "Completed", tone: "success", icon: "✅" },
    CANCELLED: { label: "Cancelled", tone: "critical", icon: "❌" },
};

export const FILTER_TABS = [
    { value: "ALL", label: "All" },
    { value: "NEW", label: "New" },
    { value: "PENDING", label: "Pending" },
    { value: "FULFILLED", label: "Fulfilled" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
];

export const SORT_OPTIONS = [
    { value: "date_desc", label: "Newest first" },
    { value: "date_asc", label: "Oldest first" },
    { value: "points_desc", label: "Points: high to low" },
    { value: "points_asc", label: "Points: low to high" },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
//
// Pure — no server-only imports. Used by the loader (server) AND by
// _hooks.js / components (client), so this file must stay import-light.
// ─────────────────────────────────────────────────────────────────────────────

export function formatDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
    });
}

/** Safely parse a positive integer from a URL param, falling back to `fallback`. */
export function parseIntParam(value, fallback, min = 1, max = Infinity) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < min || n > max) return fallback;
    return n;
}

/** Build a Prisma `where` clause from validated loader params. */
export function buildWhere(sessionId, { status, dateFrom, dateTo, newIds }) {
    const where = { prize: { sessionId } };

    if (status === "NEW") {
        where.id = { in: newIds };
    } else if (status !== "ALL") {
        where.status = status;
    }

    if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(`${dateTo}T23:59:59`);
    }

    return where;
}

/** Build a Prisma `orderBy` clause from the sortBy param. */
export function buildOrderBy(sortBy) {
    switch (sortBy) {
        case "date_asc": return { createdAt: "asc" };
        case "points_desc": return { pointsCost: "desc" };
        case "points_asc": return { pointsCost: "asc" };
        default: return { createdAt: "desc" };
    }
}
