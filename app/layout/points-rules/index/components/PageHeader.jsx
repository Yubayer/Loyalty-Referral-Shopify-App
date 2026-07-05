export function PageHeader() {
    return (
        <s-section>
            <s-grid gridTemplateColumns="1fr auto" gap="large" alignItems="center">
                <s-stack direction="block" gap="extra-small">
                    <h2 style={{ marginBlock: "0" }}>Points Rules</h2>
                    <s-text tone="subdued">
                        Manage how customers earn points for each event.
                    </s-text>
                </s-stack>
                <s-button
                    variant="primary"
                    commandFor="event-selector-modal"
                    command="--show"
                >
                    Add New Rule
                </s-button>
            </s-grid>
        </s-section>
    );
}
