// =============================================================================
// modules/module-preact/App.jsx
// Root component — sob state ekhane. Purono widget.js + html.js + store.js +
// bus.js + notifications.js + click-router.js (claim/prize-detail part)-er
// shared replacement.
// =============================================================================

import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { icon } from './icons.js';
import { formatNumber } from './utils.js';
import { LauncherButton } from './components/LauncherButton.jsx';
import { WidgetShell } from './components/WidgetShell.jsx';
import { GuestPanel } from './components/GuestPanel.jsx';
import { NotificationModal } from './components/NotificationModal.jsx';
import { ImagePreviewOverlay } from './components/ImagePreviewOverlay.jsx';
import { ReferralModal } from './components/ReferralModal.jsx';
import { ToastStack } from './components/ToastStack.jsx';
import { useReferralModal } from './hooks/useReferralModal.js';
import { useCustomerProvision } from './hooks/useCustomerProvision.js';
import { useApplyTheme } from './hooks/useApplyTheme.js';
import { useToastNotifications } from './hooks/useToastNotifications.js';
import { HomeTab } from './tabs/HomeTab.jsx';
import { EarnTab } from './tabs/EarnTab.jsx';
import { RewardsTab } from './tabs/RewardsTab.jsx';
import { PrizesTab } from './tabs/PrizesTab.jsx';
import { ReferralTab } from './tabs/ReferralTab.jsx';
import { ActivitiesTab, ActiveRewardsTab } from './tabs/ActivitiesTab.jsx';
import { MyPrizesTab } from './tabs/MyPrizesTab.jsx';
import { requestRewardVoucher, requestClaimPrize } from './api.js';

function TabPanel({ tabKey, activeTab, children }) {
    return (
        <div class={`nbl-tab-panel${activeTab === tabKey ? ' active' : ''}`} data-tab={tabKey}>
            {activeTab === tabKey ? children : null}
        </div>
    );
}

function fmtDate(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
        return '';
    }
}

