import prisma from "db-server";
import syncAppConfig from "@controller/metafieldsSync/syncAppConfig";
import { CSS_DEFAULTS } from "./constants/cssVarsConfig";

// ─────────────────────────────────────────────────────────────────────────────
// Shared upsert + sync helper. Every intent below ends with the same
// "write to DB, then push the fresh config to the storefront" sequence.
// ─────────────────────────────────────────────────────────────────────────────

async function upsertAndSync(session, admin, cssVars, presetKey = null, widgetConfig = null) {
    const data = { cssVars, presetKey, widgetConfig };
    await prisma.style.upsert({
        where: { shop: session.shop },
        update: data,
        create: { shop: session.shop, sessionId: session.id, ...data },
    });
    await syncAppConfig(admin, session);
}

// ── UPDATE ───────────────────────────────────────────────────────────────────

export async function handleUpdate({ formData, session, admin }) {
    const intent = "update";

    try {
        const cssVars = JSON.parse(formData.get("cssVars") || "{}");
        const presetKey = formData.get("presetKey") || null;
        const rawWidgetConfig = formData.get("widgetConfig");
        const widgetConfig = rawWidgetConfig ? JSON.parse(rawWidgetConfig) : null;

        await upsertAndSync(session, admin, cssVars, presetKey, widgetConfig);

        return {
            ok: true, intent, message: "Widget styles saved successfully.",
            savedCssVars: cssVars, savedPresetKey: presetKey, savedWidgetConfig: widgetConfig,
        };
    } catch (err) {
        console.error("[customize] update error:", err);
        return { ok: false, intent, message: "Something went wrong. Please try again." };
    }
}

// ── RESET ALL — back to CSS_DEFAULTS, no preset, no widget config ──────────

export async function handleResetAll({ session, admin }) {
    const intent = "resetAll";

    try {
        const fresh = { ...CSS_DEFAULTS };
        await upsertAndSync(session, admin, fresh, null, null);

        return {
            ok: true, intent, message: "All styles reset to defaults.",
            savedCssVars: fresh, savedPresetKey: null, savedWidgetConfig: null,
        };
    } catch (err) {
        console.error("[customize] resetAll error:", err);
        return { ok: false, intent, message: "Something went wrong. Please try again." };
    }
}

// ── CLEAR ALL — wipe to null, widget falls back to its own default CSS file ─

export async function handleClearAll({ session, admin }) {
    const intent = "clearAll";

    try {
        await prisma.style.upsert({
            where: { shop: session.shop },
            update: { cssVars: null, presetKey: null, widgetConfig: null },
            create: { shop: session.shop, sessionId: session.id, cssVars: null, presetKey: null, widgetConfig: null },
        });
        await syncAppConfig(admin, session);

        return {
            ok: true, intent, message: "Custom styles cleared. Widget is now using default CSS.",
            savedCssVars: null, savedPresetKey: null, savedWidgetConfig: null,
        };
    } catch (err) {
        console.error("[customize] clearAll error:", err);
        return { ok: false, intent, message: "Something went wrong. Please try again." };
    }
}
