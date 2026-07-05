/**
 * @file shopifyFileUpload.server.js
 * @description Production-grade Shopify Files API uploader for React Router (Remix) Shopify apps.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * SHOPIFY API INFO
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *   API Version : 2026-04  (latest stable — June 2026)
 *   Mutations   : stagedUploadsCreate  →  S3 direct upload  →  fileCreate
 *   Docs        : https://shopify.dev/docs/api/admin-graphql/latest/mutations/stageduploadscreate
 *                 https://shopify.dev/docs/api/admin-graphql/latest/mutations/fileCreate
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * REQUIRED ACCESS SCOPE  (shopify.app.toml)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *   [access_scopes]
 *   scopes = "write_files"          ← image / video / pdf / any file সব এক scope-এ
 *
 *   ┌──────────────┬─────────────────────────────────────────────────────────┐
 *   │ Scope        │ কী cover করে                                            │
 *   ├──────────────┼─────────────────────────────────────────────────────────┤
 *   │ write_files  │ stagedUploadsCreate + fileCreate দুটোর জন্যই যথেষ্ট।   │
 *   │              │ image, video, pdf, glb, zip — সব ধরনের file upload।     │
 *   ├──────────────┼─────────────────────────────────────────────────────────┤
 *   │ read_files   │ শুধু files query করতে হলে add করো (optional)             │
 *   └──────────────┴─────────────────────────────────────────────────────────┘
 *
 *   ⚠️  IMPORTANT: Shopify docs-এ "write_images" scope mention থাকলেও সেটা
 *   INVALID এবং TOML validation fail করে। এটা একটা confirmed Shopify docs bug
 *   (May 2026). শুধু write_files ব্যবহার করো।
 *   Ref: https://community.shopify.dev/t/write-images-access-scope-problem/33881
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * HOW IT WORKS  (3-step pipeline)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *   formData file(s)
 *       │
 *       ▼
 *   ① stagedUploadsCreate  ──→  Shopify Admin GraphQL
 *                                (pre-signed S3 URL + auth parameters পাওয়া)
 *       │
 *       ▼
 *   ② S3 direct upload     ──→  fetch(target.url, ...)
 *        ALL types  →  multipart POST  (GCS signed-POST flow)
 *                        parameters from stagedUploadsCreate MUST come before file
 *       │
 *       ▼
 *   ③ fileCreate           ──→  Shopify Admin GraphQL
 *                                (file register, permanent CDN URL পাওয়া)
 *       │
 *       ▼
 *   result.file.url  →  "https://cdn.shopify.com/s/files/..."
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ASYNC FILE PROCESSING  ⚠️
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *   fileCreate mutation complete হলেই file সাথে সাথে ready হয় না।
 *   Shopify background-এ process করে। fileStatus lifecycle:
 *
 *     UPLOADED  →  PROCESSING  →  READY   (সফল হলে)
 *                              →  FAILED  (কোনো কারণে ব্যর্থ হলে)
 *
 *   এই utility সরাসরি url + fileStatus return করে। Production-এ READY
 *   confirm করতে চাইলে shopifyPollFileStatus() helper ব্যবহার করো।
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * atomic OPTION EXPLAINED
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *   atomic: false  (default — partial save)
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │ ৫টা file পাঠালে ৩টা valid, ২টা invalid হলে:                         │
 *   │   → ৩টা valid file Shopify-তে upload হয়ে যাবে                       │
 *   │   → ২টা invalid গুলো result.errors[] array-এ থাকবে                  │
 *   │   → result.ok = false (কারণ কিছু error ছিল)                          │
 *   │   → result.files = [uploaded 3 files]                                │
 *   │ Use case: gallery upload যেখানে partial success acceptable            │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 *   atomic: true  (all-or-nothing)
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │ ৫টা file-এর যেকোনো একটাও invalid হলে:                               │
 *   │   → কোনো file-ই Shopify-তে upload হবে না                            │
 *   │   → সব validation error একসাথে result.errors[] array-এ আসবে         │
 *   │   → result.ok = false, result.files = []                             │
 *   │ Use case: product variant set যেখানে সব না হলে কোনোটাই চাই না,      │
 *   │           অথবা required form যেখানে সব fields mandatory               │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * EXPORTED FUNCTIONS  (quick reference)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *   shopifyUploadFile(admin, file, options?)
 *     → SingleUploadResult          result.file / result.error shortcut সহ
 *     → formData.get("field") থেকে single file
 *
 *   shopifyUploadFiles(admin, files, options?)
 *     → UploadResult                batch upload, partial অথবা atomic
 *     → formData.getAll("field") থেকে multiple files
 *
 *   shopifyUploadMultipleFields(admin, fieldMap, sharedOptions?)
 *     → MultiFieldUploadResult      multiple form fields, group-wise atomic
 *     → প্রতিটা field আলাদা group — একটার error অন্যটাকে affect করে না
 *
 *   shopifyUploadFromRequest(admin, request, field?, options?)
 *     → SingleUploadResult | UploadResult
 *     → maxFiles: 1 হলে SingleUploadResult (result.file / result.error সহ)
 *     → maxFiles > 1 হলে UploadResult (result.files / result.errors)
 *     → one-liner action wrapper — formData parse নিজেই করে
 *
 *   shopifyPollFileStatus(admin, fileId, options?)
 *     → { ok, fileStatus, url, attempts }
 *     → fileCreate-এর পরে READY হওয়া পর্যন্ত poll করে
 *
 *   SHOPIFY_UPLOAD_ERROR_CODES
 *     → machine-readable error code constants
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * UploadOptions  (all optional)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *   maxSize          {number}    per-file byte limit. default: 20 MB
 *   maxTotalSize     {number}    entire batch byte limit. default: 100 MB
 *   maxFiles         {number}    max files per call. default: 10
 *   allowedTypes     {string[]}  MIME whitelist. e.g. ["image/", "image/png"]
 *                                prefix (ends with "/") = wildcard match
 *                                exact string = exact match
 *                                empty [] = allow everything
 *   allowedExtensions {string[]} extension whitelist (no dot). e.g. ["jpg","pdf"]
 *                                empty [] = allow everything
 *   atomic           {boolean}   all-or-nothing mode. default: false
 *   altText          {string}    custom alt text for all files (default: filename)
 *   waitForReady     {boolean}   poll until fileStatus === READY and url is confirmed.
 *                                default: true  — upload returns only after url is available.
 *                                false = fire-and-forget, url may be null on return.
 *   pollMaxAttempts      {number}  max poll iterations when waitForReady: true. default: 20
 *   pollIntervalMs       {number}  ms between poll attempts. default: 800
 *   pollInitialDelayMs   {number}  ms to wait before first poll. default: 500
 *                                  (small images are usually READY within 500-1500ms total)
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * QUICK EXAMPLES
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * ① Single image — shopifyUploadFile:
 *
 *    import { shopifyUploadFile } from "~/utils/shopifyFileUpload.server";
 *    const { admin } = await authenticate.admin(request);
 *    const formData = await request.formData();
 *
 *    // waitForReady: true (default) — polls until READY, url is always a real CDN URL
 *    const result = await shopifyUploadFile(admin, formData.get("avatar"), {
 *        allowedTypes: ["image/jpeg", "image/png", "image/webp"],
 *        maxSize: 2 * 1024 * 1024,
 *        // waitForReady: true,       ← default, no need to set explicitly
 *        // pollMaxAttempts: 15,      ← optional, default 15 (~22s max wait)
 *        // pollIntervalMs:  1500,    ← optional, default 1500ms
 *    });
 *    if (!result.ok) return Response.json({ error: result.error.message }, { status: 422 });
 *    return Response.json({ url: result.file.url });
 *    // result.file.url        → "https://cdn.shopify.com/s/files/..." (confirmed READY)
 *    // result.file.fileStatus → "READY"
 *    // result.file.id         → "gid://shopify/MediaImage/..."
 *
 *    // waitForReady: false — returns immediately, url may be null
 *    const result2 = await shopifyUploadFile(admin, formData.get("avatar"), {
 *        allowedTypes: ["image/"],
 *        waitForReady: false,         // ← fire-and-forget
 *    });
 *    // result2.file.fileStatus → "UPLOADED" | "PROCESSING" (not yet ready)
 *    // result2.file.url        → null  (Shopify still processing)
 *
 * ② Multiple images — shopifyUploadFiles:
 *
 *    import { shopifyUploadFiles } from "~/utils/shopifyFileUpload.server";
 *    const result = await shopifyUploadFiles(admin, formData.getAll("gallery"), {
 *        allowedTypes: ["image/"],
 *        maxFiles: 10,
 *        maxSize: 5 * 1024 * 1024,
 *    });
 *    if (!result.ok) return Response.json({ errors: result.errors }, { status: 400 });
 *    return Response.json({ files: result.files });
 *
 * ③ Video upload:
 *
 *    const result = await shopifyUploadFile(admin, formData.get("video"), {
 *        allowedTypes: ["video/mp4", "video/webm", "video/quicktime"],
 *        maxSize: 500 * 1024 * 1024,
 *    });
 *    if (!result.ok) return Response.json({ error: result.error.message }, { status: 422 });
 *    return Response.json({ url: result.file.url });
 *
 * ④ Multiple fields — shopifyUploadMultipleFields:
 *
 *    import { shopifyUploadMultipleFields } from "~/utils/shopifyFileUpload.server";
 *    const result = await shopifyUploadMultipleFields(admin, {
 *        thumbnail: { files: [formData.get("thumbnail")], options: { allowedTypes: ["image/"], maxSize: 2 * 1024 * 1024 } },
 *        gallery:   { files: formData.getAll("gallery"),  options: { allowedTypes: ["image/"], maxFiles: 8 } },
 *        video:     { files: [formData.get("video")],     options: { allowedTypes: ["video/"], maxSize: 200 * 1024 * 1024 } },
 *        brochure:  { files: [formData.get("brochure")],  options: { allowedTypes: ["application/pdf"], maxFiles: 1 } },
 *    });
 *    // একটা field-এ error হলেও বাকি fields-এর upload চলতে থাকে
 *    if (!result.ok) return Response.json({ errors: result.errors }, { status: 422 });
 *    return Response.json({ files: result.files });
 *    // result.files[n].field → কোন field থেকে এসেছে
 *
 * ⑤ One-liner single — shopifyUploadFromRequest (maxFiles: 1):
 *
 *    import { shopifyUploadFromRequest } from "~/utils/shopifyFileUpload.server";
 *    const result = await shopifyUploadFromRequest(admin, request, "avatar", {
 *        maxFiles: 1,
 *        allowedTypes: ["image/"],
 *        maxSize: 2 * 1024 * 1024,
 *    });
 *    if (!result.ok) return Response.json({ error: result.error.message }, { status: 422 });
 *    return Response.json({ url: result.file.url });
 *    // maxFiles: 1 → result.file / result.error shortcut available
 *
 * ⑥ One-liner multiple — shopifyUploadFromRequest (maxFiles > 1):
 *
 *    const result = await shopifyUploadFromRequest(admin, request, "gallery", {
 *        maxFiles: 8,
 *        allowedTypes: ["image/"],
 *    });
 *    if (!result.ok) return Response.json({ errors: result.errors }, { status: 422 });
 *    return Response.json({ files: result.files });
 *    // maxFiles > 1 → result.files / result.errors (array form)
 *
 * ⑦ Atomic upload — all-or-nothing:
 *
 *    const result = await shopifyUploadFiles(admin, formData.getAll("images"), {
 *        atomic: true,
 *        allowedTypes: ["image/"],
 *        maxFiles: 5,
 *        maxSize: 2 * 1024 * 1024,
 *    });
 *    if (!result.ok) return Response.json({ errors: result.errors }, { status: 422 });
 *
 * ⑧ Poll until READY — shopifyPollFileStatus:
 *
 *    import { shopifyUploadFile, shopifyPollFileStatus } from "~/utils/shopifyFileUpload.server";
 *    const upload = await shopifyUploadFile(admin, formData.get("image"), { allowedTypes: ["image/"] });
 *    if (!upload.ok) return Response.json({ error: upload.error.message }, { status: 422 });
 *
 *    const poll = await shopifyPollFileStatus(admin, upload.file.id);
 *    if (!poll.ok) return Response.json({ error: "File processing failed." }, { status: 500 });
 *    return Response.json({ url: poll.url });
 *    // poll.url → confirmed ready CDN URL
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Default per-file size cap: 20 MB */
const DEFAULT_MAX_SIZE = 20 * 1024 * 1024;

