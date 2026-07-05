import { atom } from "jotai";

export const actionTypeAtom = atom(""); // e.g, edit | create

export const loaderDataAtom = atom(null);
export const actionDataAtom = atom(null);
export const selectedRuleAtom = atom(null);

// Default structure for a points rule
export const emptyNewRule = {
    id: null,
    eventId: null,
    name: "",
    description: "",
    priority: 1,
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

    earning: {
        type: "fixed", // "incremental" | "fixed"

        // for incremental
        rate: {
            amount: 10,   // e.g. $10
            points: 1     // = 1 point
        },

        // for fixed
        fixedPoints: 10
    },

    appliesTo: {
        type: "allProducts", // "allProducts" | "specificProducts" | "specificCollections"

        products: [],
        collections: [],
        excludedProducts: []
    },

    referral: {
        trigger: "subscription", // oneTime | subscription

        referrer: {
            firstOrderPoints: 100,
            allowRenewalReward: true,
            renewalPoints: 80
        },

        referred: {
            discountType: "fixed",
            discountValue: 10,
            allowRenewalReward: false,
            renewalPoints: 50
        }
    },
    review: {
        text: 10,
        image: 20,
        video: 30
    }
};

export const toggleAtom = atom({
    addRule: false,
    editRule: false,
});

export const loadingButtonAtom = atom({
    addRule: false,
    editRule: false,
    deleteRule: false,
});


export const savedRuleAtom = atom(emptyNewRule);
export const savedConditionsAtom = atom(emptyConditions);



export const newRuleAtom = atom(emptyNewRule);
export const conditionsAtom = atom(emptyConditions);