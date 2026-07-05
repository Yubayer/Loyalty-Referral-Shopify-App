import { authenticate } from "shopify-server";
import prisma from "db-server";
import { isDuplicateEvent } from "@app/controller/webhook/handleDuplicateWebhook";
import { logger } from "@app/utils/logger.js";

const ENABLE_IDEMPOTENCY = true;

export const action = async ({ request }) => {
    let topic;
    let shop;
    let payload;
    let webhookId = null;

    try {
        const auth = await authenticate.webhook(request);
        ({ topic, shop, payload } = auth);

        webhookId = request.headers.get("X-Shopify-Webhook-Id");

        logger.info(`Received ${topic} webhook`, {
            shop,
            webhookId,
            customerGid: payload?.admin_graphql_api_id,
        });

        if (!payload?.admin_graphql_api_id) {
            logger.warn("Missing admin_graphql_api_id in customer delete webhook", { shop });
            return new Response("Missing required data", { status: 400 });
        }

        const shopifyGid = payload.admin_graphql_api_id;

        // ==================== IDEMPOTENCY CHECK ====================
        if (ENABLE_IDEMPOTENCY) {
            const eventKey = webhookId
                ? `SHOPIFY:${webhookId}`
                : `${topic}:${shopifyGid}`;

            const isDuplicate = await isDuplicateEvent({ shop, eventKey });

            if (isDuplicate) {
                logger.warn("Duplicate webhook skipped", {
                    shop,
                    eventKey,
                    topic
                });
                return new Response("OK", { status: 200 });
            }
        }
        // ============================================================

        // HARD DELETE - Customer + related data (Cascade)
        await prisma.customer.delete({
            where: {
                shopifyId: shopifyGid
            },
        });

        logger.success("Customer permanently deleted (Hard Delete)", {
            shop,
            customerGid: shopifyGid,
            topic,
        });

        return new Response("OK", { status: 200 });

    } catch (error) {
        // Already deleted
        if (error?.code === "P2025") {
            logger.warn("Customer not found in database (already deleted)", {
                shop,
                customerGid: payload?.admin_graphql_api_id,
            });
            return new Response("OK", { status: 200 });
        }

        // Foreign key / Restrict error handling
        if (error?.code === "P2003" || error?.message?.includes("Foreign key constraint")) {
            logger.error("Foreign key constraint error during customer delete", {
                shop,
                customerGid: payload?.admin_graphql_api_id,
                error: error.message,
            });
            return new Response("OK", { status: 200 });
        }

        logger.error("Customer delete webhook failed", {
            error: error?.message || String(error),
            shop,
            topic,
            webhookId,
            customerGid: payload?.admin_graphql_api_id,
        });

        return new Response("Internal Server Error", { status: 200 });
    }
};