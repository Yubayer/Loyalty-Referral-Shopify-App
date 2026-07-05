import { useEffect, useState, useCallback, useRef } from "react";
import { useSubmit, useNavigation, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

import { VALID_STATUSES, VALID_SORT_OPTIONS, DEFAULT_PER_PAGE } from "./_data";

/**
 * Encapsulates all page-level state for the Prize Claims page: URL-param
 * driven filters/sort/pagination, the new-claims tracking ref, every modal
 * (confirm/note/bulk/view), row selection, and their handlers.
 */
export function usePrizeClaimsPage(loaderData, actionData) {
    const submit = useSubmit();
    const navigation = useNavigation();
    const shopify = useAppBridge();
    const [searchParams, setSearchParams] = useSearchParams();

    // Modal refs
    const modalRef = useRef(null);
    const noteModalRef = useRef(null);
    const bulkModalRef = useRef(null);
    const viewModalRef = useRef(null);

    // Local UI state that doesn't need to live in the URL
    const [confirmTarget, setConfirmTarget] = useState(null);
    const [trackingInput, setTrackingInput] = useState("");
    const [noteTarget, setNoteTarget] = useState(null);
    const [noteValue, setNoteValue] = useState("");
    const [viewTarget, setViewTarget] = useState(null);
    const [bulkAction, setBulkAction] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [newDismissed, setNewDismissed] = useState(false);

    // Track new claim IDs client-side (set on first load, mutated on view)
    const newClaimIds = useRef(new Set(loaderData?.newIds ?? []));

    // Keep the ref in sync with loader refreshes.
    // When the loader re-runs (filter/page change), newIds reflects the DB truth.
    // We subtract any IDs the user already viewed in this session so "New" badge
    // disappears immediately on view without waiting for the next loader round-trip.
    const sessionViewedIds = useRef(new Set());
    // Optimistic: track viewed IDs so the badge disappears immediately on view
    // without waiting for the loader to re-run after the markClaimSeen action.
    const [optimisticViewedIds, setOptimisticViewedIds] = useState(new Set());
    useEffect(() => {
        const freshNew = new Set(loaderData?.newIds ?? []);
        // Remove ones already viewed this session
        sessionViewedIds.current.forEach((id) => freshNew.delete(id));
        newClaimIds.current = freshNew;
    }, [loaderData]);

    // Derived URL state
    const activeTab = VALID_STATUSES.includes(searchParams.get("status")) ? searchParams.get("status") : "ALL";
    const sortBy = VALID_SORT_OPTIONS.includes(searchParams.get("sortBy")) ? searchParams.get("sortBy") : "date_desc";
    const dateFrom = searchParams.get("dateFrom") ?? "";
    const dateTo = searchParams.get("dateTo") ?? "";

    // Pagination values from loader (source of truth)
    const { page: currentPage, perPage, totalItems, totalPages } = loaderData?.pagination ?? {
        page: 1, perPage: DEFAULT_PER_PAGE, totalItems: 0, totalPages: 1,
    };
    const startIndex = (currentPage - 1) * perPage;

    const claims = loaderData?.claims ?? [];
    const stats = loaderData?.stats ?? {};

    const isSubmitting = navigation.state === "submitting";
    const pendingClaimId = navigation.formData?.get("claimId");
    const pendingSubmit = navigation.formData?.get("submitType");
    const isBusy = (id) => isSubmitting && Number(pendingClaimId) === Number(id);

    // ── Search param helpers ──────────────────────────────────────────────────

    /** Update one or more search params, always resetting page to 1 unless `page` is explicitly set. */
    const updateParams = useCallback((updates, resetPage = true) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            Object.entries(updates).forEach(([k, v]) => {
                if (v === "" || v == null) next.delete(k);
                else next.set(k, String(v));
            });
            if (resetPage && !("page" in updates)) next.set("page", "1");
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setCurrentPage = useCallback((p) => updateParams({ page: p }, false), [updateParams]);
    const setPerPage = useCallback((pp) => updateParams({ perPage: pp }), [updateParams]);
    const setActiveTab = useCallback((s) => { updateParams({ status: s }); setSelectedIds(new Set()); }, [updateParams]);
    const setSortBy = useCallback((s) => updateParams({ sortBy: s }), [updateParams]);
    const setDateFrom = useCallback((d) => updateParams({ dateFrom: d }), [updateParams]);
    const setDateTo = useCallback((d) => updateParams({ dateTo: d }), [updateParams]);

    const clearFilters = useCallback(() => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            ["status", "sortBy", "dateFrom", "dateTo", "page"].forEach((k) => next.delete(k));
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const hasActiveFilters = activeTab !== "ALL" || sortBy !== "date_desc" || dateFrom || dateTo;

    // ── Action data side-effects ──────────────────────────────────────────────
    useEffect(() => {
        if (!actionData) return;
        if (actionData.submitType === "markClaimSeen") return; // silent

        shopify.toast.show(actionData.message, { isError: actionData.status === "error" });
    }, [actionData, shopify]);

    // ── Confirm modal ─────────────────────────────────────────────────────────
    const openConfirm = useCallback((claim, action) => {
        setConfirmTarget({ claim, action });
        setTrackingInput("");
        requestAnimationFrame(() => modalRef.current?.showOverlay());
    }, []);

    const handleConfirm = useCallback(() => {
        if (!confirmTarget) return;
        modalRef.current?.hideOverlay();
        const { claim, action } = confirmTarget;

        if (action === "REVERT") {
            submit({ submitType: "revertClaim", claimId: String(claim.id) }, { method: "post" });
        } else {
            submit({
                submitType: "updateClaimStatus",
                claimId: String(claim.id),
                status: action,
                trackingInfo: trackingInput.trim(),
            }, { method: "post" });
        }
        setConfirmTarget(null);
        setTrackingInput("");
    }, [confirmTarget, submit, trackingInput]);

    // ── Note modal ────────────────────────────────────────────────────────────
    const openNoteModal = useCallback((claim) => {
        setNoteTarget(claim);
        setNoteValue(claim.adminNote ?? "");
        requestAnimationFrame(() => noteModalRef.current?.showOverlay());
    }, []);

    const handleSaveNote = useCallback(() => {
        if (!noteTarget) return;
        noteModalRef.current?.hideOverlay();
        submit(
            { submitType: "saveAdminNote", claimId: String(noteTarget.id), adminNote: noteValue },
            { method: "post" }
        );
    }, [noteTarget, noteValue, submit]);

    // ── View modal ────────────────────────────────────────────────────────────
    const openViewModal = useCallback((claim) => {
        setViewTarget(claim);
        requestAnimationFrame(() => viewModalRef.current?.showOverlay());

        // Always mark as viewed optimistically so badge disappears immediately
        if (!claim.viewedByAdmin) {
            setOptimisticViewedIds((prev) => new Set([...prev, claim.id]));
        }
        if (newClaimIds.current.has(claim.id)) {
            newClaimIds.current.delete(claim.id);
            sessionViewedIds.current.add(claim.id); // remember across loader refreshes
            submit({ submitType: "markClaimSeen", claimId: String(claim.id) }, { method: "post" });
        } else if (!claim.viewedByAdmin) {
            // Not a "new" claim but also not yet viewed — still need to mark it
            submit({ submitType: "markClaimSeen", claimId: String(claim.id) }, { method: "post" });
        }
    }, [submit]);

    // ── Bulk modal ────────────────────────────────────────────────────────────
    const openBulkConfirm = useCallback((action) => {
        setBulkAction(action);
        requestAnimationFrame(() => bulkModalRef.current?.showOverlay());
    }, []);

    const handleBulkConfirm = useCallback(() => {
        bulkModalRef.current?.hideOverlay();
        submit(
            { submitType: "bulkAction", bulkAction, claimIds: JSON.stringify([...selectedIds]) },
            { method: "post" }
        );
        // Optimistically clear selection; loader will re-validate
        setSelectedIds(new Set());
        setBulkAction(null);
    }, [bulkAction, selectedIds, submit]);

    // ── Selection helpers ─────────────────────────────────────────────────────
    const pendingOnPage = claims.filter((c) => c.status === "PENDING");
    const fulfilledOnPage = claims.filter((c) => c.status === "FULFILLED");
    const selectablePage = [...pendingOnPage, ...fulfilledOnPage];
    const allPageSelected = selectablePage.length > 0 && selectablePage.every((c) => selectedIds.has(c.id));

    const toggleSelect = useCallback((id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const toggleSelectAllPage = useCallback(() => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            const all = selectablePage.every((c) => next.has(c.id));
            selectablePage.forEach((c) => all ? next.delete(c.id) : next.add(c.id));
            return next;
        });
    }, [selectablePage]);

    const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

    // ── Misc helpers ──────────────────────────────────────────────────────────
    const handleOpenCustomer = useCallback(async (shopifyId) => {
        try {
            await shopify.intents.invoke("edit:shopify/Customer", { value: shopifyId });
        } catch {
            shopify.toast.show("Could not open customer profile.", { isError: true });
        }
    }, [shopify]);

    // ── Modal close handlers (s-modal's onHide) ────────────────────────────────
    const closeConfirmModal = useCallback(() => {
        setConfirmTarget(null);
        setTrackingInput("");
    }, []);
    const closeNoteModal = useCallback(() => setNoteTarget(null), []);
    const closeBulkModal = useCallback(() => setBulkAction(null), []);
    const closeViewModal = useCallback(() => setViewTarget(null), []);

    return {
        // Refs (attach directly to <s-modal ref={...}>)
        modalRef, noteModalRef, bulkModalRef, viewModalRef,

        // Loader-derived data
        claims, stats,
        activeTab, sortBy, dateFrom, dateTo,
        currentPage, perPage, totalItems, totalPages, startIndex,
        loaderError: loaderData?.loaderError ?? null,

        // Submission state
        isSubmitting, pendingSubmit, isBusy,

        // New / viewed tracking
        newClaimIds, optimisticViewedIds,

        // Filters
        setCurrentPage, setPerPage, setActiveTab, setSortBy, setDateFrom, setDateTo,
        clearFilters, hasActiveFilters,

        // New-claims banner
        newDismissed, setNewDismissed,

        // Confirm modal
        confirmTarget, trackingInput, setTrackingInput, openConfirm, handleConfirm, closeConfirmModal,

        // Note modal
        noteTarget, noteValue, setNoteValue, openNoteModal, handleSaveNote, closeNoteModal,

        // View modal
        viewTarget, openViewModal, closeViewModal,

        // Bulk modal/bar
        bulkAction, openBulkConfirm, handleBulkConfirm, closeBulkModal,

        // Selection
        selectedIds, selectablePage, allPageSelected,
        toggleSelect, toggleSelectAllPage, clearSelection,

        // Misc
        handleOpenCustomer,
    };
}
