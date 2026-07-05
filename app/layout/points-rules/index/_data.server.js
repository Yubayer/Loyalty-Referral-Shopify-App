import prisma from "db-server";

export async function handleDeleteRule({ formData, session, admin }) {
    const submitType = "deleteRule";
    const ruleId = parseInt(formData.get("ruleId"));
    if (!ruleId)
        return { message: "Rule ID is required.", status: "error", submitType };

    try {
        const rule = await prisma.pointsRule.findUnique({ where: { id: ruleId } });
        if (!rule || rule.sessionId !== session.id)
            return { message: "Rule not found or access denied.", status: "error", submitType };

        await prisma.pointsRule.delete({ where: { id: ruleId } });

        // sync app config after delete
        const { default: syncAppConfig } = await import("@controller/metafieldsSync/syncAppConfig");
        await syncAppConfig(admin, session);

        return { message: "Points rule deleted successfully.", status: "success", submitType };
    } catch (err) {
        console.error("Delete Rule Error:", err);
        return { message: err.message || "Failed to delete rule.", status: "error", submitType };
    }
}
