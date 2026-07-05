import { normalizeCustomerGid } from "../../controller/customers/normalizeCustomerGid.js";
import { logger } from "../../utils/logger.js";

/** @constant {string} Module identifier for structured logging */
const MODULE = "graphql/query/customers";

// ─────────────────────────────────────────────────────────────────────────────
// Shared Fields
// ─────────────────────────────────────────────────────────────────────────────

const CUSTOMER_FIELDS = `#graphql
    id
    firstName
    lastName
    defaultEmailAddress {
        emailAddress
        marketingState
    }
    defaultPhoneNumber {
        phoneNumber
        marketingState
        marketingCollectedFrom
    }
    createdAt
    updatedAt
    numberOfOrders
    state
    amountSpent {
        amount
        currencyCode
    }
    verifiedEmail
    taxExempt
    tags
`;

// ─────────────────────────────────────────────────────────────────────────────
// Customers (paginated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all customers from the store using cursor-based pagination.
 * Iterates through all pages until no more results remain.
 *
 * @param {Object} admin - Shopify Admin GraphQL client
 * @returns {Promise<{ customers: { nodes: Array } }|null>}
 */
export default async function customers(admin) {
    const allCustomers = [];
    let cursor = null;
    let hasNextPage = true;

    try {
        while (hasNextPage) {
            const response = await admin.graphql(
                `#graphql
                query CustomerList($cursor: String) {
                    customers(first: 250, after: $cursor) {
                        nodes {
                            ${CUSTOMER_FIELDS}
                        }
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                    }
                }`,
                { variables: { cursor } }
            );

            const json = await response.json();
            const data = json.data?.customers;

            if (!data) throw new Error("Invalid response from Shopify API");

            allCustomers.push(...data.nodes);
            hasNextPage = data.pageInfo.hasNextPage;
            cursor = data.pageInfo.endCursor;
        }

        return { customers: { nodes: allCustomers } };
    } catch (error) {
        logger.error(MODULE, "Failed to fetch customers", { error: error?.message });
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single Customer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches a single customer by ID.
 *
 * @param {Object}        admin - Shopify Admin GraphQL client
 * @param {string|number} id    - Customer ID (numeric or full GID)
 * @returns {Promise<Object|null>}
 */
export const customer = async (admin, id) => {
    try {
        if (!id) throw new Error("Valid customer ID required");

        const gid = normalizeCustomerGid(id);
        const response = await admin.graphql(
            `#graphql
            query CustomerById($id: ID!) {
                customer(id: $id) {
                    ${CUSTOMER_FIELDS}
                }
            }`,
            { variables: { id: gid } }
        );

        const json = await response.json();
        return json.data?.customer ?? null;
    } catch (error) {
        logger.error(MODULE, "Failed to fetch customer", { error: error?.message, id });
        return null;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Customer Order Count
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the total number of orders placed by a customer.
 *
 * Uses the QueryRoot `ordersCount` query filtered by `customer_id` — the only
 * truly reliable way to get an accurate customer order count in Shopify Admin
 * GraphQL:
 *
 *   - `Customer.numberOfOrders` is a scalar that can misreport as 0 even when
 *     orders exist (documented Shopify behavior).
 *   - `Customer.orders(first: N)` only returns up to N nodes, so it cannot
 *     give an accurate total without paginating through all orders.
 *   - `ordersCount(query: "customer_id:X")` is a root-level aggregation query
 *     that returns the exact count independently of the Customer object —
 *     unaffected by the numberOfOrders misreport bug.
 *
 * The `precision` field indicates whether the count is EXACT or AT_LEAST.
 * For referral eligibility checks (does the customer have any prior orders?)
 * either precision value is sufficient — we only care whether count > 0.
 *
 * Return value is always a non-negative integer.
 * Returns 0 on error so callers can safely treat it as "no orders".
 *
 * @param {Object}        admin - Shopify Admin GraphQL client
 * @param {string|number} id    - Customer ID (numeric or full GID)
 * @returns {Promise<number>} Total order count, or 0 on error
 *
 * @example
 * const count = await customerOrderCount(admin, "gid://shopify/Customer/123");
 * if (count > 0) // customer has placed at least one order
 */
export const customerOrderCount = async (admin, id) => {
    if (!id) {
        logger.error(MODULE, "customerOrderCount: missing required id");
        return 0;
    }

    try {
        // Extract the numeric ID from GID if needed:
        // "gid://shopify/Customer/9441305526522" → "9441305526522"
        // ordersCount query filter requires numeric customer_id, not GID format
        const numericId = String(id).includes("gid://")
            ? String(id).split("/").pop()
            : String(id);

        const response = await admin.graphql(
            `#graphql
            query CustomerOrderCount($query: String!) {
                ordersCount(query: $query) {
                    count
                    precision
                }
            }`,
            { variables: { query: `customer_id:${numericId}` } }
        );

        const json = await response.json();
        const result = json?.data?.ordersCount;

        if (!result) {
            logger.warn(MODULE, "customerOrderCount: no result from ordersCount query", { id, numericId });
            return 0;
        }

        logger.info(MODULE, "customerOrderCount resolved", {
            id,
            count: result.count,
            precision: result.precision,
        });

        return result.count ?? 0;

    } catch (error) {
        logger.error(MODULE, "customerOrderCount: failed", { error: error?.message, id });
        return 0;
    }
};