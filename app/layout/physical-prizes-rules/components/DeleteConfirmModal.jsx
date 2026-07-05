/**
 * Confirmation modal shown before deleting a prize.
 */
export function DeleteConfirmModal({ deleteTarget, isDeleting, onConfirm }) {
    return (
        <s-modal id="delete-prize-modal" heading="Delete Prize" size="small">
            <s-paragraph color="subdued">
                Are you sure you want to delete <strong>{deleteTarget?.title}</strong>?
                Existing claims will not be affected, but customers will no longer be able to claim this prize.
                This action cannot be undone.
            </s-paragraph>
            <s-button
                slot="secondary-actions"
                commandFor="delete-prize-modal" command="--hide"
                disabled={isDeleting}
            >
                Cancel
            </s-button>
            <s-button
                slot="primary-action" variant="primary" destructive
                onClick={onConfirm}
                commandFor="delete-prize-modal" command="--hide"
                loading={isDeleting} disabled={isDeleting}
            >
                Yes, Delete
            </s-button>
        </s-modal>
    );
}
