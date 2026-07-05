import prisma from "db-server";
import { logger } from "@app/utils/logger";

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

/**
 * Updates an existing referral by ID.
 * Only provided fields will be updated — partial update safe.
 *
 * @param {number|string} referralId               - ID of the referral to update.
 * @param {Object}        input                    - Fields to update.
 * @param {string}        [input.orderId]
 * @param {string}        [input.status]           - "ACTIVE" | "PENDING" | "USED" | "CANCELLED" | "EXPIRED"
 * @param {string}        [input.discountCode]
 * @param {string}        [input.discountInfo]
 * @param {boolean}       [input.discountUsed]
 * @param {boolean}       [input.rewardGiven]
 * @param {string}        [input.subscriptionContractId]
 * @param {Object}        [input.metadata]
 * @param {Object}        [select]                 - Prisma select object to control returned fields.
 * @returns {Promise<Object|null>} Updated referral or null on failure.
 *
 * @example
 * // Mark referral as used after order is placed
 * await updateReferral(5, {
 *     status:       "USED",
 *     orderId:      "ORD_001",
 *     discountUsed: true,
 * })
 *
 * // Mark reward as given — minimal select, fast query
 * await updateReferral(5, { rewardGiven: true }, { id: true, rewardGiven: true })
 */
export const updateReferral = async (referralId, input, select = DEFAULT_REFERRAL_SELECT) => {
    try {
        const referral = await prisma.referral.update({
            where: { id: Number(referralId) },
            data: {
                ...(input.orderId !== undefined && { orderId: input.orderId }),
                ...(input.status !== undefined && { status: input.status }),
                ...(input.discountCode !== undefined && { discountCode: input.discountCode }),
                ...(input.discountInfo !== undefined && { discountInfo: input.discountInfo }),
                ...(input.discountUsed !== undefined && { discountUsed: input.discountUsed }),
                ...(input.rewardGiven !== undefined && { rewardGiven: input.rewardGiven }),
                ...(input.subscriptionContractId !== undefined && { subscriptionContractId: input.subscriptionContractId }),
                ...(input.metadata !== undefined && { metadata: input.metadata }),
            },
            select,
        });

        logger.info("Referral updated", {
            referralId: referral.id,
            status: referral.status,
        });

        return referral;
    } catch (error) {
        // P2025 — record not found
        if (error?.code === "P2025") {
            logger.warn("Referral not found for update", { referralId });
            return null;
        }

        logger.error("Failed to update referral", {
            referralId,
            input,
            error: error?.message,
            stack: error?.stack,
        });

        return null;
    }
};