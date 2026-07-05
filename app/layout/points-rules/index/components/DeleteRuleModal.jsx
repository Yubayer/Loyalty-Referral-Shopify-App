export function DeleteRuleModal({
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    getEventName,
    onConfirm,
}) {
    return (
        <s-modal
            id="delete-modal"
            heading="Delete Points Rule"
            size="small"
        >
            {deleteTarget && (
                <s-paragraph tone="subdued">
                    Are you sure you want to delete{" "}
                    <strong>
                        {deleteTarget.name || getEventName(deleteTarget.eventId)}
                    </strong>
                    ? This action cannot be undone.
                </s-paragraph>
            )}

            <s-button
                slot="secondary-actions"
                commandFor="delete-modal"
                command="--hide"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
            >
                Cancel
            </s-button>
            <s-button
                slot="primary-action"
                variant="primary"
                destructive
                loading={isDeleting}
                disabled={isDeleting || !deleteTarget}
                onClick={onConfirm}
                commandFor="delete-modal"
                command="--hide"
            >
                Yes, Delete
            </s-button>
        </s-modal>
    );
}
