/**
 * @file app.rewards-rules._index/route.jsx
 * @description Reward (Redeem) Rule management page — list / create / edit.
 *
 *   - Loader  : fetches all reward rules for the shop
 *   - Action  : create / update / delete a RewardRule
 *   - Form    : reward type selector, discount config, points cost, title, description, active toggle
 *   - Table   : paginated rules list with edit / delete actions
 *   - Modal   : delete confirmation
 *
 * Layout follows the app.physical-prizes-rules module pattern:
 *   route.jsx        → loader, thin action dispatcher, page composition
 *   _data.js         → client-safe constants, buildFormShape, validate, pure helpers
 *   _data.server.js  → server-only per-submitType handlers (prisma)
 *   _hooks.js        → all client-side state + handlers (via useFormState)
 *   components/      → presentational pieces
 *
 * Uses useFormState for form state, dirty tracking, and validation.
 *   - `useNavigation` drives loading / disabled states (no manual loading booleans)
 *   - `useAppBridge` for toast
 *   - view state: "list" | "create" | "edit"
 */

import { useActionData, useLoaderData } from "react-router";
import { authenticate } from "shopify-server";
import prisma from "db-server";

import { useRewardRulesPage } from "./_hooks";
import { handleAddRule, handleUpdateRule, handleDeleteRule } from "./_data.server";

import { PageHeading } from "./components/PageHeading";
import { RulesTable } from "./components/RulesTable";
import { RewardRuleForm } from "./components/RewardRuleForm";
import { DeleteRuleModal } from "./components/DeleteRuleModal";

// ─────────────────────────────────────────────────────────────────────────────
// LOADER
// ─────────────────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);

    const rewardRules = await prisma.rewardRule.findMany({
        where: { sessionId: session.id },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });

    return { rewardRules };
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTION — thin dispatcher; per-submitType logic lives in _data.server.js
// ─────────────────────────────────────────────────────────────────────────────

export const action = async ({ request }) => {
    const { admin, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const submitType = formData.get("submitType");
    const ctx = { formData, session, admin };

    switch (submitType) {
        case "addRule": return handleAddRule(ctx);
        case "updateRule": return handleUpdateRule(ctx);
        case "deleteRule": return handleDeleteRule(ctx);
        default: return { message: "Invalid action.", status: "error", submitType };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function RewardRulesPage() {
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const page = useRewardRulesPage(loaderData, actionData);

    return (
        <s-page inlineSize="base">
            <s-section>
                <PageHeading
                    view={page.view}
                    fs={page.fs}
                    isAnyBusy={page.isAnyBusy}
                    isSaving={page.isSaving}
                    isUpdating={page.isUpdating}
                    onCreate={page.goToCreate}
                    onCancel={page.goToList}
                    onSave={page.handleSave}
                    onUpdate={page.handleUpdate}
                />
            </s-section>

            {page.view === "list" && (
                <RulesTable
                    paginatedRules={page.paginatedRules}
                    isAnyBusy={page.isAnyBusy}
                    currentPage={page.currentPage}
                    totalPages={page.totalPages}
                    setCurrentPage={page.setCurrentPage}
                    onEdit={page.goToEdit}
                    onDelete={page.setDeleteTarget}
                />
            )}

            {(page.view === "create" || page.view === "edit") && (
                <RewardRuleForm
                    fs={page.fs}
                    busy={page.busy}
                    titlePreview={page.titlePreview}
                />
            )}

            <DeleteRuleModal
                deleteTarget={page.deleteTarget}
                isDeleting={page.isDeleting}
                onConfirm={page.handleDelete}
            />
        </s-page>
    );
}
