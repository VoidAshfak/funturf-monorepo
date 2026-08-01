/**
 * Password rules, mirrored from the backend.
 *
 * SOURCE OF TRUTH: `backend-engine/backend/src/utils/passwordPolicy.js`. This copy
 * exists ONLY so the UI can show a live checklist and catch a weak password
 * before a round-trip — it is not security. The API re-validates every password
 * it is given (register and reset both call `assertPasswordPolicy`), so a caller
 * who bypasses this file gains nothing.
 *
 * KEEP IN SYNC: if you change a rule here, change it there in the same commit, or
 * the UI will tick a box the server then rejects.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** bcrypt truncates past 72 bytes, so the backend rejects anything longer. */
export const PASSWORD_MAX_BYTES = 72;

/** Same ids, labels and order as the backend's PASSWORD_RULES. */
export const PASSWORD_RULES = [
    {
        id: "length",
        label: `At least ${PASSWORD_MIN_LENGTH} characters`,
        test: (pw) => pw.length >= PASSWORD_MIN_LENGTH,
    },
    { id: "lowercase", label: "One lowercase letter (a–z)", test: (pw) => /[a-z]/.test(pw) },
    { id: "uppercase", label: "One uppercase letter (A–Z)", test: (pw) => /[A-Z]/.test(pw) },
    { id: "number", label: "One number (0–9)", test: (pw) => /\d/.test(pw) },
];

/**
 * Which rules a candidate password satisfies — for rendering the checklist.
 * @returns {{id:string, label:string, met:boolean}[]}
 */
export const checkPasswordRules = (password) => {
    const value = typeof password === "string" ? password : "";
    return PASSWORD_RULES.map(({ id, label, test }) => ({
        id,
        label,
        // An empty field shows every rule as "not yet met" rather than as a failure.
        met: value.length > 0 && test(value),
    }));
};

/**
 * react-hook-form `validate` function. Returns `true` when the password passes, or
 * the first unmet rule's label as the error message.
 *
 * Usage: {...register("password", { required: "…", validate: validatePasswordField })}
 */
export const validatePasswordField = (password) => {
    const value = typeof password === "string" ? password : "";
    const failed = PASSWORD_RULES.find((rule) => !rule.test(value));
    if (failed) return failed.label;
    // Byte length, not string length — Bangla and emoji are multi-byte in UTF-8.
    if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) {
        return `Password must be at most ${PASSWORD_MAX_BYTES} bytes`;
    }
    return true;
};
