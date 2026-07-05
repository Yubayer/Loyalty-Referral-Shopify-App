import { useNavigate } from "react-router";

// ─────────────────────────────────────────────────────────────────────────────
// PageHeader
//
// Breadcrumb row + active/inactive badge.
// Used at the top of every points-rule page.
//
// Props:
//   title    {string}  - e.g. "Referral Rule" | "Order Rule" | "Review Rule"
//   mode     {string}  - "create" | "edit"
//   isActive {boolean} - drives the badge tone
//   busy     {boolean} - disables the back button while submitting
// ─────────────────────────────────────────────────────────────────────────────

export function PageHeader({ title, mode, isActive, busy }) {
    const navigate = useNavigate();

    return (
        <s-section>
            <s-grid gridTemplateColumns="1fr auto" gap="large" alignItems="center">
                <s-stack direction="inline" gap="small" alignItems="center">
                    <s-button
                        variant="plain"
                        onClick={() => navigate("/app/points-rules")}
                        disabled={busy}
                        style={{ padding: 0, minHeight: "unset" }}
                    >
                        Points Rules
                    </s-button>
                    <s-text tone="subdued">›</s-text>
                    <h2 style={{ marginBlock: "0" }}>
                        {mode === "edit" ? "Edit" : "Create"} — {title}
                    </h2>
                </s-stack>
                <s-badge tone={isActive ? "success" : "critical"}>
                    {isActive ? "Active" : "Inactive"}
                </s-badge>
            </s-grid>
        </s-section>
    );
}
