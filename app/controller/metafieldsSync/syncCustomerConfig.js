import configMetafieldSyncMutation from "../../graphql/mutation/metafieldsSync/config.js";
import prisma from "../../db.server.js";
import { normalizeCustomerGid } from "../customers/normalizeCustomerGid.js";
import { logger } from "../../utils/logger.js";

// Only fields the storefront widget (app/widget-ui/ui/*) actually reads off
// this metafield. Everything else here is dead weight in every sync job and
// every page-load payload — see main.preact.jsx (customerConfig.*) and
// loyalty.liquid (customer.metafields.app.nbl_customer_v1.value.*) for the
// full list of what's consumed.
//
// Note: this is a single top-level `select` (not select+include — Prisma
// doesn't allow mixing those at the same level). `shopifyId` isn't read by
// the widget but IS needed here as the metafield's ownerId in buildMetafield().
const CUSTOMER_SELECT = {
    id: true,
    shopifyId: true,
    points: true,
    referralCode: true,

    // ActivityRow + the toast notification list read: id, type, points,
    // activity, reason (fallback text), createdAt, notifiedAt. Nothing reads
    // the nested `reward` sub-object that used to be included here.
    transactions: {
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            type: true,
            points: true,
            activity: true,
            reason: true,
            createdAt: true,
            notifiedAt: true,
        },
    },
    // ActiveRewardItem + the discountUsed/status filters (Home/Rewards/
    // Activities tabs) are all that touch this array.
    rewards: {
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            code: true,
            title: true,
            discountUsed: true,
            status: true,
        },
    },
    // referralsSent / referralsUsed removed entirely — grep confirms nothing
    // in app/widget-ui reads them. Dashboard pages and orderPaidJob.js query
    // these directly from Postgres themselves; they don't go through this
    // metafield, so dropping them here doesn't affect either.
    prizeClaims: {
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            status: true,
            pointsCost: true,
            physicalPrizeId: true,
        },
    },
};

const BATCH_SIZE = 10;

const buildMetafield = (customer) => {
    const bm = {
        namespace: "app",
        key: "nbl_customer_v1",
        value: JSON.stringify({
            appName: "North Borders Loyalty App",
            ...customer,
        }),
        type: "json",
        ownerId: customer.shopifyId,
    };

    return bm;
};

export const syncCustomersConfig = async (admin, session) => {
    try {
        const customers = await prisma.customer.findMany({
            where: { sessionId: session.id }, // scoped to current shop
            select: CUSTOMER_SELECT,
        });

        for (let i = 0; i < customers.length; i += BATCH_SIZE) {
            const batch = customers.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(
                batch.map((customer) =>
                    configMetafieldSyncMutation(admin, buildMetafield(customer))
                )
            );
        }
    } catch (error) {
        logger.error("## Error in syncCustomersConfig:", error);
    }
};

export const syncCustomerConfig = async (admin, customerId) => {
    try {
        let customer = null;
        let normalizedId = null;

        if (customerId?.toString()?.length <= 6) {
            customer = await prisma.customer.findFirst({
                where: { id: Number(customerId) },
                select: CUSTOMER_SELECT,
            });
        } else {
            normalizedId = normalizeCustomerGid(customerId);

            if (!normalizedId) {
                throw new Error("Customer ID is required");
            }

            customer = await prisma.customer.findFirst({
                where: { shopifyId: normalizedId },
                select: CUSTOMER_SELECT,
            });
        }

        if (!customer) {
            throw new Error(`Customer not found: ${normalizedId ?? customerId}`);
        }

        await configMetafieldSyncMutation(admin, buildMetafield(customer));

        return customer;
    } catch (error) {
        logger.error("## Error in syncCustomerConfig:", error);
        return null;
    }
};