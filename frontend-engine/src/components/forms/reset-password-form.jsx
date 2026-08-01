"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { CheckCircle2, Eye, EyeOff, KeyRound, LinkIcon, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PasswordRules from "@/components/auth/PasswordRules";
import InputField from "../InputField";
import RequiredSign from "../RequiredSign";
import { cn } from "@/lib/utils";
import { notifySuccess } from "@/lib/notify";
import { validatePasswordField } from "@/utils/passwordPolicy";
import { getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from "@/utils/apiError";
import { useResetPasswordMutation, useValidateResetTokenMutation } from "@/store/api/apiSlice";

/** Error codes that mean "the link is dead, get a new one". */
const DEAD_LINK_CODES = new Set(["RESET_TOKEN_INVALID", "RESET_TOKEN_EXPIRED", "RESET_TOKEN_USED"]);

/**
 * Step 2 of password recovery — choose the new password.
 *
 * FLOW
 *   1. Read `?token=` from the URL, then immediately scrub it out of the address
 *      bar with replaceState. The token stays in React state; what leaves the page
 *      is a clean `/reset-password` URL. That keeps a single-use credential out of
 *      browser history, out of a shared screenshot, and out of the Referer header.
 *   2. Validate the token before rendering a form, so a stale link says
 *      "expired — request a new one" instead of failing after the user has typed.
 *   3. Submit. On success the API has revoked every session, so we send the user
 *      to /login rather than trying to sign them in here.
 */
export function ResetPasswordForm({ className }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [token, setToken] = useState(null);
    const [tokenState, setTokenState] = useState("checking"); // checking | valid | dead
    const [account, setAccount] = useState(null); // { email (masked), first_name }
    const [deadReason, setDeadReason] = useState("");
    const [done, setDone] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [validateResetToken] = useValidateResetTokenMutation();
    const [resetPassword, { isLoading: isSaving }] = useResetPasswordMutation();

    const {
        register,
        handleSubmit,
        watch,
        setError,
        formState: { errors },
    } = useForm();

    // React 18 StrictMode mounts effects twice in dev; the guard keeps this to one
    // validation call. (Validation is read-only, so a double call is harmless —
    // this is just to avoid a confusing duplicate in the network tab.)
    const checkedRef = useRef(false);

    useEffect(() => {
        if (checkedRef.current) return;
        checkedRef.current = true;

        const raw = searchParams.get("token");

        if (!raw) {
            setTokenState("dead");
            setDeadReason("This page needs a reset link. Request one and open it from your email.");
            return;
        }

        setToken(raw);

        // Scrub the token from the visible URL (see step 1 above). replaceState
        // rather than router.replace: no re-render, no refetch, no history entry.
        window.history.replaceState(null, "", window.location.pathname);

        validateResetToken({ token: raw })
            .unwrap()
            .then((data) => {
                setAccount({ email: data?.email, first_name: data?.first_name });
                setTokenState("valid");
            })
            .catch((error) => {
                setTokenState("dead");
                setDeadReason(
                    getApiErrorMessage(error, "This reset link is not valid. Request a new one.")
                );
            });
    }, [searchParams, validateResetToken]);

    const onSubmit = async ({ password }) => {
        try {
            await resetPassword({ token, password }).unwrap();
            setDone(true);
            notifySuccess("Password changed", "Log in with your new password.");
            // Give the toast a moment to register before navigating away.
            setTimeout(() => router.push("/login"), 1800);
        } catch (error) {
            const code = getApiErrorCode(error);

            // The link died between page load and submit (expired, or spent in
            // another tab) — swap the form out for the dead-link panel.
            if (DEAD_LINK_CODES.has(code)) {
                setTokenState("dead");
                setDeadReason(getApiErrorMessage(error, "This reset link is no longer valid."));
                return;
            }

            // Server-side policy rejection. `errors` carries one entry per unmet
            // rule; join them so the user sees everything at once.
            if (code === "WEAK_PASSWORD") {
                const details = getApiErrorDetails(error)
                    .map((detail) => detail?.message)
                    .filter(Boolean);
                setError("password", {
                    message: details.length > 0 ? details.join(". ") : getApiErrorMessage(error),
                });
                return;
            }

            if (code === "PASSWORD_UNCHANGED") {
                setError("password", { message: getApiErrorMessage(error) });
                return;
            }

            setError("root.response", {
                message: getApiErrorMessage(error, "Could not update your password. Try again."),
            });
        }
    };

    // --- done ---------------------------------------------------------------
    if (done) {
        return (
            <div className={cn("flex flex-col items-center gap-5 text-center", className)}>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal/15">
                    <CheckCircle2 className="h-7 w-7 text-teal-600 dark:text-teal-400" aria-hidden />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                        Password updated
                    </h1>
                    <p className="text-muted-foreground text-sm text-balance">
                        You&apos;ve been signed out on every device. Taking you to the login page…
                    </p>
                </div>
                <Button asChild className="green-glow w-full rounded-full">
                    <Link href="/login">Log in</Link>
                </Button>
            </div>
        );
    }

    // --- checking the link --------------------------------------------------
    if (tokenState === "checking") {
        return (
            <div className={cn("flex flex-col items-center gap-3 py-10 text-center", className)}>
                <LinkIcon className="text-muted-foreground h-6 w-6 animate-pulse" aria-hidden />
                <p className="text-muted-foreground text-sm">Checking your reset link…</p>
            </div>
        );
    }

    // --- dead link ----------------------------------------------------------
    if (tokenState === "dead") {
        return (
            <div className={cn("flex flex-col items-center gap-5 text-center", className)}>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                    <ShieldAlert className="h-7 w-7 text-destructive" aria-hidden />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                        This link won&apos;t work
                    </h1>
                    <p className="text-muted-foreground text-sm text-balance">{deadReason}</p>
                    <p className="text-muted-foreground text-xs">
                        Reset links last a few minutes and can only be used once — that&apos;s what
                        keeps an old email in your inbox from becoming a way into your account.
                    </p>
                </div>
                <Button asChild className="green-glow w-full rounded-full">
                    <Link href="/forgot-password">Request a new link</Link>
                </Button>
                <Link href="/login" className="text-sm underline underline-offset-4">
                    Back to login
                </Link>
            </div>
        );
    }

    // --- the form -----------------------------------------------------------
    return (
        <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                    Choose a new password
                </h1>
                <p className="text-muted-foreground text-sm text-balance">
                    {account?.email
                        ? // Masked by the API — enough to confirm which account, not
                          // enough to harvest the address.
                          `Resetting the password for ${account.email}.`
                        : "Pick something you haven't used on FunTurf before."}
                </p>
            </div>

            {errors?.root?.response?.message && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-center text-sm font-medium text-destructive">
                    {errors.root.response.message}
                </div>
            )}

            <div className="grid gap-5">
                <div className="grid gap-3">
                    <Label htmlFor="password">
                        New password
                        <RequiredSign />
                    </Label>
                    <div className="relative">
                        <InputField errors={errors}>
                            <Input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                placeholder="Enter a new password"
                                className={cn("pr-10", errors?.password && "border-2 border-red-500")}
                                {...register("password", {
                                    required: "Password is required",
                                    // Shared mirror of the backend policy.
                                    validate: validatePasswordField,
                                })}
                            />
                        </InputField>
                        <button
                            type="button"
                            onClick={() => setShowPassword((visible) => !visible)}
                            className="text-muted-foreground hover:text-foreground absolute right-9 top-1/2 -translate-y-1/2"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4" aria-hidden />
                            ) : (
                                <Eye className="h-4 w-4" aria-hidden />
                            )}
                        </button>
                    </div>
                    <PasswordRules password={watch("password")} />
                </div>

                <div className="grid gap-3">
                    <Label htmlFor="confirmPassword">
                        Confirm new password
                        <RequiredSign />
                    </Label>
                    <InputField errors={errors}>
                        <Input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="Type it again"
                            className={errors?.confirmPassword ? "border-2 border-red-500" : ""}
                            {...register("confirmPassword", {
                                required: "Confirm your password",
                                validate: (value) =>
                                    value === watch("password") || "Passwords do not match",
                            })}
                        />
                    </InputField>
                </div>

                <Button type="submit" className="green-glow w-full rounded-full" disabled={isSaving}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    {isSaving ? "Updating…" : "Update password"}
                </Button>

                <p className="text-muted-foreground text-center text-xs">
                    Changing your password signs you out on every device.
                </p>
            </div>
        </form>
    );
}
