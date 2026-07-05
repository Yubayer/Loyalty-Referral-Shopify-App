import { authenticate } from "shopify-server";
import prisma from "db-server";
import generateReferralCode from "@app/utils/generateReferralCode.js";
import { syncCustomerConfig } from "@app/controller/metafieldsSync/syncCustomerConfig";
import { logger } from "@app/utils/logger.js";

export const action = async ({ request }) => {
    const { admin, shop, session, topic, payload } =
        await authenticate.webhook(request);

    logger.info(shop, `Received ${topic} webhook`);

    // ── 1. Idempotency check ──────────────────────────────────────────────────
    const eventKey = request.headers.get("x-shopify-webhook-id");

    if (eventKey) {
        const alreadyProcessed = await prisma.webhookEvent.findUnique({
            where: { eventKey },
        });

        if (alreadyProcessed) {
            logger.warn(shop, "Duplicate webhook, skipping", { eventKey });
            return new Response();
        }
    }

    // ── 2. Session guard ──────────────────────────────────────────────────────
    if (!session?.id) {
        logger.warn(shop, "No session found, skipping");
        await logWebhookEvent({ eventKey, shop, topic, status: "SKIPPED", error: "No session" });
        return new Response();
    }

    // ── 3. Payload validation ─────────────────────────────────────────────────
    const customer = payload;
    const shopifyId = customer?.admin_graphql_api_id || String(customer?.id);
    const email = customer?.email;

    if (!email) {
        logger.warn(shop, "No email in payload, skipping", { shopifyId });
        await logWebhookEvent({ eventKey, shop, topic, status: "SKIPPED", error: "No email in payload" });
        return new Response();
    }

    if (!shopifyId) {
        logger.warn(shop, "No shopifyId in payload, skipping");
        await logWebhookEvent({ eventKey, shop, topic, status: "SKIPPED", error: "No shopifyId in payload" });
        return new Response();
    }

    // ── 4. Upsert customer ────────────────────────────────────────────────────
    try {
        const name = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();

        const existingCustomer = await prisma.customer.findUnique({
            where: { shopifyId },
            select: { id: true },
        });

        if (existingCustomer) {
            await prisma.customer.update({
                where: { shopifyId },
                data: {
                    email,
                    name: name || null,
                    firstName: customer.first_name || null,
                    lastName: customer.last_name || null,
                    metadata: customer,
                },
            });

            logger.info(shop, "Customer updated", { email, shopifyId });
        } else {
            const referralCode = await generateReferralCode();

            await prisma.customer.create({
                data: {
                    shopifyId,
                    name: name || null,
                    firstName: customer.first_name || null,
                    lastName: customer.last_name || null,
                    email,
                    referralCode,
                    sessionId: session.id,
                    metadata: customer,
                },
            });

            logger.success(shop, "Customer created", { email, shopifyId, referralCode });
        }

        // ── 5. Sync metafields (isolated) ─────────────────────────────────────
        await syncCustomerConfig(admin, shopifyId).catch((err) => {
            logger.error(shop, "syncCustomerConfig failed", err, { shopifyId });
        });

        // ── 6. Log success ────────────────────────────────────────────────────
        await logWebhookEvent({ eventKey, shop, topic, status: "PROCESSED" });

    } catch (error) {
        logger.error(shop, "Customer webhook error", error, { shopifyId, email });
        await logWebhookEvent({
            eventKey,
            shop,
            topic,
            status: "FAILED",
            error: error?.message || String(error),
        });
    }

    return new Response();
};

// ── Helper: WebhookEvent logger ───────────────────────────────────────────────
async function logWebhookEvent({ eventKey, shop, topic, status, error = null }) {
    if (!eventKey) return;

    try {
        await prisma.webhookEvent.upsert({
            where: { eventKey },
            update: { status, error },
            create: { shop, eventKey, topic, status, error },
        });
    } catch (err) {
        logger.error(shop, "Failed to log WebhookEvent", err);
    }
}