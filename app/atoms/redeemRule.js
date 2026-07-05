import { atom } from "jotai";

export const actionTypeAtom = atom(""); // e.g, edit | create

export const loaderDataAtom = atom(null);
export const actionDataAtom = atom(null);
export const selectedRuleAtom = atom(null);

// Default structure for a points rule
export const emptyNewRule = {
    id: null,
    title: "Voucher {{currency_value}}",
    description: "",
    discountType: "fixed", // fixed | percentage
    rewardValue: 5,
    rewardType: "orderDiscount", // orderDiscount | productDiscount | freeProduct | freeShipping
    pointsCost: 100,
    isAutoApply: false,
    startDate: null,
    endDate: null,
    conditions: "",
    metadata: "",
    isActive: true
};

// Default structure for order-based conditions
export const emptyConditions = {
    minAmount: null,
    maxAmount: null,

};

export const toggleAtom = atom({
    inputSection: false,
});

export const loadingButtonAtom = atom({
    addRule: false,
    editRule: false,
    deleteRule: false,
});


export const savedRuleAtom = atom(emptyNewRule);

export const newRuleAtom = atom(emptyNewRule);
export const conditionsAtom = atom(emptyConditions);