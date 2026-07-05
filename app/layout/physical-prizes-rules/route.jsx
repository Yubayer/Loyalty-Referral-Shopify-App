/**
 * @file app.physical-prizes-rules._index/route.jsx
 * @description Physical Prize management page — list / create / edit.
 *
 * Uses useFormState for form state, dirty tracking, and validation.
 * Uses SaveBar for the floating save / discard bar.
 * Image is sent as multipart with form data on submit (no pre-upload).
 *
 * Layout follows the app.points-rules.* module pattern:
 *   route.jsx   → loader, action, thin page composition
 *   _data.js    → server-side helpers (form shape, validation, image upload)
 *   _hooks.js   → client-side state + handlers
 *   components/ → presentational pieces
 */

import { useActionData, useLoaderData } from "react-router";
import { authenticate } from "shopify-server";
import prisma from "db-server";
import syncAppConfig from "@controller/metafieldsSync/syncAppConfig";

import { uploadImageIfPresent } from "./_data.server";
import { usePhysicalPrizesPage } from "./_hooks";
import { PageHeading } from "./components/PageHeading";
import { PrizeTable } from "./components/PrizeTable";
import { PrizeForm } from "./components/PrizeForm";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";

// ─────────────────────────────────────────────────────────────────────────────
// LOADER
// ─────────────────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const prizes = await prisma.physicalPrize.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "desc" },
    });
    return { prizes };
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTION
// ─────────────────────────────────────────────────────────────────────────────

export const action = async ({ request }) => {
    const { admin, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const submitType = formData.get("submitType");

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (submitType === "addPrize") {
        const data = JSON.parse(formData.get("prize") || "{}");

        if (!data.title?.trim())
            return { message: "Title is required.", status: "error", submitType };
        if (!data.pointsCost || Number(data.pointsCost) <= 0)
            return { message: "Points cost must be greater than 0.", status: "error", submitType };

        try {
            const uploadedUrl = await uploadImageIfPresent(admin, formData.get("image"));

            const created = await prisma.physicalPrize.create({
                data: {
                    title: data.title.trim(),
                    description: data.description || null,
                    imageUrl: uploadedUrl || null,
                    pointsCost: Number(data.pointsCost),
                    productValue: data.productValue ? Number(data.productValue) : null,
                    isActive: data.isActive ?? true,
                    session: { connect: { id: session.id } },
                },
            });

            await syncAppConfig(admin, session);
            return { message: "Prize created successfully.", prize: created, status: "success", submitType };
        } catch (err) {
            console.error("Create PhysicalPrize Error:", err);
            return { message: err.message || "Failed to create prize.", status: "error", submitType };
        }
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────
    if (submitType === "updatePrize") {
        const data = JSON.parse(formData.get("prize") || "{}");

        if (!data.id)
            return { message: "Prize ID is required.", status: "error", submitType };
        if (!data.title?.trim())
            return { message: "Title is required.", status: "error", submitType };
        if (!data.pointsCost || Number(data.pointsCost) <= 0)
            return { message: "Points cost must be greater than 0.", status: "error", submitType };

        try {
            const existing = await prisma.physicalPrize.findUnique({ where: { id: parseInt(data.id) } });
            if (!existing || existing.sessionId !== session.id)
                return { message: "Prize not found or access denied.", status: "error", submitType };

            const uploadedUrl = await uploadImageIfPresent(admin, formData.get("image"));
            // New upload wins; otherwise keep whatever imageUrl came from form state
            const imageUrl = uploadedUrl || data.imageUrl || null;

            const updated = await prisma.physicalPrize.update({
                where: { id: parseInt(data.id) },
                data: {
                    title: data.title.trim(),
                    description: data.description || null,
                    imageUrl,
                    pointsCost: Number(data.pointsCost),
                    productValue: data.productValue ? Number(data.productValue) : null,
                    isActive: data.isActive ?? true,
                },
            });

            await syncAppConfig(admin, session);
            return { message: "Prize updated successfully.", prize: updated, status: "success", submitType };
        } catch (err) {
            console.error("Update PhysicalPrize Error:", err);
            return { message: err.message || "Failed to update prize.", status: "error", submitType };
        }
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (submitType === "deletePrize") {
        const prizeId = parseInt(formData.get("prizeId"));
        if (!prizeId)
            return { message: "Prize ID is required.", status: "error", submitType };

        try {
            const prize = await prisma.physicalPrize.findUnique({ where: { id: prizeId } });
            if (!prize || prize.sessionId !== session.id)
                return { message: "Prize not found or access denied.", status: "error", submitType };

            await prisma.physicalPrize.delete({ where: { id: prizeId } });
            await syncAppConfig(admin, session);
            return { message: "Prize deleted successfully.", status: "success", submitType };
        } catch (err) {
            console.error("Delete PhysicalPrize Error:", err);
            return { message: err.message || "Failed to delete prize.", status: "error", submitType };
        }
    }

    return { message: "Invalid action.", status: "error", submitType };
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function PhysicalPrizesPage() {
    const loaderData = useLoaderData();
    const actionData = useActionData();

    const page = usePhysicalPrizesPage(loaderData, actionData);
    const isEdit = page.view === "edit";

    return (
        <s-page inlineSize="base">
            <s-section>
                <PageHeading
                    view={page.view}
                    isAnyBusy={page.isAnyBusy}
                    onCreate={page.goToCreate}
                    onBackToList={page.goToList}
                />
            </s-section>

            {page.view === "list" && (
                <PrizeTable
                    prizes={page.paginatedPrizes}
                    currentPage={page.currentPage}
                    totalPages={page.totalPages}
                    isAnyBusy={page.isAnyBusy}
                    onEdit={page.goToEdit}
                    onRequestDelete={page.setDeleteTarget}
                    onPageChange={page.setCurrentPage}
                />
            )}

            {(page.view === "create" || page.view === "edit") && (
                <PrizeForm
                    formRef={page.formRef}
                    fs={page.fs}
                    isEdit={isEdit}
                    busy={page.busy}
                    multiplier={page.multiplier}
                    onMultiplierChange={page.setMultiplier}
                    pointsPerDollar={page.pointsPerDollar}
                    onPointsPerDollarChange={page.setPointsPerDollar}
                    suggestedPoints={page.suggestedPoints}
                    onPrimary={isEdit ? page.handleUpdate : page.handleSave}
                    onDiscard={page.handleDiscard}
                />
            )}

            <DeleteConfirmModal
                deleteTarget={page.deleteTarget}
                isDeleting={page.isDeleting}
                onConfirm={page.handleDelete}
            />
        </s-page>
    );
}
