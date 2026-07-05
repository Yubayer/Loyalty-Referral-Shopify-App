import prisma from "db-server";
import { logger } from "@app/utils/logger";

// ─── Default Select ───────────────────────────────────────────────────────────

/**
 * Default fields selected for all referral queries.
 * Override by passing a custom `select` object.
 */
const DEFAULT_REFERRAL_SELECT = {
    id: true,
    referrerId: true,
    referredId: true,
    orderId: true,
    status: true,
    discountCode: true,
    discountInfo: true,
    discountUsed: true,
    rewardGiven: true,
    metadata: true,
    createdAt: true,
    updatedAt: true,
    subscriptionContractId: true,
};

// ─── Get by ID ────────────────────────────────────────────────────────────────

/**
 * Fetches a single referral by ID.
 *
 * @param {number|string} referralId
 * @param {Object} [select] - Prisma select object to control returned fields.
 * @returns {Promise<Object|null>} Referral or null if not found.
 *
 * @example
 * await getReferral(10)
 * await getReferral(10, { id: true, status: true })
 */
export const getReferral = async (referralId, select = DEFAULT_REFERRAL_SELECT) => {
    try {
        const referral = await prisma.referral.findUnique({
            where: { id: Number(referralId) },
            select,
        });

        if (!referral) {
            logger.warn("Referral not found", { referralId });
            return null;
        }

        return referral;
    } catch (error) {
        logger.error("Failed to fetch referral", {
            referralId,
            error: error?.message,
            stack: error?.stack,
        });
        return null;
    }
};

// ─── Get by Referred Customer ─────────────────────────────────────────────────

/**
 * Fetches the referral record for a referred customer.
 * Since @@unique([referredId]), a customer can only be referred once.
 *
 * @param {number|string} referredId
 * @param {Object} [select] - Prisma select object to control returned fields.
 * @returns {Promise<Object|null>} Referral or null if not found.
 *
 * @example
 * await getReferralByReferredId(42)
 */
export const getReferralByReferredId = async (referredId, select = DEFAULT_REFERRAL_SELECT) => {
    try {
        const referral = await prisma.referral.findUnique({
            where: { referredId: Number(referredId) },
            select,
        });

        if (!referral) {
            logger.warn("Referral not found for referred customer", { referredId });
            return null;
        }

        return referral;
    } catch (error) {
        logger.error("Failed to fetch referral by referredId", {
            referredId,
            error: error?.message,
            stack: error?.stack,
        });
        return null;
    }
};

// ─── Get All by Referrer ──────────────────────────────────────────────────────

/**
 * Fetches all referrals made by a specific referrer customer.
 * Optionally filter by status.
 *
 * @param {number|string} referrerId
 * @param {Object}  [filters={}]
 * @param {string}  [filters.status]        - "ACTIVE" | "PENDING" | "USED" | "CANCELLED" | "EXPIRED"
 * @param {boolean} [filters.rewardGiven]   - Filter by whether reward has been given.
 * @param {boolean} [filters.discountUsed]  - Filter by whether discount has been used.
 * @param {Object}  [select]                - Prisma select object to control returned fields.
 * @returns {Promise<Object[]>} List of referrals or empty array on failure.
 *
 * @example
 * // All referrals by referrer
 * await getReferralsByReferrerId(1)
 *
 * // Only pending referrals
 * await getReferralsByReferrerId(1, { status: "PENDING" })
 *
 * // Referrals where reward not yet given
 * await getReferralsByReferrerId(1, { rewardGiven: false })
 */
export const getReferralsByReferrerId = async (referrerId, filters = {}, select = DEFAULT_REFERRAL_SELECT) => {
    try {
        const { status, rewardGiven, discountUsed } = filters;

        const referrals = await prisma.referral.findMany({
            where: {
                referrerId: Number(referrerId),
                ...(status !== undefined && { status }),
                ...(rewardGiven !== undefined && { rewardGiven }),
                ...(discountUsed !== undefined && { discountUsed }),
            },
            select,
            orderBy: { createdAt: "desc" },
        });

        return referrals;
    } catch (error) {
        logger.error("Failed to fetch referrals by referrerId", {
            referrerId,
            filters,
            error: error?.message,
            stack: error?.stack,
        });
        return [];
    }
};

// ─── Get by Discount Code ─────────────────────────────────────────────────────

/**
 * Fetches a referral by its discount code.
 * Useful for validating and redeeming referral discounts at checkout.
 *
 * @param {string} discountCode
 * @param {Object} [select] - Prisma select object to control returned fields.
 * @returns {Promise<Object|null>} Referral or null if not found.
 *
 * @example
 * await getReferralByDiscountCode("NBL_A3K9XZT_REFERRAL")
 *
 * // Minimal select for checkout validation
 * await getReferralByDiscountCode("NBL_A3K9XZT_REFERRAL", {
 *     id:           true,
 *     status:       true,
 *     discountUsed: true,
 *     referredId:   true,
 * })
 */
export const getReferralByDiscountCode = async (discountCode, select = DEFAULT_REFERRAL_SELECT) => {
    try {
        const referral = await prisma.referral.findFirst({
            where: { discountCode },
            select,
        });

        if (!referral) {
            logger.warn("Referral not found by discount code", { discountCode });
            return null;
        }

        return referral;
    } catch (error) {
        logger.error("Failed to fetch referral by discount code", {
            discountCode,
            error: error?.message,
            stack: error?.stack,
        });
        return null;
    }
};