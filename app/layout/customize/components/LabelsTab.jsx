import { DS, WIDGET_CONFIG_SECTIONS } from "../constants/cssVarsConfig";
import { ConfigLabelField } from "./ConfigLabelField";

const LABELS_SECTION = WIDGET_CONFIG_SECTIONS.find((s) => s.key === "labels");

// ─────────────────────────────────────────────────────────────────────────────
// LABELS TAB
//
// Two-column list of every label/text override field, split evenly.
// ─────────────────────────────────────────────────────────────────────────────

export function LabelsTab({ widgetConfig, onConfigChange, isNetworkSubmitting }) {
    if (!LABELS_SECTION) return null;

    const midpoint = Math.ceil(LABELS_SECTION.fields.length / 2);
    const firstHalf = LABELS_SECTION.fields.slice(0, midpoint);
    const secondHalf = LABELS_SECTION.fields.slice(midpoint);

    return (
        <>
            <s-grid gridTemplateColumns="1fr 1fr" gap="base">

                <s-section>
                    <div style={{ display: "flex", flexDirection: "column", gap: DS.sp10 }}>
                        {LABELS_SECTION.fields.map((field) => (
                            <ConfigLabelField key={field.key} field={field} widgetConfig={widgetConfig} onChange={onConfigChange} disabled={isNetworkSubmitting} />
                        ))}
                    </div>
                </s-section>

                {/* Column 1 — first half of fields */}
                {/* <s-section>
                    <div style={{ display: "flex", flexDirection: "column", gap: DS.sp10 }}>
                        {firstHalf.map((field) => (
                            <ConfigLabelField key={field.key} field={field} widgetConfig={widgetConfig} onChange={onConfigChange} disabled={isNetworkSubmitting} />
                        ))}
                    </div>
                </s-section> */}
                {/* Column 2 — second half of fields */}
                {/* <s-section>
                    <div style={{ display: "flex", flexDirection: "column", gap: DS.sp10 }}>
                        {secondHalf.map((field) => (
                            <ConfigLabelField key={field.key} field={field} widgetConfig={widgetConfig} onChange={onConfigChange} disabled={isNetworkSubmitting} />
                        ))}
                    </div>
                </s-section> */}
            </s-grid>
        </>
    );
}