/** Default total batch size cap: 100 MB */
const DEFAULT_MAX_TOTAL_SIZE = 100 * 1024 * 1024;

/** Default max files per call */
const DEFAULT_MAX_FILES = 10;

/**
 * MIME prefix → Shopify stagedUploadsCreate resource type
 * Ref: https://shopify.dev/docs/api/admin-graphql/latest/enums/StagedUploadTargetGenerateUploadResource
 *
 * @type {Array<[string, string]>}  ordered — more specific entries first
 */
const RESOURCE_TYPE_RULES = [
    ["model/gltf-binary", "MODEL_3D"],
    ["model/gltf+json", "MODEL_3D"],
    ["model/", "MODEL_3D"],
    ["video/", "VIDEO"],
    ["image/", "IMAGE"],
];

/**
 * MIME prefix → Shopify fileCreate contentType
 * IMAGE | VIDEO | FILE  (GenericFile for everything else)
 */
const CONTENT_TYPE_RULES = [
    ["model/", "FILE"],   // 3D models → GenericFile in fileCreate
    ["video/", "VIDEO"],
    ["image/", "IMAGE"],
];

// ─────────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Machine-readable error codes returned in every UploadError.
 * Import and switch on these in your action to give tailored UI feedback.
 *
 * @example
 * import { SHOPIFY_UPLOAD_ERROR_CODES as EC } from "~/utils/shopifyFileUpload.server";
 * if (result.errors[0]?.code === EC.FILE_TOO_LARGE) { ... }
 */
