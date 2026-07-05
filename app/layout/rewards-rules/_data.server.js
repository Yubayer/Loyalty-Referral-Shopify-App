import prisma from "db-server";
import syncAppConfig from "@controller/metafieldsSync/syncAppConfig";

// ─────────────────────────────────────────────────────────────────────────────
// TITLE PLACEHOLDER
//
// Server-side resolution at write-time, so the stored title is already the
// final display string (e.g. "Voucher $10") rather than the raw template.
// ─────────────────────────────────────────────────────────────────────────────

const resolveTitlePlaceholder = (title, discountType, rewardValue) => {
    if (!title) return title;
    const formatted = discountType === "percentage" ? `${rewardValue}%` : `$${rewardValue}`;
    return title.replace(/\{\{currency_value\}\}/gi, formatted);
};

// ── CREATE ───────────────────────────────────────────────────────────────────

export async function handleAddRule({ formData, session, admin }) {
    const submitType = "addRule";
    const newRule = JSON.parse(formData.get("rule") || "{}");

    if (!newRule.rewardType)
        return { message: "Please select a reward type.", status: "error", submitType };
    if (!newRule.title?.trim())
        return { message: "Display title is required.", status: "error", submitType };
    if (!newRule.pointsCost || Number(newRule.pointsCost) <= 0)
        return { message: "Points cost must be greater than 0.", status: "error", submitType };

    try {
        const resolvedTitle = resolveTitlePlaceholder(newRule.title, newRule.discountType, newRule.rewardValue);

        const created = await prisma.rewardRule.create({
            data: {
                title: resolvedTitle,
                description: newRule.description || null,
                discountType: newRule.discountType,
                rewardValue: Number(newRule.rewardValue) || 0,
                rewardType: newRule.rewardType,
                pointsCost: Number(newRule.pointsCost),
                isActive: newRule.isActive ?? true,
                startDate: newRule.startDate ? new Date(newRule.startDate) : null,
                endDate: newRule.endDate ? new Date(newRule.endDate) : null,
                session: { connect: { id: session.id } },
            },
        });

        await syncAppConfig(admin);
        return { message: "Reward rule created successfully.", rule: created, status: "success", submitType };
    } catch (err) {
        console.error("Create RewardRule Error:", err);
        return { message: "Failed to create reward rule. Please try again.", status: "error", submitType };
    }
}

// ── UPDATE ───────────────────────────────────────────────────────────────────

export async function handleUpdateRule({ formData, session, admin }) {
    const submitType = "updateRule";
    const updatedRule = JSON.parse(formData.get("rule") || "{}");

    if (!updatedRule.id)
        return { message: "Rule ID is required.", status: "error", submitType };
    if (!updatedRule.rewardType)
        return { message: "Please select a reward type.", status: "error", submitType };
    if (!updatedRule.title?.trim())
        return { message: "Display title is required.", status: "error", submitType };
    if (!updatedRule.pointsCost || Number(updatedRule.pointsCost) <= 0)
        return { message: "Points cost must be greater than 0.", status: "error", submitType };

    try {
        const existing = await prisma.rewardRule.findUnique({ where: { id: parseInt(updatedRule.id) } });
        if (!existing || existing.sessionId !== session.id)
            return { message: "Rule not found or access denied.", status: "error", submitType };

        const resolvedTitle = resolveTitlePlaceholder(updatedRule.title, updatedRule.discountType, updatedRule.rewardValue);

        const rule = await prisma.rewardRule.update({
            where: { id: parseInt(updatedRule.id) },
            data: {
                title: resolvedTitle,
                description: updatedRule.description || null,
                discountType: updatedRule.discountType,
                rewardValue: Number(updatedRule.rewardValue) || 0,
                rewardType: updatedRule.rewardType,
                pointsCost: Number(updatedRule.pointsCost),
                isActive: updatedRule.isActive ?? true,
                startDate: updatedRule.startDate ? new Date(updatedRule.startDate) : null,
                endDate: updatedRule.endDate ? new Date(updatedRule.endDate) : null,
            },
        });

        await syncAppConfig(admin);
        return { message: "Reward rule updated successfully.", rule, status: "success", submitType };
    } catch (err) {
        console.error("Update RewardRule Error:", err);
        return { message: "Failed to update reward rule. Please try again.", status: "error", submitType };
    }
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function handleDeleteRule({ formData, session, admin }) {
    const submitType = "deleteRule";
    const ruleId = parseInt(formData.get("ruleId"));
    if (!ruleId)
        return { message: "Rule ID is required.", status: "error", submitType };

    try {
        const rule = await prisma.rewardRule.findUnique({ where: { id: ruleId } });
        if (!rule || rule.sessionId !== session.id)
            return { message: "Rule not found or access denied.", status: "error", submitType };

        await prisma.rewardRule.delete({ where: { id: ruleId } });
        await syncAppConfig(admin);
        return { message: "Reward rule deleted successfully.", status: "success", submitType };
    } catch (err) {
        console.error("Delete RewardRule Error:", err);
        return { message: err.message || "Failed to delete rule. Please try again.", status: "error", submitType };
    }
}
