import { useState, useCallback, useMemo, useEffect } from "react";
import { useSubmit, useNavigation, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

import { EVENT_ROUTES, PER_PAGE } from "./_data";

export function usePointsRulesIndexPage(loaderData, actionData) {
    const submit = useSubmit();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const shopify = useAppBridge();

    const rules = loaderData?.rules ?? [];
    const events = loaderData?.events ?? [];

    // ── Submit state ──────────────────────────────────────────────────────────
    const isDeleting =
        navigation.state === "submitting" &&
        navigation.formData?.get("submitType") === "deleteRule";

    // ── Delete target ─────────────────────────────────────────────────────────
    const [deleteTarget, setDeleteTarget] = useState(null);

    // ── Event selector modal state ────────────────────────────────────────────
    const [selectedEventId, setSelectedEventId] = useState("");

    // ── Pagination ────────────────────────────────────────────────────────────
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.max(1, Math.ceil(rules.length / PER_PAGE));
    const paginatedRules = rules.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

    // ── existing event ids (to disable already-added events) ─────────────────
    const existingEventIds = useMemo(() => rules.map((r) => r.eventId), [rules]);

    // Reset page when rules change
    useEffect(() => {
        setCurrentPage(1);
    }, [rules.length]);

    // ── Toast + post-delete cleanup ───────────────────────────────────────────
    useEffect(() => {
        if (!actionData) return;
        shopify.toast.show(actionData.message, { isError: actionData.status === "error" });
        if (actionData.status === "success" && actionData.submitType === "deleteRule") {
            setDeleteTarget(null);
        }
    }, [actionData, shopify]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleDelete = useCallback(() => {
        if (!deleteTarget) return;
        submit({ submitType: "deleteRule", ruleId: deleteTarget.id }, { method: "post" });
    }, [deleteTarget, submit]);

    const handleAddRuleNext = useCallback(() => {
        if (!selectedEventId) return;
        const event = events.find((e) => e.id === parseInt(selectedEventId));
        if (!event) return;
        const route = EVENT_ROUTES[event.type?.toUpperCase()];
        if (!route) return;
        navigate(route);
    }, [selectedEventId, events, navigate]);

    const handleEditRule = useCallback((r) => {
        const route = EVENT_ROUTES[r.event?.type?.toUpperCase()];
        if (!route) return;
        navigate(`${route}?ruleId=${r.id}`);
    }, [navigate]);

    const getEventName = useCallback((eventId) =>
        events.find((e) => e.id === parseInt(eventId))?.name ?? "—",
    [events]);

    return {
        rules, events,
        isDeleting,
        deleteTarget, setDeleteTarget,
        selectedEventId, setSelectedEventId,
        currentPage, setCurrentPage, totalPages, paginatedRules,
        existingEventIds,
        handleDelete, handleAddRuleNext, handleEditRule, getEventName,
    };
}
