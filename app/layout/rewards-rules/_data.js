import { str, num, bool } from "@app/hooks/useFormState";

// ─────────────────────────────────────────────────────────────────────────────
// FORM SHAPE
// ─────────────────────────────────────────────────────────────────────────────

export const EMPTY_RULE = {
    id: null,
    title: "Voucher {{currency_value}}",
    description: null,
    discountType: "fixed",       // "fixed" | "percentage"
    rewardValue: 5,
    rewardType: "orderDiscount", // "orderDiscount" | "productDiscount" | "freeProduct" | "freeShipping"
    pointsCost: 100,
    isActive: true,
    startDate: null,
    endDate: null,
};

export function buildFormShape(data) {
    return {
        id: data?.id ?? null,
        title: str(data?.title ?? EMPTY_RULE.title),
        description: str(data?.description),
        discountType: str(data?.discountType ?? EMPTY_RULE.discountType),
        rewardValue: num(data?.rewardValue ?? EMPTY_RULE.rewardValue),
        rewardType: str(data?.rewardType ?? EMPTY_RULE.rewardType),
        pointsCost: num(data?.pointsCost ?? EMPTY_RULE.pointsCost),
        isActive: bool(data?.isActive ?? true),
        startDate: data?.startDate ?? null,
        endDate: data?.endDate ?? null,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

export function validate(form) {
    const errors = {};
    if (!form.rewardType)
        errors.rewardType = "Please select a reward type.";
    if (!form.title?.trim())
        errors.title = "Display title is required.";
    if (!form.pointsCost || Number(form.pointsCost) <= 0)
        errors.pointsCost = "Points cost must be greater than 0.";
    if (form.rewardType === "orderDiscount" && !(Number(form.rewardValue) > 0))
        errors.rewardValue = "Discount value must be greater than 0.";
    return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
//
// Pure — no server-only imports. Shared by client (_hooks.js, components/)
// and re-derived server-side at write-time (see _data.server.js).
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve `{{currency_value}}` in the title for display purposes. */
export const previewTitle = (title, discountType, rewardValue) => {
    if (!title) return "";
    const formatted = discountType === "percentage" ? `${rewardValue}%` : `$${rewardValue}`;
    return title.replace(/\{\{currency_value\}\}/gi, formatted);
};

export const formatDiscount = (discountType, rewardValue) =>
    discountType === "percentage" ? `${rewardValue}%` : `$${rewardValue}`;

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────

export const PER_PAGE = 10;
