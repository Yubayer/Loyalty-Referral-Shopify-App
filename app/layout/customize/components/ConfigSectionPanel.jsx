import { DS } from "../constants/cssVarsConfig";
import { ConfigToggleField } from "./ConfigToggleField";
import { ConfigSelectField } from "./ConfigSelectField";
import { ConfigRangeField } from "./ConfigRangeField";
import { ConfigLabelField } from "./ConfigLabelField";
import { ConfigTextField } from "./ConfigTextField";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG SECTION PANEL
//
// Renders one "Widget Config" tab section — header + its list of fields,
// dispatching each field to the right Config*Field component by type.
// ─────────────────────────────────────────────────────────────────────────────

export function ConfigSectionPanel({ section, widgetConfig, onChange, disabled }) {
    return (
        <div>
            <div style={{ marginBottom: DS.sp20 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: DS.text, lineHeight: 1.2, marginBottom: DS.sp6 }}>{section.label}</div>
                <div style={{ fontSize: 12, color: DS.textMuted }}>{section.description}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: DS.sp10 }}>
                {section.fields.map((field) => {
                    if (field.type === "toggle") return <ConfigToggleField key={field.key} field={field} widgetConfig={widgetConfig} onChange={onChange} disabled={disabled} />;
                    if (field.type === "select") return <ConfigSelectField key={field.key} field={field} widgetConfig={widgetConfig} onChange={onChange} disabled={disabled} />;
                    if (field.type === "range") return <ConfigRangeField key={field.key} field={field} widgetConfig={widgetConfig} onChange={onChange} disabled={disabled} />;
                    if (field.type === "label") return <ConfigLabelField key={field.key} field={field} widgetConfig={widgetConfig} onChange={onChange} disabled={disabled} />;
                    if (field.type === "text") return <ConfigTextField key={field.key} field={field} widgetConfig={widgetConfig} onChange={onChange} disabled={disabled} />;
                    return null;
                })}
            </div>
        </div>
    );
}
