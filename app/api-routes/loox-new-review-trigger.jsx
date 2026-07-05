import { logger } from "app/utils/logger";
import { unauthenticated } from "shopify-server";
import getCorsHeaders from "app/utils/getCorsHeaders";
import prisma from "db-server";
import createTransaction from "app/controller/transaction/createTransaction";
import { createCustomerReward } from "app/controller/customerReward/createCustomerReward";
import { syncCustomerConfig } from "app/controller/metafieldsSync/syncCustomerConfig";
import { getPointRuleByEvent } from "app/controller/pointsRule/getPointRuleByEvent";
import { isDuplicateEvent } from "app/controller/webhook/handleDuplicateWebhook";

const MODULE = "api.loox-new-review-trigger";

// ============================================================
// CONSTANTS
// ============================================================

/** Review type identifiers derived from Loox photo_url detection */
const REVIEW_TYPE = {
    TEXT: "TEXT",
    PHOTO: "PHOTO",
    VIDEO: "VIDEO",
};

/**
 * Controls how many times a customer can earn review points
 * for the same product. Set via conditions.review.rewardMode.
 *
 * "once"      - reward on the very first review, regardless of type.
 * "per_type"  - each type (TEXT, PHOTO, VIDEO) rewardable once per product. (default)
 * "unlimited" - every submission earns points, no cap.
 */
const REWARD_MODE = {
    ONCE: "once",
    PER_TYPE: "per_type",
    UNLIMITED: "unlimited",
};

// ============================================================
// FEATURE METHODS
// ============================================================

/**
 * Validates required Loox webhook fields.
 *
 * @param {string} email
 * @param {string} productId
 * @returns {boolean}
 */
const validateReview = (email, productId) => {
    if (!email || !productId) {
        logger.warn(MODULE, "Missing required fields, skipping", { email, productId });
        return false;
    }
    return true;
};

/**
 * Detects the type of a Loox review from its photo_url.
 *
 * Loox sends a .jpg thumbnail even for video reviews, so extension-based
 * detection is attempted first. Falls back to a HEAD request Content-Type
 * check when no recognisable extension is present.
 *
 * Detection order:
 *   1. No URL       -> TEXT
 *   2. .mp4 / .mov  -> VIDEO  (fast, no network)
 *   3. image ext    -> PHOTO  (fast, no network)
 *   4. HEAD request -> VIDEO | PHOTO by Content-Type
 *   5. Unknown      -> PHOTO  (safe fallback)
 *
 * @param {string|null} photoUrl
 * @returns {Promise<"TEXT"|"PHOTO"|"VIDEO">}
 */
const detectReviewType = async (photoUrl) => {
    if (!photoUrl) return REVIEW_TYPE.TEXT;

    if (/\.(mp4|mov)$/i.test(photoUrl)) return REVIEW_TYPE.VIDEO;
    if (/\.(jpg|jpeg|png|webp|gif)$/i.test(photoUrl)) return REVIEW_TYPE.PHOTO;

    try {
        const res = await fetch(photoUrl, { method: "HEAD" });
        const contentType = res.headers.get("content-type") || "";
        if (contentType.startsWith("video/")) return REVIEW_TYPE.VIDEO;
        if (contentType.startsWith("image/")) return REVIEW_TYPE.PHOTO;
    } catch {
        // Network error or CORS -- fall through to safe default
    }

    return REVIEW_TYPE.PHOTO;
};

/**
 * Loads the customer record and REVIEW points rule in parallel.
 *
 * @param {string} email
 * @returns {Promise<{ customer: Object|null, rule: Object|null }>}
 */
const loadCustomerAndRule = async (email) => {
    const [customer, rule] = await Promise.all([
        prisma.customer.findFirst({
            where: { email },
            select: { id: true, shopifyId: true, sessionId: true },
        }),
        getPointRuleByEvent("REVIEW"),
    ]);
    return { customer, rule };
};

/**
 * Loads the session record for a customer.
 *
 * @param {string} sessionId
 * @returns {Promise<{ id: string, shop: string }|null>}
 */
const loadSession = (sessionId) =>
    prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true, shop: true },
    });

/**
 * Resolves reward config for a given review type from rule conditions.
 *
 * Conditions shape (conditions.review):
 *   {
 *     text:  { points: 10, isActive: true },
 *     image: { points: 20, isActive: true },   // Loox uses "image" key for photo
 *     video: { points: 30, isActive: false },
 *     rewardMode: "per_type"
 *   }
 *
 * Returns null when the review type is disabled (isActive === false).
 *
 * @param {Object} conditions - PointsRule.conditions JSON
 * @param {"TEXT"|"PHOTO"|"VIDEO"} reviewType
 * @returns {{ points: number, rewardMode: string, typeConfig: Object } | null}
 */
