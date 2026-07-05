import prisma from "db-server";
import { ALLOWED_PAGE_SIZES, DEFAULT_PAGE_SIZE, SORT_OPTIONS } from "./_data";

const SORTABLE_FIELDS = new Set(["id", "name", "email", "points", "enrolledAt"]);

export { ALLOWED_PAGE_SIZES };

function parseSortBy(raw) {
    const fallback = "enrolledAt-desc";
    if (!raw || typeof raw !== "string") return fallback;
    return SORT_OPTIONS.map((o) => o.value).includes(raw) ? raw : fallback;
}

function parsePageSize(raw) {
    const n = parseInt(raw, 10);
    return ALLOWED_PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE;
}

/**
 * Loads customer list + active sync job status in parallel.
 *
 * @param {string}           sessionId
 * @param {string}           shop         - shop domain (for sync job lookup)
 * @param {URLSearchParams}  searchParams
 */
export async function loadCustomers(sessionId, shop, searchParams) {
    const pageSize = parsePageSize(searchParams.get("pageSize"));
    const page     = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const search   = searchParams.get("search")?.trim().slice(0, 100) || "";
    const sortBy   = parseSortBy(searchParams.get("sortBy"));

    const [field, direction] = sortBy.split("-");
    const orderDir = direction === "asc" ? "asc" : "desc";

    const where = {
        sessionId,
        ...(search && {
            OR: [
                { name:  { startsWith: search, mode: "insensitive" } },
                { email: { startsWith: search, mode: "insensitive" } },
            ],
        }),
    };

    try {
        const [[customers, totalCount], activeSyncJob] = await Promise.all([
            prisma.$transaction([
                prisma.customer.findMany({
                    where,
                    orderBy: SORTABLE_FIELDS.has(field) ? { [field]: orderDir } : { enrolledAt: "desc" },
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                    select: {
                        id: true, name: true, email: true,
                        points: true, enrolledAt: true, activeStatus: true,
                        _count: { select: { rewards: true, transactions: true } },
                    },
                }),
                prisma.customer.count({ where }),
            ]),

            // Check for an active sync job for this shop
            prisma.job.findFirst({
                where: {
                    type:   "CUSTOMER_SYNC",
                    shop,
                    status: { in: ["PENDING", "PROCESSING"] },
                },
                select: { id: true, status: true },
                orderBy: { createdAt: "desc" },
            }),
        ]);

        return {
            customers, totalCount, page, pageSize, search, sortBy, error: null,
            syncJobId:     activeSyncJob?.id    ?? null,
            syncJobStatus: activeSyncJob?.status ?? null,
        };
    } catch (err) {
        console.error("[customers.loader]", err);
        return {
            customers: [], totalCount: 0, page: 1, pageSize, search, sortBy,
            error: "Failed to load customers.",
            syncJobId: null, syncJobStatus: null,
        };
    }
}
