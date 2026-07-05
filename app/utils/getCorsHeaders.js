// export default function getCorsHeaders(request) {
//     const origin = request.headers.get("origin")?.toLowerCase();
//     if (origin && (origin.endsWith(".myshopify.com") || origin.endsWith(".shopify.com"))) {
//         return {
//             "Access-Control-Allow-Origin": origin,
//             "Access-Control-Allow-Credentials": "true",
//             "Access-Control-Allow-Headers": "Content-Type, Authorization",
//             "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
//             "Content-Type": "application/json",
//             "Vary": "Origin",
//         };
//     }
//     // Default safe headers for unknown origins
//     return { "Content-Type": "application/json" };
// }


export default function getCorsHeaders(request) {
    const origin = request.headers.get("origin")?.toLowerCase();

    const allowedOrigins = [
        "https://www.northborders.co",
        "https://northborders.co", // www chara version, jodi lagey
    ];

    const isShopifyOrigin = origin && (origin.endsWith(".myshopify.com") || origin.endsWith(".shopify.com"));
    const isAllowedCustomOrigin = origin && allowedOrigins.includes(origin);

    if (isShopifyOrigin || isAllowedCustomOrigin) {
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Content-Type": "application/json",
            "Vary": "Origin",
        };
    }

    // Default safe headers for unknown origins
    return { "Content-Type": "application/json" };
}