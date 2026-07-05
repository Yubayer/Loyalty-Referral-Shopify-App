import { str, bool, num, arr } from "@app/hooks/useFormState";

// ─────────────────────────────────────────────────────────────────────────────
// buildConditions
//
// Structures the order form values before saving to DB.
// Earning type applies globally — only the value overrides at each level.
//   P1 — global fallback (fixedPoints or rate)
//   P2 — global interval override
//   P3 — group override
//   P4 — group + interval override (highest priority)
// ─────────────────────────────────────────────────────────────────────────────

export function buildConditions(order) {
    return {
        order: {
            // "oneTime" | "subscription" | "both"
            trigger: order.trigger,

            // "fixed" | "incremental" — same type at all levels, only value overrides
            type: order.type,

            // P1 — global fallback
            fixedPoints: Number(order.fixedPoints ?? 0),
            rate: {
                amount: Number(order.rate?.amount ?? 0),
                points: Number(order.rate?.points ?? 0),
            },

            // Products that should never earn points (any priority)
            excludedProducts: (order.excludedProducts ?? []).map((p) => ({
                id: p.id,
                title: p.title,
                image: p.image ?? null,
                handle: p.handle,
            })),

            // P2 — global interval override
            intervals: (order.intervals ?? []).map((iv) => ({
                interval: iv.interval,
                fixedPoints: Number(iv.fixedPoints ?? 0),
                rate: {
                    amount: Number(iv.rate?.amount ?? 0),
                    points: Number(iv.rate?.points ?? 0),
                },
            })),

            // P3 + P4 — group overrides
            groups: (order.groups ?? []).map((g) => ({
                id: g.id,
                name: g.name,
                products: (g.products ?? []).map((p) => ({
                    id: p.id,
                    title: p.title,
                    image: p.image ?? null,
                    handle: p.handle,
                })),
                fixedPoints: Number(g.fixedPoints ?? 0),
                rate: {
                    amount: Number(g.rate?.amount ?? 0),
                    points: Number(g.rate?.points ?? 0),
                },
                // P4 — group interval override
                intervals: (g.intervals ?? []).map((iv) => ({
                    interval: iv.interval,
                    fixedPoints: Number(iv.fixedPoints ?? 0),
                    rate: {
                        amount: Number(iv.rate?.amount ?? 0),
                        points: Number(iv.rate?.points ?? 0),
                    },
                })),
            })),
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildFormShape
// ─────────────────────────────────────────────────────────────────────────────

export function buildFormShape(data) {
    const order = data?.conditions?.order ?? {};
    return {
        name: str(data?.name),
        description: str(data?.description),
        isActive: bool(data?.isActive ?? true),
        order: {
            trigger: str(order?.trigger ?? "subscription"),
            type: str(order?.type ?? "incremental"),
            fixedPoints: num(order?.fixedPoints ?? 100),
            rate: {
                amount: num(order?.rate?.amount ?? 10),
                points: num(order?.rate?.points ?? 1),
            },
            excludedProducts: arr(order?.excludedProducts),
            intervals: arr(order?.intervals),
            groups: arr(order?.groups),
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// validate
// ─────────────────────────────────────────────────────────────────────────────

export function validate(form) {
    const errors = {};
    const order = form.order;

    if (order.type === "fixed") {
        if (!order.fixedPoints || Number(order.fixedPoints) <= 0) {
            errors["order.fixedPoints"] = "Fixed points must be greater than 0.";
        }
    }

    if (order.type === "incremental") {
        if (!order.rate.points || Number(order.rate.points) <= 0) {
            errors["order.rate.points"] = "Points per rate must be greater than 0.";
        }
        if (!order.rate.amount || Number(order.rate.amount) <= 0) {
            errors["order.rate.amount"] = "Amount per rate must be greater than 0.";
        }
    }

    return errors;
}
