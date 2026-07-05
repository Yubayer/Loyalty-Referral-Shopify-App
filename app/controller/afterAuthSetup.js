import { logger } from "../utils/logger.js";
import prisma from "../db.server.js";
import syncAppConfig from "../controller/metafieldsSync/syncAppConfig.js"

export default async function afterAuthSetup({ admin, session }) {
    try {
        await eventSeeder(session);
        await syncAppConfig(admin, session);
    } catch (error) {
        logger.error("## Error in afterAuthSetup:", error);
    }
}

/**
 * Seeds initial loyalty program events for a given shop session.
 * Upserts the three core event types: ORDER, REFERRAL, and LOOX_REVIEW.
 *
 * @param {object} session - The active Shopify session object.
 * @param {string} session.id - Unique session identifier.
 * @param {string} session.shop - Shop domain (e.g. "my-store.myshopify.com").
 * @returns {Promise<void>}
 */
const eventSeeder = async (session) => {
    const SEED_EVENTS = [
        {
            name: "Direct Purchase",
            type: "ORDER",
            description: "Customer places an order and completes the checkout process. Rewards are granted when the order is marked as paid in Shopify.",
        },
        {
            name: "Refer a Friend",
            type: "REFERRAL",
            description: "Customer refers a friend who makes a purchase using their referral code. Rewards are granted when the referred friend completes a purchase using the referral code.",
        },
        {
            name: "Loox Review Written",
            type: "REVIEW",
            description: "Customer writes a product review on Loox, There are three types of reviews that can be rewarded: Text Review: A standard written review without photos. Photo Review: A review that includes photos of the product. Video Review: A review that includes a video showcasing the product.",
        },
    ];

    try {
        await Promise.all(
            SEED_EVENTS.map((event) =>
                prisma.event.upsert({
                    where: {
                        sessionId_type: {
                            sessionId: session.id,
                            type: event.type,
                        },
                    },
                    update: {
                        name: event.name,
                        description: event.description,
                    },
                    create: {
                        shop: session.shop,
                        sessionId: session.id,
                        name: event.name,
                        type: event.type,
                        description: event.description,
                    },
                })
            )
        );

        logger.info(`## eventSeeder: Seeded ${SEED_EVENTS.length} events for shop "${session.shop}"`);
    } catch (error) {
        logger.error("## eventSeeder: Failed to seed events", { shop: session.shop, error });
    }
};