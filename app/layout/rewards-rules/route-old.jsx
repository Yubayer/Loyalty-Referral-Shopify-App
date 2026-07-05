/**
 * @file app.redeem-rule.standalone.jsx
 * @description Standalone Reward (Redeem) Rule management page.
 *
 * All features self-contained — no atoms, no child component imports:
 *   - Loader  : fetches all reward rules for the shop
 *   - Action  : create / update / delete a RewardRule
 *   - Form    : reward type selector, discount config, points cost, title, description, active toggle
 *   - Table   : paginated rules list with edit / delete actions
 *   - Modal   : delete confirmation
 *
 * Pattern mirrors app_points-rule-new.jsx:
 *   - `useNavigation` drives loading / disabled states (no manual loading booleans)
 *   - `useAppBridge` for toast
 *   - view state: "list" | "create" | "edit"
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useActionData, useLoaderData, useSubmit, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "shopify-server";
import prisma from "db-server";
import syncAppConfig from "@controller/metafieldsSync/syncAppConfig";

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
// ACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves `{{currency_value}}` placeholder in the display title.
 * e.g. "Voucher {{currency_value}}" → "Voucher $10" or "Voucher 10%"
 */
const resolveTitlePlaceholder = (title, discountType, rewardValue) => {
    if (!title) return title;
    const formatted = discountType === "percentage" ? `${rewardValue}%` : `$${rewardValue}`;
    return title.replace(/\{\{currency_value\}\}/gi, formatted);
};

