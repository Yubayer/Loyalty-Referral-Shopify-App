// =============================================================================
// main.preact.jsx — Entry point for the FULLY Preact NBL Loyalty Widget.
// =============================================================================

import { h, render } from 'preact';
import { App } from './App.jsx';

function onReady(fn) {
    if (window.NBL_v1) { fn(); return; }
    var tries = 0;
    var poll = setInterval(function () {
        if (window.NBL_v1) { clearInterval(poll); fn(); }
        if (++tries > 100) { clearInterval(poll); }
    }, 50);
}

function boot() {
    var loyaltyApp = window.NBL_v1;
    var liquidData = loyaltyApp.liquidData || {};
    var appConfig = loyaltyApp.appConfig || {};
    var customer = loyaltyApp.customer || null;
    var customerConfig = (customer && customer.config) || {};

    var savedCssVars = (appConfig.styles && appConfig.styles.cssVars) || {};
    var widgetConfig = (appConfig.styles && appConfig.styles.widgetConfig) || {};

    var posFromCssVars = (savedCssVars['--nbl-launcher-position'] || '').toLowerCase();
    var posFromLiquid = (liquidData.buttonPosition || '').toLowerCase();
    var buttonPosition = (posFromCssVars === 'left' || posFromCssVars === 'right')
        ? posFromCssVars
        : (posFromLiquid === 'right' ? 'right' : 'left');

    var isLoggedIn = !!(liquidData.isLoggedIn || (customer && customer.id));
    var points = loyaltyApp.points != null
        ? Number(loyaltyApp.points)
        : (customerConfig.points || 0);

    var referralLink = (liquidData.shopUrl || '') + '/?nbl-referral=' + (liquidData.referralCode || '');

    // ── Guest auth links — purono html.js guestBodyHTML()-er loginUrl/signupUrl
    //    derivation-er shathe match kore (shop-er account routes, fallback shadharon path).
    var routes = loyaltyApp.routes || {};
    var loginUrl = routes.login_url || '/account/login';
    var signupUrl = routes.register_url || '/account/register';

    var initialData = {
        isLoggedIn: isLoggedIn,
        customerName: (customer && customer.name) || liquidData.customerName || '',
        points: points,
        buttonPosition: buttonPosition,
        launcherIconName: (savedCssVars['--nbl-launcher-icon'] || '').replace(/^'|'$/g, ''),
        cssVars: savedCssVars,
        appConfig: appConfig,
        customer: customer,
        widgetConfig: widgetConfig,
        referralLink: referralLink,
        loginUrl: loginUrl,
        signupUrl: signupUrl,
        rewardRules: appConfig.rewardRules || [],
        physicalPrizes: appConfig.physicalPrizes || [],
        pointRules: appConfig.pointRules || [],
        customerRewards: customerConfig.rewards || [],
        prizeClaims: customerConfig.prizeClaims || [],
        transactions: customerConfig.transactions || [],
        // App Proxy path — used for the toast-notification fetch/mark-seen
        // calls in addition to anything else that needs a live server call.
        proxyPath: loyaltyApp.proxyPath || '/apps/widget',
    };

    // ── Bridge ref — preview-bridge.js / customize panel-er sathe communicate korbe.
    // App.jsx mount-er pore ekhane setScene/setCssVars/setWidgetConfig inject hobe.
    var bridgeRef = {};
    window.NBL_v1.__bridge = bridgeRef;

    var root = document.createElement('div');
    document.body.appendChild(root);

    try {
        render(<App initialData={initialData} bridgeRef={bridgeRef} />, root);
        console.log('[NBL] boot(): render() returned without throwing. root.innerHTML =', root.innerHTML);
    } catch (err) {
        console.error('[NBL] boot(): render() threw an exception:', err);
    }
}

onReady(boot);