export const SHOPIFY_UPLOAD_ERROR_CODES = Object.freeze({
    /** formData.get() returned a string or null instead of a File */
    INVALID_INPUT: "INVALID_INPUT",
    /** File size === 0 */
    EMPTY_FILE: "EMPTY_FILE",
    /** File exceeds maxSize */
    FILE_TOO_LARGE: "FILE_TOO_LARGE",
    /** Total batch exceeds maxTotalSize */
    BATCH_TOO_LARGE: "BATCH_TOO_LARGE",
    /** Number of files exceeds maxFiles */
    TOO_MANY_FILES: "TOO_MANY_FILES",
    /** MIME type not in allowedTypes whitelist */
    INVALID_TYPE: "INVALID_TYPE",
    /** File extension not in allowedExtensions whitelist */
    INVALID_EXTENSION: "INVALID_EXTENSION",
    /** atomic:true — batch rejected because at least one file failed validation */
    ATOMIC_BATCH_REJECTED: "ATOMIC_BATCH_REJECTED",
    /** stagedUploadsCreate GraphQL mutation returned userErrors or empty targets */
    SHOPIFY_STAGE_ERROR: "SHOPIFY_STAGE_ERROR",
    /** fetch() to S3 pre-signed URL failed (network error or non-2xx status) */
    S3_UPLOAD_ERROR: "S3_UPLOAD_ERROR",
    /** fileCreate GraphQL mutation returned userErrors */
    SHOPIFY_REGISTER_ERROR: "SHOPIFY_REGISTER_ERROR",
    /** shopifyPollFileStatus: file never reached READY within max attempts */
    POLL_TIMEOUT: "POLL_TIMEOUT",
    /** shopifyPollFileStatus: Shopify reported fileStatus === FAILED */
    POLL_FAILED: "POLL_FAILED",
});

// ─────────────────────────────────────────────────────────────────────────────
// GRAPHQL MUTATIONS & QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/** Step 1 — get pre-signed S3 upload URL(s) from Shopify */
const STAGED_UPLOADS_CREATE_MUTATION = `#graphql
    # API: 2026-04 | Scope: write_files
    # https://shopify.dev/docs/api/admin-graphql/latest/mutations/stageduploadscreate
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
            stagedTargets {
                url
                resourceUrl
                parameters {
                    name
                    value
                }
            }
            userErrors {
                field
                message
            }
        }
    }
`;

/** Step 3 — register the file in Shopify Files and get permanent CDN URL */
const FILE_CREATE_MUTATION = `#graphql
    # API: 2026-04 | Scope: write_files
    # https://shopify.dev/docs/api/admin-graphql/latest/mutations/fileCreate
    # ⚠️  Files are processed ASYNC. Poll fileStatus until READY before use.
    mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
            files {
                id
                fileStatus
                createdAt
                alt
                ... on MediaImage {
                    id
                    fileStatus
                    image {
                        url
                        width
                        height
                        altText
                    }
                }
                ... on Video {
                    id
                    fileStatus
                    sources {
                        url
                        mimeType
                        format
                        height
                        width
                    }
                }
                ... on GenericFile {
                    id
                    fileStatus
                    url
                    mimeType
                    originalFileSize
                }
            }
            userErrors {
                field
                message
                code
            }
        }
    }
`;

/** Used by shopifyPollFileStatus — query a single file's current status + url */
const FILE_STATUS_QUERY = `#graphql
    # API: 2026-04 | Scope: read_files (or write_files)
    query fileStatus($id: ID!) {
        node(id: $id) {
            ... on MediaImage {
                id
                fileStatus
                image { url }
            }
            ... on Video {
                id
                fileStatus
                sources { url }
            }
            ... on GenericFile {
                id
                fileStatus
                url
            }
        }
    }
`;

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MIME type → Shopify stagedUploadsCreate resource enum string.
 * @param {string} mimeType
 * @returns {string}
 */
function resolveResourceType(mimeType) {
    for (const [prefix, type] of RESOURCE_TYPE_RULES) {
        if (mimeType === prefix || mimeType.startsWith(prefix)) return type;
    }
    return "FILE";
}

/**
 * MIME type → Shopify fileCreate contentType enum string.
 * @param {string} mimeType
 * @returns {string}
 */
function resolveContentType(mimeType) {
    for (const [prefix, type] of CONTENT_TYPE_RULES) {
        if (mimeType === prefix || mimeType.startsWith(prefix)) return type;
    }
    return "FILE";
}

/**
 * MIME type → S3 HTTP method.
 *
 * Despite common misconceptions, Shopify uses multipart POST for ALL file types
 * (image, video, 3D model, PDF). The stagedUploadsCreate response always includes
 * `parameters` (GoogleAccessId, key, policy, signature, etc.) that must be sent
 * as form fields — this is the Google Cloud Storage signed-POST flow.
 *
 * Using PUT causes MissingSecurityHeader(Authorization) because PUT expects
 * AWS-style pre-signed URL headers that Shopify doesn't provide for GCS.
 *
 * Ref: https://shopify.dev/docs/api/admin-graphql/latest/mutations/stageduploadscreate
 *
 * @param {string} mimeType
 * @returns {"POST"}
 */
function resolveHttpMethod(_mimeType) {
    return "POST";
}

