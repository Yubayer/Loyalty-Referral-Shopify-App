/**
 * Header bar — shows "Physical Prizes + Add New Prize" on the list view,
 * or a breadcrumb ("Prizes › Add New Prize" / "Prizes › Edit Prize") on
 * the create/edit views.
 */
export function PageHeading({ view, isAnyBusy, onCreate, onBackToList }) {
    if (view === "list") {
        return (
            <s-grid gridTemplateColumns="1fr auto" gap="large" alignItems="center">
                <h2 style={{ marginBlock: "0" }}>Physical Prizes</h2>
                <s-button variant="primary" onClick={onCreate} disabled={isAnyBusy}>
                    Add New Prize
                </s-button>
            </s-grid>
        );
    }

    const isEdit = view === "edit";
    return (
        <s-stack direction="inline" gap="small" alignItems="center">
            <s-button
                variant="plain" onClick={onBackToList} disabled={isAnyBusy}
                style={{ padding: 0, minHeight: "unset" }}
            >
                Prizes
            </s-button>
            <s-text tone="subdued">›</s-text>
            <h2 style={{ marginBlock: "0" }}>{isEdit ? "Edit Prize" : "Add New Prize"}</h2>
        </s-stack>
    );
}
