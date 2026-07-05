import { str, bool, num } from "@app/hooks/useFormState";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS (review-specific, not shared)
// ─────────────────────────────────────────────────────────────────────────────

export const REVIEW_TYPES = [
    { key: "text", label: "Text Review", description: "Written review without any media." },
    { key: "image", label: "Photo Review", description: "Review with at least one image attached." },
    { key: "video", label: "Video Review", description: "Review with a video attached." },
];

export const REWARD_MODES = [
    {
        value: "once",
        label: "Once per product",
        description: "Customer earns points once per product, regardless of review type.",
    },
    {
        value: "per_type",
        label: "Once per review type",
        description: "Customer earns points separately for text, photo, and video — once each.",
    },
    {
        value: "unlimited",
        label: "Every submission",
        description: "Every review submission earns points, no limits.",
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// buildConditions
// ─────────────────────────────────────────────────────────────────────────────

export function buildConditions(review) {
    return {
        review: {
            text: {
                isActive: Boolean(review.text?.isActive ?? true),
                points: Number(review.text?.points ?? 0),
            },
            image: {
                isActive: Boolean(review.image?.isActive ?? true),
                points: Number(review.image?.points ?? 0),
            },
            video: {
                isActive: Boolean(review.video?.isActive ?? true),
                points: Number(review.video?.points ?? 0),
            },
            // "once" | "per_type" | "unlimited"
            rewardMode: review.rewardMode ?? "per_type",
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildFormShape
// ─────────────────────────────────────────────────────────────────────────────

export function buildFormShape(data) {
    const review = data?.conditions?.review ?? {};
    return {
        name: str(data?.name),
        description: str(data?.description),
        isActive: bool(data?.isActive ?? true),
        review: {
            text: { isActive: bool(review?.text?.isActive ?? true), points: num(review?.text?.points ?? 10) },
            image: { isActive: bool(review?.image?.isActive ?? true), points: num(review?.image?.points ?? 20) },
            video: { isActive: bool(review?.video?.isActive ?? true), points: num(review?.video?.points ?? 30) },
            rewardMode: str(review?.rewardMode ?? "per_type"),
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// validate
// ─────────────────────────────────────────────────────────────────────────────

export function validate(form) {
    const errors = {};
    const review = form.review;

    const anyActive = review.text.isActive || review.image.isActive || review.video.isActive;
    if (!anyActive) {
        errors["review.types"] = "At least one review type must be enabled.";
    }
    if (review.text.isActive && (!review.text.points || Number(review.text.points) <= 0)) {
        errors["review.text.points"] = "Text review points must be greater than 0.";
    }
    if (review.image.isActive && (!review.image.points || Number(review.image.points) <= 0)) {
        errors["review.image.points"] = "Photo review points must be greater than 0.";
    }
    if (review.video.isActive && (!review.video.points || Number(review.video.points) <= 0)) {
        errors["review.video.points"] = "Video review points must be greater than 0.";
    }

    return errors;
}
