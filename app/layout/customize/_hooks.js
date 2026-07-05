import { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue } from "react";
import { useSubmit, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

import {
    SIMPLE_SECTIONS, WIDGET_CONFIG_SECTIONS, CSS_DEFAULTS, PRESETS,
    deepClone, isEqual, matchesPreset, buildInitialVars, buildInitialWidgetConfig,
} from "./constants/cssVarsConfig";

/**
 * Encapsulates all page-level state for the Customize page: CSS var state,
 * widget config state, preset selection, dirty tracking (styles + config),
 * post-action server sync, and every handler the page needs.
 *
 * BUG FIX: the original inline page called `shopify.toast.show(...)` without
 * ever declaring `shopify` — useAppBridge() was never imported or called.
 * That threw a ReferenceError on every action response, silently breaking
 * the save/reset/clear toast feedback. Fixed here.
 */
export function useCustomizePage(loaderData, actionData) {
    const { savedCssVars, savedWidgetConfig } = loaderData;
    const submit = useSubmit();
    const navigation = useNavigation();
    const shopify = useAppBridge();

    const isNetworkSubmitting = navigation.state === "submitting";

    // ── CSS vars state ────────────────────────────────────────────────────────
    const initialVars = useMemo(() => buildInitialVars(savedCssVars), []);
    const [cssVars, setCssVars] = useState(() => deepClone(initialVars));
    const [persistedVars, setPersistedVars] = useState(() => deepClone(initialVars));

    // ── Widget config state ───────────────────────────────────────────────────
    const [widgetConfig, setWidgetConfig] = useState(() => buildInitialWidgetConfig(savedWidgetConfig));
    const [persistedWidgetConfig, setPersistedWidgetConfig] = useState(() => buildInitialWidgetConfig(savedWidgetConfig));

    // ── Other persisted state ─────────────────────────────────────────────────
    const [hasSavedCustomStyles, setHasSavedCustomStyles] = useState(savedCssVars !== null);

    // ── UI-only state (never sent to server, never dirty-tracked) ────────────
    const [activeSimpleSection, setActiveSimpleSection] = useState(SIMPLE_SECTIONS[0].key);
    const [activeConfigSection, setActiveConfigSection] = useState(WIDGET_CONFIG_SECTIONS[0].key);
    const [pageTab, setPageTab] = useState("customize");
    const [activeIntent, setActiveIntent] = useState(null);
    const [notificationPreviewType, setNotificationPreviewType] = useState("reward");

    // ── Active "Quick Theme" — DERIVED, not tracked state ─────────────────────
    // Previously this was a separate useState that got explicitly cleared to
    // null on every manual field edit (see the old handleSimpleChange). That
    // meant tweaking one field away from an applied preset — or even editing
    // it and landing back on the exact same value — permanently deselected
    // every "Quick Theme" card until a preset button was clicked again, since
    // nothing ever recomputed the selection from what was actually on screen.
    // Deriving it straight from cssVars removes that whole class of bug: the
    // highlighted theme (if any) always reflects the values currently shown,
    // full stop.
    const activePreset = useMemo(
        () => PRESETS.find((p) => matchesPreset(p, cssVars))?.key ?? null,
        [cssVars]
    );

    // ── Post-action sync ──────────────────────────────────────────────────────
    //
    // React Router's actionData never goes back to null after first
    // response, so a simple [actionData] effect fires only on the *first* save.
    // Subsequent saves with the same object reference are silently ignored,
    // leaving persistedVars stale → hasChanges stays true forever.
    //
    // track the last-processed response by reference. When actionData is a
    // new object (every successful POST creates a new one) we run the sync.
    // This is a ref comparison, not value comparison — zero extra renders.
    const lastSyncedActionRef = useRef(null);

    useEffect(() => {
        if (!actionData) return;
        // Already processed this exact response object — skip.
        if (actionData === lastSyncedActionRef.current) return;
        lastSyncedActionRef.current = actionData;

        shopify.toast.show(actionData.message, { isError: !actionData.ok });
        setActiveIntent(null);
        if (!actionData.ok) return;

        if (["update", "resetAll"].includes(actionData.intent)) {
            const freshVars = buildInitialVars(actionData.savedCssVars);
            const freshWc = buildInitialWidgetConfig(actionData.savedWidgetConfig ?? null);
            // Sync both live + persisted state to the fresh server values.
            // activePreset re-derives itself from cssVars — nothing to set here.
            setCssVars(freshVars);
            setPersistedVars(freshVars);
            setWidgetConfig(freshWc);
            setPersistedWidgetConfig(freshWc);
            setHasSavedCustomStyles(true);
        }

        if (actionData.intent === "clearAll") {
            const freshVars = deepClone(CSS_DEFAULTS);
            const freshWc = buildInitialWidgetConfig(null);
            setCssVars(freshVars);
            setPersistedVars(freshVars);
            setWidgetConfig(freshWc);
            setPersistedWidgetConfig(freshWc);
            setHasSavedCustomStyles(false);
        }
        // shopify is intentionally omitted — it's stable across this effect's
        // lifetime and including it would re-fire the toast on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actionData]);

    // ── Dirty tracking ────────────────────────────────────────────────────────
    const hasStyleChanges = useMemo(() => !isEqual(cssVars, persistedVars), [cssVars, persistedVars]);

    // BUG FIX (preserved from original): was comparing widgetConfig vs
    // WIDGET_CONFIG_DEFAULTS (always-dirty if user saved non-default values).
    // Must compare vs persistedWidgetConfig.
    const hasConfigChanges = useMemo(
        () => JSON.stringify(widgetConfig) !== JSON.stringify(persistedWidgetConfig),
        [widgetConfig, persistedWidgetConfig]
    );

    const hasChanges = hasStyleChanges || hasConfigChanges;
    const isUpdating = isNetworkSubmitting && activeIntent === "update";
    // Use loader's savedCssVars (not hasSavedCustomStyles) so clearAll doesn't show "First setup"
    const isFirstSave = savedCssVars === null && !hasChanges;

    const totalDirtyVarCount = useMemo(
        () => Object.keys(cssVars).filter((k) => cssVars[k] !== persistedVars[k]).length,
        [cssVars, persistedVars]
    );

    // ── Sidebar dirty badge counts ────────────────────────────────────────────
    const simpleSectionDirtyCount = useCallback((section) => {
        return section.fields.filter((f) => f.maps.some((v) => cssVars[v] !== persistedVars[v])).length;
    }, [cssVars, persistedVars]);

    // BUG FIX (preserved from original): compare vs persistedWidgetConfig, not
    // WIDGET_CONFIG_DEFAULTS. Using defaults meant badge never cleared after
    // saving non-default values.
    const configSectionDirtyCount = useCallback((section) => {
        return section.fields.filter((f) => {
            if (f.configKey.startsWith("labels.")) {
                const labelKey = f.configKey.slice(7);
                return widgetConfig.labels?.[labelKey] !== persistedWidgetConfig.labels?.[labelKey];
            }
            if (f.configKey.startsWith("prize.")) {
                const prizeKey = f.configKey.slice(6);
                return widgetConfig.prize?.[prizeKey] !== persistedWidgetConfig.prize?.[prizeKey];
            }
            return widgetConfig[f.configKey] !== persistedWidgetConfig[f.configKey];
        }).length;
    }, [widgetConfig, persistedWidgetConfig]);

    // ── Deferred vars for live preview ────────────────────────────────────────
    const deferredCssVars = useDeferredValue(cssVars);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleSimpleChange = useCallback((updates) => {
        // No explicit setActivePreset(null) needed anymore — if `updates`
        // moves cssVars away from a preset's exact values, the derived
        // activePreset memo simply stops matching on its own next render.
        setCssVars((prev) => ({ ...prev, ...updates }));
    }, []);

    const handleConfigChange = useCallback((key, value) => {
        if (key.startsWith("labels.")) {
            const labelKey = key.slice(7);
            setWidgetConfig((prev) => ({ ...prev, labels: { ...prev.labels, [labelKey]: value } }));
        } else if (key.startsWith("prize.")) {
            const prizeKey = key.slice(6);
            setWidgetConfig((prev) => ({ ...prev, prize: { ...prev.prize, [prizeKey]: value } }));
        } else {
            setWidgetConfig((prev) => ({ ...prev, [key]: value }));
        }
    }, []);

    const handlePresetApply = useCallback((preset) => {
        setCssVars((prev) => ({ ...prev, ...preset.vars }));
    }, []);

    const handleDiscard = useCallback(() => {
        setCssVars(deepClone(persistedVars));
        setWidgetConfig(deepClone(persistedWidgetConfig));
        // activePreset re-derives from cssVars, which now matches whatever
        // preset (if any) persistedVars itself matches.
    }, [persistedVars, persistedWidgetConfig]);

    const handleSave = useCallback(() => {
        setActiveIntent("update");
        const fd = new FormData();
        fd.set("intent", "update");
        fd.set("cssVars", JSON.stringify(cssVars));
        // Always send presetKey — empty string signals "clear" to the action
        fd.set("presetKey", activePreset ?? "");
        fd.set("widgetConfig", JSON.stringify(widgetConfig));
        submit(fd, { method: "post" });
    }, [cssVars, activePreset, widgetConfig, submit]);

    const handleResetAll = useCallback(() => {
        setActiveIntent("resetAll");
        const fd = new FormData();
        fd.set("intent", "resetAll");
        submit(fd, { method: "post" });
    }, [submit]);

    const handleClearAll = useCallback(() => {
        setActiveIntent("clearAll");
        const fd = new FormData();
        fd.set("intent", "clearAll");
        submit(fd, { method: "post" });
    }, [submit]);

    // ── Convenience ───────────────────────────────────────────────────────────
    const activeSimpleSectionDef = SIMPLE_SECTIONS.find((s) => s.key === activeSimpleSection) ?? SIMPLE_SECTIONS[0];

    return {
        cssVars, deferredCssVars, widgetConfig,
        activePreset, activeSimpleSection, activeConfigSection, activeSimpleSectionDef,
        pageTab, setPageTab,
        notificationPreviewType, setNotificationPreviewType,

        hasChanges, isFirstSave, isUpdating, isNetworkSubmitting, activeIntent,
        totalDirtyVarCount,
        simpleSectionDirtyCount, configSectionDirtyCount,

        setActiveSimpleSection, setActiveConfigSection,
        setWidgetConfig,

        handleSimpleChange, handleConfigChange, handlePresetApply,
        handleDiscard, handleSave, handleResetAll, handleClearAll,
    };
}