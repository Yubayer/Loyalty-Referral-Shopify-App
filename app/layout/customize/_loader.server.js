import prisma from "db-server";

// ─────────────────────────────────────────────────────────────────────────────
// Server-only. Never import from client code (_hooks.js or components/).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads the shop's saved widget style record, if any.
 *
 * @param {string} shop
 * @returns {{ savedCssVars: object|null, savedPresetKey: string|null, savedWidgetConfig: object|null }}
 */
export async function loadCustomizeData(shop) {
    const style = await prisma.style.findUnique({ where: { shop } });
    return {
        savedCssVars: style?.cssVars ?? null,
        savedPresetKey: style?.presetKey ?? null,
        savedWidgetConfig: style?.widgetConfig ?? null,
    };
}
