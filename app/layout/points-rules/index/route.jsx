/**
 * @file app.points-rules._index/route.jsx
 * @description Points Rules list page — one row per configured event,
 * linking out to the per-event-type manage routes (order/referral/review).
 *
 * Layout follows the app.points-rules.* module pattern:
 *   route.jsx        → loader, thin action dispatcher, page composition
 *   _data.js         → client-safe constants + pure summary helpers
 *   _data.server.js  → server-only delete handler (prisma + app-config resync)
 *   _hooks.js        → all client-side state + handlers
 *   components/      → presentational pieces
 */

import { useLoaderData, useActionData } from "react-router";
import { authenticate } from "shopify-server";
import prisma from "db-server";

import { usePointsRulesIndexPage } from "./_hooks";
import { handleDeleteRule } from "./_data.server";

import { PageHeader } from "./components/PageHeader";
import { RulesTable } from "./components/RulesTable";
import { EventSelectorModal } from "./components/EventSelectorModal";
import { DeleteRuleModal } from "./components/DeleteRuleModal";

// ─────────────────────────────────────────────────────────────────────────────
// LOADER
// ─────────────────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);

    const [rules, events] = await Promise.all([
        prisma.pointsRule.findMany({
            where: { sessionId: session.id },
            include: { event: true },
            orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        }),
        prisma.event.findMany({
            where: { sessionId: session.id, isActive: true },
            orderBy: { name: "asc" },
        }),
    ]);

    return { rules, events };
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTION — delete only; thin dispatcher
// ─────────────────────────────────────────────────────────────────────────────

export const action = async ({ request }) => {
    const { session, admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const submitType = formData.get("submitType");

    switch (submitType) {
        case "deleteRule": return handleDeleteRule({ formData, session, admin });
        default: return { message: "Invalid action.", status: "error", submitType };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function PointsRulesIndexPage() {
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const page = usePointsRulesIndexPage(loaderData, actionData);

    return (
        <s-page inlineSize="base">

            <PageHeader />

            <RulesTable
                paginatedRules={page.paginatedRules}
                isDeleting={page.isDeleting}
                currentPage={page.currentPage}
                totalPages={page.totalPages}
                setCurrentPage={page.setCurrentPage}
                getEventName={page.getEventName}
                onEdit={page.handleEditRule}
                onDeleteClick={page.setDeleteTarget}
            />

            <EventSelectorModal
                events={page.events}
                existingEventIds={page.existingEventIds}
                selectedEventId={page.selectedEventId}
                setSelectedEventId={page.setSelectedEventId}
                onNext={page.handleAddRuleNext}
            />

            <DeleteRuleModal
                deleteTarget={page.deleteTarget}
                setDeleteTarget={page.setDeleteTarget}
                isDeleting={page.isDeleting}
                getEventName={page.getEventName}
                onConfirm={page.handleDelete}
            />

        </s-page>
    );
}
