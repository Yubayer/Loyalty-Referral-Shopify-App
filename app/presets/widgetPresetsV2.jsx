// ─────────────────────────────────────────────────────────────────────────────
// constants.js
// Static configuration, design tokens, CSS defaults and utility functions.
// Imported by app_customize.jsx and LivePreview.jsx
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE MODE CONFIG
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// WIDGET CONFIG — Non-CSS behaviour settings
// Saved as styles.widgetConfig in DB, read by applyWidgetConfigOverrides() in JS.
// ─────────────────────────────────────────────────────────────────────────────

export const LABEL_DEFAULTS = {
    // Header
    headerLabel: "Welcome, [name]",
    pointsLabel: "[points] pts",
    // Nav tabs
    navHome: "Home",
    navEarn: "Earn",
    navRewards: "Rewards",
    navMyRewards: "My Rewards",
    navActivity: "Activity",
    // Home nav cards
    homeCardBrowse: "Browse Rewards",
    homeCardEarn: "Earn Points",
    homeCardRefer: "Refer Friends",
    // Section headers
    sectionActiveRewards: "Active Rewards",
    sectionRecentActivity: "Recent Activity",
    // Activity table columns
    activityColDate: "Date",
    activityColActivity: "Activity",
    activityColPoints: "Points",
    // Empty states
    emptyRewards: "No active rewards available",
    emptyActivity: "No account activities yet",
    // Pagination
    loadMoreBtn: "Load More",
    loadMoreDone: "All loaded",
    // Notification
    notifyRewardHeading: "Success! Use this code at checkout",
    notifyRewardCopyBtn: "Copy",
    notifyInfoClaimBtn: "Claim",
    // Launcher
    launcherTitle: "Loyalty Rewards",
    launcherSubtitle: "[points] pts",
    // Prizes
    navPrizes: "Prizes",
    navMyPrizes: "My Prizes",
    sectionPrizeRequests: "My Prize Requests",
    emptyPrizes: "No prizes available",
    emptyMyPrizes: "You have no prize requests yet",
    prizeStatusPending: "🕐 Pending",
    prizeStatusFulfilled: "📦 Fulfilled",
    prizeStatusCompleted: "✅ Completed",
    prizeStatusCancelled: "❌ Cancelled",
    prizeContactUsText: "Contact us",
    prizeClaimSuccessMsg: "✅ Your request has been submitted! We'll contact you soon to arrange delivery.",
    claimingLabel: "Processing...",
    claimRetryLabel: "Try again",
};

export const WIDGET_CONFIG_DEFAULTS = {
    showHomeRewardsSection: true,
    showHomeActivitiesSection: true,
    showHomePrizeRequestsSection: true,
    homeRewardsPerPage: 5,
    homeActivitiesPerPage: 5,
    homePrizeRequestsPerPage: 5,
    myPrizesPerPage: 5,
    paginationMode: "pagination",
    labels: { ...LABEL_DEFAULTS },
    prize: {
        showImage: true,
        imageFit: "cover",
        imageHeight: 150,
        imagePosition: "center",
        contactUrl: "",
        showAdminNote: true,
        showTrackingInfo: true,
        showRequestDate: true,
        showFulfilledDate: true,
    },
};

