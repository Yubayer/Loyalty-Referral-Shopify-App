// ─────────────────────────────────────────────────────────────────────────────
// Icon.jsx
// Minimal SVG icon set for the customizer admin UI. Used only in two places:
//   1. LivePreview.jsx — the phone-frame widget mockup, mirroring the
//      storefront's own modules/icons.js so the preview matches reality.
//   2. The launcher "Button icon" picker (SimpleIconField) — the actual
//      icon choice the merchant makes for their storefront launcher button.
// All other dashboard chrome (sidebar nav, section headers, page tabs,
// preset cards, buttons) is plain text/labels — no icons, by design.
// ─────────────────────────────────────────────────────────────────────────────

const PATHS = {
    // Widget mockup icons (mirrors storefront modules/icons.js)
    rewards: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
    lightning: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></>,
    referral: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    cart: <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>,
    star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></>,
    chevronRight: <><polyline points="9 18 15 12 9 6" /></>,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    alertCircle: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,

    // Launcher button icon picker options
    gift: <><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 5H4a2 2 0 0 0 0 4h3M17 5h3a2 2 0 0 1 0 4h-3" /></>,
    gem: <><path d="m6 3 6 18 6-18M2 9h20M6 3 2 9l10 12L22 9l-4-6" /></>,
};

/**
 * Renders one of the registered icons as an inline SVG.
 * Usage: <Icon name="gift" size={18} />
 */
export function Icon({ name, size = 18, color = "currentColor", strokeWidth = 1.8 }) {
    const path = PATHS[name];
    if (!path) return null;
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {path}
        </svg>
    );
}

// ── Launcher button icon choices ─────────────────────────────────────────────
// The merchant picks one of these to display on the storefront launcher
// button. Names map 1:1 to modules/icons.js `launcherIconNames()` on the
// storefront so the admin picker/preview and live widget always agree.
export const LAUNCHER_ICON_OPTIONS = ["gift", "star", "trophy", "gem"];

export function LauncherIcon({ name, size = 20, color = "currentColor" }) {
    const resolved = LAUNCHER_ICON_OPTIONS.includes(name) ? name : "gift";
    return <Icon name={resolved} size={size} color={color} strokeWidth={1.8} />;
}
