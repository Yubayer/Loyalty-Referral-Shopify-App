/**
 * @file app.physical-prizes-claims-manage._index/route.jsx
 * @description Physical Prize Claims management page — server-side paginated.
 *
 * Architecture:
 *   - All filtering, sorting, and pagination happen in the loader (DB-level).
 *   - URL search params are the single source of truth for all UI state.
 *   - Stats counts are fetched in a separate, unfiltered query so tab badges
 *     always reflect total reality, not the current filter slice.
 *   - Optimistic UI: action results are merged into loaderData client-side
 *     without a full page reload, keeping the UX snappy.
 *
 * URL param schema:
 *   ?page=1&perPage=10&status=ALL&sortBy=date_desc&dateFrom=&dateTo=
 *
 * Layout follows the app.points-rules.* module pattern:
 *   route.jsx        → loader, thin action dispatcher, page composition
 *   _data.js         → client-safe constants + pure helpers (loader and client both import this)
 *   _data.server.js  → server-only per-submitType handlers (prisma, transactions)
 *   _hooks.js        → all client-side state + handlers
 *   components/      → presentational pieces
 */

import { useLoaderData, useActionData } from "react-router";
import { authenticate } from "shopify-server";
import prisma from "db-server";

import {
    VALID_STATUSES, VALID_SORT_OPTIONS, DEFAULT_PER_PAGE, MAX_PER_PAGE,
    parseIntParam, buildWhere, buildOrderBy,
} from "./_data";
import {
    handleMarkClaimSeen, handleUpdateClaimStatus, handleRevertClaim,
    handleSaveAdminNote, handleBulkAction,
} from "./_data.server";
import { usePrizeClaimsPage } from "./_hooks";

import { LoaderErrorBanner } from "./components/LoaderErrorBanner";
import { NewClaimsBanner } from "./components/NewClaimsBanner";
import { StatsBar } from "./components/StatsBar";
import { FilterBar } from "./components/FilterBar";
import { BulkActionBar } from "./components/BulkActionBar";
import { ClaimsTable } from "./components/ClaimsTable";
import { ConfirmActionModal } from "./components/ConfirmActionModal";
import { AdminNoteModal } from "./components/AdminNoteModal";
import { BulkConfirmModal } from "./components/BulkConfirmModal";
import { ViewClaimModal } from "./components/ViewClaimModal";

