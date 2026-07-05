export function PageHeading({ showAddForm, isAnyBusy, onToggle }) {
    return (
        <s-grid gridTemplateColumns="1fr auto" gap="large" alignItems="center">
            <h2 style={{ marginBlock: "0" }}>Points Events</h2>
            <s-button
                icon={showAddForm ? "minus" : "plus"}
                variant={showAddForm ? "auto" : "primary"}
                disabled={isAnyBusy}
                onClick={onToggle}
            >
                {showAddForm ? "Cancel" : "Add New Event"}
            </s-button>
        </s-grid>
    );
}
