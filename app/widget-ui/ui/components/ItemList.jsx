// =============================================================================
// modules/components/ItemList.jsx
// Generic list/table container — handles empty state, otherwise maps items
// through caller-supplied renderItem(). Reusable for every list in the
// widget. The wrapping div (with .nbl-item-list / .nbl-item-list--divided
// or a bare unstyled div) is supplied by the caller, same as before.
// =============================================================================

import { h, Fragment } from 'preact';

export function ItemList({ items, emptyText, renderItem }) {
    if (!items || !items.length) {
        return <div class="nbl-item-list__empty">{emptyText}</div>;
    }
    return <>{items.map(renderItem)}</>;
}
