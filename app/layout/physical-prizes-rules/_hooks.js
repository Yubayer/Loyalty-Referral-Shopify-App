import { useEffect, useMemo, useCallback, useRef, useState } from "react";
import { useSubmit, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useFormState } from "@app/hooks/useFormState";

import { EMPTY_PRIZE_DATA, buildFormShape, validate, PER_PAGE } from "./_data";

/**
 * Encapsulates all page-level state for the Physical Prizes list/create/edit
 * page: view routing (list/create/edit), table pagination, the multiplier
 * calculator, the prize form itself, and every submit/navigate handler.
 */
export function usePhysicalPrizesPage(loaderData, actionData) {
    const submitRR = useSubmit();
    const navigation = useNavigation();
    const shopify = useAppBridge();
    const formRef = useRef(null);

    // ── View state ────────────────────────────────────────────────────────────
    const [view, setView] = useState("list");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [multiplier, setMultiplier] = useState(15);
    const [pointsPerDollar, setPointsPerDollar] = useState(10);

    // ── Submission state ──────────────────────────────────────────────────────
    const pendingSubmitType = navigation.formData?.get("submitType") ?? null;
    const isSubmitting = navigation.state === "submitting";
    const isSaving = isSubmitting && pendingSubmitType === "addPrize";
    const isUpdating = isSubmitting && pendingSubmitType === "updatePrize";
    const isDeleting = isSubmitting && pendingSubmitType === "deletePrize";
    const isAnyBusy = isSubmitting;
    const busy = isSaving || isUpdating;

    // ── Form state ────────────────────────────────────────────────────────────
    const fs = useFormState(EMPTY_PRIZE_DATA, buildFormShape, { validate });

    // ── ACTION DATA EFFECT ────────────────────────────────────────────────────
    useEffect(() => {
        if (!actionData) return;
        shopify.toast.show(actionData.message, { isError: actionData.status === "error" });

        if (actionData.status === "success") {
            if (actionData.submitType === "addPrize" || actionData.submitType === "updatePrize") {
                setView("list");
                fs.reset();
            }
            if (actionData.submitType === "deletePrize") {
                setDeleteTarget(null);
            }
        }
        // fs is intentionally omitted — it's stable across this effect's lifetime
        // and including it would re-fire on every keystroke.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actionData, shopify]);

    useEffect(() => { setCurrentPage(1); }, [loaderData?.prizes?.length]);

    // ── DERIVED ───────────────────────────────────────────────────────────────
    const prizes = loaderData?.prizes ?? [];
    const totalPages = Math.max(1, Math.ceil(prizes.length / PER_PAGE));
    const paginatedPrizes = prizes.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

    const suggestedPoints = useMemo(() => {
        const val = Number(fs.form.productValue);
        if (!val || val <= 0) return null;
        return Math.round(val * multiplier * pointsPerDollar);
    }, [fs.form.productValue, multiplier, pointsPerDollar]);

    // ── NAVIGATION HELPERS ────────────────────────────────────────────────────
    const goToCreate = useCallback(() => {
        // Don't use fs.reset() here — it reverts the form to the *last saved
        // snapshot*. After editing an existing prize, that snapshot is that
        // prize's data, not a blank one — so "Add New Prize" would open with
        // leftover title/description/image. syncAfterSave(EMPTY_PRIZE_DATA)
        // forces both the live form and the snapshot back to a true blank slate.
        fs.syncAfterSave(EMPTY_PRIZE_DATA);
        setView("create");
    }, [fs]);

    const goToEdit = useCallback((p) => {
        // syncAfterSave rebuilds the form shape from `p` and updates both the
        // live form and the saved snapshot in one go, so isDirty starts false.
        fs.syncAfterSave(p);
        setView("edit");
    }, [fs]);

    const goToList = useCallback(() => {
        setView("list");
        fs.reset();
    }, [fs]);

    // ── SUBMIT HELPERS ────────────────────────────────────────────────────────
    const buildMultipartFD = useCallback((submitType) => {
        const fd = new FormData(formRef.current);
        fd.set("submitType", submitType);
        fd.set("prize", JSON.stringify(fs.form));
        return fd;
    }, [fs.form]);

    const handleSave = useCallback(async () => {
        const valid = await fs.submit();
        if (!valid) return;
        submitRR(buildMultipartFD("addPrize"), { method: "post", encType: "multipart/form-data" });
    }, [fs, buildMultipartFD, submitRR]);

    const handleUpdate = useCallback(async () => {
        const valid = await fs.submit();
        if (!valid) return;
        submitRR(buildMultipartFD("updatePrize"), { method: "post", encType: "multipart/form-data" });
    }, [fs, buildMultipartFD, submitRR]);

    const handleDelete = useCallback(() => {
        if (!deleteTarget) return;
        submitRR({ submitType: "deletePrize", prizeId: deleteTarget.id }, { method: "post" });
    }, [deleteTarget, submitRR]);

    const handleDiscard = useCallback(() => {
        fs.reset();
    }, [fs]);

    return {
        formRef,
        fs,
        view,
        deleteTarget, setDeleteTarget,
        currentPage, setCurrentPage,
        multiplier, setMultiplier,
        pointsPerDollar, setPointsPerDollar,
        isSaving, isUpdating, isDeleting, isAnyBusy, busy,
        paginatedPrizes, totalPages,
        suggestedPoints,
        goToCreate, goToEdit, goToList,
        handleSave, handleUpdate, handleDelete, handleDiscard,
    };
}