export const action = async ({ request }) => {
    const { admin, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const submitType = formData.get("submitType");

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (submitType === "addRule") {
        const newRule = JSON.parse(formData.get("rule") || "{}");

        if (!newRule.rewardType)
            return { message: "Please select a reward type.", status: "error", submitType };
        if (!newRule.title?.trim())
            return { message: "Display title is required.", status: "error", submitType };
        if (!newRule.pointsCost || Number(newRule.pointsCost) <= 0)
            return { message: "Points cost must be greater than 0.", status: "error", submitType };

        try {
            const resolvedTitle = resolveTitlePlaceholder(newRule.title, newRule.discountType, newRule.rewardValue);

            const created = await prisma.rewardRule.create({
                data: {
                    title: resolvedTitle,
                    description: newRule.description || null,
                    discountType: newRule.discountType,
                    rewardValue: Number(newRule.rewardValue) || 0,
                    rewardType: newRule.rewardType,
                    pointsCost: Number(newRule.pointsCost),
                    isActive: newRule.isActive ?? true,
                    startDate: newRule.startDate ? new Date(newRule.startDate) : null,
                    endDate: newRule.endDate ? new Date(newRule.endDate) : null,
                    session: { connect: { id: session.id } },
                },
            });

            await syncAppConfig(admin);
            return { message: "Reward rule created successfully.", rule: created, status: "success", submitType };
        } catch (err) {
            console.error("Create RewardRule Error:", err);
            return { message: "Failed to create reward rule. Please try again.", status: "error", submitType };
        }
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────
    if (submitType === "updateRule") {
        const updatedRule = JSON.parse(formData.get("rule") || "{}");

        if (!updatedRule.id)
            return { message: "Rule ID is required.", status: "error", submitType };
        if (!updatedRule.rewardType)
            return { message: "Please select a reward type.", status: "error", submitType };
        if (!updatedRule.title?.trim())
            return { message: "Display title is required.", status: "error", submitType };
        if (!updatedRule.pointsCost || Number(updatedRule.pointsCost) <= 0)
            return { message: "Points cost must be greater than 0.", status: "error", submitType };

        try {
            const existing = await prisma.rewardRule.findUnique({ where: { id: parseInt(updatedRule.id) } });
            if (!existing || existing.sessionId !== session.id)
                return { message: "Rule not found or access denied.", status: "error", submitType };

            const resolvedTitle = resolveTitlePlaceholder(updatedRule.title, updatedRule.discountType, updatedRule.rewardValue);

            const rule = await prisma.rewardRule.update({
                where: { id: parseInt(updatedRule.id) },
                data: {
                    title: resolvedTitle,
                    description: updatedRule.description || null,
                    discountType: updatedRule.discountType,
                    rewardValue: Number(updatedRule.rewardValue) || 0,
                    rewardType: updatedRule.rewardType,
                    pointsCost: Number(updatedRule.pointsCost),
                    isActive: updatedRule.isActive ?? true,
                    startDate: updatedRule.startDate ? new Date(updatedRule.startDate) : null,
                    endDate: updatedRule.endDate ? new Date(updatedRule.endDate) : null,
                },
            });

            await syncAppConfig(admin);
            return { message: "Reward rule updated successfully.", rule, status: "success", submitType };
        } catch (err) {
            console.error("Update RewardRule Error:", err);
            return { message: "Failed to update reward rule. Please try again.", status: "error", submitType };
        }
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (submitType === "deleteRule") {
        const ruleId = parseInt(formData.get("ruleId"));
        if (!ruleId)
            return { message: "Rule ID is required.", status: "error", submitType };

        try {
            const rule = await prisma.rewardRule.findUnique({ where: { id: ruleId } });
            if (!rule || rule.sessionId !== session.id)
                return { message: "Rule not found or access denied.", status: "error", submitType };

            await prisma.rewardRule.delete({ where: { id: ruleId } });
            await syncAppConfig(admin);
            return { message: "Reward rule deleted successfully.", status: "success", submitType };
        } catch (err) {
            console.error("Delete RewardRule Error:", err);
            return { message: err.message || "Failed to delete rule. Please try again.", status: "error", submitType };
        }
    }

    return { message: "Invalid action.", status: "error", submitType };
};

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT STATE
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_RULE = {
    id: null,
    title: "Voucher {{currency_value}}",
    description: "",
    discountType: "fixed",       // "fixed" | "percentage"
    rewardValue: 5,
    rewardType: "orderDiscount", // "orderDiscount" | "productDiscount" | "freeProduct" | "freeShipping"
    pointsCost: 100,
    isActive: true,
    startDate: null,
    endDate: null,
};

const clone = (obj) => JSON.parse(JSON.stringify(obj));

const PER_PAGE = 10;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve `{{currency_value}}` in the title for display purposes. */
const previewTitle = (title, discountType, rewardValue) => {
    if (!title) return "";
    const formatted = discountType === "percentage" ? `${rewardValue}%` : `$${rewardValue}`;
    return title.replace(/\{\{currency_value\}\}/gi, formatted);
};

const formatDiscount = (discountType, rewardValue) =>
    discountType === "percentage" ? `${rewardValue}%` : `$${rewardValue}`;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function RedeemRulePage() {
    const submit = useSubmit();
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const navigation = useNavigation();
    const shopify = useAppBridge();

    // ── Submission state via useNavigation ────────────────────────────────────
    const pendingSubmitType = navigation.formData?.get("submitType") ?? null;
    const isSubmitting = navigation.state === "submitting";

    const isSaving = isSubmitting && pendingSubmitType === "addRule";
    const isUpdating = isSubmitting && pendingSubmitType === "updateRule";
    const isDeleting = isSubmitting && pendingSubmitType === "deleteRule";
    const isAnyBusy = isSubmitting;

    // ── View: "list" | "create" | "edit" ─────────────────────────────────────
    const [view, setView] = useState("list");

    // ── Form state ────────────────────────────────────────────────────────────
    const [rule, setRule] = useState(clone(EMPTY_RULE));

    // Snapshot for hasChanges (edit only)
    const [savedRule, setSavedRule] = useState(clone(EMPTY_RULE));

    // ── Delete target ─────────────────────────────────────────────────────────
    const [deleteTarget, setDeleteTarget] = useState(null);

    // ── Pagination ────────────────────────────────────────────────────────────
    const [currentPage, setCurrentPage] = useState(1);

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION DATA EFFECT
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!actionData) return;
        shopify.toast.show(actionData.message, { isError: actionData.status === "error" });

        if (actionData.status === "success") {
            if (actionData.submitType === "addRule" || actionData.submitType === "updateRule") {
                setView("list");
                setRule(clone(EMPTY_RULE));
            }
            if (actionData.submitType === "deleteRule") {
                setDeleteTarget(null);
            }
        }
    }, [actionData]);

    useEffect(() => { setCurrentPage(1); }, [loaderData?.rewardRules?.length]);

    // ─────────────────────────────────────────────────────────────────────────
    // DERIVED
    // ─────────────────────────────────────────────────────────────────────────

    const rules = loaderData?.rewardRules ?? [];
    const totalPages = Math.max(1, Math.ceil(rules.length / PER_PAGE));
    const paginatedRules = rules.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

    const hasChanges = view === "edit" && JSON.stringify(rule) !== JSON.stringify(savedRule);

    // Live title preview (resolves placeholder while user types)
    const titlePreview = useMemo(
        () => previewTitle(rule.title, rule.discountType, rule.rewardValue),
        [rule.title, rule.discountType, rule.rewardValue]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // NAVIGATION HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    const goToCreate = useCallback(() => {
        setRule(clone(EMPTY_RULE));
        setView("create");
    }, []);

    const goToEdit = useCallback((r) => {
        const editRule = {
            id: r.id,
            title: r.title ?? EMPTY_RULE.title,
            description: r.description ?? "",
            discountType: r.discountType ?? "fixed",
            rewardValue: r.rewardValue ?? 5,
            rewardType: r.rewardType ?? "orderDiscount",
            pointsCost: r.pointsCost ?? 100,
            isActive: r.isActive ?? true,
            startDate: r.startDate ?? null,
            endDate: r.endDate ?? null,
        };
        setRule(editRule);
        setSavedRule(clone(editRule));
        setView("edit");
    }, []);

    const goToList = useCallback(() => {
        setView("list");
        setRule(clone(EMPTY_RULE));
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // FIELD HELPER
    // ─────────────────────────────────────────────────────────────────────────

    const setField = useCallback((field, value) => {
        setRule((prev) => ({ ...prev, [field]: value }));
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // VALIDATION
    // ─────────────────────────────────────────────────────────────────────────

    const validate = useCallback(() => {
        if (!rule.rewardType) {
            shopify.toast.show("Please select a reward type.", { isError: true });
            return false;
        }
        if (!rule.title?.trim()) {
            shopify.toast.show("Display title is required.", { isError: true });
            return false;
        }
        if (!rule.pointsCost || Number(rule.pointsCost) <= 0) {
            shopify.toast.show("Points cost must be greater than 0.", { isError: true });
            return false;
        }
        if (rule.rewardType === "orderDiscount" && !(Number(rule.rewardValue) > 0)) {
            shopify.toast.show("Discount value must be greater than 0.", { isError: true });
            return false;
        }
        return true;
    }, [rule, shopify]);

    // ─────────────────────────────────────────────────────────────────────────
    // SUBMIT HANDLERS
    // ─────────────────────────────────────────────────────────────────────────

    const handleSave = useCallback(() => {
        if (!validate()) return;
        submit({ submitType: "addRule", rule: JSON.stringify(rule) }, { method: "post" });
    }, [rule, submit, validate]);

    const handleUpdate = useCallback(() => {
        if (!validate()) return;
        submit({ submitType: "updateRule", rule: JSON.stringify(rule) }, { method: "post" });
    }, [rule, submit, validate]);

    const handleDelete = useCallback(() => {
        if (!deleteTarget) return;
        submit({ submitType: "deleteRule", ruleId: deleteTarget.id }, { method: "post" });
    }, [deleteTarget, submit]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER — header bar
    // ─────────────────────────────────────────────────────────────────────────

    const renderHeading = () => {
        if (view === "list") {
            return (
                <s-grid gridTemplateColumns="1fr auto" gap="large" alignItems="center">
                    <h2 style={{ marginBlock: "0" }}>Reward Rules</h2>
                    <s-button variant="primary" onClick={goToCreate} disabled={isAnyBusy}>
                        Create New Rule
                    </s-button>
                </s-grid>
            );
        }

        const isEdit = view === "edit";
        return (
            <s-grid gridTemplateColumns="1fr auto" gap="large" alignItems="center">
                <s-stack direction="inline" gap="small" alignItems="center">
                    <s-button
                        variant="plain"
                        onClick={goToList}
                        disabled={isAnyBusy}
                        style={{ padding: 0, minHeight: "unset" }}
                    >
                        Rules
                    </s-button>
                    <s-text tone="subdued">›</s-text>
                    <h2 style={{ marginBlock: "0" }}>{isEdit ? "Edit Rule" : "Create New Rule"}</h2>
                </s-stack>
                <s-stack direction="inline" gap="base" alignItems="center">
                    <s-button onClick={goToList} disabled={isAnyBusy}>
                        Cancel
                    </s-button>
                    {isEdit ? (
                        <s-button
                            variant="primary"
                            onClick={handleUpdate}
                            loading={isUpdating}
                            disabled={isUpdating || !hasChanges}
                        >
                            Update Rule
                        </s-button>
                    ) : (
                        <s-button
                            variant="primary"
                            onClick={handleSave}
                            loading={isSaving}
                            disabled={isSaving || !rule.rewardType || !rule.title?.trim()}
                        >
                            Save Rule
                        </s-button>
                    )}
                </s-stack>
            </s-grid>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER — rules table
    // ─────────────────────────────────────────────────────────────────────────

    const renderTable = () => (
        <s-section>
            <s-table>
                <s-table-header-row>
                    <s-table-header>Title</s-table-header>
                    <s-table-header>Points Cost</s-table-header>
                    <s-table-header>Discount Type</s-table-header>
                    <s-table-header>Value</s-table-header>
                    <s-table-header>Active</s-table-header>
                    <s-table-header>Actions</s-table-header>
                </s-table-header-row>
                <s-table-body>
                    {paginatedRules.length === 0 ? (
                        <s-table-row>
                            <s-table-cell colSpan="6" style={{ textAlign: "center", padding: "3rem" }}>
                                No reward rules yet. Click "Create New Rule" to get started.
                            </s-table-cell>
                        </s-table-row>
                    ) : (
                        paginatedRules.map((r) => (
                            <s-table-row key={r.id}>
                                <s-table-cell>
                                    <s-heading>{previewTitle(r.title, r.discountType, r.rewardValue)}</s-heading>
                                </s-table-cell>
                                <s-table-cell>{r.pointsCost} pts</s-table-cell>
                                <s-table-cell>{r.discountType}</s-table-cell>
                                <s-table-cell>{formatDiscount(r.discountType, r.rewardValue)}</s-table-cell>
                                <s-table-cell>{r.isActive ? "✅ Yes" : "❌ No"}</s-table-cell>
                                <s-table-cell>
                                    <s-stack gap="small" direction="inline">
                                        <s-button
                                            variant="text" size="small" icon="edit"
                                            disabled={isAnyBusy}
                                            onClick={() => goToEdit(r)}
                                        />
                                        <s-button
                                            variant="text" size="small" icon="delete" destructive
                                            disabled={isAnyBusy}
                                            onClick={() => setDeleteTarget(r)}
                                            commandFor="delete-reward-modal"
                                            command="--show"
                                        />
                                    </s-stack>
                                </s-table-cell>
                            </s-table-row>
                        ))
                    )}
                </s-table-body>
            </s-table>

            {totalPages > 1 && (
                <s-stack direction="inline" justifyContent="center" gap="small" style={{ marginBlockStart: "1rem" }}>
                    <s-button
                        variant="plain"
                        disabled={currentPage === 1 || isAnyBusy}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                        ← Prev
                    </s-button>
                    <s-text>Page {currentPage} of {totalPages}</s-text>
                    <s-button
                        variant="plain"
                        disabled={currentPage === totalPages || isAnyBusy}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                        Next →
                    </s-button>
                </s-stack>
            )}
        </s-section>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER — create / edit form
    // ─────────────────────────────────────────────────────────────────────────

    const renderForm = () => {
        const busy = isSaving || isUpdating;

        return (
            <s-grid gridTemplateColumns="2fr 1fr" gap="base">
                {/* ── Left column ─────────────────────────────────────────── */}
                <s-box>
                    {/* Reward Type */}
                    <s-box paddingBlockEnd="base">
                        <s-section>
                            <s-select
                                label="Reward Type"
                                placeholder="Select reward type"
                                value={rule.rewardType}
                                disabled={busy}
                                onInput={(e) => setField("rewardType", e.target.value)}
                            >
                                <s-option value="orderDiscount">
                                    Order Discount — discount the total order amount
                                </s-option>
                                {/* More types can be uncommented when supported:
                                <s-option value="productDiscount">Product Discount</s-option>
                                <s-option value="freeProduct">Free Product</s-option>
                                <s-option value="freeShipping">Free Shipping</s-option> */}
                            </s-select>
                        </s-section>
                    </s-box>

                    {/* Discount config — shown when orderDiscount is selected */}
                    {rule.rewardType === "orderDiscount" && (
                        <s-box paddingBlockEnd="base">
                            <s-section>
                                <s-grid gridTemplateColumns="2fr 1fr" gap="base">
                                    {/* Discount Type */}
                                    <s-select
                                        label={`Discount Type (${rule.discountType})`}
                                        value={rule.discountType}
                                        disabled={busy}
                                        onInput={(e) => setField("discountType", e.target.value)}
                                    >
                                        <s-option value="fixed">Fixed Amount</s-option>
                                        <s-option value="percentage">Percentage</s-option>
                                    </s-select>

                                    {/* Discount Value */}
                                    <s-number-field
                                        label="Value"
                                        prefix={rule.discountType === "fixed" ? "$" : ""}
                                        suffix={rule.discountType === "percentage" ? "%" : ""}
                                        step={1} min={0}
                                        value={rule.rewardValue ?? ""}
                                        disabled={busy}
                                        onInput={(e) => setField("rewardValue", Number(e.target.value))}
                                    />
                                </s-grid>

                                {/* Points Cost */}
                                <s-box paddingBlockEnd="base" />
                                <s-number-field
                                    label="Points Cost"
                                    suffix="points"
                                    step={1} min={1}
                                    value={rule.pointsCost ?? ""}
                                    disabled={busy}
                                    onInput={(e) => setField("pointsCost", e.target.value)}
                                />
                            </s-section>
                        </s-box>
                    )}

                    {/* Display Title */}
                    <s-box paddingBlockEnd="base">
                        <s-section>
                            <s-text-field
                                label="Display Title"
                                placeholder="e.g. Voucher {{currency_value}}"
                                value={rule.title ?? ""}
                                disabled={busy}
                                details="Use {{currency_value}} to auto-insert the formatted discount amount."
                                onInput={(e) => setField("title", e.target.value)}
                            />
                            {/* Live preview when placeholder is present */}
                            {rule.title?.includes("{{currency_value}}") && (
                                <s-box paddingBlockStart="small">
                                    <s-text tone="subdued">Preview: {titlePreview}</s-text>
                                </s-box>
                            )}
                        </s-section>
                    </s-box>

                    {/* Description */}
                    <s-section>
                        <s-text-area
                            label="Description"
                            placeholder="Describe this reward rule..."
                            value={rule.description ?? ""}
                            rows={3}
                            disabled={busy}
                            onInput={(e) => setField("description", e.target.value)}
                        />
                    </s-section>
                </s-box>

                {/* ── Right column ─────────────────────────────────────────── */}
                <s-box>
                    {/* Summary */}
                    <s-section>
                        <s-heading>Summary</s-heading>
                        <s-box paddingBlockEnd="small" />
                        {rule.rewardType ? (
                            <>
                                <s-text><strong>Type:</strong> {rule.rewardType}</s-text>
                                <s-box paddingBlockEnd="small" />
                                <s-text>
                                    <strong>Discount:</strong> {formatDiscount(rule.discountType, rule.rewardValue)}
                                </s-text>
                                <s-box paddingBlockEnd="small" />
                                <s-text><strong>Cost:</strong> {rule.pointsCost} points</s-text>
                                <s-box paddingBlockEnd="small" />
                                <s-text><strong>Status:</strong> {rule.isActive ? "Active ✅" : "Inactive ❌"}</s-text>
                            </>
                        ) : (
                            <s-text tone="subdued">Select a reward type to see a summary.</s-text>
                        )}
                    </s-section>

                    <s-box paddingBlockEnd="base" />

                    {/* Active Status */}
                    <s-section>
                        <s-heading>Active Status</s-heading>
                        <s-box paddingBlockEnd="small" />
                        <s-switch
                            labelAccessibilityVisibility="exclusion"
                            label={rule.isActive ? "Active" : "Inactive"}
                            checked={rule.isActive}
                            disabled={busy}
                            onChange={(e) => setField("isActive", e.target.checked)}
                        />
                    </s-section>
                </s-box>
            </s-grid>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER — delete modal
    // ─────────────────────────────────────────────────────────────────────────

    const renderDeleteModal = () => (
        <s-modal id="delete-reward-modal" heading="Delete Reward Rule" size="small">
            <s-paragraph color="subdued">
                Are you sure you want to delete{" "}
                <strong>{previewTitle(deleteTarget?.title, deleteTarget?.discountType, deleteTarget?.rewardValue)}</strong>?
                This action cannot be undone.
            </s-paragraph>
            <s-button
                slot="secondary-actions"
                commandFor="delete-reward-modal"
                command="--hide"
                disabled={isDeleting}
            >
                Cancel
            </s-button>
            <s-button
                slot="primary-action"
                variant="primary"
                destructive
                onClick={handleDelete}
                commandFor="delete-reward-modal"
                command="--hide"
                loading={isDeleting}
                disabled={isDeleting}
            >
                Yes, Delete
            </s-button>
        </s-modal>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // FINAL RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <s-page inlineSize="base">
            <s-section>{renderHeading()}</s-section>

            {view === "list" && renderTable()}
            {(view === "create" || view === "edit") && renderForm()}

            {renderDeleteModal()}
        </s-page>
    );
}