"use client";

import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkPasswordRules } from "@/utils/passwordPolicy";

/**
 * Live password-requirement checklist.
 *
 * Shown wherever a NEW password is chosen (signup, turf-admin signup, password
 * reset) so the rules are visible while typing instead of arriving as a rejection
 * after submit. Rules and their order come from `utils/passwordPolicy.js`, which
 * mirrors the backend — so a fully-ticked list always passes server validation.
 *
 * @param {{password?:string, className?:string}} props
 */
export default function PasswordRules({ password, className }) {
    const rules = checkPasswordRules(password);

    // Nothing typed yet -> keep the form compact, just state the requirement.
    if (!password) {
        return (
            <p className={cn("text-muted-foreground text-xs", className)}>
                Use {rules.length} things: 8+ characters, upper and lower case, and a number.
            </p>
        );
    }

    return (
        <ul className={cn("mt-1 grid gap-1", className)} aria-label="Password requirements">
            {rules.map(({ id, label, met }) => (
                <li
                    key={id}
                    className={cn(
                        "flex items-center gap-1.5 text-xs transition-colors",
                        met ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground"
                    )}
                >
                    {met ? (
                        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : (
                        <Circle className="h-3 w-3 shrink-0" aria-hidden />
                    )}
                    {/* Screen readers get the state in words, not just in colour. */}
                    <span>{label}</span>
                    <span className="sr-only">{met ? " — met" : " — not met yet"}</span>
                </li>
            ))}
        </ul>
    );
}