/**
 * Validates a single File against UploadOptions.
 * Returns an array of UploadError objects (empty = valid).
 *
 * @param {File}   file
 * @param {object} options
 * @returns {object[]}
 */
function validateFile(file, options) {
    const errors = [];

    if (file.size === 0) {
        errors.push({ file: file.name, message: "File is empty (0 bytes).", code: SHOPIFY_UPLOAD_ERROR_CODES.EMPTY_FILE });
        return errors; // no point checking further
    }

    const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    if (file.size > maxSize) {
        errors.push({
            file: file.name,
            message: `"${file.name}" is ${formatBytes(file.size)} — exceeds the ${formatBytes(maxSize)} limit.`,
            code: SHOPIFY_UPLOAD_ERROR_CODES.FILE_TOO_LARGE,
        });
    }

    const allowedTypes = options.allowedTypes ?? [];
    if (allowedTypes.length > 0) {
        const allowed = allowedTypes.some((rule) =>
            rule.endsWith("/") ? file.type.startsWith(rule) : file.type === rule
        );
        if (!allowed) {
            errors.push({
                file: file.name,
                message: `File type "${file.type}" is not allowed. Accepted: ${allowedTypes.join(", ")}.`,
                code: SHOPIFY_UPLOAD_ERROR_CODES.INVALID_TYPE,
            });
        }
    }

    const allowedExtensions = options.allowedExtensions ?? [];
    if (allowedExtensions.length > 0) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        if (!allowedExtensions.map((e) => e.toLowerCase()).includes(ext)) {
            errors.push({
                file: file.name,
                message: `Extension ".${ext}" is not allowed. Accepted: ${allowedExtensions.map((e) => `.${e}`).join(", ")}.`,
                code: SHOPIFY_UPLOAD_ERROR_CODES.INVALID_EXTENSION,
            });
        }
    }

    return errors;
}

/**
 * Strips empty strings and non-File values (e.g. unset file inputs return "").
 * @param {any[]} files
 * @returns {File[]}
 */
function normaliseFiles(files) {
    return (files ?? []).filter((f) => f instanceof File);
}

/**
 * Human-readable byte string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/**
 * Step 1: Call stagedUploadsCreate to get pre-signed S3 targets.
 *
 * @param {object} admin  Shopify admin GraphQL client
 * @param {File[]} files
 * @returns {Promise<{ targets: object[], userErrors: object[] }>}
 */
async function getStagedTargets(admin, files) {
    const input = files.map((file) => ({
        filename: file.name,
        mimeType: file.type,
        resource: resolveResourceType(file.type),
        fileSize: String(file.size),
        httpMethod: "POST",   // GCS signed-POST — applies to ALL resource types
    }));

    const response = await admin.graphql(STAGED_UPLOADS_CREATE_MUTATION, { variables: { input } });
    const json = await response.json();

    return {
        targets: json.data?.stagedUploadsCreate?.stagedTargets ?? [],
        userErrors: json.data?.stagedUploadsCreate?.userErrors ?? [],
    };
}

/**
 * Step 2: Upload a file directly to the S3 pre-signed URL.
 *
 *   Image/PDF/generic → multipart POST
 *     Shopify's `parameters` MUST come before the "file" field in the FormData.
 *   Video/3D model    → binary PUT with Content-Type header
 *
 * @param {File}   file
 * @param {object} target   Single stagedTarget from getStagedTargets
 * @returns {Promise<{ ok: boolean; error?: string }>}
 */
async function uploadToS3(file, target) {
    // Shopify uses Google Cloud Storage signed-POST for ALL file types
    // (image, video, 3D model, PDF, etc.).
    // The `parameters` from stagedUploadsCreate (GoogleAccessId, key, policy,
    // signature, x-goog-date, etc.) MUST be appended as form fields BEFORE the
    // file — GCS rejects requests where the file field comes before the auth fields.
    try {
        const fd = new FormData();
        for (const { name, value } of target.parameters) {
            fd.append(name, value);
        }
        fd.append("file", file);

        const res = await fetch(target.url, { method: "POST", body: fd });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            return { ok: false, error: `S3 upload failed (HTTP ${res.status}): ${text.slice(0, 300)}` };
        }

        return { ok: true };
    } catch (err) {
        return { ok: false, error: `Network error during S3 upload: ${err.message}` };
    }
}

/**
 * Step 3: Call fileCreate to register uploaded files in Shopify Files
 * and receive permanent CDN URLs + Shopify GIDs.
 *
 * @param {object}   admin
 * @param {object[]} targets   Staged targets (resourceUrl used as originalSource)
 * @param {File[]}   files     Original File objects (for alt text + metadata)
 * @param {object}   [options]
 * @returns {Promise<{ registeredFiles: object[], userErrors: object[] }>}
 */
async function registerFilesInShopify(admin, targets, files, options = {}) {
    const fileInputs = targets.map((target, i) => ({
        originalSource: target.resourceUrl,
        contentType: resolveContentType(files[i]?.type ?? ""),
        alt: options.altText ?? files[i]?.name ?? "",
    }));

    const response = await admin.graphql(FILE_CREATE_MUTATION, { variables: { files: fileInputs } });
    const json = await response.json();

    const rawFiles = json.data?.fileCreate?.files ?? [];
    const userErrors = json.data?.fileCreate?.userErrors ?? [];

    // Normalise CDN URL across all Shopify file union types
    const registeredFiles = rawFiles.map((f, i) => {
        const url =
            f.image?.url ??      // MediaImage
            f.sources?.[0]?.url ??      // Video (first source)
            f.url ??      // GenericFile
            null;

        return {
            id: f.id,
            fileStatus: f.fileStatus ?? "PROCESSING",  // UPLOADED|PROCESSING|READY|FAILED
            url,
            alt: f.alt ?? f.image?.altText ?? "",
            name: files[i]?.name ?? "",
            type: files[i]?.type ?? f.mimeType ?? "",
            size: files[i]?.size ?? f.originalFileSize ?? 0,
            width: f.image?.width ?? f.sources?.[0]?.width ?? null,
            height: f.image?.height ?? f.sources?.[0]?.height ?? null,
            createdAt: f.createdAt ?? null,
        };
    });

    return { registeredFiles, userErrors };
}

/**
 * Full 3-step pipeline for a single validated file.
 * validate → staged target → S3 upload → Shopify register
 *
 * @param {object}  admin
 * @param {File}    file
 * @param {object}  options
 * @returns {Promise<{ saved: object }|{ error: object }>}
 */
