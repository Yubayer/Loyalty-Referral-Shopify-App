import { EVENT_TYPES } from "../_data";

export function AddEventForm({ events, newEvent, setNewEvent, isAdding, onCancel, onSave }) {
    // Collect already-used type values so we can disable them in the dropdown
    const usedTypes = new Set(events.map((ev) => ev.type.toUpperCase()));

    return (
        <s-section>
            <h3 style={{ marginBlock: "0" }}>Add New Event</h3>
            <s-box paddingBlock="base">
                <s-divider />
            </s-box>

            <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-text-field
                    label="Event Name *"
                    value={newEvent.name}
                    disabled={isAdding}
                    placeholder="e.g. Order Reward"
                    onInput={(e) => setNewEvent((prev) => ({ ...prev, name: e.target.value }))}
                />
                <s-select
                    label="Event Type *"
                    value={newEvent.type}
                    disabled={isAdding}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, type: e.target.value }))}
                >
                    <s-option value="">Select event type…</s-option>
                    {EVENT_TYPES.map(({ value, label }) => {
                        const alreadyUsed = usedTypes.has(value);
                        return (
                            <s-option key={value} value={value} disabled={alreadyUsed}>
                                {label}{alreadyUsed ? " — Already created" : ""}
                            </s-option>
                        );
                    })}
                </s-select>
            </s-grid>

            <s-box paddingBlockEnd="base" />

            <s-text-area
                label="Description"
                value={newEvent.description}
                disabled={isAdding}
                placeholder="Optional description for this event"
                onInput={(e) => setNewEvent((prev) => ({ ...prev, description: e.target.value }))}
            />

            <s-stack direction="inline" gap="base" justifyContent="end" paddingBlockStart="base">
                <s-button disabled={isAdding} onClick={onCancel}>
                    Cancel
                </s-button>
                <s-button
                    variant="primary"
                    loading={isAdding}
                    disabled={isAdding || !newEvent.name?.trim() || !newEvent.type}
                    onClick={onSave}
                >
                    Save Event
                </s-button>
            </s-stack>
        </s-section>
    );
}
