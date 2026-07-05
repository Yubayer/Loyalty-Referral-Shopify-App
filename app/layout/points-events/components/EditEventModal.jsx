import { EVENT_TYPES } from "../_data";

export function EditEventModal({ selectedEvent, setSelectedEvent, isUpdating, onSave }) {
    return (
        <s-modal id="edit-event-modal" heading="Edit Points Event" size="base">
            {selectedEvent && (
                <>
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                        <s-text-field
                            label="Name *"
                            value={selectedEvent.name ?? ""}
                            disabled={isUpdating}
                            onInput={(e) => setSelectedEvent((prev) => ({ ...prev, name: e.target.value }))}
                        />
                        {/*
                         * Type is read-only in edit mode — changing it would invalidate
                         * existing points rules and webhook handlers (ORDER, REFERRAL, REVIEW…).
                         * Shown as a disabled select so the value is clear but cannot be changed.
                         */}
                        <s-select
                            label="Event Type"
                            value={selectedEvent.type ?? ""}
                            disabled
                            details="Event type cannot be changed after creation."
                        >
                            {EVENT_TYPES.map(({ value, label }) => (
                                <s-option key={value} value={value}>{label}</s-option>
                            ))}
                            {/* Fallback for any type not in the predefined list */}
                            {!EVENT_TYPES.some((t) => t.value === selectedEvent.type) && (
                                <s-option value={selectedEvent.type}>{selectedEvent.type}</s-option>
                            )}
                        </s-select>
                    </s-grid>

                    <s-box paddingBlockEnd="base" />

                    <s-text-area
                        label="Description"
                        value={selectedEvent.description ?? ""}
                        disabled={isUpdating}
                        onInput={(e) => setSelectedEvent((prev) => ({ ...prev, description: e.target.value }))}
                    />

                    <s-box paddingBlockEnd="base" />

                    <s-switch
                        label={selectedEvent.isActive ? "Active" : "Inactive"}
                        checked={!!selectedEvent.isActive}
                        disabled={isUpdating}
                        onChange={(e) => setSelectedEvent((prev) => ({ ...prev, isActive: e.target.checked }))}
                    />

                    <s-stack direction="inline" gap="base" justifyContent="end" paddingBlockStart="base">
                        <s-button
                            commandFor="edit-event-modal"
                            command="--hide"
                            disabled={isUpdating}
                            onClick={() => setSelectedEvent(null)}
                        >
                            Discard
                        </s-button>
                        <s-button
                            variant="primary"
                            loading={isUpdating}
                            disabled={isUpdating || !selectedEvent.name?.trim() || !selectedEvent.type?.trim()}
                            onClick={onSave}
                            commandFor="edit-event-modal"
                            command="--hide"
                        >
                            Save Changes
                        </s-button>
                    </s-stack>
                </>
            )}
        </s-modal>
    );
}
