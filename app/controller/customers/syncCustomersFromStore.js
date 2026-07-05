

import customers from "../../graphql/query/customers.js";
import { storeCustomer } from "./store.js";

const BATCH_SIZE = 10;

export default async function oldCustomerStoreFromShop(admin, session) {
    const response = await customers(admin);

    if (!response?.customers?.nodes) {
        throw new Error("Invalid response from Shopify API");
    }

    const allCustomers = response.customers.nodes;
    const results = { total: allCustomers.length, success: 0, failed: 0, errors: [] };

    for (let i = 0; i < allCustomers.length; i += BATCH_SIZE) {
        const batch = allCustomers.slice(i, i + BATCH_SIZE);
        const settled = await Promise.allSettled(batch.map((c) => storeCustomer(session, c)));

        settled.forEach((result, idx) => {
            if (result.status === "fulfilled") {
                results.success++;
            } else {
                results.failed++;
                results.errors.push({ customerId: batch[idx]?.id, reason: result.reason?.message });
            }
        });
    }

    return results;
}