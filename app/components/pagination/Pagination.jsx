/**
 * Pagination
 *
 * Props (all come directly from usePagination spread):
 *   currentPage    {number}   - Active page number
 *   totalPages     {number}   - Total number of pages
 *   totalItems     {number}   - Total item count
 *   perPage        {number}   - Current items-per-page value
 *   startIndex     {number}   - Zero-based index of first visible item
 *   setCurrentPage {Function} - Page setter
 *   setPerPage     {Function} - Per-page setter
 *   label          {string}   - Noun shown in "Showing X–Y of Z <label>" (default: "items")
 *   perPageOptions {number[]} - Dropdown choices (default: [5, 10, 25, 50])
 *
 * Usage:
 *   const pagination = usePagination(myData, 10);
 *   ...
 *   <Pagination {...pagination} label="customers" />
 */

const DEFAULT_PER_PAGE_OPTIONS = [5, 10, 25, 50];

function getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
    if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "...", current - 1, current, current + 1, "...", total];
}

function navBtnStyle(disabled) {
    return {
        padding: "4px 10px",
        borderRadius: "6px",
        border: "1px solid var(--p-color-border, #c9cccf)",
        background: disabled
            ? "var(--p-color-bg-surface-disabled, #f1f2f3)"
            : "var(--p-color-bg-surface, #fff)",
        color: disabled
            ? "var(--p-color-text-disabled, #a4a6a8)"
            : "var(--p-color-text, #202223)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "15px",
        lineHeight: 1,
        fontWeight: "500",
        transition: "background 0.15s",
    };
}

function pageBtnStyle(isActive) {
    return {
        padding: "4px 10px",
        borderRadius: "6px",
        border: isActive
            ? "1px solid var(--p-color-border-interactive, #2c6ecb)"
            : "1px solid var(--p-color-border, #c9cccf)",
        background: isActive
            ? "var(--p-color-bg-interactive, #2c6ecb)"
            : "var(--p-color-bg-surface, #fff)",
        color: isActive ? "#fff" : "var(--p-color-text, #202223)",
        cursor: isActive ? "default" : "pointer",
        fontSize: "13px",
        fontWeight: isActive ? "600" : "400",
        minWidth: "32px",
        transition: "all 0.15s",
    };
}

export default function Pagination({
    currentPage,
    totalPages,
    totalItems,
    perPage,
    startIndex,
    setCurrentPage,
    setPerPage,
    label = "items",
    perPageOptions = DEFAULT_PER_PAGE_OPTIONS,
}) {
    const endIndex = Math.min(startIndex + perPage, totalItems);

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
                marginTop: "16px",
                paddingTop: "16px",
                borderTop: "1px solid var(--p-color-border)",
            }}
        >
            {/* ── Left: count info + per-page selector ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", color: "var(--p-color-text-secondary, #6d7175)" }}>
                    {totalItems === 0
                        ? `No ${label}`
                        : `Showing ${startIndex + 1}–${endIndex} of ${totalItems} ${label}`}
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                        style={{
                            fontSize: "13px",
                            color: "var(--p-color-text-secondary, #6d7175)",
                            whiteSpace: "nowrap",
                        }}
                    >
                        Per page:
                    </span>
                    <select
                        value={perPage}
                        onChange={(e) => setPerPage(Number(e.target.value))}
                        style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            border: "1px solid var(--p-color-border, #c9cccf)",
                            fontSize: "13px",
                            background: "var(--p-color-bg-surface, #fff)",
                            color: "var(--p-color-text, #202223)",
                            cursor: "pointer",
                        }}
                    >
                        {perPageOptions.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Right: page navigation ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    title="First page"
                    style={navBtnStyle(currentPage === 1)}
                >
                    «
                </button>
                <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    title="Previous page"
                    style={navBtnStyle(currentPage === 1)}
                >
                    ‹
                </button>

                {getPageNumbers(currentPage, totalPages).map((page, i) =>
                    page === "..." ? (
                        <span
                            key={`ellipsis-${i}`}
                            style={{ padding: "0 4px", color: "var(--p-color-text-secondary, #6d7175)" }}
                        >
                            …
                        </span>
                    ) : (
                        <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            style={pageBtnStyle(page === currentPage)}
                        >
                            {page}
                        </button>
                    )
                )}

                <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    title="Next page"
                    style={navBtnStyle(currentPage === totalPages)}
                >
                    ›
                </button>
                <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    title="Last page"
                    style={navBtnStyle(currentPage === totalPages)}
                >
                    »
                </button>
            </div>
        </div>
    );
}