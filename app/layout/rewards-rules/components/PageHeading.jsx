// ─────────────────────────────────────────────────────────────────────────────
// PAGE HEADING
//
// "list" view shows a title + "Create New Rule" button.
// "create" / "edit" view shows a breadcrumb-style back button + Cancel/Save.
// ─────────────────────────────────────────────────────────────────────────────

export function PageHeading({
    view,
    fs,
    isAnyBusy,
    isSaving,
    isUpdating,
    onCreate,
    onCancel,
    onSave,
    onUpdate,
}) {
    if (view === "list") {
        return (
            <s-grid gridTemplateColumns="1fr auto" gap="large" alignItems="center">
                <h2 style={{ marginBlock: "0" }}>Reward Rules</h2>
                <s-button variant="primary" onClick={onCreate} disabled={isAnyBusy}>
                    Create New Rule
                </s-button>
            </s-grid>
        );
    }

    const isEdit = view === "edit";
    return (
        <s-grid gridTemplateColumns="1fr auto" gap="large" alignItems="center">
            <s-stack direction="inline" gap="small" alignItems="center">
                <s-button
                    variant="plain"
                    onClick={onCancel}
                    disabled={isAnyBusy}
                    style={{ padding: 0, minHeight: "unset" }}
                >
                    Rules
                </s-button>
                <s-text tone="subdued">›</s-text>
                <h2 style={{ marginBlock: "0" }}>{isEdit ? "Edit Rule" : "Create New Rule"}</h2>
            </s-stack>
            <s-stack direction="inline" gap="base" alignItems="center">
                <s-button onClick={onCancel} disabled={isAnyBusy}>
                    Cancel
                </s-button>
                {isEdit ? (
                    <s-button
                        variant="primary"
                        onClick={onUpdate}
                        loading={isUpdating}
                        disabled={isUpdating || !fs.isDirty}
                    >
                        Update Rule
                    </s-button>
                ) : (
                    <s-button
                        variant="primary"
                        onClick={onSave}
                        loading={isSaving}
                        disabled={isSaving || !fs.form.rewardType || !fs.form.title?.trim()}
                    >
                        Save Rule
                    </s-button>
                )}
            </s-stack>
        </s-grid>
    );
}
