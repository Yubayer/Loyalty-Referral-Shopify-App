import prisma from "db-server";
import createTransaction from "app/controller/transaction/createTransaction";
import { syncCustomerConfig } from "app/controller/metafieldsSync/syncCustomerConfig.js";

// ─────────────────────────────────────────────────────────────────────────────
// Server-only action logic, split out of route.jsx so the action stays a
// thin dispatcher. Never import this file from client code (_hooks.js or
// components/) — it pulls in prisma directly.
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch + verify a claim belongs to this session. */
async function getVerifiedClaim(sessionId, id) {
    const parsed = parseInt(id, 10);
    if (!Number.isFinite(parsed)) return null;

    const claim = await prisma.physicalPrizeClaim.findFirst({
        where: { id: parsed },
        include: {
            prize: { select: { sessionId: true, title: true } },
            customer: { select: { id: true, shopifyId: true, points: true } },
        },
    });
    if (!claim || claim.prize.sessionId !== sessionId) return null;
    return claim;
}

// ── MARK CLAIM SEEN + VIEWED ───────────────────────────────────────────────

export async function handleMarkClaimSeen({ formData, session }) {
    const submitType = "markClaimSeen";
    const claimId = formData.get("claimId");
    if (!claimId) return { message: "Claim ID is required.", status: "error", submitType };

    try {
        const claim = await getVerifiedClaim(session.id, claimId);
        if (!claim) return { message: "Claim not found or access denied.", status: "error", submitType };

        const now = new Date();
        const isFirstView = !claim.viewedByAdmin;

        await prisma.physicalPrizeClaim.update({
            where: { id: parseInt(claimId, 10) },
            data: {
                isSeenByAdmin: true,
                viewedByAdmin: true,
                // Only stamp viewedAt on the very first view
                ...(isFirstView ? { viewedAt: now } : {}),
            },
        });

        return {
            status: "success", submitType,
            claimId: parseInt(claimId, 10),
            viewedAt: isFirstView ? now.toISOString() : (claim.viewedAt?.toISOString() ?? null),
        };
    } catch (err) {
        console.error("[markClaimSeen]", err);
        return { message: err.message || "Failed to mark seen.", status: "error", submitType };
    }
}

// ── UPDATE STATUS ────────────────────────────────────────────────────────────

