import prisma from "db-server";
import { logger } from "./logger.js";

/** @constant {string} Prefix for all discount codes */
const PREFIX = "NBL";

/** @constant {number} Maximum attempts before throwing on collision */
const MAX_ATTEMPTS = 5;

/**
 * Generates a random discount code string.
 * Format: {PREFIX}_{7_RANDOM_CHARS}
 *
 * @returns {string} e.g. "NBL_A3K9XZT1B2C"
 */
function generateCode() {
    const random = Math.random().toString(36).substring(2, 9).toUpperCase(); // 7 chars
    return `${PREFIX}_${random}`;
}

/**
 * Generates a unique discount code by checking against existing DB records.
 * Retries up to MAX_ATTEMPTS times on collision before throwing.
 *
 * @returns {Promise<string>} A unique discount code e.g. "NBL_A3K9XZT1B2C"
 * @throws {Error} If a unique code cannot be generated within MAX_ATTEMPTS tries
 */
export async function generateDiscountCode() {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const code = generateCode();

        const exists = await prisma.reward.findFirst({
            where: { code },
            select: { id: true },
        });

        if (!exists) {
            if (attempt > 1) {
                logger.info(`Discount code generated after ${attempt} attempts`, { code });
            }
            return code;
        }

        logger.warn(`Discount code collision on attempt ${attempt}/${MAX_ATTEMPTS}`, { code });
    }

    throw new Error(`Failed to generate a unique discount code after ${MAX_ATTEMPTS} attempts`);
}