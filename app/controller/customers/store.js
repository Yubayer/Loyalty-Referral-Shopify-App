import prisma from "../../db.server.js";
import { logger } from "../../utils/logger.js";
import generateReferralCode from "../../utils/generateReferralCode.js";

export const storeCustomer = async (session, customer) => {
    const email =
        customer?.defaultEmailAddress?.emailAddress ||
        customer?.email ||
        null;

    if (!email) {
        logger.warn("storeCustomer: no email in payload, skipping", {
            shopifyId: customer?.admin_graphql_api_id || customer?.id,
        });
        return null;
    }

    const shopifyId = customer?.admin_graphql_api_id || String(customer.id);
    const name = `${customer.firstName || customer.first_name || ""} ${customer.lastName || customer.last_name || ""}`.trim();

    const referralCode = await generateReferralCode();

    if (!referralCode) {
        logger.error("storeCustomer: failed to generate referral code", {
            shopifyId,
            email,
        });
        return null;
    }

    try {
        return await prisma.customer.upsert({
            where: {
                shopifyId,
            },
            update: {
                email,
                name: name || null,
                firstName: customer.firstName || customer.first_name || null,
                lastName: customer.lastName || customer.last_name || null,
                metadata: customer,
            },
            create: {
                shopifyId,
                name: name || null,
                firstName: customer.firstName || customer.first_name || null,
                lastName: customer.lastName || customer.last_name || null,
                email,
                referralCode: referralCode,
                sessionId: session.id,
                metadata: customer,
            },
        });
    } catch (error) {
        logger.error("storeCustomer: upsert failed", {
            shopifyId,
            email,
            error: error?.message,
        });
        return null;
    }
};