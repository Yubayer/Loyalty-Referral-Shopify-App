// =============================================================================
// modules/components/ToastStack.jsx
// Stacked toast notifications shown above the launcher button on page load,
// for transactions the customer hasn't seen yet (notifiedAt=null server-side).
// Hidden whenever the widget panel itself is open.
// =============================================================================

import { h } from 'preact';
import { icon } from '../icons.js';

const TYPE_ICON = {
    EARN: 'star',
    REDEEM: 'gift',
    REFERRAL: 'referral',
};

export function ToastStack({ toasts, moreCount, hidden, position, onOpenWidget, onDismissToast, onExpand }) {
    if (hidden || (!toasts || toasts.length === 0)) return null;

    return (
        <div class={`nbl-toast-stack pos-${position}`}>
            {toasts.map((t, i) => (
                <div
                    key={t.id}
                    class="nbl-toast"
                    style={{ '--nbl-toast-index': i }}
                >
                    <button
                        type="button"
                        class="nbl-toast__body"
                        onClick={onOpenWidget}
                    >
                        <span
                            class="nbl-toast__icon"
                            dangerouslySetInnerHTML={{ __html: icon(TYPE_ICON[t.type] || 'star') }}
                        />
                        <span class="nbl-toast__text">{t.activity}</span>
                        <span class="nbl-toast__chevron" aria-hidden="true">›</span>
                    </button>
                    <button
                        type="button"
                        class="nbl-toast__close"
                        aria-label="Dismiss notification"
                        onClick={(e) => {
                            // Don't let this bubble up to the toast body's
                            // onOpenWidget — closing a toast should never
                            // also open the widget.
                            e.stopPropagation();
                            if (onDismissToast) onDismissToast(t.id);
                        }}
                    >
                        <span dangerouslySetInnerHTML={{ __html: icon('close') }} />
                    </button>
                </div>
            ))}

            {moreCount > 0 && (
                <button type="button" class="nbl-toast nbl-toast--summary" onClick={onExpand}>
                    <span class="nbl-toast__text">+{moreCount} more update{moreCount === 1 ? '' : 's'}</span>
                    <span class="nbl-toast__chevron" aria-hidden="true">›</span>
                </button>
            )}
        </div>
    );
}