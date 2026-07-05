import prisma from "db-server";
import { authenticate } from "shopify-server";
import { logger } from "app/utils/logger.js";
import { isDuplicateEvent } from "app/controller/webhook/handleDuplicateWebhook";

/** @constant {string} Module identifier for structured logging */
const MODULE = "webhooks.app.refunds.create";

const ENABLE_IDEMPOTENCY = true;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sums the refunded amount for this specific refund event from its
 * transactions array. A refund can bundle several transactions
 * (e.g. gateway refund + store credit) — we only care about the total.
 *
 * @param {Object} refund - Shopify Refund payload
 * @returns {number}
 */
const getRefundAmount = (refund) =>
    (refund?.transactions ?? [])
        .filter((t) => t.kind === "refund" && t.status === "success")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Entry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /webhooks/refunds/create
 *
 * Acknowledges the Shopify refunds/create webhook and enqueues an
 * ORDER_REVERSED job (reversalType: "REFUND") carrying the refunded
 * amount for THIS refund event only. orderReversalJob.js uses
 * refundAmount / orderTotal (stored on the original EARN transaction's
 * metadata) to reverse a proportional slice of points — so full refunds
 * and multiple partial refunds are both handled correctly.
 *
 * Note: the Refund payload does not include admin_graphql_api_id for the
 * order directly — only the numeric order_id — so we build the GID here.
 *
 * @param {{ request: Request }} args - Remix action arguments
 * @returns {Promise<Response>} Always 200 — Shopify must not retry
 */
export const action = async ({ request }) => {
    try {
        const { payload, topic, shop } = await authenticate.webhook(request);
        const refund = payload;

        const orderGid = `gid://shopify/Order/${refund.order_id}`;
        const refundAmount = getRefundAmount(refund);

        const webhookId = request.headers.get("X-Shopify-Webhook-Id");
        const eventKey = webhookId
            ? `SHOPIFY:${webhookId}`
            : `${topic}:${refund.admin_graphql_api_id ?? refund.id}`;

        // ── 1. Duplicate check ────────────────────────────────────────────────
        if (ENABLE_IDEMPOTENCY) {
            const isDuplicate = await isDuplicateEvent({ shop, eventKey });
            if (isDuplicate) {
                logger.warn(MODULE, "Duplicate webhook — skipping", { shop, eventKey });
                return new Response("OK", { status: 200 });
            }
        }

        if (refundAmount <= 0) {
            logger.info(MODULE, "Refund amount is 0 — nothing to reverse, skipping", {
                shop, orderId: orderGid, refundId: refund.id,
            });
            return new Response("OK", { status: 200 });
        }

        // ── 2. Enqueue job ────────────────────────────────────────────────────
        // upsert so a second delivery before the poller runs is silently ignored
        await prisma.job.upsert({
            where: { idempotencyKey: eventKey },
            create: {
                type: "ORDER_REVERSED",
                shop,
                idempotencyKey: eventKey,
                payload: {
                    orderId: orderGid,
                    reversalType: "REFUND",
                    refundId: refund.id,
                    refundAmount,
                    webhookId,
                },
            },
            update: {}, // already queued — do nothing
        });

        logger.info(MODULE, "ORDER_REVERSED (REFUND) job enqueued", {
            shop, orderId: orderGid, refundId: refund.id, refundAmount,
        });

        // ── 3. Acknowledge ────────────────────────────────────────────────────
        return new Response("OK", { status: 200 });
    } catch (error) {
        logger.error(MODULE, "Webhook entry error", { error: error?.message });
        return new Response("OK", { status: 200 });
    }
};