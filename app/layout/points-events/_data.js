// ─────────────────────────────────────────────────────────────────────────────
// EVENT TYPE OPTIONS
// Mirrors the seed events in afterAuthSetup.js + allows custom additions.
// Each entry has a value (stored in DB) and a human-readable label.
// ─────────────────────────────────────────────────────────────────────────────

export const EVENT_TYPES = [
    { value: "ORDER", label: "ORDER — Direct Purchase" },
    { value: "REFERRAL", label: "REFERRAL — Refer a Friend" },
    { value: "REVIEW", label: "REVIEW — Product Review (Loox)" },
    // { value: "BIRTHDAY", label: "BIRTHDAY — Birthday Reward" },
    // { value: "SIGNUP", label: "SIGNUP — Account Sign Up" },
    // { value: "SUBSCRIPTION", label: "SUBSCRIPTION — Subscription Event" },
    // { value: "MANUAL", label: "MANUAL — Manual Adjustment" },
    // { value: "CUSTOM", label: "CUSTOM — Custom Event" },
];

export const EMPTY_EVENT = { name: "", type: "", description: "", isActive: true };

export const PER_PAGE = 10;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
//
// Pure — no server-only imports.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client-side duplicate-name/type guard, run before submit so the admin
 * gets instant feedback without waiting for the server's unique constraint
 * (P2002) to bounce the request back.
 *
 * `excludeId` skips the currently-edited record so update doesn't block itself.
 * Type uniqueness only matters for create — edit locks the type field.
 *
 * Returns an error message string, or null if the event is valid.
 */
export function findDuplicateEventError(events, ev, excludeId = null) {
    if (!ev.name?.trim()) return "Event name is required.";
    if (!ev.type) return "Please select an event type.";

    const norm = (s) => s?.trim().toLowerCase();
    const others = excludeId ? events.filter((e) => e.id !== excludeId) : events;

    if (others.some((e) => norm(e.name) === norm(ev.name))) {
        return "An event with this name already exists.";
    }
    if (!excludeId && others.some((e) => norm(e.type) === norm(ev.type))) {
        return "An event with this type already exists.";
    }
    return null;
}