const resolveRewardConfig = (conditions, reviewType) => {
    const review = conditions?.review ?? {};

    // Loox uses "image" as the key for photo reviews
    const typeKeyMap = {
        [REVIEW_TYPE.VIDEO]: review.video,
        [REVIEW_TYPE.PHOTO]: review.image,
        [REVIEW_TYPE.TEXT]: review.text,
    };

    const typeConfig = typeKeyMap[reviewType] ?? {};

    // If this review type is disabled, skip — no points awarded
    if (typeConfig.isActive === false) return null;

    const points = Number(typeConfig.points) || 0;
    const rewardMode = review.rewardMode ?? REWARD_MODE.PER_TYPE;

    return { points, rewardMode, typeConfig };
};

/**
 * Builds and checks the idempotency event key based on reward mode.
 *
 * Key patterns:
 *   "once"      -> LOOX_REVIEW:email:productId
 *   "per_type"  -> LOOX_REVIEW:email:productId:reviewType
 *   "unlimited" -> LOOX_REVIEW:email:productId:reviewType:timestamp (always unique)
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.productId
 * @param {string} params.reviewType
 * @param {string} params.rewardMode
 * @param {string} params.shop
 * @returns {Promise<{ isDuplicate: boolean, eventKey: string }>}
 */
const checkIdempotency = async ({ email, productId, reviewType, rewardMode, shop }) => {
    let eventKey;

    switch (rewardMode) {
        case REWARD_MODE.ONCE:
            eventKey = `LOOX_REVIEW:${email}:${productId}`;
            break;
        case REWARD_MODE.UNLIMITED:
            // Always unique -- isDuplicateEvent will never match
            eventKey = `LOOX_REVIEW:${email}:${productId}:${reviewType}:${Date.now()}`;
            break;
        case REWARD_MODE.PER_TYPE:
        default:
            eventKey = `LOOX_REVIEW:${email}:${productId}:${reviewType}`;
    }

    const isDuplicate = await isDuplicateEvent({ shop, eventKey });
    return { isDuplicate, eventKey };
};

/**
 * Builds a unique rewardKey for the reward record.
 *
 * rewardKey must be unique per reward. Since review rewards have no orderId
 * or referralId, createCustomerReward's auto-generated key would be identical
 * across multiple submissions of the same type -- causing false P2002 duplicates.
 *
 * Key strategy per rewardMode:
 *   "unlimited" -> includes timestamp -- always unique, every submission rewarded
 *   "per_type"  -> no timestamp -- same type on same product = same key (intentional cap)
 *   "once"      -> no type or timestamp -- any review on same product = same key (intentional cap)
 *
 * @param {number} customerId
 * @param {string} productId
 * @param {string} reviewType
 * @param {string} rewardMode
 * @returns {string}
 */
const buildRewardKey = (customerId, productId, reviewType, rewardMode) => {
    switch (rewardMode) {
        case REWARD_MODE.ONCE:
            return `REVIEW:DEFAULT:${customerId}:${productId}`;
        case REWARD_MODE.UNLIMITED:
            return `REVIEW:DEFAULT:${customerId}:${productId}:${reviewType}:${Date.now()}`;
        case REWARD_MODE.PER_TYPE:
        default:
            return `REVIEW:DEFAULT:${customerId}:${productId}:${reviewType}`;
    }
};

/**
 * Creates the points transaction and reward record in parallel.
 *
 * Supplies an explicit rewardKey to createCustomerReward so that the
 * P2002 duplicate behaviour aligns with the configured rewardMode rather
 * than the default auto-generated key (which would collide when no
 * orderId/referralId is present).
 *
 * @param {Object} params
 * @param {number} params.customerId
 * @param {string} params.sessionId
 * @param {number} params.eventId
 * @param {string} params.reviewType
 * @param {string} params.rewardMode
 * @param {number} params.points
 * @param {string} params.productId
 * @param {string} params.productTitle
 * @param {string} params.rating
 * @param {string} params.author
 * @param {string|null} params.orderId
 * @returns {Promise<void>}
 */
const issueReward = async ({
    customerId,
    sessionId,
    eventId,
    reviewType,
    rewardMode,
    points,
    productId,
    productTitle,
    rating,
    author,
    orderId,
}) => {
    const label = reviewType.charAt(0) + reviewType.slice(1).toLowerCase();
    const reason = `${label} review submitted for "${productTitle}"`;
    const activity = points > 0
        ? `+${points} points for ${label.toLowerCase()} review on "${productTitle}"`
        : `${label} review submitted for "${productTitle}" -- no points for this review type`;

    const sharedMetadata = {
        reviewType,
        rewardMode,
        productId,
        productTitle,
        rating,
        orderId,
    };

    const rewardKey = buildRewardKey(customerId, productId, reviewType, rewardMode);

    await Promise.all([
        createTransaction(
            {
                customerId,
                type: "EARN",
                eventId,
                points,
                status: "COMPLETED",
                reason,
                activity,
                metadata: sharedMetadata,
            },
            { id: sessionId }
        ),
        createCustomerReward({
            customerId,
            event: "REVIEW",
            type: "DEFAULT",
            status: "COMPLETED",
            title: `${label} review reward`,
            description: points > 0
                ? `You earned ${points} points for submitting a ${label.toLowerCase()} review on "${productTitle}".`
                : `Thank you for your ${label.toLowerCase()} review on "${productTitle}".`,
            rewardKey,
            metadata: { ...sharedMetadata, author },
        }),
    ]);
};

