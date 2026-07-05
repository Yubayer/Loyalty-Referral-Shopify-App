import { useCallback } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { INTERVAL_OPTIONS } from "@shared-utils/constants/ruleConstants";

/**
 * useOrderHandlers
 *
 * All order-specific form handlers, grouped by concern.
 * Accepts the form state object from useRuleForm and returns
 * a structured object — no flat list of functions.
 *
 * @param {object} formState - form state returned by useRuleForm
 * @returns {{ intervals, groups, excludedProducts }} grouped handlers
 *
 * @example
 * const orderHandlers = useOrderHandlers(formState);
 * orderHandlers.intervals.add();
 * orderHandlers.groups.add();
 * orderHandlers.excludedProducts.openPicker();
 */
export function useOrderHandlers(formState) {
    const shopify = useAppBridge();

    // ── Global intervals (P2) ─────────────────────────────────────────────────

    /**
     * Adds a new global interval override using the next unused interval value.
     * Shows a toast if all intervals are already in use.
     */
    const addInterval = useCallback(() => {
        const usedValues = new Set(
            (formState.form.order.intervals ?? []).map((interval) => interval.interval)
        );
        const nextAvailable = INTERVAL_OPTIONS.find((option) => !usedValues.has(option.value));
        if (!nextAvailable) {
            shopify.toast.show("All intervals are already added.", { isError: true });
            return;
        }
        formState.addItem("order.intervals", {
            interval: nextAvailable.value,
            fixedPoints: 120,
            rate: { amount: 10, points: 2 },
        });
    }, [formState, shopify]);

    /**
     * Removes a global interval override by index.
     * @param {number} intervalIndex
     */
    const removeInterval = useCallback((intervalIndex) => {
        formState.removeItem("order.intervals", intervalIndex);
    }, [formState]);

    /**
     * Updates the interval value (e.g. "monthly") for a global interval.
     * Shows a toast if the value is already used by another interval.
     *
     * @param {number} intervalIndex
     * @param {string} newIntervalValue
     */
    const updateIntervalValue = useCallback((intervalIndex, newIntervalValue) => {
        const selectedLabel = INTERVAL_OPTIONS.find((option) => option.value === newIntervalValue)?.label ?? newIntervalValue;
        const isDuplicate = (formState.form.order.intervals ?? []).some(
            (interval, index) => index !== intervalIndex && interval.interval === newIntervalValue
        );
        if (isDuplicate) {
            shopify.toast.show(`"${selectedLabel}" interval is already added.`, { isError: true });
            return;
        }
        const updated = [...formState.form.order.intervals];
        updated[intervalIndex] = { ...updated[intervalIndex], interval: newIntervalValue };
        formState.set("order.intervals", updated);
    }, [formState, shopify]);

    /**
     * Updates the rate sub-object (points or amount) within a global interval.
     * @param {number} intervalIndex
     * @param {string} rateField - "points" | "amount"
     * @param {number} value
     */
    const updateIntervalRate = useCallback((intervalIndex, rateField, value) => {
        const updated = [...formState.form.order.intervals];
        updated[intervalIndex] = {
            ...updated[intervalIndex],
            rate: { ...updated[intervalIndex].rate, [rateField]: value },
        };
        formState.set("order.intervals", updated);
    }, [formState]);

    /**
     * Updates a non-rate field (e.g. fixedPoints) on a global interval.
     * @param {number} intervalIndex
     * @param {string} field
     * @param {*}      value
     */
    const updateIntervalField = useCallback((intervalIndex, field, value) => {
        formState.updateItem("order.intervals", intervalIndex, field, value);
    }, [formState]);

    // ── Groups (P3) ───────────────────────────────────────────────────────────

    /** Adds a new product group with default earning values. */
    const addGroup = useCallback(() => {
        formState.addItem("order.groups", {
            id: crypto.randomUUID(),
            name: `Group ${(formState.form.order.groups?.length ?? 0) + 1}`,
            products: [],
            fixedPoints: 150,
            rate: { amount: 10, points: 2 },
            intervals: [],
        });
    }, [formState]);

    /**
     * Removes a group by index.
     * @param {number} groupIndex
     */
    const removeGroup = useCallback((groupIndex) => {
        formState.removeItem("order.groups", groupIndex);
    }, [formState]);

    /**
     * Updates a top-level field on a group (e.g. "name", "products", "fixedPoints").
     * @param {number} groupIndex
     * @param {string} field
     * @param {*}      value
     */
    const updateGroupField = useCallback((groupIndex, field, value) => {
        formState.updateItem("order.groups", groupIndex, field, value);
    }, [formState]);

    /**
     * Updates the rate sub-object within a group.
     * @param {number} groupIndex
     * @param {string} rateField - "points" | "amount"
     * @param {number} value
     */
    const updateGroupRate = useCallback((groupIndex, rateField, value) => {
        const updated = [...formState.form.order.groups];
        updated[groupIndex] = {
            ...updated[groupIndex],
            rate: { ...updated[groupIndex].rate, [rateField]: value },
        };
        formState.set("order.groups", updated);
    }, [formState]);

    // ── Group intervals (P4) ──────────────────────────────────────────────────

    /**
     * Adds a new interval override inside a group.
     * Auto-picks the next unused interval for that group.
     *
     * @param {number} groupIndex
     */
    const addGroupInterval = useCallback((groupIndex) => {
        const groups = [...formState.form.order.groups];
        const usedValues = new Set(
            (groups[groupIndex].intervals ?? []).map((interval) => interval.interval)
        );
        const nextAvailable = INTERVAL_OPTIONS.find((option) => !usedValues.has(option.value));
        if (!nextAvailable) {
            shopify.toast.show("All intervals are already added to this group.", { isError: true });
            return;
        }
        groups[groupIndex] = {
            ...groups[groupIndex],
            intervals: [
                ...(groups[groupIndex].intervals ?? []),
                { interval: nextAvailable.value, fixedPoints: 130, rate: { amount: 10, points: 3 } },
            ],
        };
        formState.set("order.groups", groups);
    }, [formState, shopify]);

    /**
     * Removes an interval override from inside a group.
     * @param {number} groupIndex
     * @param {number} intervalIndex
     */
    const removeGroupInterval = useCallback((groupIndex, intervalIndex) => {
        const groups = [...formState.form.order.groups];
        groups[groupIndex] = {
            ...groups[groupIndex],
            intervals: groups[groupIndex].intervals.filter((_, index) => index !== intervalIndex),
        };
        formState.set("order.groups", groups);
    }, [formState]);

    /**
     * Updates the interval value inside a group interval.
     * Shows a toast if the value is already used by another interval in the same group.
     *
     * @param {number} groupIndex
     * @param {number} intervalIndex
     * @param {string} newIntervalValue
     */
    const updateGroupIntervalValue = useCallback((groupIndex, intervalIndex, newIntervalValue) => {
        const selectedLabel = INTERVAL_OPTIONS.find((option) => option.value === newIntervalValue)?.label ?? newIntervalValue;
        const isDuplicate = (formState.form.order.groups[groupIndex].intervals ?? []).some(
            (interval, index) => index !== intervalIndex && interval.interval === newIntervalValue
        );
        if (isDuplicate) {
            shopify.toast.show(`"${selectedLabel}" interval is already added to this group.`, { isError: true });
            return;
        }
        const groups = [...formState.form.order.groups];
        const intervals = [...groups[groupIndex].intervals];
        intervals[intervalIndex] = { ...intervals[intervalIndex], interval: newIntervalValue };
        groups[groupIndex] = { ...groups[groupIndex], intervals };
        formState.set("order.groups", groups);
    }, [formState, shopify]);

    /**
     * Updates a non-rate field (e.g. fixedPoints) within a group interval.
     * @param {number} groupIndex
     * @param {number} intervalIndex
     * @param {string} field
     * @param {*}      value
     */
    const updateGroupIntervalField = useCallback((groupIndex, intervalIndex, field, value) => {
        const groups = [...formState.form.order.groups];
        const intervals = [...groups[groupIndex].intervals];
        intervals[intervalIndex] = { ...intervals[intervalIndex], [field]: value };
        groups[groupIndex] = { ...groups[groupIndex], intervals };
        formState.set("order.groups", groups);
    }, [formState]);

    /**
     * Updates the rate sub-object within a group interval.
     * @param {number} groupIndex
     * @param {number} intervalIndex
     * @param {string} rateField - "points" | "amount"
     * @param {number} value
     */
    const updateGroupIntervalRate = useCallback((groupIndex, intervalIndex, rateField, value) => {
        const groups = [...formState.form.order.groups];
        const intervals = [...groups[groupIndex].intervals];
        intervals[intervalIndex] = {
            ...intervals[intervalIndex],
            rate: { ...intervals[intervalIndex].rate, [rateField]: value },
        };
        groups[groupIndex] = { ...groups[groupIndex], intervals };
        formState.set("order.groups", groups);
    }, [formState]);

    // ── Excluded products ─────────────────────────────────────────────────────

    /**
     * Returns a Set of product IDs blocked from the excluded-products picker —
     * i.e. products already assigned to any group.
     *
     * @returns {Set<string>}
     */
    const getBlockedProductIdsForExcluded = useCallback(() => {
        return new Set(
            (formState.form.order.groups ?? []).flatMap(
                (group) => (group.products ?? []).map((product) => product.id)
            )
        );
    }, [formState]);

    /**
     * Returns a Set of product IDs blocked for a given group picker —
     * i.e. excluded products + products in any OTHER group.
     *
     * @param {number} groupIndex
     * @returns {Set<string>}
     */
    const getBlockedProductIdsForGroup = useCallback((groupIndex) => {
        const excludedIds = (formState.form.order.excludedProducts ?? []).map((product) => product.id);
        const otherGroupIds = (formState.form.order.groups ?? [])
            .filter((_, index) => index !== groupIndex)
            .flatMap((group) => (group.products ?? []).map((product) => product.id));
        return new Set([...excludedIds, ...otherGroupIds]);
    }, [formState]);

    /**
     * Opens the Shopify resource picker for excluded products.
     * Filters out products already in a group and shows a toast if any were skipped.
     */
    const openExcludedProductPicker = useCallback(async () => {
        const selectionIds = (formState.form.order.excludedProducts ?? []).map((product) => ({ id: product.id }));
        const result = await shopify.resourcePicker({
            type: "product", multiple: true, selectionIds, filter: { variants: false },
        });
        if (!result?.selection?.length) return;

        const blockedIds = getBlockedProductIdsForExcluded();
        const allowedProducts = [];
        const blockedTitles = [];

        result.selection.forEach((selected) => {
            if (blockedIds.has(selected.id)) {
                blockedTitles.push(selected.title);
            } else {
                allowedProducts.push({
                    id: selected.id,
                    title: selected.title,
                    image: selected.images?.[0]?.originalSrc ?? null,
                    handle: selected.handle,
                });
            }
        });

        if (blockedTitles.length > 0) {
            shopify.toast.show(
                `${blockedTitles.length} product${blockedTitles.length > 1 ? "s" : ""} skipped — already in a group: ${blockedTitles.join(", ")}`,
                { isError: true }
            );
        }
        if (allowedProducts.length > 0) formState.set("order.excludedProducts", allowedProducts);
    }, [formState, shopify, getBlockedProductIdsForExcluded]);

    /**
     * Removes a product from the excluded-products list.
     * @param {string} productId
     */
    const removeExcludedProduct = useCallback((productId) => {
        formState.set(
            "order.excludedProducts",
            formState.form.order.excludedProducts.filter((product) => product.id !== productId)
        );
    }, [formState]);

    /**
     * Opens the Shopify resource picker for a group's products.
     * Filters out excluded products and products in other groups.
     *
     * @param {number} groupIndex
     */
    const openGroupProductPicker = useCallback(async (groupIndex) => {
        const group = formState.form.order.groups[groupIndex];
        const selectionIds = (group.products ?? []).map((product) => ({ id: product.id }));
        const result = await shopify.resourcePicker({
            type: "product", multiple: true, selectionIds, filter: { variants: false },
        });
        if (!result?.selection?.length) return;

        const blockedIds = getBlockedProductIdsForGroup(groupIndex);
        const allowedProducts = [];
        const blockedTitles = [];

        result.selection.forEach((selected) => {
            if (blockedIds.has(selected.id)) {
                blockedTitles.push(selected.title);
            } else {
                allowedProducts.push({
                    id: selected.id,
                    title: selected.title,
                    image: selected.images?.[0]?.originalSrc ?? null,
                    handle: selected.handle,
                });
            }
        });

        if (blockedTitles.length > 0) {
            shopify.toast.show(
                `${blockedTitles.length} product${blockedTitles.length > 1 ? "s" : ""} skipped — already excluded or in another group: ${blockedTitles.join(", ")}`,
                { isError: true }
            );
        }
        if (allowedProducts.length > 0) updateGroupField(groupIndex, "products", allowedProducts);
    }, [formState, shopify, updateGroupField, getBlockedProductIdsForGroup]);

    /**
     * Removes a product from a group's product list.
     * @param {number} groupIndex
     * @param {string} productId
     */
    const removeGroupProduct = useCallback((groupIndex, productId) => {
        const group = formState.form.order.groups[groupIndex];
        updateGroupField(
            groupIndex,
            "products",
            group.products.filter((product) => product.id !== productId)
        );
    }, [formState, updateGroupField]);

    // ─────────────────────────────────────────────────────────────────────────
    // Grouped return
    // ─────────────────────────────────────────────────────────────────────────

    return {
        /** Global interval overrides (Priority 2) */
        intervals: {
            add: addInterval,
            remove: removeInterval,
            updateValue: updateIntervalValue,
            updateRate: updateIntervalRate,
            updateField: updateIntervalField,
        },

        /** Product group handlers (Priority 3 + 4) */
        groups: {
            add: addGroup,
            remove: removeGroup,
            updateField: updateGroupField,
            updateRate: updateGroupRate,

            /** Products within a group */
            products: {
                openPicker: openGroupProductPicker,
                remove: removeGroupProduct,
            },

            /** Interval overrides within a group (Priority 4) */
            intervals: {
                add: addGroupInterval,
                remove: removeGroupInterval,
                updateValue: updateGroupIntervalValue,
                updateField: updateGroupIntervalField,
                updateRate: updateGroupIntervalRate,
            },
        },

        /** Excluded products (never earn points regardless of group/interval) */
        excludedProducts: {
            openPicker: openExcludedProductPicker,
            remove: removeExcludedProduct,
        },
    };
}