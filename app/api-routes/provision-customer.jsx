import { logger } from "app/utils/logger";
import { unauthenticated } from "shopify-server";
import getCorsHeaders from "app/utils/getCorsHeaders";
import { syncCustomerConfig } from "@controller/metafieldsSync/syncCustomerConfig";
import prisma from "db-server";
import { normalizeCustomerGid } from "@controller/customers/normalizeCustomerGid.js";
import { customer as fetchShopifyCustomer } from "@graphql/query/customers";
import generateReferralCode from "app/utils/generateReferralCode.js";
import { withRetry } from "app/utils/retry/withRetry.js";

/** @constant {string} Module identifier for structured logging */
const MODULE = "api.provision-customer";

// =====================================================
// CONSTANTS
// =====================================================

/**
 * Structured error codes for consistent client-side handling.
 *
 * 400 — Bad Request   : missing/malformed input
 * 404 — Not Found     : customer doesn't exist in Shopify (shouldn't normally
 *                        happen — they're logged in — but defend anyway)
 * 500 — Internal Error: server/DB/Shopify failure
 */
const ERROR_CODES = {
    INVALID_INPUT: { code: "INVALID_INPUT", status: 400 },
    SHOPIFY_CUSTOMER_NOT_FOUND: { code: "SHOPIFY_CUSTOMER_NOT_FOUND", status: 404 },
    INTERNAL_ERROR: { code: "INTERNAL_ERROR", status: 500 },
};

// This endpoint is purely a silent background convenience — it's never the
// only path that creates a customer record (the customer-create webhook and
// the bulk store sync both also do this). So we deliberately keep retries
// light: the goal is "don't make the customer wait", not "guarantee success
// at all costs". If this fails, the webhook or a later widget load will
// catch the customer eventually.
const FAST_RETRY = {
    maxAttempts: 2,
    baseDelayMs: 400,
    backoffFactor: 2,
    maxDelayMs: 1500,
    jitterFactor: 0.2,
    retryableErrors: ["fetch failed", "ECONNRESET", "ETIMEDOUT"],
};

// =====================================================
// MAIN ACTION
// =====================================================

/**
 * POST /api/provision-customer
 *
 * Silently creates the app's Customer record (+ referral code) for a
 * Shopify customer who is logged in on the storefront but doesn't yet have
 * an app-side record (e.g. customer existed before app install, or the
 * create webhook was missed/delayed). Idempotent — safe to call repeatedly.
 *
 * Request body: { shop, customerId }
 *
 * Response (200):
 *   { success: true, shouldReload: boolean }
 *   shouldReload is true only when a NEW record was just created — the
 *   storefront should reload once to pick up the freshly synced metafield.
 *   If the customer already existed, shouldReload is false (nothing changed,
 *   no reload needed — avoids any possibility of a reload loop).
 *
 * Error responses (400 / 404 / 500):
 *   { success: false, code, message }
 */
