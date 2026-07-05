import prisma from "../../db.server.js";
import { logger } from "../../utils/logger.js"

// ─── Default Select ───────────────────────────────────────────────────────────

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

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Creates a new customer reward record.
 * Uses a deterministic rewardKey as an idempotency key to prevent duplicates.
 *
 * @param {Object}        input
 * @param {number|string} input.customerId
 * @param {string}        [input.event]        - "ORDER" | "REFERRAL" | "BIRTHDAY" | "REVIEW" | "SIGNUP" | "SUBSCRIPTION" | "MANUAL" | "CAMPAIGN"
 * @param {string}        [input.type]         - "FIRST" | "RECURRING" | "VERIFIED" | "BONUS" | "DEFAULT"
 * @param {string}        [input.status]       - "PENDING" | "ACTIVE" | "USED" | "EXPIRED" | "CANCELLED"
 * @param {string}        [input.title]
 * @param {string}        [input.description]
 * @param {string}        [input.code]
 * @param {string}        [input.orderId]
 * @param {string}        [input.referralId]
 * @param {number|string} [input.rewardRuleId]
 * @param {number|string} [input.pointsCost]
 * @param {string|Date}   [input.expiresAt]
 * @param {Object}        [input.metadata]
 * @param {Object}        [select]             - Prisma select object to control returned fields.
 * @returns {Promise<Object|null>} Created reward or null on failure.
 *
 * @example
 * await createCustomerReward({
 *     customerId: 42,
 *     event:      "ORDER",
 *     type:       "FIRST",
 *     title:      "First Order Reward",
 *     code:       "NBL_A3K9XZT_ORDER",
 *     pointsCost: 100,
 *     expiresAt:  "2026-12-31",
 * })
 *
 * // Minimal select — only return what's needed
 * await createCustomerReward(input, { id: true, rewardKey: true, status: true })
 */
export const createCustomerReward = async (input, select = DEFAULT_REWARD_SELECT) => {
    try {
        const customerId = Number(input.customerId);

        // Deterministic idempotency key — no random suffix
        const entityId = input.orderId || input.referralId || "0";
        const rewardKey = input.rewardKey
            ?? `${input.event || "EVENT"}:${input.type || "DEFAULT"}:${customerId}:${entityId}:${input.code ?? ""}:${input.title ?? ""}`;

        const reward = await prisma.reward.create({
            data: {
                customerId,
                rewardKey,
                event: input.event ?? null,
                type: input.type ?? "DEFAULT",
                status: input.status ?? "PENDING",
                title: input.title ?? null,
                description: input.description ?? null,
                code: input.code ?? null,
                orderId: input.orderId ?? null,
                rewardRuleId: input.rewardRuleId ? Number(input.rewardRuleId) : null,
                pointsCost: input.pointsCost !== undefined ? Number(input.pointsCost) : null,
                expiresAt: input.expiresAt ?? null,
                metadata: input.metadata ?? {},
                // usedAt intentionally omitted — set only when reward is actually used
            },
            select,
        });

        logger.info("Customer reward created", {
            rewardId: reward.id,
            customerId,
            event: reward.event,
            type: reward.type,
            rewardKey: reward.rewardKey,
        });

        return reward;
    } catch (error) {
        // P2002 — rewardKey unique constraint violation (duplicate reward)
        if (error?.code === "P2002") {
            logger.warn("Duplicate reward skipped", {
                customerId: input.customerId,
                event: input.event,
                type: input.type,
            });
            return null;
        }

        logger.error("Failed to create customer reward", {
            input,
            error: error?.message,
            stack: error?.stack,
        });

        return null;
    }
};