export const WIDGET_CONFIG_SECTIONS = [
    {
        key: "behaviour",
        label: "Behaviour",
        icon: "⚙️",
        description: "Control what sections appear and how content is paged.",
        fields: [
            {
                key: "showHomeRewardsSection",
                label: "Show active rewards on Home tab",
                hint: "Display the 'Active Rewards' section on the Home tab",
                type: "toggle",
                configKey: "showHomeRewardsSection",
                default: true,
            },
            {
                key: "showHomeActivitiesSection",
                label: "Show recent activity on Home tab",
                hint: "Display the 'Recent Activity' section on the Home tab",
                type: "toggle",
                configKey: "showHomeActivitiesSection",
                default: true,
            },
            {
                key: "homeRewardsPerPage",
                label: "Active rewards per page",
                hint: "How many active reward items to show at once on the Home tab",
                type: "range",
                min: 1,
                max: 10,
                unit: "",
                configKey: "homeRewardsPerPage",
                default: 5,
                parseValue: (v) => Number(v),
                displayValue: (v) => Number(v),
            },
            {
                key: "homeActivitiesPerPage",
                label: "Activity rows per page",
                hint: "How many activity rows to show at once on the Home tab",
                type: "range",
                min: 1,
                max: 15,
                unit: "",
                configKey: "homeActivitiesPerPage",
                default: 7,
                parseValue: (v) => Number(v),
                displayValue: (v) => Number(v),
            },
            {
                key: "paginationMode",
                label: "Pagination style",
                hint: "How to load more items in lists — arrow buttons or a Load More button",
                type: "select",
                options: [{ value: "pagination", label: "Arrows" }, { value: "loadmore", label: "Load More button" }],
                configKey: "paginationMode",
                default: "pagination",
            },
            {
                key: "showHomePrizeRequestsSection",
                label: "Show prize requests on Home tab",
                hint: "Display the 'My Prize Requests' section on the Home tab",
                type: "toggle",
                configKey: "showHomePrizeRequestsSection",
                default: true,
            },
            {
                key: "homePrizeRequestsPerPage",
                label: "Prize requests per page (Home)",
                hint: "How many prize request items to show at once on the Home tab",
                type: "range",
                min: 1,
                max: 10,
                unit: "",
                configKey: "homePrizeRequestsPerPage",
                default: 5,
                parseValue: (v) => Number(v),
                displayValue: (v) => Number(v),
            },
            {
                key: "myPrizesPerPage",
                label: "Prize requests per page (My Prizes tab)",
                hint: "How many prize request items to show at once on the My Prizes tab",
                type: "range",
                min: 1,
                max: 20,
                unit: "",
                configKey: "myPrizesPerPage",
                default: 8,
                parseValue: (v) => Number(v),
                displayValue: (v) => Number(v),
            },
        ],
    },
    {
        key: "prizeNotifications",
        label: "Prize Notifications",
        icon: "🏆",
        description: "Control how prize request details appear in the slide-up notification panel.",
        fields: [
            {
                key: "prize_contactUrl",
                label: "Contact page URL",
                hint: "URL shown as a 'Contact us' button on Pending and Cancelled prize notifications. Leave empty to hide the button. E.g. /pages/contact",
                type: "text",
                configKey: "prize.contactUrl",
                default: "",
            },
            {
                key: "prize_showImage",
                label: "Show prize image",
                hint: "Display the prize image (or a placeholder icon) at the top of the notification",
                type: "toggle",
                configKey: "prize.showImage",
                default: true,
            },
            {
                key: "prize_imageFit",
                label: "Image fit",
                hint: "How the image fills the banner area — Cover crops to fill, Contain shows the full image, Auto uses natural height",
                type: "select",
                options: [
                    { value: "cover", label: "Cover (crop to fill)" },
                    { value: "contain", label: "Contain (show full image)" },
                    { value: "auto", label: "Auto (natural height)" },
                ],
                configKey: "prize.imageFit",
                default: "cover",
            },
            {
                key: "prize_imageHeight",
                label: "Image banner height",
                hint: "Height of the image area in pixels (ignored when fit is Auto)",
                type: "range",
                min: 80,
                max: 300,
                unit: "px",
                configKey: "prize.imageHeight",
                default: 150,
                parseValue: (v) => Number(v),
                displayValue: (v) => Number(v),
            },
            {
                key: "prize_imagePosition",
                label: "Image focal point",
                hint: "Which part of the image stays visible when cropped",
                type: "select",
                options: [
                    { value: "center", label: "Center" },
                    { value: "top", label: "Top" },
                    { value: "bottom", label: "Bottom" },
                    { value: "left", label: "Left" },
                    { value: "right", label: "Right" },
                ],
                configKey: "prize.imagePosition",
                default: "center",
            },
            {
                key: "prize_showRequestDate",
                label: "Show request date",
                hint: "Display when the prize was requested in the notification",
                type: "toggle",
                configKey: "prize.showRequestDate",
                default: true,
            },
            {
                key: "prize_showFulfilledDate",
                label: "Show dispatch / completion date",
                hint: "Display when the prize was dispatched or completed in the notification",
                type: "toggle",
                configKey: "prize.showFulfilledDate",
                default: true,
            },
            {
                key: "prize_showAdminNote",
                label: "Show admin note",
                hint: "Display the admin note in the notification (e.g. cancellation reason or delivery details)",
                type: "toggle",
                configKey: "prize.showAdminNote",
                default: true,
            },
            {
                key: "prize_showTrackingInfo",
                label: "Show tracking info",
                hint: "Display tracking link or license key in the notification (shown for Fulfilled and Completed prizes)",
                type: "toggle",
                configKey: "prize.showTrackingInfo",
                default: true,
            },
        ],
    },

    {
        key: "labels",
        label: "Labels & Text",
        icon: "✏️",
        description: "Customize all text labels shown inside the widget.",
        fields: [
            { key: "lbl_headerLabel", label: "Header greeting", hint: "Use [name] to insert the customer's name. E.g. 'Welcome, [name]'", type: "label", configKey: "labels.headerLabel", default: LABEL_DEFAULTS.headerLabel },
            { key: "lbl_pointsLabel", label: "Points balance text", hint: "Use [points] to insert the balance. E.g. '[points] pts'", type: "label", configKey: "labels.pointsLabel", default: LABEL_DEFAULTS.pointsLabel },
            { key: "lbl_navHome", label: "Nav — Home tab", hint: "Label shown on the Home navigation tab", type: "label", configKey: "labels.navHome", default: LABEL_DEFAULTS.navHome },
            { key: "lbl_navEarn", label: "Nav — Earn tab", hint: "Label shown on the Earn navigation tab", type: "label", configKey: "labels.navEarn", default: LABEL_DEFAULTS.navEarn },
            { key: "lbl_navRewards", label: "Nav — Rewards tab", hint: "Label shown on the Rewards navigation tab", type: "label", configKey: "labels.navRewards", default: LABEL_DEFAULTS.navRewards },
            { key: "lbl_navMyRewards", label: "Nav — My Rewards tab", hint: "Label shown on the My Rewards navigation tab", type: "label", configKey: "labels.navMyRewards", default: LABEL_DEFAULTS.navMyRewards },
            { key: "lbl_navActivity", label: "Nav — Activity tab", hint: "Label shown on the Activity navigation tab", type: "label", configKey: "labels.navActivity", default: LABEL_DEFAULTS.navActivity },
            { key: "lbl_homeCardBrowse", label: "Home card — Browse Rewards", hint: "Text on the Browse Rewards shortcut card on the Home tab", type: "label", configKey: "labels.homeCardBrowse", default: LABEL_DEFAULTS.homeCardBrowse },
            { key: "lbl_homeCardEarn", label: "Home card — Earn Points", hint: "Text on the Earn Points shortcut card on the Home tab", type: "label", configKey: "labels.homeCardEarn", default: LABEL_DEFAULTS.homeCardEarn },
            { key: "lbl_homeCardRefer", label: "Home card — Refer Friends", hint: "Text on the Refer Friends shortcut card on the Home tab", type: "label", configKey: "labels.homeCardRefer", default: LABEL_DEFAULTS.homeCardRefer },
            { key: "lbl_sectionRewards", label: "Section — Active Rewards", hint: "Heading of the Active Rewards section on the Home tab", type: "label", configKey: "labels.sectionActiveRewards", default: LABEL_DEFAULTS.sectionActiveRewards },
            { key: "lbl_sectionActivity", label: "Section — Recent Activity", hint: "Heading of the Recent Activity section on the Home tab", type: "label", configKey: "labels.sectionRecentActivity", default: LABEL_DEFAULTS.sectionRecentActivity },
            { key: "lbl_activityColDate", label: "Activity table — Date", hint: "Column header for the date column in activity tables", type: "label", configKey: "labels.activityColDate", default: LABEL_DEFAULTS.activityColDate },
            { key: "lbl_activityColAct", label: "Activity table — Activity", hint: "Column header for the activity description column", type: "label", configKey: "labels.activityColActivity", default: LABEL_DEFAULTS.activityColActivity },
            { key: "lbl_activityColPts", label: "Activity table — Points", hint: "Column header for the points column in activity tables", type: "label", configKey: "labels.activityColPoints", default: LABEL_DEFAULTS.activityColPoints },
            { key: "lbl_emptyRewards", label: "Empty state — No rewards", hint: "Message shown when there are no active rewards", type: "label", configKey: "labels.emptyRewards", default: LABEL_DEFAULTS.emptyRewards },
            { key: "lbl_emptyActivity", label: "Empty state — No activity", hint: "Message shown when there are no activity entries yet", type: "label", configKey: "labels.emptyActivity", default: LABEL_DEFAULTS.emptyActivity },
            { key: "lbl_loadMoreBtn", label: "Pagination — Load More", hint: "Text on the Load More button", type: "label", configKey: "labels.loadMoreBtn", default: LABEL_DEFAULTS.loadMoreBtn },
            { key: "lbl_loadMoreDone", label: "Pagination — All loaded", hint: "Text shown when all items have been loaded", type: "label", configKey: "labels.loadMoreDone", default: LABEL_DEFAULTS.loadMoreDone },
            { key: "lbl_notifyRewardHead", label: "Reward popup heading", hint: "Heading text inside the reward earned slide-up panel", type: "label", configKey: "labels.notifyRewardHeading", default: LABEL_DEFAULTS.notifyRewardHeading },
            { key: "lbl_notifyRewardCopy", label: "Reward popup copy button", hint: "Text on the Copy button inside the reward popup", type: "label", configKey: "labels.notifyRewardCopyBtn", default: LABEL_DEFAULTS.notifyRewardCopyBtn },
            { key: "lbl_notifyInfoClaim", label: "Info popup claim button", hint: "Text on the action button inside the info slide-up panel", type: "label", configKey: "labels.notifyInfoClaimBtn", default: LABEL_DEFAULTS.notifyInfoClaimBtn },
            { key: "lbl_launcherTitle", label: "Launcher title", hint: "Main title text on the floating launcher button", type: "label", configKey: "labels.launcherTitle", default: LABEL_DEFAULTS.launcherTitle },
            { key: "lbl_launcherSubtitle", label: "Launcher subtitle", hint: "Text shown below the launcher button title. Use [points] for balance. E.g. '[points] pts'", type: "label", configKey: "labels.launcherSubtitle", default: LABEL_DEFAULTS.launcherSubtitle },
            { key: "lbl_navPrizes", label: "Nav — Prizes tab", hint: "Label shown on the Prizes navigation tab", type: "label", configKey: "labels.navPrizes", default: LABEL_DEFAULTS.navPrizes },
            { key: "lbl_navMyPrizes", label: "Nav — My Prizes tab", hint: "Label shown on the My Prizes navigation tab", type: "label", configKey: "labels.navMyPrizes", default: LABEL_DEFAULTS.navMyPrizes },
            { key: "lbl_sectionPrizeRequests", label: "Section — My Prize Requests", hint: "Heading of the Prize Requests section on the Home tab", type: "label", configKey: "labels.sectionPrizeRequests", default: LABEL_DEFAULTS.sectionPrizeRequests },
            { key: "lbl_emptyPrizes", label: "Empty state — No prizes", hint: "Message shown when there are no prizes available", type: "label", configKey: "labels.emptyPrizes", default: LABEL_DEFAULTS.emptyPrizes },
            { key: "lbl_emptyMyPrizes", label: "Empty state — No prize requests", hint: "Message shown when the customer has no prize requests", type: "label", configKey: "labels.emptyMyPrizes", default: LABEL_DEFAULTS.emptyMyPrizes },
            { key: "lbl_prizeStatusPending", label: "Prize status — Pending", hint: "Text shown when a prize request is pending", type: "label", configKey: "labels.prizeStatusPending", default: LABEL_DEFAULTS.prizeStatusPending },
            { key: "lbl_prizeStatusFulfilled", label: "Prize status — Fulfilled", hint: "Text shown when a prize has been dispatched", type: "label", configKey: "labels.prizeStatusFulfilled", default: LABEL_DEFAULTS.prizeStatusFulfilled },
            { key: "lbl_prizeStatusCompleted", label: "Prize status — Completed", hint: "Text shown when a prize has been delivered", type: "label", configKey: "labels.prizeStatusCompleted", default: LABEL_DEFAULTS.prizeStatusCompleted },
            { key: "lbl_prizeStatusCancelled", label: "Prize status — Cancelled", hint: "Text shown when a prize request has been cancelled", type: "label", configKey: "labels.prizeStatusCancelled", default: LABEL_DEFAULTS.prizeStatusCancelled },
            { key: "lbl_prizeContactUsText", label: "Prize — Contact us button", hint: "Label on the Contact us button shown in prize notifications", type: "label", configKey: "labels.prizeContactUsText", default: LABEL_DEFAULTS.prizeContactUsText },
            { key: "lbl_prizeClaimSuccessMsg", label: "Prize — Claim success message", hint: "Message shown after a prize is successfully claimed", type: "label", configKey: "labels.prizeClaimSuccessMsg", default: LABEL_DEFAULTS.prizeClaimSuccessMsg },
            { key: "lbl_claimingLabel", label: "Claim button — Processing", hint: "Text on the claim button while the request is being submitted", type: "label", configKey: "labels.claimingLabel", default: LABEL_DEFAULTS.claimingLabel },
            { key: "lbl_claimRetryLabel", label: "Claim button — Retry", hint: "Text on the claim button after a failed attempt", type: "label", configKey: "labels.claimRetryLabel", default: LABEL_DEFAULTS.claimRetryLabel },
        ],
    },
];

