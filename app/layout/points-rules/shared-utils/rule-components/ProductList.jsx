// ─────────────────────────────────────────────────────────────────────────────
// ProductList
//
// "Select Products" button + count label + deletable product list.
// Used in: order excluded products, order group products, referral group products.
//
// Props:
//   products      {Array}    - [{ id, title }]
//   onPick        {Function} - () => void  — opens the resource picker
//   onRemove      {Function} - (productId) => void
//   busy          {boolean}
//   buttonLabel   {string}   - default "Select Products"
//   countLabel    {string}   - default "{n} product(s) selected"
// ─────────────────────────────────────────────────────────────────────────────

export function ProductList({
    products = [],
    onPick,
    onRemove,
    busy,
    buttonLabel = "Select Products",
}) {
    return (
        <>
            <s-stack direction="inline" gap="base" alignItems="center">
                <s-button variant="secondary" disabled={busy} onClick={onPick}>
                    {buttonLabel}
                </s-button>
                {products.length > 0 && (
                    <s-text tone="subdued">
                        {products.length} product{products.length !== 1 ? "s" : ""} selected
                    </s-text>
                )}
            </s-stack>

            {products.length > 0 && (
                <>
                    <s-box paddingBlockEnd="small" />
                    <s-ordered-list>
                        {products.map((p) => (
                            <s-list-item key={p.id}>
                                <s-grid
                                    gridTemplateColumns="1fr auto"
                                    gap="small"
                                    alignItems="center"
                                >
                                    <s-text>{p.title}</s-text>
                                    <s-button
                                        icon="delete"
                                        variant="text"
                                        disabled={busy}
                                        onClick={() => onRemove(p.id)}
                                    />
                                </s-grid>
                            </s-list-item>
                        ))}
                    </s-ordered-list>
                </>
            )}
        </>
    );
}
