export function EventSelectorModal({
    events,
    existingEventIds,
    selectedEventId,
    setSelectedEventId,
    onNext,
}) {
    return (
        <s-modal
            id="event-selector-modal"
            heading="Select Event Type"
            size="small"
        >
            <s-paragraph>
                Choose the event you want to create a points rule for.
            </s-paragraph>
            <s-box paddingBlockEnd="base" />
            <s-select
                label="Points Event"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
            >
                <s-option value="">Select an event</s-option>
                {events.map((ev) => {
                    const taken = existingEventIds.includes(ev.id);
                    return (
                        <s-option
                            key={ev.id}
                            value={ev.id}
                            disabled={taken}
                        >
                            {ev.name} ({ev.type}){taken ? " — Already Added" : ""}
                        </s-option>
                    );
                })}
            </s-select>

            {/* Modal actions */}
            <s-button
                slot="secondary-actions"
                commandFor="event-selector-modal"
                command="--hide"
                onClick={() => setSelectedEventId("")}
            >
                Cancel
            </s-button>
            <s-button
                slot="primary-action"
                variant="primary"
                disabled={!selectedEventId}
                commandFor="event-selector-modal"
                command="--hide"
                onClick={onNext}
            >
                Next
            </s-button>
        </s-modal>
    );
}
