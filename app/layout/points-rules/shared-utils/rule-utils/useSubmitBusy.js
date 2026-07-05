import { useNavigation } from "react-router";

// ─────────────────────────────────────────────────────────────────────────────
// useSubmitBusy
//
// Returns true while a createRule or updateRule form submission is in flight.
// Drives the `disabled` / `loading` state on inputs and buttons.
//
// Usage:
//   const busy = useSubmitBusy();
// ─────────────────────────────────────────────────────────────────────────────

const SUBMIT_TYPES = ["createRule", "updateRule"];

export function useSubmitBusy() {
    const navigation = useNavigation();
    return (
        navigation.state === "submitting" &&
        SUBMIT_TYPES.includes(navigation.formData?.get("submitType"))
    );
}
