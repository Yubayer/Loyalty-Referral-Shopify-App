import { INTERVAL_OPTIONS } from "@shared-utils/constants/ruleConstants";
import { ProductList } from "@shared-utils/rule-components/ProductList";
import { EarningFields } from "./EarningFields";

/**
 * GroupCard
 *
 * Renders one product group: name field, product picker, group-level
 * earning override (P3), and optional per-interval earning overrides (P4).
 *
 * @param {object}  props
 * @param {object}  props.group          - the group data object
 * @param {number}  props.groupIndex     - index of this group in the groups array
 * @param {string}  props.orderType      - "fixed" | "incremental"
 * @param {boolean} props.isSubscription - whether trigger includes subscriptions
 * @param {boolean} props.busy           - disables all inputs while submitting
 * @param {object}  props.handlers       - grouped handlers from useOrderHandlers().groups
 */
export function GroupCard({ group, groupIndex, orderType, isSubscription, busy, handlers }) {
    return (
        <s-box paddingBlockEnd="base">
            <s-box
                padding="base"
                background="base"
                borderWidth="base"
                borderColor="base"
                borderRadius="base"
            >
                {/* Group name + delete */}
                <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="center">
                    <s-text-field
                        label="Group Name"
                        labelAccessibilityVisibility="exclusive"
                        value={group.name}
                        disabled={busy}
                        onInput={(e) => handlers.updateField(groupIndex, "name", e.target.value)}
                    />
                    <s-button
                        icon="delete"
                        tone="critical"
                        variant="tertiary"
                        disabled={busy}
                        onClick={() => handlers.remove(groupIndex)}
                    />
                </s-grid>

                <s-box paddingBlockEnd="base" />
                <s-divider />
                <s-box paddingBlockEnd="base" />

                {/* Products */}
                <ProductList
                    products={group.products ?? []}
                    onPick={() => handlers.products.openPicker(groupIndex)}
                    onRemove={(productId) => handlers.products.remove(groupIndex, productId)}
                    busy={busy}
                />

                {/* Group earning override — P3 */}
                <s-box paddingBlockEnd="base" />
                <s-divider />
                <s-box paddingBlockEnd="base" />
                <s-grid gridTemplateColumns="1fr auto" alignItems="center">
                    <s-text><strong>Group Points</strong></s-text>
                    <s-badge tone="info">Default override</s-badge>
                </s-grid>
                <s-box paddingBlockEnd="small" />
                <EarningFields
                    val={group}
                    orderType={orderType}
                    onChangeFixed={(value) => handlers.updateField(groupIndex, "fixedPoints", value)}
                    onChangeRatePoints={(value) => handlers.updateRate(groupIndex, "points", value)}
                    onChangeRateAmount={(value) => handlers.updateRate(groupIndex, "amount", value)}
                    busy={busy}
                />

                {/* Group interval overrides — P4 (subscription only) */}
                {isSubscription && (
                    <>
                        <s-box paddingBlockEnd="base" />
                        <s-divider />
                        <s-box paddingBlockEnd="base" />
                        <s-grid gridTemplateColumns="1fr auto" alignItems="center">
                            <div>
                                <s-text><strong>Interval Overrides</strong></s-text>
                                <s-box paddingBlockEnd="extra-small" />
                                <s-text tone="subdued" style={{ fontSize: "0.75rem" }}>
                                    Applied when subscription interval matches — overrides group points above.
                                </s-text>
                            </div>
                            <s-button
                                variant="secondary"
                                disabled={busy}
                                onClick={() => handlers.intervals.add(groupIndex)}
                            >
                                + Add Interval
                            </s-button>
                        </s-grid>

                        {(group.intervals ?? []).length > 0 && (
                            <>
                                <s-box paddingBlockEnd="small" />
                                {group.intervals.map((interval, intervalIndex) => (
                                    <GroupIntervalCard
                                        key={intervalIndex}
                                        interval={interval}
                                        intervalIndex={intervalIndex}
                                        groupIndex={groupIndex}
                                        orderType={orderType}
                                        busy={busy}
                                        usedIntervals={new Set(
                                            group.intervals
                                                .filter((_, index) => index !== intervalIndex)
                                                .map((item) => item.interval)
                                        )}
                                        handlers={handlers.intervals}
                                    />
                                ))}
                            </>
                        )}
                    </>
                )}
            </s-box>
        </s-box>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// GroupIntervalCard
//
// One interval override row inside a group (Priority 4).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object}  props
 * @param {object}  props.interval       - the interval data object
 * @param {number}  props.intervalIndex  - index in the group's intervals array
 * @param {number}  props.groupIndex     - index of the parent group
 * @param {string}  props.orderType      - "fixed" | "incremental"
 * @param {boolean} props.busy
 * @param {Set}     props.usedIntervals  - interval values used by sibling cards
 * @param {object}  props.handlers       - handlers.intervals from GroupCard
 */
function GroupIntervalCard({
    interval, intervalIndex, groupIndex, orderType,
    busy, usedIntervals, handlers,
}) {
    return (
        <s-box paddingBlockEnd="base">
            <s-box
                padding="base"
                borderStyle="dashed"
                borderWidth="base"
                borderColor="base"
                borderRadius="base"
            >
                <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="center">
                    <s-text>
                        <strong>
                            Interval — {INTERVAL_OPTIONS.find((option) => option.value === interval.interval)?.label ?? "Not selected"}
                        </strong>
                    </s-text>
                    <s-button
                        icon="delete"
                        tone="critical"
                        variant="tertiary"
                        disabled={busy}
                        onClick={() => handlers.remove(groupIndex, intervalIndex)}
                    />
                </s-grid>

                <s-box paddingBlockEnd="small" />

                <s-select
                    label="Interval"
                    labelAccessibilityVisibility="exclusive"
                    value={interval.interval}
                    disabled={busy}
                    onChange={(e) => handlers.updateValue(groupIndex, intervalIndex, e.target.value)}
                >
                    {INTERVAL_OPTIONS.map(({ value, label }) => {
                        const isUsedByOther = usedIntervals.has(value) && value !== interval.interval;
                        return (
                            <s-option key={value} value={value} disabled={isUsedByOther || undefined}>
                                {label}{isUsedByOther ? " (added)" : ""}
                            </s-option>
                        );
                    })}
                </s-select>

                <s-box paddingBlockEnd="small" />

                <EarningFields
                    val={interval}
                    orderType={orderType}
                    onChangeFixed={(value) => handlers.updateField(groupIndex, intervalIndex, "fixedPoints", value)}
                    onChangeRatePoints={(value) => handlers.updateRate(groupIndex, intervalIndex, "points", value)}
                    onChangeRateAmount={(value) => handlers.updateRate(groupIndex, intervalIndex, "amount", value)}
                    busy={busy}
                />
            </s-box>
        </s-box>
    );
}