/**
 * Internal admin note editor for a single claim.
 */
export function AdminNoteModal({
    modalRef,
    noteTarget,
    noteValue,
    onNoteValueChange,
    isSubmitting,
    onSave,
    onHide,
}) {
    return (
        <s-modal
            ref={modalRef}
            id="note-claim-modal"
            heading="Admin Note"
            accessibilityLabel="Admin Note"
            onHide={onHide}
        >
            <s-stack direction="block" gap="base">
                <s-text tone="subdued" variant="bodySm">
                    Note for: <strong>{noteTarget?.prize?.title ?? "this claim"}</strong> — {noteTarget?.customer?.name || noteTarget?.customer?.email || ""}
                </s-text>
                <s-text-field
                    label="Note"
                    multiline={4}
                    placeholder="Internal notes about this claim..."
                    value={noteValue}
                    onChange={(e) => onNoteValueChange(e.currentTarget.value)}
                />
            </s-stack>
            <s-button slot="secondary-actions" variant="secondary" commandFor="note-claim-modal" command="--hide" disabled={isSubmitting}>
                Cancel
            </s-button>
            <s-button slot="primary-action" variant="primary" onClick={onSave} loading={isSubmitting} disabled={isSubmitting}>
                Save Note
            </s-button>
        </s-modal>
    );
}
