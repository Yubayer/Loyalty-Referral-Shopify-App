import { previewTitle } from "../_data";

// ─────────────────────────────────────────────────────────────────────────────
// DELETE RULE MODAL
// ─────────────────────────────────────────────────────────────────────────────

export function DeleteRuleModal({ deleteTarget, isDeleting, onConfirm }) {
    return (
        <s-modal id="delete-reward-modal" heading="Delete Reward Rule" size="small">
            <s-paragraph color="subdued">
                Are you sure you want to delete{" "}
                <strong>{previewTitle(deleteTarget?.title, deleteTarget?.discountType, deleteTarget?.rewardValue)}</strong>?
                This action cannot be undone.
            </s-paragraph>
            <s-button
                slot="secondary-actions"
                commandFor="delete-reward-modal"
                command="--hide"
                disabled={isDeleting}
            >
                Cancel
            </s-button>
            <s-button
                slot="primary-action"
                variant="primary"
                destructive
                onClick={onConfirm}
                commandFor="delete-reward-modal"
                command="--hide"
                loading={isDeleting}
                disabled={isDeleting}
            >
                Yes, Delete
            </s-button>
        </s-modal>
    );
}
