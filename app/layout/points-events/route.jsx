/**
 * @file app.points-events._index/route.jsx
 * @description Points Events management page — simple shop-scoped CRUD.
 *
 * Layout follows the app.points-rules.* module pattern:
 *   route.jsx        → loader, thin action dispatcher, page composition
 *   _data.js         → client-safe constants + pure helpers (loader/action and client both import this)
 *   _data.server.js  → server-only per-submitType handlers (prisma)
 *   _hooks.js        → all client-side state + handlers
 *   components/      → presentational pieces
 */

import { useLoaderData, useActionData } from "react-router";
import { authenticate } from "shopify-server";
import prisma from "db-server";

import { useEventsPage } from "./_hooks";
import { handleAddEvent, handleUpdateEvent, handleDeleteEvent } from "./_data.server";

import { PageHeading } from "./components/PageHeading";
import { AddEventForm } from "./components/AddEventForm";
import { EventsTable } from "./components/EventsTable";
import { EditEventModal } from "./components/EditEventModal";
import { DeleteEventModal } from "./components/DeleteEventModal";

// ─────────────────────────────────────────────────────────────────────────────
// LOADER
// ─────────────────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);

    const events = await prisma.event.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "desc" },
    });

    return { events };
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTION — thin dispatcher; per-submitType logic lives in _data.server.js
// ─────────────────────────────────────────────────────────────────────────────

export const action = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();
    const submitType = formData.get("submitType");
    const ctx = { formData, session };

    switch (submitType) {
        case "addEvent": return handleAddEvent(ctx);
        case "updateEvent": return handleUpdateEvent(ctx);
        case "deleteEvent": return handleDeleteEvent(ctx);
        default: return { message: "Invalid action.", status: "error", submitType };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function EventsPage() {
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const page = useEventsPage(loaderData, actionData);

    // Edit copies the row into a draft object; Delete keeps the raw reference
    // (read-only confirmation, never mutated) — preserved from the original.
    const handleEditClick = (ev) => page.setSelectedEvent({ ...ev });
    const handleDeleteClick = (ev) => page.setSelectedEvent(ev);

    return (
        <s-page inlineSize="base">
            <s-section>
                <PageHeading
                    showAddForm={page.showAddForm}
                    isAnyBusy={page.isAnyBusy}
                    onToggle={page.toggleAddForm}
                />
            </s-section>

            {page.showAddForm ? (
                <AddEventForm
                    events={page.events}
                    newEvent={page.newEvent}
                    setNewEvent={page.setNewEvent}
                    isAdding={page.isAdding}
                    onCancel={page.cancelAddForm}
                    onSave={page.handleAddEvent}
                />
            ) : (
                <EventsTable
                    paginatedEvents={page.paginatedEvents}
                    isAnyBusy={page.isAnyBusy}
                    currentPage={page.currentPage}
                    totalPages={page.totalPages}
                    setCurrentPage={page.setCurrentPage}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                />
            )}

            <EditEventModal
                selectedEvent={page.selectedEvent}
                setSelectedEvent={page.setSelectedEvent}
                isUpdating={page.isUpdating}
                onSave={page.handleUpdateEvent}
            />
            <DeleteEventModal
                selectedEvent={page.selectedEvent}
                isDeleting={page.isDeleting}
                onConfirm={page.handleDeleteEvent}
            />
        </s-page>
    );
}
