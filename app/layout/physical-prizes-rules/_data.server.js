import { shopifyUploadFile } from "@app/fileUpload.server";

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE UPLOAD
//
// Server-only. Kept in its own *.server.js file because _data.js is also
// imported from client code (_hooks.js) — if the upload helper lived there,
// the `@app/fileUpload.server` import would leak into the browser bundle
// and React Router's Vite plugin would reject it ("Server-only module
// referenced by client").
//
// Returns the uploaded file's URL, or `null` if no real file was provided
// (e.g. the field was left empty, or the value is a leftover string from
// the client — only a File object with a size should ever be uploaded).
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadImageIfPresent(admin, file) {
    if (!file || typeof file === "string" || file.size === 0) return null;

    const result = await shopifyUploadFile(admin, file, {
        allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        maxSize: 5 * 1024 * 1024,
        waitForReady: true,
    });
    if (!result.ok) throw new Error(result.error?.message || "Image upload failed.");
    return result.file.url;
}
