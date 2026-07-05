import { logger } from "../../../utils/logger.js";

// js doc and return for metafield sync mutation config function
/**
 * Configures the metafield sync mutation for a given admin client and metafield data.
 * @param {object} admin - The admin client to perform the GraphQL mutation.
 * @param {object} metafield - The metafield data to be synced, including ownerId, key, namespace, and value.
 * @returns {Promise<void>} - A promise that resolves when the mutation is complete.
 * @throws {Error} - Throws an error if the mutation fails or if required parameters are missing.
 * @example
 * const admin = ...; // Obtain the admin client
 * const metafield = {
 *   ownerId: "gid://shopify/Shop/123456789",
 *   key: "config",
 *   namespace: "shield_insurance_app_new",
 *   value: JSON.stringify({ some: "data" }),
 * };
 * await configMetafieldSyncMutation(admin, metafield); 
 */

export default async function configMetafieldSyncMutation(admin, metafield) {
    metafield = metafield || {};
    if (!admin) {
        logger.error("Admin client is required for metafield sync mutation");
        return;
    }
    if (!metafield.ownerId || !metafield.key || !metafield.namespace) {
        logger.error("Metafield ownerId, key and namespace are required for metafield sync mutation");
        return;
    }
    if (typeof metafield.value !== "string") {
        logger.error("Metafield value must be a string for metafield sync mutation");
        return;
    }
    try {
        const response = await admin.graphql(
            `#graphql
            mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                metafields {
                    key
                    namespace
                    value
                    createdAt
                    updatedAt
                }
                userErrors {
                    field
                    message
                    code
                }
            }
        }`,
            {
                variables: {
                    metafields: [
                        { ...metafield }
                        // {
                        //     namespace: "shield_insurance_app_new",
                        //     key: "config",
                        //     value: JSON.stringify(data),
                        //     type: "json",
                        //     ownerId: shopId,
                        // },
                    ],
                },
            },
        );

        if (response.errors) {
            throw new Error("Something went wrong! please try again later.")
        } else {
            logger.success("Metafield successfully synced");
        }
    } catch (err) {
        logger.error("Metafield sync mutation error", {
            module: "graphql/mutation/metafieldSync.js",
            error: err?.message,
            stack: err?.stack
        })
    }
}