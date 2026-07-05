// ─────────────────────────────────────────────────────────────────────────────
// Server-only. Never import from client code (_hooks.js or components/).
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "db-server";

/**
 * Fetches all dashboard data in one parallel round-trip.
 *
 * @param {string} sessionId
 * @returns {{ transactions, rewards, customerCount, prizeStats, prizeClaims }}
 */
export async function loadDashboardData(sessionId) {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const [transactions, rewards, customerCount, prizeClaims] = await Promise.all([

        prisma.transaction.findMany({
            where: { createdAt: { gte: twoYearsAgo }, customer: { sessionId } },
            select: { id: true, type: true, points: true, status: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        }),

        prisma.reward.findMany({
            where: { createdAt: { gte: twoYearsAgo }, customer: { sessionId } },
            select: { id: true, status: true, pointsCost: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        }),

        prisma.customer.count({
            where: { sessionId, activeStatus: "ACTIVE" },
        }),

        // Date-range filterable — used for both stat cards and the prize activity chart.
        prisma.physicalPrizeClaim.findMany({
            where: { createdAt: { gte: twoYearsAgo }, prize: { sessionId } },
            select: { id: true, pointsCost: true, status: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        }),

    ]);

    return { transactions, rewards, customerCount, prizeClaims };
}