export async function handleUpdateClaimStatus({ formData, session, admin }) {
    const submitType = "updateClaimStatus";
    const claimId = formData.get("claimId");
    const newStatus = formData.get("status");
    const trackingInfo = formData.get("trackingInfo") || null;

    if (!claimId) return { message: "Claim ID is required.", status: "error", submitType };
    if (!["FULFILLED", "COMPLETED", "CANCELLED"].includes(newStatus))
        return { message: "Invalid status.", status: "error", submitType };

    try {
        const claim = await getVerifiedClaim(session.id, claimId);
        if (!claim) return { message: "Claim not found or access denied.", status: "error", submitType };
        if (claim.status === newStatus) return { message: "Claim is already in that status.", status: "error", submitType };

        const claimIdInt = parseInt(claimId, 10);

        // CANCELLED — refund points
        if (newStatus === "CANCELLED") {
            const pointsCost = Math.abs(Number(claim.pointsCost) || 0);

            await prisma.$transaction(async (tx) => {
                await tx.physicalPrizeClaim.update({
                    where: { id: claimIdInt },
                    data: { status: "CANCELLED", fulfilledAt: null, completedAt: null },
                });
                await tx.customer.update({
                    where: { id: claim.customer.id },
                    data: { points: { increment: pointsCost } },
                });
            });

            const updated = await prisma.customer.findUnique({
                where: { id: claim.customer.id }, select: { points: true },
            });

            await createTransaction({
                customerId: claim.customer.id, type: "ADJUST",
                reason: `Points refunded — prize cancelled: ${claim.prize.title}`,
                activity: `+${pointsCost} points refunded for cancelled prize: ${claim.prize.title}`,
                points: pointsCost,
                balanceAfter: updated?.points ?? 0,
                status: "COMPLETED",
            }, session);

            await syncCustomerConfig(admin, claim.customer.shopifyId);

            return {
                message: `Claim cancelled. ${Number(pointsCost).toLocaleString()} points refunded.`,
                status: "success", submitType,
                claimId: claimIdInt, newStatus: "CANCELLED",
            };
        }

        // FULFILLED — only from PENDING
        if (newStatus === "FULFILLED") {
            if (claim.status !== "PENDING")
                return { message: "Only pending claims can be marked as fulfilled.", status: "error", submitType };

            await prisma.physicalPrizeClaim.update({
                where: { id: claimIdInt },
                data: {
                    status: "FULFILLED",
                    fulfilledAt: new Date(),
                    ...(trackingInfo ? { trackingInfo } : {}),
                },
            });

            const customer = await prisma.customer.findUnique({
                where: { id: claim.customer.id }, select: { points: true },
            });
            await createTransaction({
                customerId: claim.customer.id, type: "ADJUST",
                reason: `Prize claim fulfilled: ${claim.prize.title}`,
                activity: `Prize "${claim.prize.title}" marked as fulfilled — no points changed`,
                points: 0,
                balanceAfter: customer?.points ?? 0,
                status: "COMPLETED",
            }, session);

            await syncCustomerConfig(admin, claim.customer.shopifyId);

            return {
                message: "Claim marked as fulfilled.",
                status: "success", submitType,
                claimId: claimIdInt, newStatus: "FULFILLED", trackingInfo,
            };
        }

        // COMPLETED — only from FULFILLED
        if (newStatus === "COMPLETED") {
            if (claim.status !== "FULFILLED")
                return { message: "Only fulfilled claims can be marked as completed.", status: "error", submitType };

            await prisma.physicalPrizeClaim.update({
                where: { id: claimIdInt },
                data: { status: "COMPLETED", completedAt: new Date() },
            });

            const customer = await prisma.customer.findUnique({
                where: { id: claim.customer.id }, select: { points: true },
            });
            await createTransaction({
                customerId: claim.customer.id, type: "ADJUST",
                reason: `Prize claim completed: ${claim.prize.title}`,
                activity: `Prize "${claim.prize.title}" marked as completed — delivery confirmed`,
                points: 0,
                balanceAfter: customer?.points ?? 0,
                status: "COMPLETED",
            }, session);

            await syncCustomerConfig(admin, claim.customer.shopifyId);

            return {
                message: "Claim marked as completed.",
                status: "success", submitType,
                claimId: claimIdInt, newStatus: "COMPLETED",
            };
        }

    } catch (err) {
        console.error("[updateClaimStatus]", err);
        return { message: err.message || "Failed to update claim.", status: "error", submitType };
    }
}

// ── REVERT ──────────────────────────────────────────────────────────────────

