import prisma from "../../db.server.js";
import { logger } from "../../utils/logger.js"

/**
 * Updates an existing customer reward by ID.
 *
 * @param {number|string} rewardId - The ID of the reward to update.
 * @param {Object} input - Fields to update.
 * @param {string} [input.event]       - "ORDER" | "REFERRAL" | "BIRTHDAY" | "REVIEW" | "SIGNUP" | "SUBSCRIPTION" | "MANUAL" | "CAMPAIGN"
 * @param {string} [input.type]        - "FIRST" | "RECURRING" | "VERIFIED" | "BONUS" | "DEFAULT"
 * @param {string} [input.status]      - "PENDING" | "ACTIVE" | "USED" | "EXPIRED" | "CANCELLED"
 * @param {string} [input.title]
 * @param {string} [input.description]
 * @param {boolean} [input.discountUsed]
 * @param {string} [input.code]
 * @param {string} [input.orderId]
 * @param {string} [input.referralId]
 * @param {number|string} [input.rewardRuleId]
 * @param {number|string} [input.pointsCost]
 * @param {string|Date} [input.expiresAt]
 * @param {string|Date} [input.usedAt]
 * @param {Object} [input.metadata]
 * @returns {Promise<Object|null>} Updated reward or null on failure.
 */
export const updateCustomerReward = async (rewardId, input) => {
    try {
        const id = Number(rewardId);

        const updatedReward = await prisma.reward.update({
            where: { id },
            data: {
                ...(input.event !== undefined && { event: input.event }),
                ...(input.type !== undefined && { type: input.type }),
                ...(input.status !== undefined && { status: input.status }),
                ...(input.title !== undefined && { title: input.title }),
                ...(input.description !== undefined && { description: input.description }),
                ...(input.code !== undefined && { code: input.code }),
                ...(input.orderId !== undefined && { orderId: input.orderId }),
                ...(input.referralId !== undefined && { referralId: input.referralId }),
                ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
                ...(input.usedAt !== undefined && { usedAt: input.usedAt }),
                ...(input.rewardRuleId !== undefined && { rewardRuleId: Number(input.rewardRuleId) }),
                ...(input.pointsCost !== undefined && { pointsCost: Number(input.pointsCost) }),
                ...(input.metadata !== undefined && { metadata: input.metadata }),
                ...(input.discountUsed !== undefined && { discountUsed: input.discountUsed }),
            },
        });

        logger.info("Customer reward updated", {
            rewardId: updatedReward.id,
            event: updatedReward.event,
            type: updatedReward.type,
            status: updatedReward.status,
        });

        return updatedReward;
    } catch (error) {
        if (error?.code === "P2025") {
            logger.warn("Reward not found for update", { rewardId });
            return null;
        }

        logger.error("Customer reward update failed", {
            rewardId,
            error: error?.message,
            stack: error?.stack,
        });

        return null;
    }
};