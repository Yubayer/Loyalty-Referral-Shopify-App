import { useState, useEffect, useCallback, useRef } from "react";
import { useSubmit, useNavigation, useNavigate, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

const POLL_INTERVAL_MS = 3000; // poll every 3s while sync is running

export function useCustomersPage(loaderData, actionData) {
    const submit      = useSubmit();
    const nav         = useNavigation();
    const navigate    = useNavigate();
    const shopify     = useAppBridge();
    const { revalidate } = useRevalidator();

    const {
        customers = [], totalCount = 0,
        page, pageSize, search, sortBy,
        error,
        syncJobId,
        syncJobStatus,
    } = loaderData ?? {};

    // Sync is running if loader says PENDING/PROCESSING, OR we just submitted
    const isSubmittingSync = nav.state === "submitting" && nav.formMethod === "POST";
    const isSyncRunning    = isSubmittingSync || ["PENDING", "PROCESSING"].includes(syncJobStatus);

    // ── Polling ───────────────────────────────────────────────────────────────
    // While a sync job is active, revalidate the loader every 3s so the button
    // stays in loading state and the customer count updates when done.
    const pollRef = useRef(null);

    useEffect(() => {
        if (isSyncRunning && !isSubmittingSync) {
            pollRef.current = setInterval(() => revalidate(), POLL_INTERVAL_MS);
        } else {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        return () => clearInterval(pollRef.current);
    }, [isSyncRunning, isSubmittingSync, revalidate]);

    // ── Toast on sync complete ────────────────────────────────────────────────
    const prevSyncStatus = useRef(syncJobStatus);
    useEffect(() => {
        const wasRunning = ["PENDING", "PROCESSING"].includes(prevSyncStatus.current);
        const isNowDone  = syncJobStatus === "COMPLETED" || syncJobStatus === null;
        if (wasRunning && isNowDone && prevSyncStatus.current !== null) {
            shopify.toast.show("Customers synced successfully.");
        }
        if (syncJobStatus === "FAILED") {
            shopify.toast.show("Sync failed. Please try again.", { isError: true });
        }
        prevSyncStatus.current = syncJobStatus;
    }, [syncJobStatus, shopify]);

    // ── Toast on action data ──────────────────────────────────────────────────
    useEffect(() => {
        if (!actionData?.message) return;
        // "Sync started" is silent — button state already shows it
        if (actionData.submitType === "sync-customers") return;
        shopify.toast.show(actionData.message, { isError: actionData.isError ?? false });
    }, [actionData, shopify]);

    // ── Navigation ────────────────────────────────────────────────────────────
    const [navigatingTo, setNavigatingTo] = useState(null);
    useEffect(() => { if (nav.state === "idle") setNavigatingTo(null); }, [nav.state]);

    const isLoading = nav.state === "loading"
        && nav.formMethod !== "POST"
        && navigatingTo === null
        && nav.location?.pathname === window.location.pathname;

    // ── Search with debounce ──────────────────────────────────────────────────
    const [localSearch, setLocalSearch] = useState(search);
    const debounceRef = useRef(null);
    useEffect(() => { setLocalSearch(search); }, [search]);

    // ── URL updater ───────────────────────────────────────────────────────────
    const updateURL = useCallback((params) => {
        const next = new URLSearchParams({
            search:   params.search   ?? search,
            sortBy:   params.sortBy   ?? sortBy,
            page:     String(params.page     ?? 1),
            pageSize: String(params.pageSize ?? pageSize),
        });
        submit(next, { method: "GET", replace: true });
    }, [submit, search, sortBy, pageSize]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleSearch = useCallback((e) => {
        const val = e.target.value;
        setLocalSearch(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => updateURL({ search: val, page: 1 }), 400);
    }, [updateURL]);

    const handleSortChange     = useCallback((e) => updateURL({ sortBy: e.target.value, page: 1 }), [updateURL]);
    const handlePageChange     = useCallback((p)  => updateURL({ page: p }), [updateURL]);
    const handlePageSizeChange = useCallback((pp) => updateURL({ pageSize: pp, page: 1 }), [updateURL]);

    const handleSync = useCallback(() => {
        submit({ submitType: "sync-customers" }, { method: "POST" });
    }, [submit]);

    const handleDetails = useCallback((customerId) => {
        setNavigatingTo(customerId);
        navigate(`/app/customers/${customerId}`);
    }, [navigate]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return {
        customers, totalCount, totalPages,
        page, pageSize, search, sortBy,
        localSearch, loaderError: error,
        isSyncRunning, isLoading, navigatingTo,
        handleSearch, handleSortChange,
        handlePageChange, handlePageSizeChange,
        handleSync, handleDetails,
    };
}
