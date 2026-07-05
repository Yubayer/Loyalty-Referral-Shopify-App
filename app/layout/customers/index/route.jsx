import { useLoaderData, useActionData } from "react-router";
import { authenticate } from "shopify-server";

import { loadCustomers } from "./_loader.server";
import { handleSyncCustomers } from "./_action.server";
import { useCustomersPage } from "./_hooks";
import { CustomerTable } from "./components/CustomerTable";

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const url = new URL(request.url);
    return loadCustomers(session.id, session.shop, url.searchParams);
};

// ─── Action ───────────────────────────────────────────────────────────────────

export const action = async ({ request }) => {
    const { admin, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const submitType = formData.get("submitType");
    const ctx = { formData, session, admin };

    switch (submitType) {
        case "sync-customers": return handleSyncCustomers(ctx);
        default: return Response.json({ message: "Unknown action.", isError: true });
    }
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Customers() {
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const page = useCustomersPage(loaderData, actionData);

    return (
        <s-page title="Customers" inlineSize="base">
            <s-button
                slot="primary-action"
                variant="primary"
                icon="refresh"
                loading={page.isSyncRunning}
                disabled={page.isSyncRunning}
                onClick={page.handleSync}
            >
                {page.isSyncRunning ? "Syncing…" : "Sync Customers"}
            </s-button>

            <CustomerTable
                customers={page.customers}
                totalCount={page.totalCount}
                totalPages={page.totalPages}
                page={page.page}
                pageSize={page.pageSize}
                localSearch={page.localSearch}
                sortBy={page.sortBy}
                isLoading={page.isLoading}
                navigatingTo={page.navigatingTo}
                loaderError={page.loaderError}
                onSearch={page.handleSearch}
                onSortChange={page.handleSortChange}
                onPageChange={page.handlePageChange}
                onPageSizeChange={page.handlePageSizeChange}
                onDetails={page.handleDetails}
            />
        </s-page>
    );
}
