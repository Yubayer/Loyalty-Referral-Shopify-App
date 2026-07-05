import prisma from "db-server";
import { logger } from "app/utils/logger.js";

/**
 * Prevents duplicate webhook or event processing using a unique eventKey.
 * Uses a dedicated `webhookEvent` table with a unique constraint on (shop, eventKey).
 *
 * @param {Object} params
 * @param {string|null} params.shop     - Shop domain e.g. "my-store.myshopify.com".
 *                                        Falls back to "unknown" if null (schema requires non-null).
 * @param {string}      params.eventKey - Unique key identifying this event.
 *                                        e.g. "SHOPIFY:webhook-id" or "LOOX_REVIEW:email:productId:TEXT"
 * @returns {Promise<boolean>} true if duplicate (already processed), false if first time.
 * @throws {Error} Re-throws any non-duplicate DB error.
 *
 * @example
 * const isDuplicate = await isDuplicateEvent({ shop: "my-store.myshopify.com", eventKey });
 * if (isDuplicate) return; // skip
 */
export async function isDuplicateEvent({ shop, eventKey }) {
    try {
        await prisma.webhookEvent.create({
            data: { shop: shop ?? "unknown", eventKey },
        });
        return false;
    } catch (err) {
        if (err?.code === "P2002") {
            return true;
        }
        logger.error("isDuplicateEvent error", { eventKey, error: err?.message });
        throw err;
    }
}