import { TRIGGER_DESCRIPTIONS } from "@shared-utils/constants/ruleConstants";
import { ActiveToggle } from "@shared-utils/rule-components/ActiveToggle";

// ─────────────────────────────────────────────────────────────────────────────
// SummaryPanel
//
// Right-column summary card for the order rule page.
//
// Props:
//   event          {object}
//   order          {object}  - fs.form.order
//   isActive       {boolean}
//   onActiveChange {Function}
//   busy           {boolean}
// ─────────────────────────────────────────────────────────────────────────────

export function SummaryPanel({ event, order, isActive, onActiveChange, busy }) {
    const defaultRateLabel = order.type === "incremental"
        ? `${order.rate.points || 0} pt for every $${order.rate.amount || 0} spent`
        : `${order.fixedPoints || 0} pts flat per order`;

    return (
        <>
            <s-section>
                <s-heading>Summary</s-heading>
                <s-box paddingBlockEnd="small" />

                <s-text><strong>Event:</strong> {event?.name ?? "Direct Purchase"}</s-text>
                <s-box paddingBlockEnd="small" />

                <s-text>
                    <strong>Applies to:</strong>{" "}
                    {TRIGGER_DESCRIPTIONS[order.trigger] ?? order.trigger}
                </s-text>
                <s-box paddingBlockEnd="small" />

                <s-text>
                    <strong>Default rate:</strong> {defaultRateLabel}
                </s-text>

                {(order.groups ?? []).length > 0 && (
                    <>
                        <s-box paddingBlockEnd="small" />
                        <s-text>
                            <strong>Product groups:</strong>{" "}
                            {order.groups.length} group{order.groups.length !== 1 ? "s" : ""} with custom rates
                            {" — "}{order.groups.map((g) => g.name).filter(Boolean).join(", ")}
                        </s-text>
                    </>
                )}

                {(order.intervals ?? []).length > 0 && (
                    <>
                        <s-box paddingBlockEnd="small" />
                        <s-text>
                            <strong>Interval overrides:</strong>{" "}
                            {order.intervals.length} subscription interval{order.intervals.length !== 1 ? "s" : ""} with custom rates
                        </s-text>
                    </>
                )}

                {(order.excludedProducts ?? []).length > 0 && (
                    <>
                        <s-box paddingBlockEnd="small" />
                        <s-text>
                            <strong>Excluded:</strong>{" "}
                            {order.excludedProducts.length} product{order.excludedProducts.length !== 1 ? "s" : ""} earn no points
                            {" — "}{order.excludedProducts.map((p) => p.title).filter(Boolean).join(", ")}
                        </s-text>
                    </>
                )}

                <s-box paddingBlockEnd="small" />
                <s-text>
                    <strong>Status:</strong>{" "}
                    {isActive ? "Active ✅" : "Inactive ❌"}
                </s-text>
            </s-section>

            <s-box paddingBlockEnd="base" />
            <ActiveToggle checked={isActive} onChange={onActiveChange} busy={busy} />
        </>
    );
}
