import { useEffect, useCallback, useState } from "react";
import { useSubmit, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useFormState } from "@app/hooks/useFormState";

import { EMPTY_RULE, buildFormShape, validate, previewTitle, PER_PAGE } from "./_data";

/**
 * Encapsulates all page-level state for the Reward Rules list/create/edit
 * page: view routing (list/create/edit), table pagination, the rule form
 * itself (via useFormState), and every submit/navigate handler.
 */
export function useRewardRulesPage(loaderData, actionData) {
    const submit = useSubmit();
    const navigation = useNavigation();
    const shopify = useAppBridge();

    // ── View state ────────────────────────────────────────────────────────────
    const [view, setView] = useState("list");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);

    // ── Submission state via useNavigation ────────────────────────────────────
    const pendingSubmitType = navigation.formData?.get("submitType") ?? null;
    const isSubmitting = navigation.state === "submitting";

    const isSaving = isSubmitting && pendingSubmitType === "addRule";
    const isUpdating = isSubmitting && pendingSubmitType === "updateRule";
    const isDeleting = isSubmitting && pendingSubmitType === "deleteRule";
    const isAnyBusy = isSubmitting;
    const busy = isSaving || isUpdating;

    // ── Form state ────────────────────────────────────────────────────────────
    const fs = useFormState(EMPTY_RULE, buildFormShape, { validate });

    // ── ACTION DATA EFFECT ────────────────────────────────────────────────────
    useEffect(() => {
        if (!actionData) return;
        shopify.toast.show(actionData.message, { isError: actionData.status === "error" });

        if (actionData.status === "success") {
            if (actionData.submitType === "addRule" || actionData.submitType === "updateRule") {
                setView("list");
                fs.reset();
            }
            if (actionData.submitType === "deleteRule") {
                setDeleteTarget(null);
            }
        }
        // fs is intentionally omitted — it's stable across this effect's lifetime
        // and including it would re-fire on every keystroke.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actionData, shopify]);

    const rules = loaderData?.rewardRules ?? [];

    useEffect(() => { setCurrentPage(1); }, [rules.length]);

    // ── DERIVED ───────────────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(rules.length / PER_PAGE));
    const paginatedRules = rules.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

    // Live title preview (resolves placeholder while user types)
    const titlePreview = previewTitle(fs.form.title, fs.form.discountType, fs.form.rewardValue);

    // ── NAVIGATION HELPERS ────────────────────────────────────────────────────
    const goToCreate = useCallback(() => {
        // Don't use fs.reset() here — it reverts to the *last saved snapshot*,
        // which after editing an existing rule is that rule's data, not a
        // blank one. syncAfterSave(EMPTY_RULE) forces both the live form and
        // the snapshot back to a true blank slate.
        fs.syncAfterSave(EMPTY_RULE);
        setView("create");
    }, [fs]);

    const goToEdit = useCallback((r) => {
        // syncAfterSave rebuilds the form shape from `r` and updates both the
        // live form and the saved snapshot in one go, so isDirty starts false.
        fs.syncAfterSave(r);
        setView("edit");
    }, [fs]);

    const goToList = useCallback(() => {
        setView("list");
        fs.reset();
    }, [fs]);

    // ── SUBMIT HANDLERS ────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        const valid = await fs.submit();
        if (!valid) return;
        submit({ submitType: "addRule", rule: JSON.stringify(fs.form) }, { method: "post" });
    }, [fs, submit]);

    const handleUpdate = useCallback(async () => {
        const valid = await fs.submit();
        if (!valid) return;
        submit({ submitType: "updateRule", rule: JSON.stringify(fs.form) }, { method: "post" });
    }, [fs, submit]);

    const handleDelete = useCallback(() => {
        if (!deleteTarget) return;
        submit({ submitType: "deleteRule", ruleId: deleteTarget.id }, { method: "post" });
    }, [deleteTarget, submit]);

    return {
        fs,
        view,
        rules, paginatedRules,
        currentPage, totalPages, setCurrentPage,

        isSaving, isUpdating, isDeleting, isAnyBusy, busy,
        titlePreview,

        deleteTarget, setDeleteTarget,

        goToCreate, goToEdit, goToList,
        handleSave, handleUpdate, handleDelete,
    };
}
