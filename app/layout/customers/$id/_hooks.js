import { useEffect, useRef } from "react";
import { useNavigate, useNavigation, useSubmit } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { usePagination } from "@app/hooks/pagination/usePagination";

export function useCustomerDetailsPage(loaderData, actionData) {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const submit = useSubmit();
    const shopify = useAppBridge();

    const customer = loaderData?.customer ?? {};
    const customerLabel = customer?.name || customer?.email || "Customer Details";

    const isSubmitting = navigation.state === "submitting";
    const pendingSubmit = navigation.formData?.get("submitType");
    const isAdjusting = isSubmitting && pendingSubmit === "adjustPoints";

    // ── Toast on action result ────────────────────────────────────────────────
    useEffect(() => {
        if (!actionData) return;
        shopify.toast.show(actionData.message, { isError: actionData.status === "error" });
    }, [actionData, shopify]);

    // ── Navigation ────────────────────────────────────────────────────────────
    const handleBack = () => navigate("/app/customers", { replace: true });

    // ── Adjust points submit ──────────────────────────────────────────────────
    const handleAdjustPoints = ({ mode, amount, reason }) => {
        submit({
            submitType: "adjustPoints",
            customerId: String(customer.id),
            shopifyId: customer.shopifyId,
            mode,
            amount: String(amount),
            reason: reason || "",
        }, { method: "POST" });
    };

    // ── Pagination ────────────────────────────────────────────────────────────
    const txPagination = usePagination(customer?.transactions ?? [], 25);
    const rwPagination = usePagination(customer?.rewards ?? [], 25);

    return {
        customer, customerLabel,
        isAdjusting,
        handleBack,
        handleAdjustPoints,
        txPagination,
        rwPagination,
    };
}
