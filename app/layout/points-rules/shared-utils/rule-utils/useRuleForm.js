import { useSubmit } from "react-router";
import { useFormState } from "@app/hooks/useFormState";

/**
 * @typedef {Object} FormState
 * @property {Object}   form          - Current form values
 * @property {Function} set           - Update a single field by dot-path
 *                                      @example fs.set("order.fixedPoints", 100)
 * @property {Function} setMany       - Update multiple fields at once
 *                                      @example fs.setMany([["order.type", "fixed"], ["order.fixedPoints", 100]])
 * @property {Function} addItem       - Append an item to an array field
 *                                      @example fs.addItem("order.groups", { id: "...", name: "Group 1" })
 * @property {Function} removeItem    - Remove an item from an array field by index
 *                                      @example fs.removeItem("order.groups", 0)
 * @property {Function} updateItem    - Update a single field on an array item
 *                                      @example fs.updateItem("order.groups", 0, "name", "Premium")
 * @property {Function} errorFor      - Get the validation error message for a field path
 *                                      @example fs.errorFor("order.fixedPoints") → "Must be greater than 0"
 * @property {boolean}  isDirty       - True if any field has changed from the initial value
 * @property {Function} submit        - Trigger form submission (runs validate → onSubmit)
 * @property {Function} reset         - Reset all fields back to initial values
 */

/**
 * Shared form state hook for all points-rule pages.
 *
 * Wraps `useFormState` with the standard create/update submit pattern
 * so each route only needs to pass its own `buildFormShape`, `validate`,
 * and `payloadKey` — the submit wiring is handled here once.
 *
 * @param {Object|null} rule            - Rule loaded from DB (null in create mode)
 * @param {Function}    buildFormShape  - Converts raw DB data to safe form values
 *                                        Signature: (rule) => formObject
 * @param {Function}    validate        - Validates current form values before submit
 *                                        Signature: (form) => errorsObject
 * @param {string}      payloadKey      - Top-level key for the event-specific data
 *                                        e.g. "order" | "referral" | "review"
 * @param {string}      mode            - "create" | "edit"
 * @returns {FormState}
 *
 * @example
 * const formState = useRuleForm(rule, buildFormShape, validate, "order", mode);
 *
 * // Read values
 * formState.form.order.fixedPoints
 *
 * // Update a value
 * formState.set("order.fixedPoints", 100)
 *
 * // Show a validation error
 * formState.errorFor("order.fixedPoints")
 *
 * // Submit / discard
 * formState.submit()
 * formState.reset()
 */
export function useRuleForm(rule, buildFormShape, validate, payloadKey, mode) {
    const submitToAction = useSubmit();

    return useFormState(rule, buildFormShape, {
        validate,
        onSubmit: async (form) => {
            const payload = JSON.stringify({
                name: form.name,
                description: form.description,
                isActive: form.isActive,
                [payloadKey]: form[payloadKey],
            });

            if (mode === "edit") {
                submitToAction(
                    { submitType: "updateRule", ruleId: rule.id, payload },
                    { method: "post" }
                );
            } else {
                submitToAction(
                    { submitType: "createRule", payload },
                    { method: "post" }
                );
            }
        },
    });
}