export const SIMPLE_SECTIONS = [
    {
        key: "brand",
        label: "Brand Colors",
        icon: "🎨",
        description: "Primary and accent colors. Everything in the widget derives from these two colors automatically.",
        fields: [
            {
                key: "primary",
                label: "Primary color",
                hint: "Your main brand color — used for header, launcher, nav items, and active states throughout the widget",
                type: "color",
                maps: ["--nbl-primary"],
                default: "#8b5cf6",
            },
            {
                key: "accent",
                label: "Accent color",
                hint: "Secondary color used for action buttons, active reward highlights, and positive indicators",
                type: "color",
                maps: ["--nbl-accent"],
                default: "#4ecba8",
            },
        ],
    },
    {
        key: "launcher",
        label: "Launcher Button",
        icon: "🚀",
        description: "The floating button on your storefront that opens the widget.",
        fields: [
            {
                key: "launcherIcon",
                label: "Button icon",
                hint: "Emoji icon displayed on the floating button",
                type: "emoji",
                options: ["🎁", "⭐", "🏆", "💎", "🎯", "✨", "🎊", "🎀"],
                maps: ["--nbl-launcher-icon"],
                default: "'🎁'",
                displayValue: (v) => v.replace(/^'|'$/g, ""),
                parseValue: (v) => `'${v}'`,
            },
            {
                key: "launcherPosition",
                label: "Button position",
                hint: "Which side of the screen the launcher appears on",
                type: "select",
                options: [{ value: "left", label: "Left" }, { value: "right", label: "Right" }],
                maps: ["--nbl-launcher-position"],
                default: "right",
            },
            {
                key: "launcherBottom",
                label: "Distance from bottom",
                hint: "How far from the bottom edge of the screen the button sits",
                type: "text",
                maps: ["--nbl-launcher-bottom"],
                default: "24px",
            },
            {
                key: "launcherSideOffset",
                label: "Side offset",
                hint: "How far from the left or right edge of the screen the button sits",
                type: "text",
                maps: ["--nbl-launcher-side-offset"],
                default: "20px",
            },
        ],
    },

]
export const PRESETS = [
    {
        key: "violet",
        label: "Violet Dream",
        emoji: "💜",
        swatches: ["#7c3aed", "#a78bfa", "#ede9fe"],
        tagline: "Rich purple tones",
        vars: {
            "--nbl-primary": "#7c3aed", "--nbl-header-bg": "#7c3aed",
            "--nbl-nav-active-color": "#7c3aed", "--nbl-nav-active-border": "#7c3aed",
            "--nbl-loadmore-color": "#7c3aed", "--nbl-accent": "#a78bfa",
            "--nbl-btn-bg": "#7c3aed", "--nbl-btn-border": "#7c3aed", "--nbl-btn-color": "#ffffff",
            "--nbl-reward-item-active-border": "#a78bfa", "--nbl-reward-item-active-bg": "#f5f3ff",
            "--nbl-launcher-bg": "#7c3aed",
            "--nbl-surface": "#ffffff", "--nbl-surface-2": "#f5f3ff",
            "--nbl-reward-item-bg": "#f5f3ff", "--nbl-hsc-header-bg": "#f5f3ff",
            "--nbl-nav-bg": "#ffffff", "--nbl-nav-item-color": "#6b7280",
            "--nbl-text": "#1a1a2e", "--nbl-text-muted": "#6b7280",
            "--nbl-border": "#ede9fe", "--nbl-nav-border-color": "#ede9fe",
            "--nbl-card-bg": "#ffffff", "--nbl-card-border": "#ede9fe",
            "--nbl-notify-bg-from": "#4c1d95", "--nbl-notify-bg-to": "#7c3aed",
            "--nbl-notify-color": "#ffffff",
            "--nbl-notify-reward-code-bg": "rgba(255,255,255,0.18)",
            "--nbl-notify-reward-btn-bg": "#a78bfa", "--nbl-notify-reward-btn-color": "#3b0764", "--nbl-notify-reward-btn-border": "#a78bfa",
            "--nbl-notify-info-btn-bg": "#a78bfa", "--nbl-notify-info-btn-color": "#3b0764", "--nbl-notify-info-btn-border": "#a78bfa",
        },
    },
    {
        key: "midnight",
        label: "Midnight Dark",
        emoji: "🌙",
        swatches: ["#6366f1", "#818cf8", "#1e1b4b"],
        tagline: "Sleek dark mode",
        vars: {
            "--nbl-primary": "#4338ca", "--nbl-header-bg": "#1e1b4b",
            "--nbl-nav-active-color": "#818cf8", "--nbl-nav-active-border": "#818cf8",
            "--nbl-loadmore-color": "#818cf8", "--nbl-accent": "#6366f1",
            "--nbl-btn-bg": "#6366f1", "--nbl-btn-border": "#6366f1", "--nbl-btn-color": "#ffffff",
            "--nbl-reward-item-active-border": "#818cf8", "--nbl-reward-item-active-bg": "#1e1b4b",
            "--nbl-launcher-bg": "#6366f1",
            "--nbl-surface": "#0f0e1a", "--nbl-surface-2": "#1a1833",
            "--nbl-reward-item-bg": "#1a1833", "--nbl-hsc-header-bg": "#1a1833",
            "--nbl-nav-bg": "#12111f", "--nbl-nav-item-color": "#a5b4fc",
            "--nbl-text": "#e0e7ff", "--nbl-text-muted": "#a5b4fc",
            "--nbl-border": "#2d2b52", "--nbl-nav-border-color": "#2d2b52",
            "--nbl-card-bg": "#1a1833", "--nbl-card-border": "#2d2b52",
            "--nbl-home-nav-color": "#e0e7ff",
            "--nbl-notify-bg-from": "#3730a3", "--nbl-notify-bg-to": "#6366f1",
            "--nbl-notify-color": "#ffffff",
            "--nbl-notify-reward-code-bg": "rgba(255,255,255,0.18)",
            "--nbl-notify-reward-btn-bg": "#818cf8", "--nbl-notify-reward-btn-color": "#1e1b4b", "--nbl-notify-reward-btn-border": "#818cf8",
            "--nbl-notify-info-btn-bg": "#818cf8", "--nbl-notify-info-btn-color": "#1e1b4b", "--nbl-notify-info-btn-border": "#818cf8",
        },
    },
    {
        key: "emerald",
        label: "Emerald Forest",
        emoji: "🌿",
        swatches: ["#059669", "#34d399", "#ecfdf5"],
        tagline: "Fresh & natural",
        vars: {
            "--nbl-primary": "#059669", "--nbl-header-bg": "#059669",
            "--nbl-nav-active-color": "#059669", "--nbl-nav-active-border": "#059669",
            "--nbl-loadmore-color": "#059669", "--nbl-accent": "#34d399",
            "--nbl-btn-bg": "#059669", "--nbl-btn-border": "#059669", "--nbl-btn-color": "#ffffff",
            "--nbl-reward-item-active-border": "#34d399", "--nbl-reward-item-active-bg": "#ecfdf5",
            "--nbl-launcher-bg": "#059669",
            "--nbl-surface": "#ffffff", "--nbl-surface-2": "#ecfdf5",
            "--nbl-reward-item-bg": "#ecfdf5", "--nbl-hsc-header-bg": "#ecfdf5",
            "--nbl-nav-bg": "#ffffff", "--nbl-nav-item-color": "#6b7280",
            "--nbl-text": "#0a1f18", "--nbl-text-muted": "#6b7280",
            "--nbl-border": "#a7f3d0", "--nbl-nav-border-color": "#a7f3d0",
            "--nbl-card-bg": "#ffffff", "--nbl-card-border": "#a7f3d0",
            "--nbl-notify-bg-from": "#065f46", "--nbl-notify-bg-to": "#059669",
            "--nbl-notify-color": "#ffffff",
            "--nbl-notify-reward-code-bg": "rgba(255,255,255,0.2)",
            "--nbl-notify-reward-btn-bg": "#34d399", "--nbl-notify-reward-btn-color": "#064e3b", "--nbl-notify-reward-btn-border": "#34d399",
            "--nbl-notify-info-btn-bg": "#34d399", "--nbl-notify-info-btn-color": "#064e3b", "--nbl-notify-info-btn-border": "#34d399",
        },
    },
    {
        key: "ocean",
        label: "Ocean Breeze",
        emoji: "🌊",
        swatches: ["#0284c7", "#38bdf8", "#f0f9ff"],
        tagline: "Cool & professional",
        vars: {
            "--nbl-primary": "#0284c7", "--nbl-header-bg": "#0284c7",
            "--nbl-nav-active-color": "#0284c7", "--nbl-nav-active-border": "#0284c7",
            "--nbl-loadmore-color": "#0284c7", "--nbl-accent": "#38bdf8",
            "--nbl-btn-bg": "#0284c7", "--nbl-btn-border": "#0284c7", "--nbl-btn-color": "#ffffff",
            "--nbl-reward-item-active-border": "#38bdf8", "--nbl-reward-item-active-bg": "#f0f9ff",
            "--nbl-launcher-bg": "#0284c7",
            "--nbl-surface": "#ffffff", "--nbl-surface-2": "#f0f9ff",
            "--nbl-reward-item-bg": "#f0f9ff", "--nbl-hsc-header-bg": "#f0f9ff",
            "--nbl-nav-bg": "#ffffff", "--nbl-nav-item-color": "#6b7280",
            "--nbl-text": "#0c1a2e", "--nbl-text-muted": "#6b7280",
            "--nbl-border": "#bae6fd", "--nbl-nav-border-color": "#bae6fd",
            "--nbl-card-bg": "#ffffff", "--nbl-card-border": "#bae6fd",
            "--nbl-notify-bg-from": "#075985", "--nbl-notify-bg-to": "#0284c7",
            "--nbl-notify-color": "#ffffff",
            "--nbl-notify-reward-code-bg": "rgba(255,255,255,0.2)",
            "--nbl-notify-reward-btn-bg": "#38bdf8", "--nbl-notify-reward-btn-color": "#0c4a6e", "--nbl-notify-reward-btn-border": "#38bdf8",
            "--nbl-notify-info-btn-bg": "#38bdf8", "--nbl-notify-info-btn-color": "#0c4a6e", "--nbl-notify-info-btn-border": "#38bdf8",
        },
    },
    {
        key: "blush",
        label: "Blush Pink",
        emoji: "🌸",
        swatches: ["#db2777", "#f472b6", "#fdf2f8"],
        tagline: "Soft & feminine",
        vars: {
            "--nbl-primary": "#db2777", "--nbl-header-bg": "#db2777",
            "--nbl-nav-active-color": "#db2777", "--nbl-nav-active-border": "#db2777",
            "--nbl-loadmore-color": "#db2777", "--nbl-accent": "#f472b6",
            "--nbl-btn-bg": "#db2777", "--nbl-btn-border": "#db2777", "--nbl-btn-color": "#ffffff",
            "--nbl-reward-item-active-border": "#f472b6", "--nbl-reward-item-active-bg": "#fdf2f8",
            "--nbl-launcher-bg": "#db2777",
            "--nbl-surface": "#ffffff", "--nbl-surface-2": "#fdf2f8",
            "--nbl-reward-item-bg": "#fdf2f8", "--nbl-hsc-header-bg": "#fdf2f8",
            "--nbl-nav-bg": "#ffffff", "--nbl-nav-item-color": "#9d174d",
            "--nbl-text": "#1a0011", "--nbl-text-muted": "#9d174d",
            "--nbl-border": "#fce7f3", "--nbl-nav-border-color": "#fce7f3",
            "--nbl-card-bg": "#ffffff", "--nbl-card-border": "#fce7f3",
            "--nbl-notify-bg-from": "#9d174d", "--nbl-notify-bg-to": "#db2777",
            "--nbl-notify-color": "#ffffff",
            "--nbl-notify-reward-code-bg": "rgba(255,255,255,0.2)",
            "--nbl-notify-reward-btn-bg": "#f472b6", "--nbl-notify-reward-btn-color": "#831843", "--nbl-notify-reward-btn-border": "#f472b6",
            "--nbl-notify-info-btn-bg": "#f472b6", "--nbl-notify-info-btn-color": "#831843", "--nbl-notify-info-btn-border": "#f472b6",
        },
    },
];



// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT VALUES
// ─────────────────────────────────────────────────────────────────────────────

export const CSS_DEFAULTS = {
    /* Only merchant-set values — CSS :root handles all derived tokens */
    "--nbl-primary": "#8b5cf6",
    "--nbl-primary-fg": "#ffffff",
    "--nbl-accent": "#4ecba8",
    "--nbl-accent-fg": "#ffffff",
    "--nbl-launcher-position": "right",
    "--nbl-launcher-bottom": "24px",
    "--nbl-launcher-side-offset": "20px",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
export function isEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
export function buildInitialVars(savedCssVars) {
    const base = deepClone(CSS_DEFAULTS);
    if (!savedCssVars || typeof savedCssVars !== "object") return base;
    return { ...base, ...savedCssVars };
}

export function buildInitialWidgetConfig(saved) {
    const base = { ...WIDGET_CONFIG_DEFAULTS, labels: { ...LABEL_DEFAULTS }, prize: { ...WIDGET_CONFIG_DEFAULTS.prize } };
    if (!saved || typeof saved !== "object") return base;
    const merged = { ...base, ...saved };
    // Deep merge labels and prize so partial saves don't lose defaults
    merged.labels = { ...LABEL_DEFAULTS, ...(saved.labels || {}) };
    merged.prize = { ...WIDGET_CONFIG_DEFAULTS.prize, ...(saved.prize || {}) };
    return merged;
}
export const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export function isHex(v) { return HEX_RE.test((v ?? "").trim()); }

// ─────────────────────────────────────────────────────────────────────────────
// INLINE STYLES (design system)
// ─────────────────────────────────────────────────────────────────────────────

export const DS = {
    sp2: "2px", sp4: "4px", sp6: "6px", sp8: "8px", sp10: "10px", sp12: "12px",
    sp14: "14px", sp16: "16px", sp20: "20px", sp24: "24px",
    r6: "6px", r8: "8px", r10: "10px", r12: "12px", r14: "14px", r16: "16px", r99: "99px",
    white: "#ffffff",
    bg: "#f9fafb",
    bgCard: "#ffffff",
    borderLight: "#e5e7eb",
    borderMid: "#d1d5db",
    text: "#111827",
    textSub: "#374151",
    textMuted: "#6b7280",
    textHint: "#9ca3af",
    accentBg: "#f5f3ff",
    accentText: "#6d28d9",
    accentBorder: "#ede9fe",
    warnBg: "#fffbeb",
    warnBorder: "#fde68a",
    warnText: "#92400e",
    dangerText: "#dc2626",
    dangerBg: "#fef2f2",
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION → SCENE MAP
// Maps every CSS group key and simple section key to a preview "scene" so that
// clicking a group in the sidebar automatically shows the relevant widget view.
// ─────────────────────────────────────────────────────────────────────────────

export const SECTION_TO_SCENE = {
    // ── Simple mode section keys (SIMPLE_SECTIONS[].key) ─────────────────
    header: "home",             // Header bg, text, points badge
    navigation: "home",             // Nav bar tabs, chevrons
    brand: "home",             // Primary + accent colors
    buttons: "earn",             // Action CTA buttons shown in Earn tab
    text: "home",             // Text & fonts
    surfaces: "home",             // Surfaces, borders, radius
    rewards: "rewards",          // Reward item cards
    activity: "home",             // Activity table
    pagination: "rewards",          // Load More + arrow buttons
    notifications: "notification-reward", // Reward + info slide-up panels
    status: "home",             // Status color tints
    modal: "modal",              // Referral modal — standalone preview, no widget
    animations: "home",             // Transition durations / easing
    glow: "home",             // Widget glow ring

};