export async function handleRevertClaim({ formData, session, admin }) {
    const submitType = "revertClaim";
    const claimId = formData.get("claimId");
    if (!claimId) return { message: "Claim ID is required.", status: "error", submitType };

    try {
        const claim = await getVerifiedClaim(session.id, claimId);
        const claimIdInt = parseInt(claimId, 10);

        if (!claim) return { message: "Claim not found or access denied.", status: "error", submitType };

        const logRevert = async (tx, reason, activity) => {
            const customer = await tx.customer.findUnique({
                where: { id: claim.customer.id }, select: { points: true },
            });
            await createTransaction({
                customerId: claim.customer.id, type: "ADJUST",
                reason, activity, points: 0,
                balanceAfter: customer?.points ?? 0, status: "COMPLETED",
            }, session);
            await syncCustomerConfig(admin, claim.customer.shopifyId);
        };

        // COMPLETED → FULFILLED
        if (claim.status === "COMPLETED") {
            await prisma.$transaction(async (tx) => {
                await tx.physicalPrizeClaim.update({
                    where: { id: claimIdInt },
                    data: { status: "FULFILLED", completedAt: null },
                });
                await logRevert(
                    tx,
                    `Prize claim reverted to fulfilled: ${claim.prize.title}`,
                    `Prize "${claim.prize.title}" reverted from completed → fulfilled — no points changed`,
                );
            });
            return { message: "Claim reverted to fulfilled.", status: "success", submitType, claimId: claimIdInt, newStatus: "FULFILLED" };
        }

        // FULFILLED → PENDING
        if (claim.status === "FULFILLED") {
            await prisma.$transaction(async (tx) => {
                await tx.physicalPrizeClaim.update({
                    where: { id: claimIdInt },
                    data: { status: "PENDING", fulfilledAt: null, trackingInfo: null },
                });
                await logRevert(
                    tx,
                    `Prize claim reverted to pending: ${claim.prize.title}`,
                    `Prize "${claim.prize.title}" reverted from fulfilled → pending — no points changed`,
                );
            });
            return { message: "Claim reverted to pending.", status: "success", submitType, claimId: claimIdInt, newStatus: "PENDING" };
        }

        // CANCELLED → PENDING (re-deduct points)
        if (claim.status === "CANCELLED") {
            const pointsCost = Math.abs(Number(claim.pointsCost) || 0);

            if (claim.customer.points < pointsCost)
                return {
                    message: `Not enough points. Required: ${pointsCost.toLocaleString()}, Available: ${claim.customer.points.toLocaleString()}.`,
                    status: "error", submitType,
                };

            await prisma.$transaction(async (tx) => {
                await tx.physicalPrizeClaim.update({
                    where: { id: claimIdInt },
                    data: { status: "PENDING", fulfilledAt: null, completedAt: null, trackingInfo: null },
                });
                await tx.customer.update({
                    where: { id: claim.customer.id },
                    data: { points: { decrement: pointsCost } },
                });
            });

            const updated = await prisma.customer.findUnique({
                where: { id: claim.customer.id }, select: { points: true },
            });
            await createTransaction({
                customerId: claim.customer.id, type: "ADJUST",
                reason: `Points re-deducted — prize reinstated: ${claim.prize.title}`,
                activity: `-${pointsCost} points re-deducted for reinstated prize: ${claim.prize.title}`,
                points: -pointsCost,
                balanceAfter: updated?.points ?? 0,
                status: "COMPLETED",
            }, session);
            await syncCustomerConfig(admin, claim.customer.shopifyId);

            return {
                message: `Claim reverted to pending. ${Number(pointsCost).toLocaleString()} points re-deducted.`,
                status: "success", submitType,
                claimId: claimIdInt, newStatus: "PENDING",
            };
        }

        return { message: "Cannot revert this claim.", status: "error", submitType };

    } catch (err) {
        console.error("[revertClaim]", err);
        return { message: err.message || "Failed to revert claim.", status: "error", submitType };
    }
}

// ── SAVE ADMIN NOTE ────────────────────────────────────────────────────────

export async function handleSaveAdminNote({ formData, session }) {
    const submitType = "saveAdminNote";
    const claimId = formData.get("claimId");
    const adminNote = formData.get("adminNote") ?? "";

    if (!claimId) return { message: "Claim ID is required.", status: "error", submitType };

    try {
        const claim = await getVerifiedClaim(session.id, claimId);
        if (!claim) return { message: "Claim not found or access denied.", status: "error", submitType };

        const trimmed = adminNote.trim() || null;

        await prisma.physicalPrizeClaim.update({
            where: { id: parseInt(claimId, 10) },
            data: { adminNote: trimmed },
        });

        return {
            message: "Note saved.",
            status: "success", submitType,
            claimId: parseInt(claimId, 10), adminNote: trimmed,
        };

    } catch (err) {
        console.error("[saveAdminNote]", err);
        return { message: err.message || "Failed to save note.", status: "error", submitType };
    }
}

// ── BULK ACTION ───────────────────────────────────────────────────────────

