export function DeleteEventModal({ selectedEvent, isDeleting, onConfirm }) {
    return (
        <s-modal id="delete-event-modal" heading="Delete Points Event" size="small">
            <s-paragraph color="subdued">
                Are you sure you want to delete <strong>{selectedEvent?.name}</strong>?
                This will also remove any associated points rules. This action cannot be undone.
            </s-paragraph>
            <s-button
                slot="secondary-actions"
                commandFor="delete-event-modal"
                command="--hide"
                disabled={isDeleting}
            >
                Cancel
            </s-button>
            <s-button
                slot="primary-action"
                variant="primary"
                destructive
                loading={isDeleting}
                disabled={isDeleting}
                onClick={onConfirm}
                commandFor="delete-event-modal"
                command="--hide"
            >
                Yes, Delete
            </s-button>
        </s-modal>
    );
}