export async function action({ request }) {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse(
            { success: false, message: "Method not allowed.", code: ERROR_CODES.INVALID_INPUT.code },
            405,
            corsHeaders
        );
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse(
            { success: false, message: "Invalid request body.", code: ERROR_CODES.INVALID_INPUT.code },
            400,
            corsHeaders
        );
    }

    const { shop, customerId } = body;

    try {
        if (!shop) throw createError("Shop is required.", ERROR_CODES.INVALID_INPUT);
        if (!customerId) throw createError("Customer ID is required.", ERROR_CODES.INVALID_INPUT);

        const shopifyId = normalizeCustomerGid(customerId);

        // ── 1. Fast path — already provisioned ────────────────────────────────
        // This is the common case on every call after the first: the previous
        // call (or the webhook) already created the record, so we just
        // confirm and tell the frontend NOT to reload. Single indexed lookup,
        // no Shopify API call — keeps repeat calls effectively instant and
        // makes the endpoint naturally loop-proof (a new record can only ever
        // trigger shouldReload once, on the call that actually creates it).
        const existing = await prisma.customer.findUnique({
            where: { shopifyId },
            select: { id: true },
        });

        if (existing) {
            return jsonResponse({ success: true, shouldReload: false }, 200, corsHeaders);
        }

        // ── 2. Authenticate shop ──────────────────────────────────────────────
        const { admin, session } = await unauthenticated.admin(shop);
        if (!session) {
            throw createError("Valid shop session required.", ERROR_CODES.INVALID_INPUT);
        }

        // ── 3. Fetch customer details from Shopify (name/email) ───────────────
        // Trusted source — we never accept name/email from the storefront
        // request body itself.
        const shopifyCustomer = await withRetry(
            () => fetchShopifyCustomer(admin, shopifyId),
            { ...FAST_RETRY, context: { shop, customerId: shopifyId, module: MODULE } }
        );

        if (!shopifyCustomer) {
            throw createError("Shopify customer not found.", ERROR_CODES.SHOPIFY_CUSTOMER_NOT_FOUND);
        }

        const email = shopifyCustomer.defaultEmailAddress?.emailAddress || null;
        const name = `${shopifyCustomer.firstName || ""} ${shopifyCustomer.lastName || ""}`.trim();
        const referralCode = await generateReferralCode();

        // ── 4. Create the record — upsert on the unique shopifyId guards ──────
        // against a race where two requests land here at the same time (e.g.
        // two tabs open). Whichever wins the create, the other just updates
        // the same row — no duplicate-record error, no crash.
        let created = true;
        let customerRecord;
        try {
            customerRecord = await prisma.customer.create({
                data: {
                    shopifyId,
                    name: name || null,
                    firstName: shopifyCustomer.firstName || null,
                    lastName: shopifyCustomer.lastName || null,
                    email,
                    referralCode,
                    sessionId: session.id,
                    metadata: shopifyCustomer,
                },
                select: { id: true },
            });
        } catch (err) {
            // P2002 = unique constraint violation — another concurrent request
            // (or the webhook) created this customer a moment ago. Not an
            // error from the customer's point of view — just means someone
            // else already finished the job.
            if (err.code === "P2002") {
                created = false;
                customerRecord = await prisma.customer.findUnique({
                    where: { shopifyId },
                    select: { id: true },
                });
            } else {
                throw err;
            }
        }

        if (!customerRecord) {
            throw createError("Failed to create customer record.", ERROR_CODES.INTERNAL_ERROR);
        }

        // ── 5. Sync metafield — must complete before responding ───────────────
        // Unlike the referral flow (where metafield sync is best-effort/
        // non-blocking because the discount code itself is already the
        // valuable part), here the metafield IS the thing the storefront is
        // about to reload for. If this fails, reloading would just show the
        // same empty state again — so we surface the failure instead of
        // silently telling the frontend to reload into nothing.
        await syncCustomerConfig(admin, shopifyId);

        if (created) {
            logger.success("Customer auto-provisioned from storefront", {
                shop,
                shopifyId,
                referralCode,
                module: MODULE,
            });
        }

        return jsonResponse({ success: true, shouldReload: created }, 200, corsHeaders);

    } catch (err) {
        const errorDef = err?.errorDef || ERROR_CODES.INTERNAL_ERROR;
        const isClientError = errorDef.status < 500;

        if (isClientError) {
            logger.warn("Customer provision rejected", {
                error: err?.message,
                code: errorDef.code,
                shop,
                customerId,
                module: MODULE,
            });
        } else {
            logger.error("Customer provision error", {
                error: err?.message,
                code: errorDef.code,
                shop,
                customerId,
                module: MODULE,
            });
        }

        return jsonResponse(
            { success: false, message: err.message || "Something went wrong.", code: errorDef.code },
            errorDef.status,
            corsHeaders
        );
    }
}

// =====================================================
// HEALTH CHECK
// =====================================================

export async function loader({ request }) {
    const corsHeaders = getCorsHeaders(request);
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    return jsonResponse({ status: "ok", timestamp: new Date().toISOString() }, 200, corsHeaders);
}

// =====================================================
// HELPERS
// =====================================================

function jsonResponse(data, status, headers) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });
}

function createError(message, errorDef) {
    const err = new Error(message);
    err.errorDef = errorDef;
    return err;
}