import { str, bool, num, arr } from "@app/hooks/useFormState";

// ─────────────────────────────────────────────────────────────────────────────
// buildConditions
//
// Structures the referral form values before saving to DB.
// Priority system:
//   P1 — global fallback (referrer + referred base points)
//   P2 — global interval override (subscription frequency, no group match)
//   P3 — group override (product in group, no interval match)
//   P4 — group + interval override (highest priority)
// ─────────────────────────────────────────────────────────────────────────────

export function buildConditions(referral) {
    return {
        referral: {
            // "oneTime" | "subscription" | "both"
            trigger: referral.trigger,

            // P1 — global fallback
            referrer: {
                points: Number(referral.referrer?.points ?? 0),
                allowRenewalReward: Boolean(referral.referrer?.allowRenewalReward ?? false),
                renewalPoints: Number(referral.referrer?.renewalPoints ?? 0),
            },
            referred: {
                // Always global — never overridden at group level
                // "fixed" | "percentage"
                discountType: referral.referred?.discountType ?? "fixed",
                discountValue: Number(referral.referred?.discountValue ?? 0),
                points: Number(referral.referred?.points ?? 0),
                allowRenewalReward: Boolean(referral.referred?.allowRenewalReward ?? false),
                renewalPoints: Number(referral.referred?.renewalPoints ?? 0),
            },

            // P2 — global interval override
            intervals: (referral.intervals ?? []).map((iv) => ({
                interval: iv.interval,
                referrer: {
                    points: Number(iv.referrer?.points ?? 0),
                    allowRenewalReward: Boolean(iv.referrer?.allowRenewalReward ?? false),
                    renewalPoints: Number(iv.referrer?.renewalPoints ?? 0),
                },
                referred: {
                    points: Number(iv.referred?.points ?? 0),
                    allowRenewalReward: Boolean(iv.referred?.allowRenewalReward ?? false),
                    renewalPoints: Number(iv.referred?.renewalPoints ?? 0),
                },
            })),

            // P3 + P4 — group overrides
            groups: (referral.groups ?? []).map((g) => ({
                id: g.id,
                name: g.name,
                products: (g.products ?? []).map((p) => ({
                    id: p.id,
                    title: p.title,
                    image: p.image ?? null,
                    handle: p.handle,
                })),
                referrer: {
                    points: Number(g.referrer?.points ?? 0),
                    allowRenewalReward: Boolean(g.referrer?.allowRenewalReward ?? false),
                    renewalPoints: Number(g.referrer?.renewalPoints ?? 0),
                },
                referred: {
                    points: Number(g.referred?.points ?? 0),
                    allowRenewalReward: Boolean(g.referred?.allowRenewalReward ?? false),
                    renewalPoints: Number(g.referred?.renewalPoints ?? 0),
                },
                // P4 — group interval override
                intervals: (g.intervals ?? []).map((iv) => ({
                    interval: iv.interval,
                    referrer: {
                        points: Number(iv.referrer?.points ?? 0),
                        allowRenewalReward: Boolean(iv.referrer?.allowRenewalReward ?? false),
                        renewalPoints: Number(iv.referrer?.renewalPoints ?? 0),
                    },
                    referred: {
                        points: Number(iv.referred?.points ?? 0),
                        allowRenewalReward: Boolean(iv.referred?.allowRenewalReward ?? false),
                        renewalPoints: Number(iv.referred?.renewalPoints ?? 0),
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
    const ref = data?.conditions?.referral ?? {};
    return {
        name: str(data?.name),
        description: str(data?.description),
        isActive: bool(data?.isActive ?? true),
        referral: {
            trigger: str(ref?.trigger ?? "subscription"),

            // P1 — global fallback defaults
            referrer: {
                points: num(ref?.referrer?.points ?? 100),
                allowRenewalReward: bool(ref?.referrer?.allowRenewalReward ?? false),
                renewalPoints: num(ref?.referrer?.renewalPoints ?? 80),
            },
            referred: {
                discountType: str(ref?.referred?.discountType ?? "fixed"),
                discountValue: num(ref?.referred?.discountValue ?? 10),
                points: num(ref?.referred?.points ?? 50),
                allowRenewalReward: bool(ref?.referred?.allowRenewalReward ?? false),
                renewalPoints: num(ref?.referred?.renewalPoints ?? 40),
            },

            intervals: arr(ref?.intervals), // P2
            groups: arr(ref?.groups),    // P3 + P4
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// validate
// ─────────────────────────────────────────────────────────────────────────────

export function validate(form) {
    const errors = {};
    const ref = form.referral.referrer;
    const referred = form.referral.referred;

    if (!ref.points || Number(ref.points) <= 0) {
        errors["referral.referrer.points"] = "Referrer points must be greater than 0.";
    }
    if (!referred.discountValue || Number(referred.discountValue) <= 0) {
        errors["referral.referred.discountValue"] = "Referred discount value must be greater than 0.";
    }
    if (!referred.points || Number(referred.points) <= 0) {
        errors["referral.referred.points"] = "Referred points must be greater than 0.";
    }

    return errors;
}
