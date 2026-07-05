/**
 * Dismissible banner that surfaces unseen claims since the admin's last
 * visit, with a shortcut to jump straight to the "New" filter tab.
 */
export function NewClaimsBanner({ stats, newDismissed, onDismiss, onViewNew }) {
    if (newDismissed || !stats.new || stats.new === 0) return null;
    return (
        <s-section>
            <s-banner
                tone="info"
                heading={`${stats.new} new prize request${stats.new > 1 ? "s" : ""} since your last visit`}
                dismissible
                onDismiss={onDismiss}
            >
                <s-stack direction="inline" gap="small" alignItems="center">
                    <s-text variant="bodySm">
                        {stats.new} new {stats.new > 1 ? "requests need" : "request needs"} your attention.
                    </s-text>
                    <s-button variant="plain" onClick={onViewNew}>
                        View new requests
                    </s-button>
                </s-stack>
            </s-banner>
        </s-section>
    );
}
