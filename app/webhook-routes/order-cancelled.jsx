import prisma from "db-server";
import { authenticate } from "shopify-server";
import { logger } from "app/utils/logger.js";
import { isDuplicateEvent } from "app/controller/webhook/handleDuplicateWebhook";

/** @constant {string} Module identifier for structured logging */
const MODULE = "webhooks.app.orders.cancelled";

const ENABLE_IDEMPOTENCY = true;

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Entry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /webhooks/orders/cancelled
 *
 * Acknowledges the Shopify orders/cancelled webhook and enqueues an
 * ORDER_REVERSED job (reversalType: "CANCEL") for asynchronous processing.
 *
 * A cancelled order reverses 100% of the points earned for that order —
 * the actual lookup + reversal math lives in orderReversalJob.js, same
 * split used for orders/paid (webhook = ack + enqueue only).
 *
 * @param {{ request: Request }} args - Remix action arguments
 * @returns {Promise<Response>} Always 200 — Shopify must not retry
 */
export const action = async ({ request }) => {
    try {
        const { payload, topic, shop } = await authenticate.webhook(request);
        const order = payload;

        const webhookId = request.headers.get("X-Shopify-Webhook-Id");
        const eventKey = webhookId
            ? `SHOPIFY:${webhookId}`
            : `${topic}:${order.admin_graphql_api_id}`;

        // ── 1. Duplicate check ────────────────────────────────────────────────
        if (ENABLE_IDEMPOTENCY) {
            const isDuplicate = await isDuplicateEvent({ shop, eventKey });
            if (isDuplicate) {
                logger.warn(MODULE, "Duplicate webhook — skipping", { shop, eventKey });
                return new Response("OK", { status: 200 });
            }
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
                    orderId: order.admin_graphql_api_id,
                    reversalType: "CANCEL",
                    webhookId,
                },
            },
            update: {}, // already queued — do nothing
        });

        logger.info(MODULE, "ORDER_REVERSED (CANCEL) job enqueued", {
            shop,
            orderId: order.admin_graphql_api_id,
        });

        // ── 3. Acknowledge ────────────────────────────────────────────────────
        return new Response("OK", { status: 200 });
    } catch (error) {
        logger.error(MODULE, "Webhook entry error", { error: error?.message });
        return new Response("OK", { status: 200 });
    }
};