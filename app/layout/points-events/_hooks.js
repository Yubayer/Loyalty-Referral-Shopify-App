import { useEffect, useState, useCallback } from "react";
import { useSubmit, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

import { EMPTY_EVENT, PER_PAGE, findDuplicateEventError } from "./_data";

export function useEventsPage(loaderData, actionData) {
    const submit = useSubmit();
    const navigation = useNavigation();
    const shopify = useAppBridge();

    // ── Submission state via useNavigation ────────────────────────────────────
    const pendingSubmitType = navigation.formData?.get("submitType") ?? null;
    const isSubmitting = navigation.state === "submitting";

    const isAdding = isSubmitting && pendingSubmitType === "addEvent";
    const isUpdating = isSubmitting && pendingSubmitType === "updateEvent";
    const isDeleting = isSubmitting && pendingSubmitType === "deleteEvent";
    const isAnyBusy = isSubmitting;

    // ── UI state ──────────────────────────────────────────────────────────────
    const [showAddForm, setShowAddForm] = useState(false);
    const [newEvent, setNewEvent] = useState({ ...EMPTY_EVENT });
    const [selectedEvent, setSelectedEvent] = useState(null); // for edit/delete modals

    // ── Pagination ────────────────────────────────────────────────────────────
    const [currentPage, setCurrentPage] = useState(1);

    const events = loaderData?.events ?? [];
    const totalPages = Math.max(1, Math.ceil(events.length / PER_PAGE));
    const paginatedEvents = events.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

    // ── Action data effect ───────────────────────────────────────────────────
    useEffect(() => {
        if (!actionData) return;
        shopify.toast.show(actionData.message, { isError: actionData.status === "error" });

        if (actionData.status === "success") {
            if (actionData.submitType === "addEvent") {
                setShowAddForm(false);
                setNewEvent({ ...EMPTY_EVENT });
            }
            if (actionData.submitType === "updateEvent" || actionData.submitType === "deleteEvent") {
                setSelectedEvent(null);
            }
        }
    }, [actionData, shopify]);

    useEffect(() => { setCurrentPage(1); }, [events.length]);

    // ── Validation ────────────────────────────────────────────────────────────
    const validateEvent = useCallback((ev, excludeId = null) => {
        const error = findDuplicateEventError(events, ev, excludeId);
        if (error) {
            shopify.toast.show(error, { isError: true });
            return false;
        }
        return true;
    }, [events, shopify]);

    // ── Add-form toggle ───────────────────────────────────────────────────────
    const toggleAddForm = useCallback(() => {
        setNewEvent({ ...EMPTY_EVENT });
        setShowAddForm((prev) => !prev);
    }, []);

    const cancelAddForm = useCallback(() => {
        setShowAddForm(false);
        setNewEvent({ ...EMPTY_EVENT });
    }, []);

    // ── Submit handlers ───────────────────────────────────────────────────────
    const handleAddEvent = useCallback(() => {
        if (!validateEvent(newEvent)) return;
        submit({ submitType: "addEvent", event: JSON.stringify(newEvent) }, { method: "post" });
    }, [newEvent, submit, validateEvent]);

    const handleUpdateEvent = useCallback(() => {
        if (!validateEvent(selectedEvent, selectedEvent?.id)) return;
        submit({ submitType: "updateEvent", event: JSON.stringify(selectedEvent) }, { method: "post" });
    }, [selectedEvent, submit, validateEvent]);

    const handleDeleteEvent = useCallback(() => {
        if (!selectedEvent) return;
        submit({ submitType: "deleteEvent", eventId: selectedEvent.id }, { method: "post" });
    }, [selectedEvent, submit]);

    return {
        events, paginatedEvents,
        currentPage, totalPages, setCurrentPage,

        isAdding, isUpdating, isDeleting, isAnyBusy,

        showAddForm, toggleAddForm, cancelAddForm,
        newEvent, setNewEvent,
        selectedEvent, setSelectedEvent,

        handleAddEvent, handleUpdateEvent, handleDeleteEvent,
    };
}
