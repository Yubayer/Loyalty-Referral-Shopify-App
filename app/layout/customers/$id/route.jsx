/**
 * @file layout/customers/$id/route.jsx
 * @description Customer details page — thin composition layer.
 *
 *   _loader.server.js  → prisma + Shopify GraphQL queries
 *   _action.server.js  → adjustPoints handler
 *   _hooks.js          → page state (no jotai)
 *   components/
 *     SummaryCard.jsx        → left summary panel
 *     StatsGrid.jsx          → 6 stat boxes
 *     AdjustPointsModal.jsx  → add/remove toggle + live preview
 *     TransactionsTable.jsx  → paginated transaction history
 *     RewardsTable.jsx       → paginated rewards history
 */

import { useLoaderData, useActionData } from "react-router";
import { authenticate } from "shopify-server";

import { loadCustomerDetails } from "./_loader.server";
import { handleAdjustPoints }  from "./_action.server";
import { useCustomerDetailsPage } from "./_hooks";

import { SummaryCard }        from "./components/SummaryCard";
import { StatsGrid }          from "./components/StatsGrid";
import { AdjustPointsModal }  from "./components/AdjustPointsModal";
import { TransactionsTable }  from "./components/TransactionsTable";
import { RewardsTable }       from "./components/RewardsTable";

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request, params }) => {
    const { admin, session } = await authenticate.admin(request);
    return loadCustomerDetails(admin, session.id, params.id);
};

// ─── Action ───────────────────────────────────────────────────────────────────

export const action = async ({ request }) => {
    const { admin, session } = await authenticate.admin(request);
    const formData  = await request.formData();
    const submitType = formData.get("submitType");
    const ctx = { formData, session, admin };

    switch (submitType) {
        case "adjustPoints": return handleAdjustPoints(ctx);
        default: return { message: "Invalid action.", status: "error", submitType };
    }
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerDetails() {
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const page       = useCustomerDetailsPage(loaderData, actionData);

    if (!page.customer?.id) {
        return (
            <s-page>
                <s-section>
                    <s-banner tone="critical">Customer not found.</s-banner>
                </s-section>
            </s-page>
        );
    }

    return (
        <s-page>

            {/* ── Header ── */}
            <s-section>
                <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
                    <s-box>
                        <s-stack direction="inline" gap="small-200" alignItems="center">
                            <s-button variant="secondary" size="small" onClick={page.handleBack}>
                                Customers
                            </s-button>
                            <s-text tone="subdued">›</s-text>
                            <s-text>{page.customerLabel}</s-text>
                        </s-stack>
                        <s-box paddingBlockEnd="small" />
                        <s-heading>
                            <s-badge>Details about: '{page.customerLabel}'</s-badge>
                        </s-heading>
                    </s-box>
                    <s-button
                        variant="primary"
                        icon="plus-circle"
                        command="--show"
                        commandFor="adjust-points-modal"
                    >
                        Adjust Points
                    </s-button>
                </s-grid>
            </s-section>

            {/* ── Modal ── */}
            <AdjustPointsModal
                customer={page.customer}
                isAdjusting={page.isAdjusting}
                onConfirm={page.handleAdjustPoints}
            />

            {/* ── Summary + Stats ── */}
            <s-section>
                <s-grid gridTemplateColumns="1fr 2fr" gap="base">
                    <SummaryCard customer={page.customer} />
                    <StatsGrid   customer={page.customer} />
                </s-grid>
            </s-section>

            {/* ── Transaction History ── */}
            <TransactionsTable pagination={page.txPagination} />

            {/* ── Rewards History ── */}
            <RewardsTable pagination={page.rwPagination} />

        </s-page>
    );
}
