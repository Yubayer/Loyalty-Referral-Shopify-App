// ─────────────────────────────────────────────────────────────────────────────
// Client-safe constants — imported by both server and client code.
// ─────────────────────────────────────────────────────────────────────────────

export const ALLOWED_PAGE_SIZES = [5, 10, 25, 50];
export const DEFAULT_PAGE_SIZE  = 50;

export const SORT_OPTIONS = [
    { value: "enrolledAt-desc", label: "Latest enrolled" },
    { value: "enrolledAt-asc",  label: "Oldest enrolled" },
    { value: "id-asc",          label: "ID (ascending)" },
    { value: "id-desc",         label: "ID (descending)" },
    { value: "name-asc",        label: "Name (A–Z)" },
    { value: "name-desc",       label: "Name (Z–A)" },
    { value: "email-asc",       label: "Email (A–Z)" },
    { value: "email-desc",      label: "Email (Z–A)" },
    { value: "points-desc",     label: "Points (high to low)" },
    { value: "points-asc",      label: "Points (low to high)" },
];
