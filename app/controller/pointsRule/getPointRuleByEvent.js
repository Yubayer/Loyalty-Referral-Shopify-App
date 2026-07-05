import { logger } from "../../utils/logger.js";
import prisma from "../../db.server.js";

/**
 * Fetches the active PointsRule for a given event type.
 * Queries directly by event type — no JS-side filtering.
 *
 * @param {string} event - Event type e.g. "ORDER" | "REFERRAL" | "REVIEW"
 * @returns {Promise<Object|null>} PointsRule with event, or null if not found / inactive
 */
export const getPointRuleByEvent = async (event = null) => {
    if (!event) {
        logger.warn("getPointRuleByEvent called without event type");
        return null;
    }

    try {
        const rule = await prisma.pointsRule.findFirst({
            where: {
                isActive: true,
                event: {
                    type: { equals: event, mode: "insensitive" },
                    isActive: true,
                },
            },
            include: { event: true },
        });

        return rule ?? null;
    } catch (error) {
        logger.error("getPointRuleByEvent error", {
            event,
            message: error?.message,
        });
        return null;
    }
};