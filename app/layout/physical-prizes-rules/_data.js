import { str, num, bool } from "@app/hooks/useFormState";

// ─────────────────────────────────────────────────────────────────────────────
// FORM SHAPE
// ─────────────────────────────────────────────────────────────────────────────

export const EMPTY_PRIZE_DATA = {
    id: null, title: null, description: null, imageUrl: null,
    pointsCost: null, productValue: null, isActive: true,
};

export function buildFormShape(data) {
    return {
        id: data?.id ?? null,
        title: str(data?.title),
        description: str(data?.description),
        imageUrl: data?.imageUrl ?? null,
        pointsCost: num(data?.pointsCost),
        productValue: num(data?.productValue),
        isActive: bool(data?.isActive ?? true),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

export function validate(form) {
    const errors = {};
    if (!form.title?.trim())
        errors.title = "Title is required.";
    if (!form.pointsCost || Number(form.pointsCost) <= 0)
        errors.pointsCost = "Points cost must be greater than 0.";
    return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────

export const PER_PAGE = 10;
