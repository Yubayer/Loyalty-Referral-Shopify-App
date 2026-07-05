/**
 * @file widget-ui/route.jsx
 * @description App Proxy route for the storefront widget.
 *
 * Registered manually in app/routes.js:
 *   route("widget-data", "widget-ui/route.jsx")
 *
 * shopify.app.toml:
 *   [app_proxy]
 *   url = "/widget-data"   -> this file
 *   prefix = "apps"
 *   subpath = "widget"
 *
 * Storefront requests to https://{shop}.myshopify.com/apps/widget get
 * proxied by Shopify to https://<application_url>/widget-data, with a
 * Shopify-signed query string (shop, signature, timestamp, and — when the
 * shopper is logged in — logged_in_customer_id).
 *
 * Endpoints:
 *   GET /apps/widget  — Live customer data for the storefront widget
 */

import { authenticate } from "shopify-server";
import { logger } from "app/utils/logger";
import { customer } from "app/graphql/query/customers";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULE = "widget-ui/route.jsx";

const HTTP = /** @type {const} */ ({
    OK: 200,
    UNAUTHORIZED: 401,
    INTERNAL_SERVER_ERROR: 500,
});

// ─── GET: Live widget data ─────────────────────────────────────────────────────

/**
 * Handles GET /apps/widget.
 *
 * Flow:
 *  1. Verify the request's Shopify signature (authenticate.public.appProxy)
 *  2. Only ever trust `logged_in_customer_id` for identity — Shopify appends
 *     it itself and it's covered by the signature just verified. Never
 *     accept a self-invented query param (e.g. ?customer_id=123) — that
 *     would let anyone read anyone else's data.
 *  3. Guest (not logged in) -> generic response, no personal data
 *  4. Logged in -> fetch that customer's real data via the shared
 *     customer() helper (same one app/api-routes/join-our-program.jsx uses)
 *
 * @param {{ request: Request }} context - React Router loader context
 * @returns {Promise<Response>}
 */
export async function loader({ request }) {
    const { session, admin } = await authenticate.public.appProxy(request);

    if (!session) {
        return jsonResponse({ error: "Unauthorized" }, HTTP.UNAUTHORIZED);
    }

    const url = new URL(request.url);
    const loggedInCustomerId = url.searchParams.get("logged_in_customer_id");

    if (!loggedInCustomerId) {
        // Guest visitor — no personalized data, don't cache aggressively
        // since this is served fresh per-request via the proxy.
        return jsonResponse(
            { customer: null },
            HTTP.OK,
            { "Cache-Control": "public, max-age=30" },
        );
    }

    try {
        const customerData = await customer(admin, loggedInCustomerId);

        if (!customerData) {
            logger.warn(MODULE, "Customer not found for logged_in_customer_id", {
                shop: session.shop,
                loggedInCustomerId,
            });
            return jsonResponse({ customer: null }, HTTP.OK, {
                "Cache-Control": "private, no-store",
            });
        }

        logger.info(MODULE, "Widget data served for logged-in customer", {
            shop: session.shop,
            loggedInCustomerId,
        });

        return jsonResponse(
            { customer: customerData },
            HTTP.OK,
            // Personalized response — never let this be cached by CDNs/browsers.
            { "Cache-Control": "private, no-store" },
        );
    } catch (error) {
        logger.error(MODULE, "Failed to load widget data", {
            shop: session.shop,
            loggedInCustomerId,
            error: error?.message,
        });
        // Don't crash the whole widget over a transient failure — degrade
        // to a non-personalized response instead.
        return jsonResponse({ customer: null }, HTTP.OK, {
            "Cache-Control": "private, no-store",
        });
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a JSON `Response` with the correct `Content-Type` header and
 * any additional headers.
 *
 * @param {Record<string, unknown>} data    - Payload to serialise as JSON
 * @param {number}                  status  - HTTP status code
 * @param {Record<string, string>}  [headers] - Extra response headers
 * @returns {Response}
 */
function jsonResponse(data, status, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });
}
