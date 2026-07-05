import { FILTER_TABS, SORT_OPTIONS } from "../_data";

/**
 * Status tabs + date range + sort dropdown, all backed by URL search params
 * (see _hooks.js's updateParams). Tab counts come from `stats`, which is
 * always unfiltered.
 */
export function FilterBar({
    stats,
    activeTab, onTabChange,
    dateFrom, onDateFromChange,
    dateTo, onDateToChange,
    sortBy, onSortByChange,
    hasActiveFilters, onClearFilters,
    totalItems,
}) {
    const countFor = (v) => ({
        NEW: stats.new, PENDING: stats.pending, FULFILLED: stats.fulfilled,
        COMPLETED: stats.completed, CANCELLED: stats.cancelled,
    }[v] ?? stats.total ?? 0);

    return (
        <s-section>
            <s-stack direction="block" gap="base">

                {/* Tabs */}
                <s-stack direction="inline" gap="small" alignItems="center">
                    <s-text tone="subdued" variant="bodySm">Filter:</s-text>
                    {FILTER_TABS.map(({ value, label }) => (
                        <s-button
                            key={value}
                            variant={activeTab === value ? "primary" : "secondary"}
                            onClick={() => onTabChange(value)}
                        >
                            {label} ({countFor(value)})
                            {value === "NEW" && stats.new > 0 && activeTab !== "NEW" && " 🔵"}
                        </s-button>
                    ))}
                </s-stack>

                {/* Date range + sort */}
                <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
                    <s-date-field
                        label="From date"
                        value={dateFrom}
                        onChange={(e) => onDateFromChange(e.currentTarget.value)}
                    />
                    <s-date-field
                        label="To date"
                        value={dateTo}
                        onChange={(e) => onDateToChange(e.currentTarget.value)}
                    />
                    <s-select
                        label="Sort by"
                        value={sortBy}
                        onChange={(e) => onSortByChange(e.currentTarget.value)}
                    >
                        {SORT_OPTIONS.map(({ value, label }) => (
                            <s-option key={value} value={value}>{label}</s-option>
                        ))}
                    </s-select>
                </s-grid>

                {hasActiveFilters && (
                    <s-stack direction="inline" gap="base" alignItems="center">
                        <s-button variant="plain" tone="critical" onClick={onClearFilters}>
                            Clear filters
                        </s-button>
                        <s-text variant="bodySm" tone="subdued">
                            {totalItems} of {stats.total ?? 0} claims
                        </s-text>
                    </s-stack>
                )}

            </s-stack>
        </s-section>
    );
}
