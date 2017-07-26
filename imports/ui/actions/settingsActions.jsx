export function inverseOption(option) {
    return {
        type: "INVERSE_OPTION",
        payload: option
    };
}

export function setEmail(email) {
    return {
        type: "SET_EMAIL",
        payload: email
    };
}