export function App({ initialData, bridgeRef, hostEl }) {
    console.log('[NBL] App() component function called. initialData present:', !!initialData);
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('home');
    const [points, setPoints] = useState(Number(initialData.points) || 0);

    // ── Data state — purono appConfig/customer.config-er jaiga ───────────────
    const [rewardRules] = useState(initialData.rewardRules || []);
    const [physicalPrizes] = useState(initialData.physicalPrizes || []);
    const [pointRules] = useState(initialData.pointRules || []);
    const [customerRewards, setCustomerRewards] = useState(initialData.customerRewards || []);
    const [prizeClaims, setPrizeClaims] = useState(initialData.prizeClaims || []);
    const [transactions, setTransactions] = useState(initialData.transactions || []);

    // ── Notification (reward panel / info panel) state ───────────────────────
    const [notification, setNotification] = useState(null);
    const [claimState, setClaimState] = useState('idle');
    const [claimErrorMsg, setClaimErrorMsg] = useState('');

    // ── Image preview (full-size view from any viewable Image) state ─────────
    const [previewImage, setPreviewImage] = useState(null);

    const isLoggedIn = !!initialData.isLoggedIn;
    const customerName = initialData.customerName || '';
    // useState (not const) — the preview bridge needs to update these live as
    // the merchant tweaks position/icon in the dashboard, before saving.
    // Production never calls the bridge (bridgeRef is undefined there), so
    // these just keep their initial value for the lifetime of the page,
    // exactly as before.
    const [position, setPosition] = useState(initialData.buttonPosition === 'right' ? 'right' : 'left');
    const [launcherIconName, setLauncherIconName] = useState(initialData.launcherIconName || '');
    const appConfig = initialData.appConfig || {};
    const customer = initialData.customer || null;
    // widgetConfig state-e rakha hoycе — bridge setWidgetConfig() call korle
    // re-render trigger hobe, label/show*Section/perPage sob live update pabe.
    const [widgetConfig, setWidgetConfig] = useState(initialData.widgetConfig || {});
    const prizeConfig = widgetConfig.prize || {};
    const currencySymbol = (appConfig.shop && appConfig.shop.currencySymbol) || '$';
    const referralLink = initialData.referralLink || '';
    const loginUrl = initialData.loginUrl || '/account/login';
    const signupUrl = initialData.signupUrl || '/account/register';
    const paginationMode = widgetConfig.paginationMode === 'pagination' ? 'pagination' : 'loadmore';

    // lbl() — widgetConfig.labels theke key lookup kore.
    // Prop hisebe pass kora lbl() ta window.NBL_v1 direct read korto — state
    // change-e re-derive hoto na. Ekhon widgetConfig state theke derive kori.
    function lbl(key) {
        var labels = widgetConfig && widgetConfig.labels;
        return (labels && labels[key]) || '';
    }

    const { provisioning, provisionNeeded, inFlight } = useCustomerProvision({ isLoggedIn, customer, appConfig });
    const refModal = useReferralModal({ isLoggedIn, customer, appConfig, provisioning: inFlight, provisionNeeded });
    useApplyTheme(initialData.cssVars, hostEl);

    // ── Toast notifications (unseen transactions from since the customer's
    //    last visit) — derived client-side from `transactions` (already on
    //    the page via the customer metafield), hidden while widget is open.
    //    See hooks/useToastNotifications.js for why this isn't a fetch().
    const proxyPath = initialData.proxyPath || '/apps/widget';
    const {
        toasts,
        moreCount: toastsMoreCount,
        dismissToast,
        expandToasts,
        clearAll: clearToasts,
    } = useToastNotifications({
        isLoggedIn,
        enabled: widgetConfig.enableToastNotifications,
        transactions,
        customerId: customer && customer.id,
        proxyPath,
        isPreview: !!bridgeRef,
    });

    // ── Bridge injection — preview only, production-e bridgeRef undefined ─────
    // App mount-er pore window.NBL_v1.__bridge-e imperative API inject kori.
    // preview-bridge.js whenBridgeReady() polling diye wait kore, then call kore.
    useEffect(function () {
        if (!bridgeRef) return;

        // Scene switch: launcher(close) / home / earn→points / rewards /
        //               prizes / referral / activities / modal / notification-*
        bridgeRef.setScene = function (scene) {
            if (scene === 'launcher') {
                setIsOpen(false);
                setActiveTab('home');
                return;
            }
            if (scene === 'modal') {
                refModal.openModal();
                return;
            }
            if (scene === 'notification-reward') {
                openReward('PREVIEW15OFF');
                return;
            }
            if (scene === 'notification-info') {
                openInfo({ rewardRuleId: 1, title: 'Preview Reward' });
                return;
            }
            // Customize panel-er scene name → data-tab value map
            var TAB_MAP = {
                home: 'home',
                earn: 'points',
                rewards: 'rewards',
                prizes: 'prizes',
                referral: 'referral',
                activities: 'activities',
            };
            setIsOpen(true);
            setActiveTab(TAB_MAP[scene] || 'home');
        };

        // CSS vars live update — dashboard customize panel color/position changes
        bridgeRef.setCssVars = function (vars) {
            if (!vars || typeof vars !== 'object') return;
            // document.documentElement age global page-e set hoto — eta
            // shadow host-e set kora dorkar, nahole widget-er theme var
            // bahirer page-e leak kore jabe.
            var root = hostEl || document.documentElement;
            Object.keys(vars).forEach(function (k) {
                if (k.indexOf('--') === 0) root.style.setProperty(k, vars[k]);
            });
            // launcher position — '--nbl-launcher-position' isn't a real CSS
            // custom property (nothing in ui.css reads it), it's a plain
            // config value riding on the cssVars payload for convenience.
            // Drive it through state so both LauncherButton and WidgetShell
            // re-render with the new pos-left/pos-right class — a direct
            // classList hack here would get silently overwritten on the
            // next unrelated re-render (e.g. a points update).
            var pos = (vars['--nbl-launcher-position'] || '').toLowerCase();
            if (pos === 'left' || pos === 'right') {
                setPosition(pos);
            }
            // launcher icon — same story: '--nbl-launcher-icon' only ever
            // existed as a config value (quoted, e.g. "'gift'"), never a CSS
            // property. Previously this was written to :root via
            // setProperty above and nothing consumed it, so picking a new
            // icon in the dashboard never showed up here. Route it into
            // state instead so LauncherButton re-renders with the new icon.
            if (typeof vars['--nbl-launcher-icon'] === 'string') {
                setLauncherIconName(vars['--nbl-launcher-icon'].replace(/^'|'$/g, ''));
            }
        };

        // widgetConfig update — labels, show*Section flags, perPage etc.
        // setWidgetConfig() → Preact re-render, lbl() automatically nতুন labels pabe.
        bridgeRef.setWidgetConfig = function (cfg) {
            if (!cfg) return;
            setWidgetConfig(cfg);
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // ── End bridge injection ──────────────────────────────────────────────────

    function closeWidget() {
        setIsOpen(false);
        setActiveTab('home');
    }
    function toggleWidget() {
        setIsOpen((prev) => {
            const next = !prev;
            if (!next) setActiveTab('home');
            if (next && toasts.length) {
                // Clear the toast stack immediately — previously these only
                // hid while isOpen was true (via ToastStack's `hidden` prop)
                // and reappeared as soon as the widget closed again, since
                // the toast state itself was never cleared.
                clearToasts();
            }
            return next;
        });
    }
    function setActiveNavigation(tabKey) {
        setActiveTab(tabKey || 'home');
    }

    // ── Notification panel control ────────────────────────────────────────────

    function openInfo(payload) {
        setClaimState('idle');
        setClaimErrorMsg('');
        setNotification({ type: 'info', payload });
    }
    function openReward(code) {
        setClaimState('idle');
        setNotification({ type: 'reward', code });
    }
    function closeNotification() {
        if (claimState === 'loading') return;
        setNotification(null);
    }

    // ── Image preview control ─────────────────────────────────────────────────

    function openImagePreview(src, alt) {
        if (!src) return;
        setPreviewImage({ src, alt });
    }
    function closeImagePreview() {
        setPreviewImage(null);
    }

    // ── Prize claim detail dialog — purono click-router.js myPrizeItem block ──

    function openPrizeClaim(claim) {
        const status = claim.status || 'PENDING';
        const prize = physicalPrizes.find((p) => Number(p.id) === Number(claim.physicalPrizeId));
        const title = prize ? prize.title : claim.title || 'Prize';

        const statusMessages = {
            PENDING: `<span class="nbl-notify-info__msg-icon">${icon('clock')}</span>Your request is being reviewed. We'll reach out to you soon to arrange delivery.`,
            FULFILLED: `<span class="nbl-notify-info__msg-icon">${icon('package')}</span>Your prize is on its way! We've dispatched your order and will follow up shortly.`,
            COMPLETED: `<span class="nbl-notify-info__msg-icon">${icon('check-circle')}</span>Your prize has been delivered. Thank you for being a loyal customer!`,
            CANCELLED: `<span class="nbl-notify-info__msg-icon">${icon('x-circle')}</span>This request was cancelled.`,
        };
        const badgeLabels = {
            PENDING: lbl('prizeStatusPending') || 'Pending',
            FULFILLED: lbl('prizeStatusFulfilled') || 'Fulfilled',
            COMPLETED: lbl('prizeStatusCompleted') || 'Completed',
            CANCELLED: lbl('prizeStatusCancelled') || 'Cancelled',
        };

        const detailRows = [];
        if (claim.productValue || (prize && prize.productValue)) {
            detailRows.push({ key: 'Prize value', val: `$${Number(claim.productValue || (prize && prize.productValue)).toLocaleString()}` });
        }
        if (claim.pointsCost) detailRows.push({ key: 'Points spent', val: `${formatNumber(claim.pointsCost)} pts` });
        if (prizeConfig.showRequestDate && claim.createdAt) detailRows.push({ key: 'Requested on', val: fmtDate(claim.createdAt) });
        if (prizeConfig.showFulfilledDate) {
            if (status === 'FULFILLED' && claim.fulfilledAt) detailRows.push({ key: 'Dispatched on', val: fmtDate(claim.fulfilledAt) });
            if (status === 'COMPLETED' && claim.completedAt) detailRows.push({ key: 'Completed on', val: fmtDate(claim.completedAt) });
        }

        let tUrl = '', tText = '', tLabel = 'Track your order';
        if (prizeConfig.showTrackingInfo && claim.trackingInfo && (status === 'FULFILLED' || status === 'COMPLETED')) {
            if (/^https?:\/\//i.test(claim.trackingInfo)) tUrl = claim.trackingInfo;
            else { tText = claim.trackingInfo; tLabel = claim.trackingInfo; }
        }

        let noteStr = '';
        if (prizeConfig.showAdminNote && claim.adminNote) {
            noteStr = (status === 'CANCELLED' ? 'Reason: ' : 'Note: ') + claim.adminNote;
        }

        openInfo({
            title,
            badge: badgeLabels[status] || status,
            badgeType: status.toLowerCase(),
            rows: detailRows,
            msg: statusMessages[status] || statusMessages.PENDING,
            isHtml: true,
            msgClass: status === 'CANCELLED' ? 'cancelled' : '',
            note: noteStr,
            trackingUrl: tUrl,
            trackingLabel: tLabel,
            trackingText: tText,
            contactUrl: (status === 'PENDING' || status === 'CANCELLED') ? (prizeConfig.contactUrl || '') : '',
            contactText: lbl('prizeContactUsText') || 'Contact us',
            claim: false,
        });
    }

    // ── Claim flow — purono notifications.js claimBtn + click-router.js
    //    notify:info:claim:start/success-er replacement ────────────────────────

    async function handleClaim(data) {
        if (!data) return;
        setClaimState('loading');
        setClaimErrorMsg('');

        try {
            if (data.isPrize) {
                const prize = data.prize;
                const response = await requestClaimPrize({ prizeId: prize.id, customer, appConfig });

                const newPoints = Number(response.points);
                if (!isNaN(newPoints)) setPoints(newPoints);

                const createdAt = response.createdAt ? new Date(response.createdAt).toISOString() : new Date().toISOString();
                setPrizeClaims((prev) => [{ id: response.claimId || Date.now(), physicalPrizeId: prize.id, pointsCost: prize.pointsCost, status: 'PENDING', createdAt }, ...prev]);
                setTransactions((prev) => [{ activity: response.activity || 'Prize Claimed', points: -Math.abs(Number(prize.pointsCost) || 0), createdAt }, ...prev]);

                setClaimState('idle');
                openInfo({
                    msg: lbl('prizeClaimSuccessMsg') || "Your request has been submitted! We'll contact you soon to arrange delivery.",
                    isHtml: false,
                    claim: false,
                });
            } else {
                const rule = data.rewardRule;
                const response = await requestRewardVoucher({ rewardRuleId: rule.id, title: data.title, customer, appConfig });

                const newPoints = Number(response.points);
                if (!isNaN(newPoints)) setPoints(newPoints);

                const createdAt = response.createdAt ? new Date(response.createdAt).toISOString() : new Date().toISOString();
                if (response.voucherCode) {
                    setCustomerRewards((prev) => [{ code: response.voucherCode, title: data.title || 'Voucher', status: 'ACTIVE', discountUsed: false, createdAt }, ...prev]);
                }
                setTransactions((prev) => [{ activity: response.activity || 'Reward Redeemed', points: -Math.abs(Number(rule.pointsCost) || 0), createdAt }, ...prev]);

                setClaimState('idle');
                openReward(response.voucherCode);
            }
        } catch (err) {
            setClaimState('error');
            setClaimErrorMsg(err.message || 'Something went wrong. Please try again.');
        }
    }

    console.log('[NBL] App(): about to return JSX');
    return (
        <div id="nbl-loyalty-root">
            <LauncherButton
                isLoggedIn={isLoggedIn}
                points={points}
                position={position}
                launcherIconName={launcherIconName}
                onClick={toggleWidget}
                lbl={lbl}
            />
            <ToastStack
                toasts={toasts}
                moreCount={toastsMoreCount}
                hidden={isOpen}
                position={position}
                onOpenWidget={toggleWidget}
                onDismissToast={dismissToast}
                onExpand={expandToasts}
            />
            <WidgetShell
                isOpen={isOpen}
                isLoggedIn={isLoggedIn}
                customerName={customerName}
                points={points}
                position={position}
                activeTab={activeTab}
                onNavChange={setActiveNavigation}
                onClose={closeWidget}
                lbl={lbl}
                notificationSlot={
                    <NotificationModal
                        notification={notification}
                        claimState={claimState}
                        claimErrorMsg={claimErrorMsg}
                        onClose={closeNotification}
                        onClaim={handleClaim}
                        lbl={lbl}
                    />
                }
                previewSlot={
                    <ImagePreviewOverlay preview={previewImage} onClose={closeImagePreview} />
                }
                provisionSlot={
                    provisioning ? (
                        <div class="nbl-provision-overlay" role="status" aria-live="polite">
                            <span class="nbl-spinner nbl-spinner--provision" />
                        </div>
                    ) : null
                }
            >
                {isLoggedIn ? (
                    <>
                        <TabPanel tabKey="home" activeTab={activeTab}>
                            <HomeTab
                                showRewardsSection={widgetConfig.showHomeRewardsSection !== false}
                                showPrizeRequestsSection={widgetConfig.showHomePrizeRequestsSection !== false}
                                showActivitiesSection={widgetConfig.showHomeActivitiesSection !== false}
                                customerRewards={customerRewards}
                                prizeClaims={prizeClaims}
                                physicalPrizes={physicalPrizes}
                                transactions={transactions}
                                homeRewardsPerPage={widgetConfig.homeRewardsPerPage || 5}
                                homePrizeRequestsPerPage={widgetConfig.homePrizeRequestsPerPage || 5}
                                homeActivitiesPerPage={widgetConfig.homeActivitiesPerPage || 5}
                                paginationMode={paginationMode}
                                onNavigate={setActiveNavigation}
                                onOpenVoucher={openReward}
                                onOpenClaim={openPrizeClaim}
                                onViewImage={openImagePreview}
                                lbl={lbl}
                            />
                        </TabPanel>
                        <TabPanel tabKey="points" activeTab={activeTab}>
                            <EarnTab pointRules={pointRules} currencySymbol={currencySymbol} onOpenInfo={openInfo} />
                        </TabPanel>
                        <TabPanel tabKey="rewards" activeTab={activeTab}>
                            <RewardsTab
                                rewardRules={rewardRules}
                                points={points}
                                customerRewards={customerRewards}
                                perPage={widgetConfig.homeRewardsPerPage || 5}
                                paginationMode={paginationMode}
                                lbl={lbl}
                                onOpenInfo={openInfo}
                                onOpenVoucher={openReward}
                            />
                        </TabPanel>
                        <TabPanel tabKey="prizes" activeTab={activeTab}>
                            <PrizesTab
                                physicalPrizes={physicalPrizes}
                                points={points}
                                prizeClaims={prizeClaims}
                                perPage={widgetConfig.homePrizeRequestsPerPage || 5}
                                paginationMode={paginationMode}
                                lbl={lbl}
                                onOpenInfo={openInfo}
                                onOpenClaim={openPrizeClaim}
                                onViewImage={openImagePreview}
                            />
                        </TabPanel>
                        <TabPanel tabKey="referral" activeTab={activeTab}>
                            <ReferralTab pointRules={pointRules} referralLink={referralLink} currencySymbol={currencySymbol} onOpenInfo={openInfo} />
                        </TabPanel>
                        <TabPanel tabKey="activities" activeTab={activeTab}>
                            {/* Purono activities.js-e eta hardcoded '10' chilo, kono config field na */}
                            <ActivitiesTab transactions={transactions} perPage={10} paginationMode={paginationMode} lbl={lbl} />
                        </TabPanel>
                        <TabPanel tabKey="active-rewards" activeTab={activeTab}>
                            {/* Purono activities.js-e eta hardcoded '8' chilo, kono config field na */}
                            <ActiveRewardsTab customerRewards={customerRewards} perPage={8} paginationMode={paginationMode} lbl={lbl} onOpenVoucher={openReward} />
                        </TabPanel>
                        <TabPanel tabKey="my-prizes" activeTab={activeTab}>
                            <MyPrizesTab
                                prizeClaims={prizeClaims}
                                physicalPrizes={physicalPrizes}
                                perPage={widgetConfig.myPrizesPerPage || 5}
                                paginationMode={paginationMode}
                                lbl={lbl}
                                onOpenClaim={openPrizeClaim}
                                onViewImage={openImagePreview}
                            />
                        </TabPanel>
                    </>
                ) : (
                    <GuestPanel loginUrl={loginUrl} signupUrl={signupUrl} lbl={lbl} />
                )}
            </WidgetShell>

            <ReferralModal refModal={refModal} pointRules={pointRules} currencySymbol={currencySymbol} />
        </div>
    );
}