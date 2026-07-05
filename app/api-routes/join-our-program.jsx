/**
 * @file api.join-our-program.jsx
 * @description Public API route for enrolling a customer into the loyalty/referral program.
 *
 * Endpoints:
 *   POST /api/join-our-program  — Enroll a customer by shop + customerId
 *   GET  /api/join-our-program  — Health check
 *   OPTIONS (any)               — CORS preflight
 */

import { logger } from "app/utils/logger";
import { unauthenticated } from "shopify-server";
import getCorsHeaders from "app/utils/getCorsHeaders";
import { customer } from "app/graphql/query/customers";
import { storeCustomer } from "@controller/customers/store";
import { syncCustomerConfig } from "@controller/metafieldsSync/syncCustomerConfig";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULE = "api.join-our-program.jsx";

const HTTP = /** @type {const} */ ({
    OK: 200,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_SERVER_ERROR: 500,
});

// ─── POST: Join Program ───────────────────────────────────────────────────────

/**
 * Handles the POST /api/join-our-program action.
 *
 * Expects a JSON body: `{ shop: string, customerId: string }`
 *
 * Flow:
 *  1. Validate method & parse body
 *  2. Authenticate against Shopify via `unauthenticated.admin`
 *  3. Fetch customer data from Shopify
 *  4. Persist to DB via storeCustomer
 *  5. Sync metafields via syncCustomerConfig
 *  6. Return sanitised response (no session/token, no raw customer data)
 *
 * @param {{ request: Request }} context - React Router loader/action context
 * @returns {Promise<Response>}
 */
export async function action({ request }) {
    const corsHeaders = getCorsHeaders(request);

    // ── Preflight ──────────────────────────────────────────────────────────────
    if (request.method === "OPTIONS") {
        return new Response(null, { status: HTTP.NO_CONTENT, headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, HTTP.METHOD_NOT_ALLOWED, corsHeaders);
    }

    // ── Parse & validate body ──────────────────────────────────────────────────
    let shop, customerId;

    try {
        ({ shop, customerId } = await request.json());
    } catch {
        return jsonResponse({ error: "Invalid or malformed JSON body" }, HTTP.BAD_REQUEST, corsHeaders);
    }

    if (!shop) {
        return jsonResponse({ error: "Field 'shop' is required" }, HTTP.BAD_REQUEST, corsHeaders);
    }

    if (!customerId) {
        return jsonResponse({ error: "Field 'customerId' is required" }, HTTP.BAD_REQUEST, corsHeaders);
    }

    // ── Business logic ─────────────────────────────────────────────────────────
    try {
        const { admin, session } = await unauthenticated.admin(shop);

        if (!session) {
            return jsonResponse({ error: "No active session found for shop" }, HTTP.UNAUTHORIZED, corsHeaders);
        }

        logger.info("Join program request received", { module: MODULE, shop, customerId });

        // 1. Fetch customer data from Shopify
        const customerData = await customer(admin, customerId);

        if (!customerData) {
            return jsonResponse(
                { error: "Customer not found in Shopify" },
                HTTP.BAD_REQUEST,
                corsHeaders
            );
        }

        // 2. Persist to DB — must succeed before syncing metafields
        await storeCustomer(session, customerData);

        // 3. Sync updated config to Shopify metafields
        await syncCustomerConfig(admin, customerId);

        logger.success("Customer successfully joined program", { module: MODULE, shop, customerId });

        // NOTE: Never return `session` — it contains the Shopify access token.
        // Return only safe identifiers, not the full raw Shopify customer object.
        return jsonResponse(
            { success: true, shop, customerId },
            HTTP.OK,
            corsHeaders
        );

    } catch (err) {
        logger.error("Unhandled error in join-our-program action", {
            module: MODULE,
            shop,
            customerId,
            error: err?.message,
            stack: err?.stack,
        });

        return jsonResponse(
            { error: "Failed to join program", details: err?.message },
            HTTP.INTERNAL_SERVER_ERROR,
            corsHeaders
        );
    }
}

// ─── GET: Health Check ────────────────────────────────────────────────────────

/**
 * Handles GET /api/join-our-program.
 *
 * Returns a lightweight health-check payload so uptime monitors and
 * frontend preflight checks can verify the route is reachable.
 *
 * @param {{ request: Request }} context - React Router loader/action context
 * @returns {Promise<Response>}
 */
export async function loader({ request }) {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
        return new Response(null, { status: HTTP.NO_CONTENT, headers: corsHeaders });
    }

    return jsonResponse(
        { status: "ok", timestamp: new Date().toISOString() },
        HTTP.OK,
        corsHeaders
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a JSON `Response` with the correct `Content-Type` header and
 * any additional headers (e.g. CORS).
 *
 * @param {Record<string, unknown>} data    - Payload to serialise as JSON
 * @param {number}                  status  - HTTP status code
 * @param {Record<string, string>}  headers - Extra response headers
 * @returns {Response}
 */
function jsonResponse(data, status, headers) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });
}