import { REWARD_MODES } from "../_data";

// ─────────────────────────────────────────────────────────────────────────────
// RewardModeSelector
//
// Choice list for how many times a customer can earn review points per product.
//
// Props:
//   value    {string}   - "once" | "per_type" | "unlimited"
//   busy     {boolean}
//   onChange {Function} - (value: string) => void
// ─────────────────────────────────────────────────────────────────────────────

export function RewardModeSelector({ value, busy, onChange }) {
    return (
        <s-section>
            <s-heading>Reward Mode</s-heading>
            <s-text tone="subdued">
                Controls how many times a customer can earn review points per product.
            </s-text>
            <s-box paddingBlockEnd="small" />
            <s-choice-list
                name="rewardMode"
                value={[value]}
                onInput={(e) => onChange(e.currentTarget.values[0])}
            >
                {REWARD_MODES.map(({ value: v, label, description }) => (
                    <s-choice key={v} value={v} selected={value === v} disabled={busy}>
                        {label}
                        <span slot="description">{description}</span>
                    </s-choice>
                ))}
            </s-choice-list>
        </s-section>
    );
}
