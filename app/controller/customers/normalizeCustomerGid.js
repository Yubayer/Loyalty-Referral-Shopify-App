export const normalizeCustomerGid = (customerId) => {
    if (!customerId) return null;

    if (
        typeof customerId === "string" &&
        customerId.startsWith("gid://shopify/Customer/")
    ) {
        return customerId;
    }

    return `gid://shopify/Customer/${customerId}`;
};
