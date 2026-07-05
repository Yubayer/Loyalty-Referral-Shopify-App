// =============================================================================
// public/widget/preview-bridge.js
// Loaded ONLY inside app/widget-routes/preview.jsx — never in production.
//
// Two jobs:
//   1. Intercept fetch() so api.js calls never hit a real backend.
//   2. Translate postMessage from the customize panel (parent window) into
//      direct calls on window.NBL_v1.__bridge — the imperative API that
//      App.jsx exposes after mounting. (Purono code e bus.emit() use hoto,
//      new Preact widget-e kono bus nei — sob state App-er useState-e.)
// =============================================================================

(function () {
    "use strict";

    // ── 1. Mock fetch() for any /api/* call api.js makes ────────────────────
    var originalFetch = window.fetch;
    window.fetch = function (url, opts) {
        var isApiCall = typeof url === "string" && url.indexOf("/api/") !== -1;
        if (!isApiCall) return originalFetch.call(this, url, opts);

        var mockResponse = { success: true };
        if (url.indexOf("get-reward-voucher") !== -1) {
            mockResponse = { voucherCode: "PREVIEW15OFF" };
        } else if (url.indexOf("claim-prize") !== -1) {
            mockResponse = { success: true, claimId: "preview-claim-1" };
        } else if (url.indexOf("referral") !== -1) {
            mockResponse = {
                success: true,
                referralDiscountCode: "PREVIEW-REF15",
            };
        }

        return Promise.resolve(
            new Response(JSON.stringify(mockResponse), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );
    };

    // ── 2. scene name → bridge method call ───────────────────────────────────
    // New Preact widget-e kono bus nei. App.jsx boot-er pore
    // window.NBL_v1.__bridge object-e imperative functions inject kore.
    // Amra shei functions call kori.
    function whenBridgeReady(fn) {
        if (
            window.NBL_v1 &&
            window.NBL_v1.__bridge &&
            typeof window.NBL_v1.__bridge.setScene === "function"
        ) {
            fn();
            return;
        }
        var tries = 0;
        var poll = setInterval(function () {
            if (
                window.NBL_v1 &&
                window.NBL_v1.__bridge &&
                typeof window.NBL_v1.__bridge.setScene === "function"
            ) {
                clearInterval(poll);
                fn();
            }
            if (++tries > 200) clearInterval(poll); // ~10s timeout
        }, 50);
    }

    // ── 3. postMessage listener — only accept our own protocol ───────────────
    window.addEventListener("message", function (e) {
        var msg = e.data;
        if (!msg || msg.source !== "nbl-customize") return;

        whenBridgeReady(function () {
            var bridge = window.NBL_v1.__bridge;

            if (msg.type === "cssVars") {
                bridge.setCssVars(msg.payload || {});
            }

            if (msg.type === "widgetConfig") {
                bridge.setWidgetConfig(msg.payload || {});
            }

            if (msg.type === "scene") {
                bridge.setScene(msg.payload);
            }
        });
    });

    // ── 4. Tell the parent we're alive ───────────────────────────────────────
    whenBridgeReady(function () {
        // Default: widget open on home tab, same as LivePreview default prop.
        window.NBL_v1.__bridge.setScene("home");
        parent.postMessage({ source: "nbl-preview", type: "ready" }, "*");
    });
})();