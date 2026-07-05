import prisma from "../db.server.js";
import { logger } from "./logger.js";

/** @constant {string} Prefix for all referral codes */
const PREFIX = "NBL";

/** @constant {number} Maximum attempts before throwing on collision */
const MAX_ATTEMPTS = 5;

/**
 * Generates a random referral code string.
 * Format: {PREFIX}_{7_RANDOM_CHARS}
 *
 * @returns {string} e.g. "NBL_A3K9XZT1B2C"
 */
function generateCode() {
    const random = Math.random().toString(36).substring(2, 9).toUpperCase();
    return `${PREFIX}_${random}`;
}

/**
 * Generates a unique referral code by checking against existing DB records.
 * Retries up to MAX_ATTEMPTS times on collision before throwing.
 *
 * @returns {Promise<string>} A unique referral code e.g. "NBL_A3K9XZT1B2C"
 * @throws {Error} If a unique code cannot be generated within MAX_ATTEMPTS tries
 */
export default async function generateReferralCode() {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const code = generateCode();

        const exists = await prisma.customer.findUnique({
            where: { referralCode: code },
            select: { id: true },
        });

        if (!exists) {
            if (attempt > 1) {
                logger.info(`Referral code generated after ${attempt} attempts`, { code });
            }
            return code;
        }

        logger.warn(`Referral code collision on attempt ${attempt}/${MAX_ATTEMPTS}`, { code });
    }

    throw new Error(`Failed to generate a unique referral code after ${MAX_ATTEMPTS} attempts`);
}