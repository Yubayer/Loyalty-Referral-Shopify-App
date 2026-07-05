/**
 * @file app.customize._index/route.jsx
 * @description Customize Widget page — list / create / edit CSS vars + widget config.
 *
 *   - Loader  : fetches the shop's saved Style record (cssVars, presetKey, widgetConfig)
 *   - Action  : update / resetAll / clearAll
 *   - Tabs    : "customize" (Simple-mode CSS fields + presets), "config" (behaviour
 *               toggles), "labels" (text overrides)
 *   - Preview : live phone-frame preview, always mounted so its portal persists
 *               across tab switches
 *
 * Layout follows the app.points-events module pattern:
 *   route.jsx          → loader, thin action dispatcher, page composition
 *   constants/         → widgetPresetsV3.js — CSS_DEFAULTS, LABEL_DEFAULTS, DS,
 *                         WIDGET_CONFIG_*, PRESETS, SIMPLE_SECTIONS, helpers
 *                         (shared by this page AND the livePreview/ panel below)
 *   livePreview/        → LivePreviewPanel — standalone phone-frame mock,
 *                         customize-exclusive, kept separate from components/
 *                         because it's a self-contained rendering surface,
 *                         not a form field
 *   _data.js            → getConfigValue, getConfigDefault (pure helpers)
 *   _loader.server.js   → prisma style lookup
 *   _action.server.js   → per-intent handlers (prisma + syncAppConfig)
 *   _hooks.js            → useCustomizePage() — all state, dirty-tracking, handlers
 *   components/          → presentational pieces (fields, section panels, tabs)
 */

import { useActionData, useLoaderData } from "react-router";
import { authenticate } from "shopify-server";
import SaveBar from "@components/saveBar/SaveBar";

import { loadCustomizeData } from "./_loader.server";
import { handleUpdate, handleResetAll, handleClearAll } from "./_action.server";
import { useCustomizePage } from "./_hooks";
import { SECTION_TO_SCENE } from "./constants/cssVarsConfig";

import LivePreviewPanel from "./livePreview/LivePreview";
import { PageHeader } from "./components/PageHeader";
import { CustomizeTab } from "./components/CustomizeTab";
import { ConfigTab } from "./components/ConfigTab";
import { LabelsTab } from "./components/LabelsTab";
import { AdvancedTab } from "./components/AdvancedTab";

// ─────────────────────────────────────────────────────────────────────────────
// LOADER
// ─────────────────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    return loadCustomizeData(session.shop);
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTION — thin dispatcher; per-intent logic lives in _action.server.js
// ─────────────────────────────────────────────────────────────────────────────

export const action = async ({ request }) => {
    const { session, admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");
    const ctx = { formData, session, admin };

    switch (intent) {
        case "update": return handleUpdate(ctx);
        case "resetAll": return handleResetAll(ctx);
        case "clearAll": return handleClearAll(ctx);
        default: return { ok: false, message: "Unknown intent." };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function CustomizeNew() {
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const page = useCustomizePage(loaderData, actionData);

    // Which preview scene to show, based on the active tab/section
    const previewScene =
        page.pageTab === "customize" && page.activeSimpleSection === "notifications"
            ? (page.notificationPreviewType === "reward" ? "notification-reward" : "notification-info")
            : page.pageTab === "customize"
                ? (SECTION_TO_SCENE[page.activeSimpleSection] ?? "home")
                : "home";

    return (
        <s-page inlineSize="large">
            <PageHeader
                hasChanges={page.hasChanges}
                isFirstSave={page.isFirstSave}
                totalDirtyVarCount={page.totalDirtyVarCount}
                isNetworkSubmitting={page.isNetworkSubmitting}
                isUpdating={page.isUpdating}
                activeIntent={page.activeIntent}
                pageTab={page.pageTab}
                onTabChange={page.setPageTab}
                onDiscard={page.handleDiscard}
                onResetAll={page.handleResetAll}
                onSave={page.handleSave}
            />

            {/* ══ LIVE PREVIEW — always mounted so portal persists across tabs ══ */}
            <LivePreviewPanel
                cssVars={page.deferredCssVars}
                widgetConfig={page.widgetConfig}
                hidden={page.pageTab === "config"}
                previewScene={previewScene}
            />

            {page.pageTab === "customize" && (
                <CustomizeTab
                    activePreset={page.activePreset}
                    onPresetApply={page.handlePresetApply}
                    activeSimpleSection={page.activeSimpleSection}
                    onSimpleSectionChange={page.setActiveSimpleSection}
                    simpleSectionDirtyCount={page.simpleSectionDirtyCount}
                    activeSimpleSectionDef={page.activeSimpleSectionDef}
                    cssVars={page.cssVars}
                    onSimpleChange={page.handleSimpleChange}
                    notificationPreviewType={page.notificationPreviewType}
                    onNotificationPreviewChange={page.setNotificationPreviewType}
                    isNetworkSubmitting={page.isNetworkSubmitting}
                    onResetAll={page.handleResetAll}
                    onClearAll={page.handleClearAll}
                />
            )}

            {page.pageTab === "config" && (
                <ConfigTab
                    activeConfigSection={page.activeConfigSection}
                    onConfigSectionChange={page.setActiveConfigSection}
                    configSectionDirtyCount={page.configSectionDirtyCount}
                    widgetConfig={page.widgetConfig}
                    onConfigChange={page.handleConfigChange}
                    onResetConfig={page.setWidgetConfig}
                    isNetworkSubmitting={page.isNetworkSubmitting}
                />
            )}

            {page.pageTab === "labels" && (
                <LabelsTab
                    widgetConfig={page.widgetConfig}
                    onConfigChange={page.handleConfigChange}
                    isNetworkSubmitting={page.isNetworkSubmitting}
                />
            )}

            {page.pageTab === "advanced" && (
                <AdvancedTab
                    cssVars={page.cssVars}
                    onSimpleChange={page.handleSimpleChange}
                    isNetworkSubmitting={page.isNetworkSubmitting}
                />
            )}

            {/* ══ FLOATING SAVE BAR ══ */}
            <SaveBar
                visible={page.hasChanges}
                position="bottom-center"
                message={
                    page.totalDirtyVarCount > 0
                        ? `${page.totalDirtyVarCount} unsaved change${page.totalDirtyVarCount !== 1 ? "s" : ""}`
                        : "Unsaved changes"
                }
                primaryLabel={page.isUpdating ? "Saving…" : "Save changes"}
                secondaryLabel="Discard"
                onPrimary={page.handleSave}
                onSecondary={page.handleDiscard}
                loading={page.isUpdating}
                disabled={page.isNetworkSubmitting}
            />
        </s-page>
    );
}