// ============================================================
// RESPONSE HELPER
// ============================================================

const jsonResponse = (data, status, headers) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });

// ============================================================
// ACTION -- POST
// ============================================================

/**
 * POST /api/loox-new-review-trigger
 *
 * Receives Loox HTTP webhook on new review submission.
 * Always returns 200 immediately to prevent Loox retries.
 * All processing runs in the background after the response is sent.
 *
 * Loox payload shape:
 * {
 *   author, email, rating, review_body, review_date,
 *   product_title, product_id, product_url, photo_url, order_id
 * }
 */
export const action = async ({ request }) => {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
    }

    let data;
    try {
        data = await request.json();
    } catch (error) {
        logger.error(MODULE, "Failed to parse request body", { error: error?.message });
        return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Fire and forget -- Loox requires a fast response
    handleLooxReview(data).catch((err) =>
        logger.error(MODULE, "Background review handler failed", {
            error: err?.message,
            stack: err?.stack,
        })
    );

    return new Response("OK", { status: 200, headers: corsHeaders });
};

// ============================================================
// LOADER -- GET (Health Check)
// ============================================================

export const loader = async ({ request }) => {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    return jsonResponse(
        { status: "ok", timestamp: new Date().toISOString() },
        200,
        corsHeaders
    );
};

// ============================================================
// ORCHESTRATOR
// ============================================================

/**
 * Orchestrates the full review reward flow for a single Loox submission.
 *
 * Each step is delegated to a dedicated feature method.
 * The orchestrator only handles control flow and logging.
 *
 * Steps:
 *   1. validateReview        -- required fields
 *   2. detectReviewType      -- TEXT / PHOTO / VIDEO from photo_url
 *   3. loadCustomerAndRule   -- parallel DB fetch
 *   4. loadSession           -- needs customer.sessionId
 *   5. resolveRewardConfig   -- points + rewardMode from rule conditions
 *   6. checkIdempotency      -- build key + duplicate check
 *   7. issueReward           -- transaction + reward record in parallel
 *   8. syncCustomerConfig    -- push updated balance to Shopify metafields
 *
 * @param {Object} reviewData - Raw Loox webhook payload
 */
const handleLooxReview = async (reviewData) => {
    const { email, author, rating, product_title, product_id, photo_url, order_id } = reviewData;

    // 1. Validate
    if (!validateReview(email, product_id)) return;

    // 2. Detect review type
    const reviewType = await detectReviewType(photo_url);

    // 3. Load customer + rule
    const { customer, rule } = await loadCustomerAndRule(email);

    if (!customer) {
        logger.warn(MODULE, "Customer not found, skipping", { email });
        return;
    }
    if (!rule) {
        logger.warn(MODULE, "REVIEW rule not found, skipping");
        return;
    }
    if (!rule.isActive) {
        logger.warn(MODULE, "REVIEW rule is inactive, skipping");
        return;
    }

    // 4. Load session (needs customer.sessionId)
    const dbSession = await loadSession(customer.sessionId);
    if (!dbSession) {
        logger.warn(MODULE, "Session not found, skipping", { customerId: customer.id });
        return;
    }

    // 5. Resolve reward config — returns null if review type is disabled
    const rewardConfig = resolveRewardConfig(rule.conditions, reviewType);

    if (!rewardConfig) {
        logger.info(MODULE, `${reviewType} review type is disabled, skipping`, { email });
        return;
    }

    const { points, rewardMode, typeConfig } = rewardConfig;

    logger.info(MODULE, "Review resolved", { reviewType, rewardMode, points, email, product_title });

    // 6. Idempotency check
    const { isDuplicate, eventKey } = await checkIdempotency({
        email,
        productId: product_id,
        reviewType,
        rewardMode,
        shop: dbSession.shop,
    });

    if (isDuplicate) {
        logger.warn(MODULE, "Duplicate review event skipped", { eventKey, rewardMode });
        return;
    }

    // 7. Issue reward
    const { admin } = await unauthenticated.admin(dbSession.shop);

    await issueReward({
        customerId: customer.id,
        sessionId: dbSession.id,
        eventId: rule.event.id,
        reviewType,
        rewardMode,
        points,
        productId: product_id,
        productTitle: product_title,
        rating,
        author,
        orderId: order_id || null,
    });

    // 8. Sync metafields
    await syncCustomerConfig(admin, customer.shopifyId);

    logger.success(MODULE, "Loox review handled", {
        email,
        customerId: customer.id,
        reviewType,
        rewardMode,
        points,
        product_title,
    });
};