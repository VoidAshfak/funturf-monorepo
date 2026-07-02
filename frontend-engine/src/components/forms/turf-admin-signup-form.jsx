"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Building2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import InputField from "../InputField"
import RequiredSign from "../RequiredSign"
import { useRegisterUserMutation } from "@/store/api/apiSlice"
import { getApiErrorMessage } from "@/utils/apiError"

/**
 * Turf-owner signup. Deliberately minimal — owners create only their account
 * here (name, contact, password). All venue details are collected afterwards in
 * the dedicated turf-creation wizard (/onboarding/turf). Registers with
 * user_type "turf_admin" (whitelisted server-side).
 */
export function TurfAdminSignupForm({ className, ...props }) {
    const router = useRouter();
    const [registerUser] = useRegisterUserMutation();

    const {
        register,
        handleSubmit,
        watch,
        setError,
        formState: { errors, isSubmitting },
    } = useForm();

    const onSubmit = async (data) => {
        const { confirmPassword, password, ...rest } = data;

        try {
            await registerUser({
                ...rest,
                password_hash: password,
                user_type: "turf_admin",
            }).unwrap();

            alert("Turf owner account created! Please log in to set up your turf.");
            router.push("/login");
        } catch (error) {
            console.error("Error submitting:", error);
            setError("root.response", {
                message: getApiErrorMessage(error, "Something went wrong."),
            });
        }
    };

    return (
        <form
            className={cn("flex flex-col gap-6", className)}
            {...props}
            onSubmit={handleSubmit(onSubmit)}
        >
            <div className="flex flex-col items-center gap-2 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                    <Building2 className="h-6 w-6" />
                </span>
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                    Create your turf owner account
                </h1>
                <p className="text-muted-foreground text-sm text-balance">
                    Set up your account — you&apos;ll add your turf details next.
                </p>
            </div>

            {errors?.root?.response?.message && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-center text-sm font-medium text-destructive">
                    {errors.root.response.message}
                </div>
            )}

            <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="first_name">First Name <RequiredSign /></Label>
                    <InputField errors={errors}>
                        <Input
                            type="text"
                            id="first_name"
                            placeholder="Enter First Name"
                            className={`${errors?.first_name ? 'border-2 border-red-500' : ''}`}
                            {...register("first_name", { required: "First name is required" })}
                        />
                    </InputField>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name <RequiredSign /></Label>
                    <InputField errors={errors}>
                        <Input
                            type="text"
                            id="last_name"
                            placeholder="Enter Last Name"
                            className={`${errors?.last_name ? 'border-2 border-red-500' : ''}`}
                            {...register("last_name", { required: "Last name is required" })}
                        />
                    </InputField>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email">Email <RequiredSign /></Label>
                    <InputField errors={errors}>
                        <Input
                            type="text"
                            id="email"
                            placeholder="Enter Email Address"
                            className={`${errors?.email ? 'border-2 border-red-500' : ''}`}
                            {...register("email", {
                                required: "Email is required",
                                pattern: {
                                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                    message: "Please enter a valid email address",
                                },
                            })}
                        />
                    </InputField>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="phone">Phone <RequiredSign /></Label>
                    <InputField errors={errors}>
                        <Input
                            type="tel"
                            id="phone"
                            placeholder="Enter Phone Number"
                            className={`${errors?.phone ? 'border-2 border-red-500' : ''}`}
                            {...register("phone", { required: "Phone number is required" })}
                        />
                    </InputField>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password">Password <RequiredSign /></Label>
                    <InputField errors={errors}>
                        <Input
                            id="password"
                            type="password"
                            className={`${errors?.password ? 'border-2 border-red-500' : ''}`}
                            {...register("password", {
                                required: "Password is required",
                                minLength: { value: 6, message: "Password must be at least 6 characters." },
                            })}
                        />
                    </InputField>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password <RequiredSign /></Label>
                    <InputField errors={errors}>
                        <Input
                            id="confirmPassword"
                            type="password"
                            className={`${errors?.confirmPassword ? 'border-2 border-red-500' : ''}`}
                            {...register("confirmPassword", {
                                required: "Confirm your password",
                                validate: (value) => value === watch("password") || "Passwords do not match",
                            })}
                        />
                    </InputField>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-4 text-center text-sm">
                <Button
                    type="submit"
                    className="green-glow w-full rounded-full sm:w-1/2"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Creating account…" : "Create account"}
                </Button>
                <div>
                    Already have an account?{" "}
                    <Link href="/login" className="underline underline-offset-4">Login</Link>
                </div>
            </div>
        </form>
    );
}
