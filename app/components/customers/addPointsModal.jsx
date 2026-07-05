import { useEffect, useState } from "react";
import { useSubmit } from "react-router";

export default function AddPointsModal({ customer }) {
    if (!customer) return null;

    const submit = useSubmit();

    const emptyInput = {
        customerId: customer.id,
        shopifyId: customer.shopifyId,
        points: 1,
        type: "ADJUST",
        reason: "",
    };

    const [input, setInput] = useState(emptyInput);

    useEffect(() => {
        setInput(prev => {
            return {
                ...prev,
                customerId: customer.id,
                shopifyId: customer.shopifyId
            }
        })
    }, [customer?.id, customer?.shopifyId])

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setInput((prev) => ({ ...prev, [name]: value }));
    };

    const clearInput = () => {
        setInput(emptyInput);
    };

    const handleSubmit = () => {
        if (!input.points || input.points == 0) {
            shopify.toast.show("Please enter a valid points value.", { duration: 5000, isError: true });
            return;
        }

        console.log("input", input)

        const _input = {
            ...input,
            customerId: customer?.id,
            shopifyId: customer.shopifyId,
            points: parseInt(input.points),
            reason: input.reason || "Admin adjustment",
        }

        console.log("input", _input)
        // return;

        if (!_input?.customerId) {
            shopify.toast.show("Customer id not found!");
            return;
        }

        submit({
            input: JSON.stringify(_input),
            submitType: "addPoints",
        }, { method: "POST" });
    };

    return (<s-modal id="add-points-modal" heading="Adjust Points (add or remove)" size="base" onHide={() => clearInput()}>
        <s-number-field
            label="Points" placeholder="1"
            name="points" type="number"
            step="1"
            required onInput={handleInputChange}
            value={input.points}
            error={!input.points || input.points == 0 ? "Point must be a number and cannot be zero." : null}
        />
        <s-box paddingBlockEnd="base" />
        <s-text-area
            label="Reason (optional)"
            name="reason"
            placeholder="Manually adjusting points for customer"
            onInput={handleInputChange} value={input.reason}
        />
        <s-box paddingBlockEnd="base" />

        <s-stack direction="inline" gap="base" justifyContent="end" paddingBlockStart="base">
            <s-button commandFor="add-points-modal" command="--hide">Cancel</s-button>
            <s-button
                variant="primary"
                commandFor="add-points-modal"
                command="--hide"
                disabled={!input.points || input.points == 0}
                onClick={() => handleSubmit()}
                icon={input?.points > 0 ? 'plus-circle' : 'minus-circle'}
            >
                Adjust Points
            </s-button>
        </s-stack>
        {/* <pre>{JSON.stringify(input, null, 2)}</pre> */}
    </s-modal>)
}