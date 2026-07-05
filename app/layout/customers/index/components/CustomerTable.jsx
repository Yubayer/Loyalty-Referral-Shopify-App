import { SORT_OPTIONS, ALLOWED_PAGE_SIZES } from "../_data";
import Pagination from "@components/pagination/Pagination";

/**
 * Customer list — toolbar (search + sort) + table + pagination.
 */
export function CustomerTable({
    customers, totalCount, totalPages,
    page, pageSize,
    localSearch, sortBy,
    isLoading, navigatingTo, loaderError,
    onSearch, onSortChange,
    onPageChange, onPageSizeChange,
    onDetails,
}) {
    return (
        <s-section>
            {/* ── Toolbar ── */}
            <s-grid gridTemplateColumns="1fr 1fr 1fr" alignItems="center" gap="base">
                <h2 style={{ margin: 0 }}>Customers ({totalCount.toLocaleString()})</h2>
                <s-search-field
                    label="Search customers"
                    labelAccessibilityVisibility="exclusive"
                    placeholder="Search by name or email"
                    value={localSearch}
                    onInput={onSearch}
                    disabled={isLoading}
                />
                <s-select
                    label="Sort by"
                    labelAccessibilityVisibility="exclusive"
                    value={sortBy}
                    onChange={onSortChange}
                    disabled={isLoading}
                >
                    {SORT_OPTIONS.map((o) => (
                        <s-option key={o.value} value={o.value}>{o.label}</s-option>
                    ))}
                </s-select>
            </s-grid>

            <s-box paddingBlock="base"><s-divider /></s-box>

            {/* ── Error banner ── */}
            {loaderError && (
                <s-banner tone="critical" style={{ marginBottom: "16px" }}>{loaderError}</s-banner>
            )}

            {/* ── Table ── */}
            {isLoading ? (
                <s-box padding="base" style={{ textAlign: "center", minHeight: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <s-spinner />
                </s-box>
            ) : (
                <s-table>
                    <s-table-header-row>
                        <s-table-header>Customer</s-table-header>
                        <s-table-header>Events</s-table-header>
                        <s-table-header>Points</s-table-header>
                        <s-table-header>Rewards</s-table-header>
                        <s-table-header>Enrolled At</s-table-header>
                        <s-table-header />
                    </s-table-header-row>
                    <s-table-body>
                        {customers.length === 0 ? (
                            <s-table-row>
                                <s-table-cell colSpan={6} style={{ textAlign: "center", color: "var(--p-color-text-secondary, #6d7175)", padding: "32px 0" }}>
                                    {localSearch ? `No customers found for "${localSearch}".` : "No customers yet. Click Sync Customers to get started."}
                                </s-table-cell>
                            </s-table-row>
                        ) : customers.map((c) => {
                            const isThisNavigating  = navigatingTo === c.id;
                            const isOtherNavigating = navigatingTo !== null && navigatingTo !== c.id;
                            return (
                                <s-table-row key={c.id}>
                                    <s-table-cell>
                                        <s-heading>{c.name || "N/A"}</s-heading>
                                        <s-box />
                                        <s-text>{c.email || "N/A"}</s-text>
                                    </s-table-cell>
                                    <s-table-cell>{c._count.transactions}</s-table-cell>
                                    <s-table-cell>{c.points.toLocaleString()}</s-table-cell>
                                    <s-table-cell>{c._count.rewards}</s-table-cell>
                                    <s-table-cell>
                                        {c.enrolledAt ? new Date(c.enrolledAt).toLocaleDateString() : "N/A"}
                                    </s-table-cell>
                                    <s-table-cell>
                                        <s-button
                                            variant="text"
                                            loading={isThisNavigating}
                                            disabled={isThisNavigating || isOtherNavigating}
                                            onClick={() => onDetails(c.id)}
                                        >
                                            {isThisNavigating ? "Loading…" : "Details"}
                                        </s-button>
                                    </s-table-cell>
                                </s-table-row>
                            );
                        })}
                    </s-table-body>
                </s-table>
            )}

            {/* ── Pagination ── */}
            {!loaderError && totalCount > 0 && (
                <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={totalCount}
                    perPage={pageSize}
                    startIndex={(page - 1) * pageSize}
                    setCurrentPage={onPageChange}
                    setPerPage={onPageSizeChange}
                    label="customers"
                    perPageOptions={ALLOWED_PAGE_SIZES}
                />
            )}
        </s-section>
    );
}
