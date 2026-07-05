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
 * Creates a new referral record.
 * A customer can only be referred once — enforced by @@unique([referredId]).
 *
 * @param {Object}        input
 * @param {number|string} input.referrerId              - Customer who referred.
 * @param {number|string} input.referredId              - Customer who was referred.
 * @param {string}        [input.orderId]
 * @param {string}        [input.status]                - "ACTIVE" | "PENDING" | "USED" | "CANCELLED" | "EXPIRED"
 * @param {string}        [input.discountCode]
 * @param {string}        [input.discountInfo]
 * @param {boolean}       [input.discountUsed]
 * @param {boolean}       [input.rewardGiven]
 * @param {string}        [input.subscriptionContractId]
 * @param {Object}        [input.metadata]
 * @param {Object}        [select]                      - Prisma select object to control returned fields.
 * @returns {Promise<Object|null>} Created referral or null on failure.
 *
 * @example
 * await createReferral({
 *     referrerId:   1,
 *     referredId:   2,
 *     discountCode: "NBL_A3K9XZT_REFERRAL",
 *     status:       "PENDING",
 * })
 */
export const createReferral = async (input, select = DEFAULT_REFERRAL_SELECT) => {
    try {
        const referral = await prisma.referral.create({
            data: {
                referrerId: Number(input.referrerId),
                referredId: Number(input.referredId),
                orderId: input.orderId ?? null,
                status: input.status ?? "PENDING",
                discountCode: input.discountCode ?? null,
                discountInfo: input.discountInfo ?? null,
                discountUsed: input.discountUsed ?? false,
                rewardGiven: input.rewardGiven ?? false,
                subscriptionContractId: input.subscriptionContractId ?? null,
                metadata: input.metadata ?? {},
            },
            select,
        });

        logger.info("Referral created", {
            referralId: referral.id,
            referrerId: input.referrerId,
            referredId: input.referredId,
            status: referral.status,
        });

        return referral;
    } catch (error) {
        // P2002 — referredId unique constraint violation
        if (error?.code === "P2002") {
            logger.warn("Referral already exists for referred customer", {
                referredId: input.referredId,
            });
            return null;
        }

        logger.error("Failed to create referral", {
            input,
            error: error?.message,
            stack: error?.stack,
        });

        return null;
    }
};