import createTransaction from "@controller/transaction/createTransaction";
import { syncCustomerConfig } from "app/controller/metafieldsSync/syncCustomerConfig";

export async function handleAdjustPoints({ formData, session, admin }) {
    const submitType = "adjustPoints";
    const customerId = parseInt(formData.get("customerId"), 10);
    const shopifyId  = formData.get("shopifyId");
    const mode       = formData.get("mode");   // "add" | "remove"
    const amount     = parseInt(formData.get("amount"), 10);
    const reason     = formData.get("reason")?.trim() || null;

    if (!customerId) return { message: "Customer ID is required.", status: "error", submitType };
    if (!["add", "remove"].includes(mode)) return { message: "Invalid mode.", status: "error", submitType };
    if (!amount || amount <= 0) return { message: "Points must be greater than 0.", status: "error", submitType };

    // ADJUST type accepts signed value — positive to add, negative to remove
    const signedPoints = mode === "add" ? amount : -amount;

    try {
        const tx = await createTransaction({
            customerId,
            type:     "ADJUST",
            points:   signedPoints,
            reason:   reason ?? `Admin ${mode === "add" ? "added" : "removed"} ${amount} points`,
            activity: `Admin ${mode === "add" ? "added" : "removed"} ${amount} points`,
            status:   "COMPLETED",
        }, session);

        if (!tx) return { message: "Failed to adjust points.", status: "error", submitType };

        await syncCustomerConfig(admin, shopifyId);

        return {
            message:      `${amount.toLocaleString()} points ${mode === "add" ? "added" : "removed"} successfully.`,
            status:       "success",
            submitType,
            balanceAfter: tx.balanceAfter,
        };
    } catch (err) {
        console.error("[adjustPoints]", err);
        return { message: err.message || "Failed to adjust points.", status: "error", submitType };
    }
}
