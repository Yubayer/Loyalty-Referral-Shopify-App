import prisma from "../../db.server.js";
import shopId from "../../graphql/query/shop/shopId.js"
import configMetafieldSyncMutation from "../../graphql/mutation/metafieldsSync/config.js";


export default async function syncAppConfig(admin, session) {
    try {
        const shop_id = await shopId(admin);
        const appUrl = process.env.SHOPIFY_APP_URL || "http://localhost:3000";
        const shop = await prisma.session.findFirst({
            where: { id: session?.id },
            select: {
                shop: true,
                email: true,
                pointRules: {
                    include: {
                        event: {
                            select: {
                                name: true,
                                id: true,
                                type: true
                            }
                        }
                    }
                },
                rewardRules: true,
                styles: true,
                physicalPrizes: {
                    where: { isActive: true },
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        imageUrl: true,
                        pointsCost: true,
                        productValue: true,
                        isActive: true,
                    },
                },
            }
        })


        const metafield = {
            namespace: "app",
            key: "nbl_config_v1",
            value: JSON.stringify({
                appUrl,
                ...shop
            }),
            type: "json",
            ownerId: shop_id,
        };

        await configMetafieldSyncMutation(admin, metafield);

    } catch (error) {
        console.error("## Error in syncAppConfig:", error);
    }
}