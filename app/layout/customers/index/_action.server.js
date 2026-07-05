import prisma from "db-server";
import { processCustomerSync } from "@controller/customers/customerSyncProcessor";

// ─────────────────────────────────────────────────────────────────────────────
// Sync Customers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles the "sync-customers" action.
 *
 * Flow:
 *   1. Guard — if a sync job is already PENDING or PROCESSING, return early
 *   2. Create a CUSTOMER_SYNC job (PENDING)
 *   3. Fire processCustomerSync via setImmediate — HTTP response returns first,
 *      sync runs in the background without blocking or timing out
 *
 * @param {{ admin: Object, session: Object }} ctx
 */
export async function handleSyncCustomers({ admin, session }) {
    const submitType = "sync-customers";

    // ── Guard: already running ────────────────────────────────────────────────
    const existing = await prisma.job.findFirst({
        where: {
            type:   "CUSTOMER_SYNC",
            shop:   session.shop,
            status: { in: ["PENDING", "PROCESSING"] },
        },
        select: { id: true, status: true },
    });

    if (existing) {
        return Response.json({
            message:    "Sync is already in progress.",
            isError:    false,
            submitType,
            syncJobId:  existing.id,
            syncStatus: existing.status,
        });
    }

    // ── Create job ────────────────────────────────────────────────────────────
    const job = await prisma.job.create({
        data: {
            type:            "CUSTOMER_SYNC",
            shop:            session.shop,
            status:          "PENDING",
            idempotencyKey:  `CUSTOMER_SYNC:${session.shop}:${Date.now()}`,
            payload:         { shop: session.shop, sessionId: session.id },
        },
    });

    // ── Immediate trigger — fire and forget ───────────────────────────────────
    // setImmediate defers execution until after the current event loop tick,
    // so the HTTP response returns to the client before sync begins.
    // The Node.js process stays alive (Express server), so the async work
    // continues safely in the background.
    setImmediate(() => {
        processCustomerSync(admin, session, job.id).catch((err) => {
            console.error(`[customerSync] Background error for job #${job.id}:`, err?.message);
        });
    });

    return Response.json({
        message:    "Sync started.",
        isError:    false,
        submitType,
        syncJobId:  job.id,
        syncStatus: "PROCESSING",
    });
}
