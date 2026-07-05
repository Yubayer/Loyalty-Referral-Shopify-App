import { useState, useCallback, useRef } from "react";

const MODAL_ID = "adjust-points-modal";

/**
 * AdjustPointsModal — merchant-friendly points adjustment.
 *
 * UX:
 *   - Add / Remove toggle — merchant always enters a positive number
 *   - Live preview: "4,610,365 → 4,610,465 pts"
 *   - Validation: amount must be > 0; Remove blocked if insufficient balance
 */
export function AdjustPointsModal({ customer, isAdjusting, onConfirm }) {
    const modalRef = useRef(null);

    const [mode,   setMode]   = useState("add");   // "add" | "remove"
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");

    const currentPoints = customer?.points ?? 0;
    const parsedAmount  = Math.max(0, parseInt(amount, 10) || 0);

    const previewBalance = mode === "add"
        ? currentPoints + parsedAmount
        : Math.max(0, currentPoints - parsedAmount);

    const insufficientBalance = mode === "remove" && parsedAmount > currentPoints;
    const isValid = parsedAmount > 0 && !insufficientBalance;

    const reset = useCallback(() => {
        setMode("add");
        setAmount("");
        setReason("");
    }, []);

    const handleConfirm = useCallback(() => {
        if (!isValid) return;
        modalRef.current?.hideOverlay();
        onConfirm({ mode, amount: parsedAmount, reason });
        reset();
    }, [isValid, mode, parsedAmount, reason, onConfirm, reset]);

    // ── Toggle button style ───────────────────────────────────────────────────
    const toggleStyle = (active) => ({
        flex: 1,
        padding: "8px 0",
        borderRadius: "6px",
        border: active
            ? `2px solid ${mode === "add" ? "#1D9E75" : "#E24B4A"}`
            : "2px solid var(--p-color-border, #c9cccf)",
        background: active
            ? (mode === "add" ? "#f0faf6" : "#fdf2f2")
            : "var(--p-color-bg-surface, #fff)",
        color: active
            ? (mode === "add" ? "#1D9E75" : "#E24B4A")
            : "var(--p-color-text-secondary, #6d7175)",
        fontWeight: active ? 600 : 400,
        fontSize: "14px",
        cursor: "pointer",
        transition: "all 0.15s",
    });

    return (
        <>
            {/* Trigger button — rendered by parent via slot */}
            <s-modal
                ref={modalRef}
                id={MODAL_ID}
                heading="Adjust Points"
                size="base"
                onHide={reset}
            >
                {/* ── Add / Remove toggle ── */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                    <button style={toggleStyle(mode === "add")}    onClick={() => setMode("add")}>
                        + Add Points
                    </button>
                    <button style={toggleStyle(mode === "remove")} onClick={() => setMode("remove")}>
                        − Remove Points
                    </button>
                </div>

                {/* ── Amount ── */}
                <s-number-field
                    label="Points"
                    placeholder="0"
                    min="1"
                    step="1"
                    value={amount}
                    onInput={(e) => setAmount(e.target.value)}
                    error={
                        amount && !isValid
                            ? insufficientBalance
                                ? `Customer only has ${currentPoints.toLocaleString()} points.`
                                : "Points must be greater than 0."
                            : null
                    }
                />

                <s-box paddingBlockEnd="base" />

                {/* ── Live preview ── */}
                {parsedAmount > 0 && (
                    <div style={{
                        background: "var(--p-color-bg-surface-secondary)",
                        borderRadius: "8px",
                        padding: "12px 16px",
                        marginBottom: "16px",
                        fontSize: "13px",
                        color: "var(--p-color-text-secondary, #6d7175)",
                    }}>
                        Preview:{" "}
                        <strong style={{ color: "var(--p-color-text)" }}>
                            {currentPoints.toLocaleString()}
                        </strong>
                        {" → "}
                        <strong style={{ color: mode === "add" ? "#1D9E75" : "#E24B4A" }}>
                            {previewBalance.toLocaleString()} pts
                        </strong>
                    </div>
                )}

                {/* ── Reason ── */}
                <s-text-area
                    label="Reason (optional)"
                    placeholder="Manually adjusting points for customer"
                    value={reason}
                    onInput={(e) => setReason(e.target.value)}
                />

                <s-box paddingBlockEnd="base" />

                {/* ── Actions ── */}
                <s-stack direction="inline" gap="base" justifyContent="end">
                    <s-button commandFor={MODAL_ID} command="--hide">Cancel</s-button>
                    <s-button
                        variant="primary"
                        icon={mode === "add" ? "plus-circle" : "minus-circle"}
                        disabled={!isValid || isAdjusting}
                        loading={isAdjusting}
                        onClick={handleConfirm}
                    >
                        {mode === "add" ? "Add Points" : "Remove Points"}
                    </s-button>
                </s-stack>
            </s-modal>
        </>
    );
}
