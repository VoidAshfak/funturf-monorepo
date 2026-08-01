"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArrowLeft, MailCheck, Send, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyError } from "@/lib/notify";
import { useForm } from "react-hook-form";
import InputField from "../InputField";
import RequiredSign from "../RequiredSign";
import { useForgotPasswordMutation } from "@/store/api/apiSlice";
import { getApiErrorCode, getApiErrorMessage } from "@/utils/apiError";

/**
 * Step 1 of password recovery — request a reset link.
 *
 * THREE OUTCOMES:
 *   200            -> "check your inbox" panel
 *   404 USER_NOT_FOUND -> the address has no account; send them to /signup with the
 *                     email carried along, rather than leaving them waiting for an
 *                     email that will never arrive
 *   429 RATE_LIMITED  -> shown verbatim so they wait instead of hammering the form
 *
 * The 404 is a product decision, not an oversight: it means this form can be used
 * to check whether an email is registered on FunTurf. The backend caps it at 5
 * requests/hour/IP and logs every miss. See the header comment in
 * backend-engine/backend/src/controllers/auth/password.controller.js before
 * changing either side — the two must move together.
 */
export function ForgotPasswordForm({ className }) {
    const router = useRouter();
    const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

    // Explicit "we sent it" state rather than react-hook-form's isSubmitSuccessful:
    // this handler swallows its own errors, which would leave that flag true on a
    // failed request. It also carries the values the confirmation panel needs.
    const [sent, setSent] = useState(null); // { email, ttlMinutes } | null

    // Set on a 404 so the button stays disabled while the router navigates to
    // /signup — otherwise the form flashes back to "Send reset link" mid-redirect
    // and invites a second submit.
    const [redirecting, setRedirecting] = useState(false);

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm();

    const onSubmit = async ({ email }) => {
        try {
            const result = await forgotPassword({ email }).unwrap();
            // TTL comes from the API so the copy can't drift from the real setting
            // (PASSWORD_RESET_TOKEN_TTL_MINUTES on the backend).
            setSent({ email, ttlMinutes: result?.expires_in_minutes ?? 30 });
        } catch (error) {
            const code = getApiErrorCode(error);

            // No account on that address — nothing to reset, so put them on the
            // signup path with the email they already typed carried over.
            if (code === "USER_NOT_FOUND") {
                setRedirecting(true);
                notifyError(
                    "No account for that email",
                    "Taking you to sign up — you can create one now."
                );
                router.push(`/signup?email=${encodeURIComponent(email)}`);
                return;
            }

            // RATE_LIMITED is the one remaining failure worth showing verbatim —
            // the user needs to know to wait rather than keep retrying.
            setError("root.response", {
                message:
                    code === "RATE_LIMITED"
                        ? "Too many reset requests. Wait a little and try again."
                        : getApiErrorMessage(error, "Could not send the reset link. Try again."),
            });
        }
    };

    if (sent) {
        return (
            <div className={cn("flex flex-col items-center gap-5 text-center", className)}>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal/15">
                    <MailCheck className="h-7 w-7 text-teal-600 dark:text-teal-400" aria-hidden />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                        Check your inbox
                    </h1>
                    <p className="text-muted-foreground text-sm text-balance">
                        We&apos;ve sent a password reset link to{" "}
                        <span className="font-medium text-foreground">{sent.email}</span>. It expires
                        in {sent.ttlMinutes} minutes and works only once.
                    </p>
                    <p className="text-muted-foreground text-xs">
                        Nothing after a minute or two? Check your spam folder.
                    </p>
                </div>
                <Button asChild variant="outline" className="w-full rounded-full">
                    <Link href="/login">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to login
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                    Forgot your password?
                </h1>
                <p className="text-muted-foreground text-sm text-balance">
                    Enter the email you signed up with and we&apos;ll send you a reset link.
                </p>
            </div>

            {errors?.root?.response?.message && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-center text-sm font-medium text-destructive">
                    {errors.root.response.message}
                </div>
            )}

            <div className="grid gap-6">
                <div className="grid gap-3">
                    <Label htmlFor="email">
                        Email
                        <RequiredSign />
                    </Label>
                    <InputField errors={errors}>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="Enter Your Email"
                            className={errors?.email ? "border-2 border-red-500" : ""}
                            {...register("email", {
                                required: "Email is required",
                                pattern: {
                                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // same basic check as login
                                    message: "Please enter a valid email address",
                                },
                            })}
                        />
                    </InputField>
                </div>

                <Button
                    type="submit"
                    className="green-glow w-full rounded-full"
                    disabled={isLoading || redirecting}
                >
                    <Send className="mr-2 h-4 w-4" />
                    {redirecting ? "Redirecting…" : isLoading ? "Sending…" : "Send reset link"}
                </Button>
            </div>

            <div className="space-y-2 text-center text-sm">
                <p>
                    Remembered it?{" "}
                    <Link href="/login" className="underline underline-offset-4">
                        Back to login
                    </Link>
                </p>
                <p className="text-muted-foreground">
                    <Link
                        href="/signup"
                        className="inline-flex items-center gap-1.5 underline underline-offset-4"
                    >
                        <UserPlus className="h-3.5 w-3.5" aria-hidden />
                        No account yet? Sign up
                    </Link>
                </p>
            </div>
        </form>
    );
}