// ─────────────────────────────────────────────────────────────────────────────
// LOADER
// ─────────────────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const url = new URL(request.url);

    // ── Validate & sanitise URL params ────────────────────────────────────────
    const rawStatus = url.searchParams.get("status") ?? "ALL";
    const rawSort = url.searchParams.get("sortBy") ?? "date_desc";
    const rawDateFrom = url.searchParams.get("dateFrom") ?? "";
    const rawDateTo = url.searchParams.get("dateTo") ?? "";
    const rawPage = url.searchParams.get("page") ?? "1";
    const rawPerPage = url.searchParams.get("perPage") ?? String(DEFAULT_PER_PAGE);

    const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : "ALL";
    const sortBy = VALID_SORT_OPTIONS.includes(rawSort) ? rawSort : "date_desc";
    const dateFrom = rawDateFrom.match(/^\d{4}-\d{2}-\d{2}$/) ? rawDateFrom : "";
    const dateTo = rawDateTo.match(/^\d{4}-\d{2}-\d{2}$/) ? rawDateTo : "";
    const perPage = parseIntParam(rawPerPage, DEFAULT_PER_PAGE, 1, MAX_PER_PAGE);

    try {
        // ── 1. Stats query — always unfiltered for accurate tab counts ─────────
        const [allClaims, newClaimsRaw] = await Promise.all([
            prisma.physicalPrizeClaim.groupBy({
                by: ["status"],
                where: { prize: { sessionId: session.id } },
                _count: { _all: true },
            }),
            prisma.physicalPrizeClaim.findMany({
                where: { prize: { sessionId: session.id }, isSeenByAdmin: false },
                select: { id: true },
            }),
        ]);

        const newIds = newClaimsRaw.map((c) => c.id);

        // NOTE: we deliberately do NOT mark these as seen here. The loader
        // re-runs on every filter/tab/sort/page change (React Router
        // revalidation), so a blanket "mark all unseen as seen" here would
        // wipe out the New badge/tab before the admin ever opens a claim.
        // Seen-status is only updated per-claim, via the markClaimSeen
        // action, when the admin actually opens that claim's detail modal.

        const countByStatus = Object.fromEntries(
            allClaims.map(({ status: s, _count }) => [s, _count._all])
        );
        const stats = {
            total: Object.values(countByStatus).reduce((a, b) => a + b, 0),
            new: newIds.length,
            pending: countByStatus.PENDING ?? 0,
            fulfilled: countByStatus.FULFILLED ?? 0,
            completed: countByStatus.COMPLETED ?? 0,
            cancelled: countByStatus.CANCELLED ?? 0,
        };

        // ── 2. Data query — filtered + sorted + paginated ─────────────────────
        const where = buildWhere(session.id, { status, dateFrom, dateTo, newIds });
        const orderBy = buildOrderBy(sortBy);

        const [totalItems, claims] = await Promise.all([
            prisma.physicalPrizeClaim.count({ where }),
            prisma.physicalPrizeClaim.findMany({
                where,
                orderBy,
                skip: (Math.max(1, parseIntParam(rawPage, 1)) - 1) * perPage,
                take: perPage,
                include: {
                    prize: {
                        select: { id: true, title: true, imageUrl: true, productValue: true },
                    },
                    customer: {
                        select: {
                            id: true, shopifyId: true, name: true,
                            firstName: true, lastName: true, email: true, points: true,
                        },
                    },
                },
            }),
        ]);

        const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
        // Clamp page to valid range after we know totalPages
        const page = parseIntParam(rawPage, 1, 1, totalPages);

        // Tag claims currently unseen by the admin (newIds is the live truth)
        const newIdSet = new Set(newIds);
        const claimsWithNewFlag = claims.map((c) => ({ ...c, _isNew: newIdSet.has(c.id) }));

        return {
            claims: claimsWithNewFlag,
            stats,
            newIds,          // sent to client for ref tracking
            pagination: { page, perPage, totalItems, totalPages },
        };

    } catch (err) {
        console.error("[PrizeClaims Loader]", err);
        // Return safe empty state — don't crash the page
        return {
            claims: [],
            stats: { total: 0, new: 0, pending: 0, fulfilled: 0, completed: 0, cancelled: 0 },
            newIds: [],
            pagination: { page: 1, perPage, totalItems: 0, totalPages: 1 },
            loaderError: "Failed to load claims. Please refresh.",
        };
    }
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
        case "markClaimSeen": return handleMarkClaimSeen(ctx);
        case "updateClaimStatus": return handleUpdateClaimStatus(ctx);
        case "revertClaim": return handleRevertClaim(ctx);
        case "saveAdminNote": return handleSaveAdminNote(ctx);
        case "bulkAction": return handleBulkAction(ctx);
        default: return { message: "Invalid action.", status: "error", submitType };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function PrizeClaimsPage() {
    const loaderData = useLoaderData();
    const actionData = useActionData();

    const page = usePrizeClaimsPage(loaderData, actionData);

    return (
        <s-page heading="Prize Claims" inlineSize="large">

            <ConfirmActionModal
                modalRef={page.modalRef}
                confirmTarget={page.confirmTarget}
                trackingInput={page.trackingInput}
                onTrackingInputChange={page.setTrackingInput}
                isSubmitting={page.isSubmitting}
                onConfirm={page.handleConfirm}
                onHide={page.closeConfirmModal}
            />

            <AdminNoteModal
                modalRef={page.noteModalRef}
                noteTarget={page.noteTarget}
                noteValue={page.noteValue}
                onNoteValueChange={page.setNoteValue}
                isSubmitting={page.isSubmitting}
                onSave={page.handleSaveNote}
                onHide={page.closeNoteModal}
            />

            <BulkConfirmModal
                modalRef={page.bulkModalRef}
                bulkAction={page.bulkAction}
                selectedIds={page.selectedIds}
                isSubmitting={page.isSubmitting}
                onConfirm={page.handleBulkConfirm}
                onHide={page.closeBulkModal}
            />

            <ViewClaimModal
                modalRef={page.viewModalRef}
                viewTarget={page.viewTarget}
                onHide={page.closeViewModal}
                isSubmitting={page.isSubmitting}
                pendingSubmit={page.pendingSubmit}
                isBusy={page.isBusy}
                onOpenCustomer={page.handleOpenCustomer}
                onOpenNote={page.openNoteModal}
                onOpenConfirm={page.openConfirm}
            />

            {/* ── Page content ── */}
            <LoaderErrorBanner loaderError={page.loaderError} />
            <NewClaimsBanner
                stats={page.stats}
                newDismissed={page.newDismissed}
                onDismiss={() => page.setNewDismissed(true)}
                onViewNew={() => page.setActiveTab("NEW")}
            />

            <s-section>
                <s-text tone="subdued" variant="bodySm">
                    Manage customer prize requests — fulfill when sent, complete when delivered, or cancel to refund points.
                </s-text>
            </s-section>

            <s-section>
                <StatsBar stats={page.stats} />
            </s-section>

            <FilterBar
                stats={page.stats}
                activeTab={page.activeTab}
                onTabChange={page.setActiveTab}
                dateFrom={page.dateFrom}
                onDateFromChange={page.setDateFrom}
                dateTo={page.dateTo}
                onDateToChange={page.setDateTo}
                sortBy={page.sortBy}
                onSortByChange={page.setSortBy}
                hasActiveFilters={page.hasActiveFilters}
                onClearFilters={page.clearFilters}
                totalItems={page.totalItems}
            />

            <BulkActionBar
                claims={page.claims}
                selectedIds={page.selectedIds}
                isSubmitting={page.isSubmitting}
                onBulkAction={page.openBulkConfirm}
                onClearSelection={page.clearSelection}
            />

            <ClaimsTable
                claims={page.claims}
                selectablePage={page.selectablePage}
                allPageSelected={page.allPageSelected}
                onToggleSelectAllPage={page.toggleSelectAllPage}
                selectedIds={page.selectedIds}
                onToggleSelect={page.toggleSelect}
                isSubmitting={page.isSubmitting}
                isBusy={page.isBusy}
                newClaimIds={page.newClaimIds}
                optimisticViewedIds={page.optimisticViewedIds}
                onOpenCustomer={page.handleOpenCustomer}
                onView={page.openViewModal}
                currentPage={page.currentPage}
                totalPages={page.totalPages}
                totalItems={page.totalItems}
                perPage={page.perPage}
                startIndex={page.startIndex}
                setCurrentPage={page.setCurrentPage}
                setPerPage={page.setPerPage}
            />

        </s-page>
    );
}