async function runPipeline(admin, file, options) {

    const { targets, userErrors: stageErrors } = await getStagedTargets(admin, [file]);

    if (stageErrors.length > 0 || targets.length === 0) {
        return { error: { file: file.name, message: stageErrors[0]?.message ?? "Failed to get staged upload URL from Shopify.", code: SHOPIFY_UPLOAD_ERROR_CODES.SHOPIFY_STAGE_ERROR } };
    }

    const s3 = await uploadToS3(file, targets[0]);
    if (!s3.ok) {
        return { error: { file: file.name, message: s3.error, code: SHOPIFY_UPLOAD_ERROR_CODES.S3_UPLOAD_ERROR } };
    }

    const { registeredFiles, userErrors: regErrors } = await registerFilesInShopify(admin, targets, [file], options);

    if (regErrors.length > 0 || registeredFiles.length === 0) {
        return { error: { file: file.name, message: regErrors[0]?.message ?? "Failed to register file in Shopify.", code: SHOPIFY_UPLOAD_ERROR_CODES.SHOPIFY_REGISTER_ERROR } };
    }

    let saved = registeredFiles[0];

    // ── waitForReady (default: true) ──────────────────────────────────────
    // fileCreate returns immediately with fileStatus "UPLOADED" and url: null.
    // Poll until READY so the caller always gets a usable CDN URL.
    const waitForReady = options.waitForReady !== false; // default true
    if (waitForReady && saved.fileStatus !== "READY") {
        const poll = await shopifyPollFileStatus(admin, saved.id, {
            maxAttempts: options.pollMaxAttempts ?? 20,
            intervalMs: options.pollIntervalMs ?? 800,
            initialDelayMs: options.pollInitialDelayMs ?? 500,
        });
        if (poll.ok) {
            saved = { ...saved, url: poll.url, fileStatus: poll.fileStatus };
        }
        // If poll times out or fails, still return saved with whatever url we have.
        // The caller can check fileStatus !== "READY" to detect this.
    }

    return { saved };
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH-LEVEL GUARDS  (shared across shopifyUploadFiles + shopifyUploadMultipleFields)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates batch-level constraints (file count + total size).
 * Returns an array of UploadError objects — empty means batch is valid.
 *
 * @param {File[]}  fileObjects
 * @param {object}  options
 * @param {string}  [fieldName]  Only used in error messages for multi-field calls
 * @returns {object[]}
 */
function checkBatchGuards(fileObjects, options, fieldName) {
    const label = fieldName ? `in field "${fieldName}"` : "";
    const errors = [];

    const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
    if (fileObjects.length > maxFiles) {
        errors.push({
            file: "",
            message: `Too many files ${label}. Maximum: ${maxFiles}, received: ${fileObjects.length}.`,
            code: SHOPIFY_UPLOAD_ERROR_CODES.TOO_MANY_FILES,
        });
    }

    const maxTotalSize = options.maxTotalSize ?? DEFAULT_MAX_TOTAL_SIZE;
    const batchSize = fileObjects.reduce((s, f) => s + f.size, 0);
    if (batchSize > maxTotalSize) {
        errors.push({
            file: "",
            message: `Batch size ${label} is ${formatBytes(batchSize)} — exceeds the ${formatBytes(maxTotalSize)} limit.`,
            code: SHOPIFY_UPLOAD_ERROR_CODES.BATCH_TOO_LARGE,
        });
    }

    return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — shopifyUploadFile  (single file, result.file / result.error)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uploads exactly one file to the Shopify CDN.
 *
 * Returns `result.file` and `result.error` shortcuts (no need for `[0]`).
 * Also includes `result.files` / `result.errors` arrays for API consistency.
 *
 * @param {object}                  admin    Shopify admin client from authenticate.admin(request)
 * @param {File|FormDataEntryValue} file     formData.get("fieldName")
 * @param {object}                  [options]
 * @param {string[]}  [options.allowedTypes]      MIME whitelist. e.g. ["image/", "image/png"]
 * @param {string[]}  [options.allowedExtensions] Extension whitelist (no dot). e.g. ["jpg","pdf"]
 * @param {number}    [options.maxSize]            Per-file byte limit. default: 20 MB
 * @param {string}    [options.altText]            Custom alt text. default: filename
 * @param {boolean}   [options.waitForReady=true]  Poll until READY and url is confirmed.
 *                                                  false = return immediately (url may be null).
 * @param {number}    [options.pollMaxAttempts=20]       Max poll attempts. default: 20
 * @param {number}    [options.pollIntervalMs=800]        Ms between polls. default: 800ms
 * @param {number}    [options.pollInitialDelayMs=500]   Ms before first poll. default: 500ms
 * @returns {Promise<{
 *   ok:        boolean,
 *   file:      object|undefined,
 *   error:     object|undefined,
 *   files:     object[],
 *   errors:    object[],
 *   meta:      { totalUploaded: number, totalFailed: number, totalBytes: number }
 * }>}
 *
 * @example
 * // Single image
 * const result = await shopifyUploadFile(admin, formData.get("avatar"), {
 *     allowedTypes: ["image/jpeg", "image/png", "image/webp"],
 *     maxSize: 2 * 1024 * 1024,
 * });
 * if (!result.ok) return Response.json({ error: result.error.message }, { status: 422 });
 * return Response.json({ url: result.file.url, id: result.file.id });
 *
 * @example
 * // PDF / document
 * const result = await shopifyUploadFile(admin, formData.get("brochure"), {
 *     allowedTypes: ["application/pdf"],
 *     maxSize: 10 * 1024 * 1024,
 *     altText: "Product brochure",
 * });
 *
 * @example
 * // Video
 * const result = await shopifyUploadFile(admin, formData.get("demo"), {
 *     allowedTypes: ["video/mp4", "video/webm"],
 *     maxSize: 500 * 1024 * 1024,
 * });
 */
export async function shopifyUploadFile(admin, file, options = {}) {
    const fail = (err) => ({
        ok: false, file: undefined, error: err,
        files: [], errors: [err],
        meta: { totalUploaded: 0, totalFailed: 1, totalBytes: 0 },
    });

    // ── Input guard ────────────────────────────────────────────────────────
    if (!(file instanceof File)) {
        return fail({
            file: typeof file === "string" ? file : "(none)",
            message: "No valid file provided. Make sure the form field contains a File.",
            code: SHOPIFY_UPLOAD_ERROR_CODES.INVALID_INPUT,
        });
    }

    // ── Per-file validation ────────────────────────────────────────────────
    const validationErrors = validateFile(file, options);
    if (validationErrors.length > 0) {
        return fail(validationErrors[0]);
    }

    // ── Pipeline ───────────────────────────────────────────────────────────
    const result = await runPipeline(admin, file, options);

    if (result.error) return fail(result.error);

    return {
        ok: true,
        file: result.saved,
        error: undefined,
        files: [result.saved],
        errors: [],
        meta: { totalUploaded: 1, totalFailed: 0, totalBytes: file.size },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — shopifyUploadFiles  (batch, partial or atomic)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uploads multiple files to the Shopify CDN in one call.
 *
 * Performance: staged targets fetched in one batch GraphQL call,
 * then S3 uploads run in parallel.
 *
 * @param {object}                        admin
 * @param {File[]|FormDataEntryValue[]}   files    formData.getAll("fieldName")
 * @param {object}                        [options]
 * @param {string[]}  [options.allowedTypes]
 * @param {string[]}  [options.allowedExtensions]
 * @param {number}    [options.maxSize]             Per-file limit. default: 20 MB
 * @param {number}    [options.maxTotalSize]        Batch limit. default: 100 MB
 * @param {number}    [options.maxFiles]            Max file count. default: 10
 * @param {boolean}   [options.atomic]              All-or-nothing. default: false
 * @param {string}    [options.altText]             Alt text for all files
 * @returns {Promise<{
 *   ok:      boolean,
 *   files:   object[],
 *   errors:  object[],
 *   meta:    { totalUploaded: number, totalFailed: number, totalBytes: number }
 * }>}
 *
 * @example
 * // Gallery — partial save (default)
 * const result = await shopifyUploadFiles(admin, formData.getAll("gallery"), {
 *     allowedTypes: ["image/"],
 *     maxFiles: 10,
 *     maxSize: 5 * 1024 * 1024,
 * });
 * // result.files  → successfully uploaded files
 * // result.errors → failed files (with code + message)
 * if (!result.ok) return Response.json({ errors: result.errors }, { status: 400 });
 * return Response.json({ files: result.files.map(f => ({ url: f.url, id: f.id })) });
 *
 * @example
 * // Variant images — atomic (all or nothing)
 * const result = await shopifyUploadFiles(admin, formData.getAll("variants"), {
 *     atomic: true,
 *     allowedTypes: ["image/"],
 *     maxFiles: 6,
 *     maxSize: 3 * 1024 * 1024,
 * });
 * if (!result.ok) return Response.json({ errors: result.errors }, { status: 422 });
 */
export async function shopifyUploadFiles(admin, files, options = {}) {
    const uploaded = [];
    const errors = [];

    const fileObjects = normaliseFiles(files);

    // ── Empty input guard ──────────────────────────────────────────────────
    if (fileObjects.length === 0) {
        return {
            ok: false, files: [], errors: [{
                file: "", message: "No valid files provided.", code: SHOPIFY_UPLOAD_ERROR_CODES.INVALID_INPUT,
            }],
            meta: { totalUploaded: 0, totalFailed: 0, totalBytes: 0 },
        };
    }

    // ── Batch guards ───────────────────────────────────────────────────────
    const batchErrors = checkBatchGuards(fileObjects, options);
    if (batchErrors.length > 0) {
        return {
            ok: false, files: [], errors: batchErrors,
            meta: { totalUploaded: 0, totalFailed: fileObjects.length, totalBytes: 0 },
        };
    }

    // ── Per-file validation ────────────────────────────────────────────────
    const validationMap = new Map(fileObjects.map((f) => [f, validateFile(f, options)]));

    // ── Atomic gate ────────────────────────────────────────────────────────
    if (options.atomic) {
        const allValidationErrors = [...validationMap.values()].flat();
        if (allValidationErrors.length > 0) {
            return {
                ok: false, files: [],
                errors: [
                    ...allValidationErrors,
                    {
                        file: "",
                        message: `Atomic upload rejected: ${allValidationErrors.length} validation error(s) found. No files were uploaded.`,
                        code: SHOPIFY_UPLOAD_ERROR_CODES.ATOMIC_BATCH_REJECTED,
                    },
                ],
                meta: { totalUploaded: 0, totalFailed: fileObjects.length, totalBytes: 0 },
            };
        }
    }

    // ── Filter valid files (non-atomic path) ──────────────────────────────
    const validFiles = fileObjects.filter((f) => {
        const errs = validationMap.get(f);
        if (errs.length > 0) { errors.push(...errs); return false; }
        return true;
    });

    if (validFiles.length === 0) {
        return { ok: false, files: [], errors, meta: { totalUploaded: 0, totalFailed: fileObjects.length, totalBytes: 0 } };
    }

    // ── Step 1: Get staged targets (one batch GraphQL call) ────────────────
    const { targets, userErrors: stageErrors } = await getStagedTargets(admin, validFiles);

    if (stageErrors.length > 0 || targets.length !== validFiles.length) {
        return {
            ok: false, files: [],
            errors: [{ file: "", message: stageErrors[0]?.message ?? "Failed to get staged upload URLs from Shopify.", code: SHOPIFY_UPLOAD_ERROR_CODES.SHOPIFY_STAGE_ERROR }],
            meta: { totalUploaded: 0, totalFailed: validFiles.length, totalBytes: 0 },
        };
    }

    // ── Step 2: S3 uploads in parallel ────────────────────────────────────
    const s3Results = await Promise.all(validFiles.map((f, i) => uploadToS3(f, targets[i])));

    const successFiles = [];
    const successTargets = [];

    validFiles.forEach((f, i) => {
        if (s3Results[i].ok) {
            successFiles.push(f);
            successTargets.push(targets[i]);
        } else {
            errors.push({ file: f.name, message: s3Results[i].error, code: SHOPIFY_UPLOAD_ERROR_CODES.S3_UPLOAD_ERROR });
        }
    });

    if (successFiles.length === 0) {
        return { ok: false, files: [], errors, meta: { totalUploaded: 0, totalFailed: fileObjects.length, totalBytes: 0 } };
    }

    // ── Step 3: Register in Shopify Files (one batch GraphQL call) ─────────
    const { registeredFiles, userErrors: regErrors } = await registerFilesInShopify(admin, successTargets, successFiles, options);

    if (regErrors.length > 0) {
        errors.push({ file: "", message: regErrors[0]?.message ?? "Failed to register files in Shopify.", code: SHOPIFY_UPLOAD_ERROR_CODES.SHOPIFY_REGISTER_ERROR });
    } else {
        // ── waitForReady (default: true) — poll all registered files in parallel ──
        const waitForReady = options.waitForReady !== false;
        const polledFiles = waitForReady
            ? await Promise.all(registeredFiles.map(async (f) => {
                if (f.fileStatus === "READY") return f;
                const poll = await shopifyPollFileStatus(admin, f.id, {
                    maxAttempts: options.pollMaxAttempts ?? 20,
                    intervalMs: options.pollIntervalMs ?? 800,
                    initialDelayMs: options.pollInitialDelayMs ?? 500,
                });
                return poll.ok ? { ...f, url: poll.url, fileStatus: poll.fileStatus } : f;
            }))
            : registeredFiles;
        uploaded.push(...polledFiles);
    }

    return {
        ok: errors.length === 0,
        files: uploaded,
        errors,
        meta: {
            totalUploaded: uploaded.length,
            totalFailed: errors.length,
            totalBytes: uploaded.reduce((s, f) => s + (f.size ?? 0), 0),
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — shopifyUploadMultipleFields  (group-wise atomic)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uploads files from multiple FormData fields in a single action call.
 *
 * Group-wise atomic behaviour:
 *   • Each field is an independent group.
 *   • ANY error in a field → that field is entirely rejected (nothing uploaded for it).
 *   • Other fields proceed normally — one field's failure doesn't block others.
 *
 * Options merging:
 *   sharedOptions apply to every field.
 *   Each field's options are merged on top and always win on conflict.
 *
 * @param {object}                           admin
 * @param {Record<string, {
 *   files:   File[]|FormDataEntryValue[],
 *   options?: object
 * }>}                                       fieldMap
 * @param {object}                           [sharedOptions]
 * @returns {Promise<{
 *   ok:     boolean,
 *   files:  object[],              each entry includes a `field` property
 *   errors: Record<string, object[]>,   grouped by field name; [] = success
 *   meta:   { totalUploaded, totalFailed, totalBytes }
 * }>}
 *
 * @example
 * const result = await shopifyUploadMultipleFields(admin, {
 *     thumbnail: {
 *         files:   [formData.get("thumbnail")],
 *         options: { allowedTypes: ["image/"], maxFiles: 1, maxSize: 2 * 1024 * 1024 },
 *     },
 *     gallery: {
 *         files:   formData.getAll("gallery"),
 *         options: { allowedTypes: ["image/"], maxFiles: 8, maxSize: 5 * 1024 * 1024 },
 *     },
 *     video: {
 *         files:   [formData.get("video")],
 *         options: { allowedTypes: ["video/"], maxFiles: 1, maxSize: 200 * 1024 * 1024 },
 *     },
 *     brochure: {
 *         files:   [formData.get("brochure")],
 *         options: { allowedTypes: ["application/pdf"], maxFiles: 1 },
 *     },
 * });
 *
 * // result.errors shape:
 * // {
 * //   thumbnail: [],           ← empty = uploaded OK
 * //   gallery:   [{ file: "big.jpg", code: "FILE_TOO_LARGE", ... }],
 * //   video:     [],
 * //   brochure:  [],
 * // }
 *
 * if (!result.ok) return Response.json({ errors: result.errors }, { status: 422 });
 * // group files by field for easy DB storage
 * const byField = Object.fromEntries(
 *     Object.keys(fieldMap).map((key) => [key, result.files.filter((f) => f.field === key)])
 * );
 */
export async function shopifyUploadMultipleFields(admin, fieldMap, sharedOptions = {}) {
    const allUploaded = [];
    const groupedErrors = {};
    let totalFailed = 0;

    for (const [fieldName, fieldConfig] of Object.entries(fieldMap)) {
        // Field-level options win over shared options
        const opts = { ...sharedOptions, ...(fieldConfig.options ?? {}) };
        const fileObjects = normaliseFiles(fieldConfig.files);

        // ── Batch guards + per-file validation (group-wise atomic) ─────────
        const fieldErrors = [
            ...checkBatchGuards(fileObjects, opts, fieldName),
            ...(fileObjects.length > 0 && checkBatchGuards(fileObjects, opts, fieldName).length === 0
                ? fileObjects.flatMap((f) => validateFile(f, opts))
                : []),
        ];

        if (fieldErrors.length > 0) {
            groupedErrors[fieldName] = fieldErrors;
            totalFailed += fileObjects.length;
            continue;
        }

        // Empty field — skip silently
        if (fileObjects.length === 0) {
            groupedErrors[fieldName] = [];
            continue;
        }

        // ── Step 1: Staged targets for this field ──────────────────────────
        const { targets, userErrors: stageErrors } = await getStagedTargets(admin, fileObjects);

        if (stageErrors.length > 0 || targets.length !== fileObjects.length) {
            groupedErrors[fieldName] = [{
                file: "", message: stageErrors[0]?.message ?? "Failed to get staged URLs from Shopify.",
                code: SHOPIFY_UPLOAD_ERROR_CODES.SHOPIFY_STAGE_ERROR,
            }];
            totalFailed += fileObjects.length;
            continue;
        }

        // ── Step 2: S3 parallel uploads ────────────────────────────────────
        const s3Results = await Promise.all(fileObjects.map((f, i) => uploadToS3(f, targets[i])));
        const okFiles = [];
        const okTargets = [];
        const ioErrors = [];

        fileObjects.forEach((f, i) => {
            if (s3Results[i].ok) { okFiles.push(f); okTargets.push(targets[i]); }
            else ioErrors.push({ file: f.name, message: s3Results[i].error, code: SHOPIFY_UPLOAD_ERROR_CODES.S3_UPLOAD_ERROR });
        });

        // ── Step 3: Register in Shopify ────────────────────────────────────
        if (okFiles.length > 0) {
            const { registeredFiles, userErrors: regErrors } = await registerFilesInShopify(admin, okTargets, okFiles, opts);

            if (regErrors.length > 0) {
                ioErrors.push({ file: "", message: regErrors[0]?.message ?? "Failed to register files.", code: SHOPIFY_UPLOAD_ERROR_CODES.SHOPIFY_REGISTER_ERROR });
            } else {
                // ── waitForReady (default: true) per field, parallel ──────────
                const waitForReady = opts.waitForReady !== false;
                const polledFiles = waitForReady
                    ? await Promise.all(registeredFiles.map(async (f) => {
                        if (f.fileStatus === "READY") return f;
                        const poll = await shopifyPollFileStatus(admin, f.id, {
                            maxAttempts: opts.pollMaxAttempts ?? 20,
                            intervalMs: opts.pollIntervalMs ?? 800,
                            initialDelayMs: opts.pollInitialDelayMs ?? 500,
                        });
                        return poll.ok ? { ...f, url: poll.url, fileStatus: poll.fileStatus } : f;
                    }))
                    : registeredFiles;
                polledFiles.forEach((f) => allUploaded.push({ ...f, field: fieldName }));
            }
        }

        groupedErrors[fieldName] = ioErrors;
        totalFailed += ioErrors.length;
    }

    const hasAnyError = Object.values(groupedErrors).some((e) => e.length > 0);

    return {
        ok: !hasAnyError,
        files: allUploaded,
        errors: groupedErrors,
        meta: {
            totalUploaded: allUploaded.length,
            totalFailed,
            totalBytes: allUploaded.reduce((s, f) => s + (f.size ?? 0), 0),
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — shopifyUploadFromRequest  (one-liner wrapper)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One-liner convenience wrapper — parses formData internally, then delegates.
 *
 * Behaviour based on maxFiles option:
 *   maxFiles: 1  →  delegates to shopifyUploadFile
 *                   result.file + result.error shortcuts are available
 *   maxFiles > 1 →  delegates to shopifyUploadFiles
 *                   result.files + result.errors arrays
 *   maxFiles not set → defaults to shopifyUploadFiles (array form)
 *
 * @param {object}   admin
 * @param {Request}  request
 * @param {string}   [field="files"]   FormData field name
 * @param {object}   [options]
 * @param {number}   [options.maxFiles]  Set to 1 for single-file shortcut
 * @returns {Promise<SingleUploadResult|UploadResult>}
 *
 * @example
 * // Single — maxFiles: 1 → result.file / result.error
 * export const action = async ({ request }) => {
 *     const { admin } = await authenticate.admin(request);
 *     const result = await shopifyUploadFromRequest(admin, request, "avatar", {
 *         maxFiles:     1,
 *         allowedTypes: ["image/"],
 *         maxSize:      2 * 1024 * 1024,
 *     });
 *     if (!result.ok) return Response.json({ error: result.error.message }, { status: 422 });
 *     return Response.json({ url: result.file.url });
 * };
 *
 * @example
 * // Multiple — maxFiles > 1 → result.files / result.errors
 * export const action = async ({ request }) => {
 *     const { admin } = await authenticate.admin(request);
 *     const result = await shopifyUploadFromRequest(admin, request, "gallery", {
 *         maxFiles:     8,
 *         allowedTypes: ["image/"],
 *         maxSize:      5 * 1024 * 1024,
 *     });
 *     if (!result.ok) return Response.json({ errors: result.errors }, { status: 422 });
 *     return Response.json({ files: result.files });
 * };
 */
export async function shopifyUploadFromRequest(admin, request, field = "files", options = {}) {
    const formData = await request.formData();

    if (options.maxFiles === 1) {
        // Single-file path → result.file / result.error shortcuts
        return shopifyUploadFile(admin, formData.get(field), options);
    }

    // Multi-file path → result.files / result.errors arrays
    return shopifyUploadFiles(admin, formData.getAll(field), options);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — shopifyPollFileStatus  (production-ready async check)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Polls Shopify until a file reaches READY status or the attempt limit is hit.
 *
 * Background: fileCreate is asynchronous. The CDN URL is returned immediately
 * but the file may still be PROCESSING. For product images or media that must
 * be usable right away, poll until READY.
 *
 * @param {object}  admin         Shopify admin client
 * @param {string}  fileId        Shopify GID e.g. "gid://shopify/MediaImage/123"
 * @param {object}  [options]
 * @param {number}  [options.maxAttempts=10]   Max polling iterations
 * @param {number}  [options.intervalMs=1500]  Delay between attempts (ms)
 * @returns {Promise<{
 *   ok:          boolean,
 *   fileStatus:  string,
 *   url:         string|null,
 *   attempts:    number,
 *   error?:      { message: string, code: string }
 * }>}
 *
 * @example
 * const upload = await shopifyUploadFile(admin, formData.get("image"), { allowedTypes: ["image/"] });
 * if (!upload.ok) return Response.json({ error: upload.error.message }, { status: 422 });
 *
 * // Optionally wait for processing to finish before saving the URL to DB
 * const poll = await shopifyPollFileStatus(admin, upload.file.id, {
 *     maxAttempts: 12,
 *     intervalMs:  2000,
 * });
 * if (!poll.ok) return Response.json({ error: "File processing failed or timed out." }, { status: 500 });
 * return Response.json({ url: poll.url });
 */
export async function shopifyPollFileStatus(admin, fileId, options = {}) {
    const maxAttempts = options.maxAttempts ?? 20;
    const intervalMs = options.intervalMs ?? 800;   // reduced from 1500ms
    const initialDelayMs = options.initialDelayMs ?? 500;   // wait before first check

    // Small initial wait — Shopify typically processes small images in 500-800ms.
    // Querying immediately always returns UPLOADED/PROCESSING and wastes a round-trip.
    if (initialDelayMs > 0) {
        await new Promise((r) => setTimeout(r, initialDelayMs));
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const response = await admin.graphql(FILE_STATUS_QUERY, { variables: { id: fileId } });
        const json = await response.json();
        const node = json.data?.node;

        if (!node) {
            return {
                ok: false, fileStatus: "UNKNOWN", url: null, attempts: attempt,
                error: { message: `File not found: ${fileId}`, code: SHOPIFY_UPLOAD_ERROR_CODES.POLL_FAILED },
            };
        }

        const status = node.fileStatus;
        const url = node.image?.url ?? node.sources?.[0]?.url ?? node.url ?? null;

        if (status === "READY") {
            return { ok: true, fileStatus: status, url, attempts: attempt };
        }

        if (status === "FAILED") {
            return {
                ok: false, fileStatus: status, url: null, attempts: attempt,
                error: { message: "Shopify reported file processing FAILED.", code: SHOPIFY_UPLOAD_ERROR_CODES.POLL_FAILED },
            };
        }

        // UPLOADED or PROCESSING — wait and retry
        if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, intervalMs));
        }
    }

    const totalMs = initialDelayMs + (maxAttempts * intervalMs);
    return {
        ok: false, fileStatus: "PROCESSING", url: null, attempts: maxAttempts,
        error: {
            message: `File did not reach READY status after ${maxAttempts} attempts (~${(totalMs / 1000).toFixed(1)}s total).`,
            code: SHOPIFY_UPLOAD_ERROR_CODES.POLL_TIMEOUT,
        },
    };
}