/**
 * @file jobs/_loader.server.js
 * @description Prisma queries for the Jobs admin page — server-side
 * pagination (skip/take), since the Job table can realistically grow
 * much larger than other paginated lists in this app (every order/
 * customer-sync event can create a row).
 */

import prisma from "db-server";

export const DEFAULT_PAGE_SIZE = 25;

/**
 * Fetches one page of jobs matching the given filters, plus the total
 * count (for page-count math) and the distinct list of job types.
 *
 * @param {Object} params
 * @param {string} [params.status]  - "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED"
 * @param {string} [params.type]    - "ORDER_PAID" | "ORDER_REVERSED" | "CUSTOMER_SYNC" | ...
 * @param {number} [params.page]   - 1-indexed page number
 * @param {number} [params.perPage] - rows per page
 * @returns {Promise<{ jobs: Array, total: number, page: number, perPage: number, types: string[] }>}
 */
export async function loadJobsData({ status, type, page = 1, perPage = DEFAULT_PAGE_SIZE }) {
    const where = {
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
    };

    const [jobs, total, distinctTypes] = await Promise.all([
        prisma.job.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            skip: (page - 1) * perPage,
            take: perPage,
        }),
        prisma.job.count({ where }),
        prisma.job.findMany({
            distinct: ["type"],
            select: { type: true },
            orderBy: { type: "asc" },
        }),
    ]);

    return {
        jobs,
        total,
        page,
        perPage,
        types: distinctTypes.map((t) => t.type),
    };
}
