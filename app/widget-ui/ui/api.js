// =============================================================================
// modules/module-preact/api.js
// Promise-based fetch wrappers — purono api.js-er replacement.
// eventBus.emit() na, ekhon shudhu async function jeটা resolve/reject kore —
// caller (App.jsx) .then()/.catch() ba try/catch diye handle kore.
// =============================================================================

export async function requestRewardVoucher({ rewardRuleId, title, customer, appConfig }) {
    if (!rewardRuleId || !customer || !customer.id || !customer.config || !customer.config.id) {
        throw new Error('Missing required data. Please refresh and try again.');
    }

    const res = await fetch(appConfig.appUrl + '/api/get-reward-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            shop: window.Shopify && window.Shopify.shop,
            customerId: customer.id,
            rewardRuleId,
            title,
            customerIndex: customer.config.id,
        }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(40000) : undefined,
    });

    if (!res.ok) throw new Error('Server error: ' + res.status);
    const data = await res.json();
    if (!data || !data.voucherCode) throw new Error('No voucher code returned. Please try again.');
    return data;
}

export async function requestClaimPrize({ prizeId, customer, appConfig }) {
    if (!prizeId || !customer || !customer.id || !customer.config || !customer.config.id) {
        throw new Error('Missing required data. Please refresh and try again.');
    }

    const res = await fetch(appConfig.appUrl + '/api/claim-prize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            shop: window.Shopify && window.Shopify.shop,
            customerId: customer.id,
            customerIndex: customer.config.id,
            prizeId,
        }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(40000) : undefined,
    });

    if (!res.ok) throw new Error('Server error: ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.details || data.error);
    return data;
}