export async function handleBulkAction({ formData, session, admin }) {
    const submitType = "bulkAction";
    const bulkAction = formData.get("bulkAction");
    let claimIds;

    try {
        claimIds = JSON.parse(formData.get("claimIds") || "[]");
        if (!Array.isArray(claimIds)) throw new Error();
    } catch {
        return { message: "Invalid claim IDs.", status: "error", submitType };
    }

    if (!claimIds.length) return { message: "No claims selected.", status: "error", submitType };
    if (!["FULFILLED", "COMPLETED", "CANCELLED"].includes(bulkAction))
        return { message: "Invalid bulk action.", status: "error", submitType };

    try {
        const results = { success: [], failed: [] };

        for (const claimId of claimIds) {
            const claim = await getVerifiedClaim(session.id, claimId);
            const id = parseInt(claimId, 10);

            const skip =
                !claim
                || (bulkAction === "FULFILLED" && claim.status !== "PENDING")
                || (bulkAction === "COMPLETED" && claim.status !== "FULFILLED")
                || (bulkAction === "CANCELLED" && !["PENDING", "FULFILLED"].includes(claim.status));

            if (skip) { results.failed.push(id); continue; }

            if (bulkAction === "CANCELLED") {
                const pointsCost = Math.abs(Number(claim.pointsCost) || 0);
                await prisma.$transaction(async (tx) => {
                    await tx.physicalPrizeClaim.update({
                        where: { id },
                        data: { status: "CANCELLED", fulfilledAt: null, completedAt: null },
                    });
                    await tx.customer.update({
                        where: { id: claim.customer.id },
                        data: { points: { increment: pointsCost } },
                    });
                });
                const updated = await prisma.customer.findUnique({
                    where: { id: claim.customer.id }, select: { points: true },
                });
                await createTransaction({
                    customerId: claim.customer.id, type: "ADJUST",
                    reason: `Points refunded — prize cancelled: ${claim.prize.title}`,
                    activity: `+${pointsCost} points refunded for cancelled prize: ${claim.prize.title}`,
                    points: pointsCost,
                    balanceAfter: updated?.points ?? 0,
                    status: "COMPLETED",
                }, session);
                await syncCustomerConfig(admin, claim.customer.shopifyId);
            }

            if (bulkAction === "FULFILLED") {
                await prisma.physicalPrizeClaim.update({
                    where: { id },
                    data: { status: "FULFILLED", fulfilledAt: new Date() },
                });
                const customer = await prisma.customer.findUnique({
                    where: { id: claim.customer.id }, select: { points: true },
                });
                await createTransaction({
                    customerId: claim.customer.id, type: "ADJUST",
                    reason: `Prize claim fulfilled: ${claim.prize.title}`,
                    activity: `Prize "${claim.prize.title}" marked as fulfilled (bulk) — no points changed`,
                    points: 0,
                    balanceAfter: customer?.points ?? 0,
                    status: "COMPLETED",
                }, session);
                await syncCustomerConfig(admin, claim.customer.shopifyId);
            }

            if (bulkAction === "COMPLETED") {
                await prisma.physicalPrizeClaim.update({
                    where: { id },
                    data: { status: "COMPLETED", completedAt: new Date() },
                });
                const customer = await prisma.customer.findUnique({
                    where: { id: claim.customer.id }, select: { points: true },
                });
                await createTransaction({
                    customerId: claim.customer.id, type: "ADJUST",
                    reason: `Prize claim completed: ${claim.prize.title}`,
                    activity: `Prize "${claim.prize.title}" marked as completed (bulk) — delivery confirmed`,
                    points: 0,
                    balanceAfter: customer?.points ?? 0,
                    status: "COMPLETED",
                }, session);
                await syncCustomerConfig(admin, claim.customer.shopifyId);
            }

            results.success.push(id);
        }

        const actionLabel = { FULFILLED: "fulfilled", COMPLETED: "completed", CANCELLED: "cancelled" }[bulkAction];
        const msg = results.failed.length
            ? `${results.success.length} updated. ${results.failed.length} skipped (wrong status or not found).`
            : `${results.success.length} claim${results.success.length > 1 ? "s" : ""} ${actionLabel}.`;

        return {
            message: msg, status: "success", submitType,
            bulkAction, updatedIds: results.success, newStatus: bulkAction,
        };

    } catch (err) {
        console.error("[bulkAction]", err);
        return { message: err.message || "Bulk action failed.", status: "error", submitType };
    }
}
