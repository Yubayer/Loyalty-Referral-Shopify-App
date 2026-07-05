import prisma from "../../db.server.js";
import { logger } from "../../utils/logger.js"

/**
 * Default fields selected for all reward queries.
 * Override by passing a custom `select` object.
 */
const DEFAULT_REWARD_SELECT = {
    id: true,
    title: true,
    event: true,
    type: true,
    code: true,
    rewardKey: true,
    orderId: true,
    pointsCost: true,
    status: true,
    discountUsed: true,
    usedAt: true,
    expiresAt: true,
    metadata: true,
    description: true,
    createdAt: true,
    updatedAt: true,
    rewardRuleId: true,
    customerId: true,
};

/**
 * Fetches a single customer reward by ID.
 *
 * @param {number|string} rewardId
 * @param {Object} [select] - Prisma select object to control returned fields.
 * @returns {Promise<Object|null>} Reward or null if not found.
 *
 * @example
 * // All default fields
 * await getCustomerReward(101)
 *
 * // Only specific fields
 * await getCustomerReward(101, { id: true, status: true, code: true })
 */
export const getCustomerReward = async (rewardId, select = DEFAULT_REWARD_SELECT) => {
    try {
        const reward = await prisma.reward.findUnique({
            where: { id: Number(rewardId) },
            select,
        });

        if (!reward) {
            logger.warn("Reward not found", { rewardId });
            return null;
        }

        return reward;
    } catch (error) {
        logger.error("Failed to fetch customer reward", {
            rewardId,
            error: error?.message,
            stack: error?.stack,
        });
        return null;
    }
};

/**
 * Fetches all rewards for a specific customer.
 * Optionally filter by status, event, type, and expiry.
 *
 * @param {number|string} customerId
 * @param {Object}  [filters={}]
 * @param {string}  [filters.status]          - "PENDING" | "ACTIVE" | "USED" | "EXPIRED" | "CANCELLED" | "REDEEMED" | "FAILED"
 * @param {string}  [filters.event]           - "ORDER" | "REFERRAL" | "BIRTHDAY" | "REVIEW" | "SIGNUP" | "SUBSCRIPTION" | "MANUAL" | "CAMPAIGN"
 * @param {string}  [filters.type]            - "FIRST" | "RECURRING" | "VERIFIED" | "BONUS" | "DEFAULT"
 * @param {boolean} [filters.excludeExpired]  - Exclude rewards past their expiresAt date.
 * @param {Object}  [select]                  - Prisma select object to control returned fields.
 * @returns {Promise<Object[]>} List of rewards or empty array on failure.
 *
 * @example
 * // All rewards with default fields
 * await getCustomerRewards(42)
 *
 * // Filtered rewards with only specific fields
 * await getCustomerRewards(
 *     42,
 *     { status: "ACTIVE", excludeExpired: true },
 *     { id: true, code: true, expiresAt: true }
 * )
 */
export const getCustomerRewards = async (customerId, filters = {}, select = DEFAULT_REWARD_SELECT) => {
    try {
        const { status, event, type, excludeExpired = false } = filters;

        const rewards = await prisma.reward.findMany({
            where: {
                customerId: Number(customerId),
                ...(status && { status }),
                ...(event && { event }),
                ...(type && { type }),
                ...(excludeExpired && {
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } },
                    ],
                }),
            },
            select,
            orderBy: { createdAt: "desc" },
        });

        return rewards;
    } catch (error) {
        logger.error("Failed to fetch customer rewards", {
            customerId,
            filters,
            error: error?.message,
            stack: error?.stack,
        });
        return [];
    }
};

/**
 * Fetches a reward by its unique rewardKey (idempotency key).
 *
 * @param {string} rewardKey
 * @param {Object} [select] - Prisma select object to control returned fields.
 * @returns {Promise<Object|null>} Reward or null if not found.
 *
 * @example
 * // Check existence only
 * await getCustomerRewardByKey("ORDER:FIRST:42:ORD_001", { id: true })
 */
export const getCustomerRewardByKey = async (rewardKey, select = DEFAULT_REWARD_SELECT) => {
    try {
        const reward = await prisma.reward.findUnique({
            where: { rewardKey },
            select,
        });

        if (!reward) {
            logger.warn("Reward not found by key", { rewardKey });
            return null;
        }

        return reward;
    } catch (error) {
        logger.error("Failed to fetch reward by key", {
            rewardKey,
            error: error?.message,
            stack: error?.stack,
        });
        return null;
    }
};

/**
 * Fetches a reward by its discount code.
 *
 * @param {string} code
 * @param {Object} [select] - Prisma select object to control returned fields.
 * @returns {Promise<Object|null>} Reward or null if not found.
 *
 * @example
 * // Fetch for redemption — only fields needed for validation
 * await getCustomerRewardByCode("NBL_A3K9XZT_REFERRAL", {
 *     id:        true,
 *     status:    true,
 *     expiresAt: true,
 *     pointsCost: true,
 * })
 */
export const getCustomerRewardByCode = async (code, select = DEFAULT_REWARD_SELECT) => {
    try {
        const reward = await prisma.reward.findFirst({
            where: { code },
            select,
        });

        if (!reward) {
            logger.warn("Reward not found by code", { code });
            return null;
        }

        return reward;
    } catch (error) {
        logger.error("Failed to fetch reward by code", {
            code,
            error: error?.message,
            stack: error?.stack,
        });
        return null;
    }
};