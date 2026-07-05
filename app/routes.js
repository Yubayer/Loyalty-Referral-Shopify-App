import { route, layout } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default [
    ...(await flatRoutes()),

    layout("./layout/index.jsx", [
        // dashboard
        route("app/dashboard", "./layout/dashboard/route.jsx"),

        // customer
        route("app/customers", "./layout/customers/index/route.jsx"),
        route("app/customers/:id", "./layout/customers/$id/route.jsx"),

        // customize
        route("app/customize", "./layout/customize/route.jsx"),

        // point earning rule
        route("app/points-rules", "./layout/points-rules/index/route.jsx"),
        route("app/points-rules/order", "./layout/points-rules/order/route.jsx"),
        route("app/points-rules/referral", "./layout/points-rules/referral/route.jsx"),
        route("app/points-rules/review", "./layout/points-rules/review/route.jsx"),

        // reward rule
        route("app/rewards-rules", "./layout/rewards-rules/route.jsx"),

        // physical prize
        route("app/physical-prizes-rules", "./layout/physical-prizes-rules/route.jsx"),
        route("app/physical-prizes-claims-manage", "./layout/physical-prizes-claims-manage/route.jsx"),

        // point events
        route("app/points-events", "./layout/points-events/route.jsx"),

        // background jobs (retry/monitor)
        route("app/jobs", "./layout/jobs/route.jsx"),

        // widget preview
        // route("widget/preview", "./widget-routes/preview.jsx"),

    ]),

    // API Routes
    route("api/claim-prize", "./api-routes/physical-prize-claim.jsx"),
    route("api/get-reward-voucher", "./api-routes/reward-claim.jsx"),
    route("api/join-our-program", "./api-routes/join-our-program.jsx"),
    route("api/get-referral-discount", "./api-routes/referral-claim.jsx"),
    route("api/loox-new-review-trigger", "./api-routes/loox-new-review-trigger.jsx"),
    route("api/provision-customer", "./api-routes/provision-customer.jsx"),

    // Widget App Proxy — storefront calls /apps/widget, Shopify proxies it here.
    // Backend code lives in app/widget-ui/ (not app/routes/), kept grouped
    // with the rest of the widget-related code.
    route("widget-data", "./widget-ui/route.jsx"),
    route("widget-data/notifications/mark-seen", "./widget-ui/notifications-mark-seen.jsx"),

    // Webhooks
    route("webhooks/app/orders_paid", "./webhook-routes/order-paid.jsx"),
    route("webhooks/app/orders_cancelled", "./webhook-routes/order-cancelled.jsx"),
    route("webhooks/app/refunds_create", "./webhook-routes/refund-created.jsx"),
    route("webhooks/app/customers_create", "./webhook-routes/customer-create.jsx"),
    route("webhooks/app/customers_delete", "./webhook-routes/customer-delete.jsx"),
    route("webhooks/app/uninstalled", "./webhook-routes/app-uninstalled.jsx"),
    route("webhooks/app/scopes_update", "./webhook-routes/scopes-update.jsx"),
];