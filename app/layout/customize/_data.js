import { WIDGET_CONFIG_DEFAULTS } from "./constants/cssVarsConfig";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG KEY HELPERS
//
// Pure — no server-only imports. configKey may be a flat key ("someKey") or
// a dotted path into a nested group ("labels.foo", "prize.bar").
// ─────────────────────────────────────────────────────────────────────────────

/** Read a (possibly nested) configKey value from widgetConfig. */
export function getConfigValue(widgetConfig, configKey, fallback) {
    if (configKey.startsWith("labels.")) {
        return widgetConfig.labels?.[configKey.slice(7)] ?? fallback;
    }
    if (configKey.startsWith("prize.")) {
        return widgetConfig.prize?.[configKey.slice(6)] ?? fallback;
    }
    return widgetConfig[configKey] ?? fallback;
}

/** Read a default value for a (possibly nested) configKey from WIDGET_CONFIG_DEFAULTS. */
export function getConfigDefault(configKey) {
    if (configKey.startsWith("labels.")) {
        return WIDGET_CONFIG_DEFAULTS.labels?.[configKey.slice(7)];
    }
    if (configKey.startsWith("prize.")) {
        return WIDGET_CONFIG_DEFAULTS.prize?.[configKey.slice(6)];
    }
    return WIDGET_CONFIG_DEFAULTS[configKey];
}
