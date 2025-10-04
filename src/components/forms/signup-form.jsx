"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import InputField from "../InputField"
import RequiredSign from "../RequiredSign"

export function SignupForm({
    className,
    ...props
}) {

    const {
        register,
        control,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm({
        defaultValues: {
            gender: "male",
            date_of_birth: null,
        },
    });

    const onSubmit = (data) => console.log(data)

    return (
        <form
            className={cn("flex flex-col gap-6", className)}
            {...props}
            onSubmit={handleSubmit(onSubmit)}
        >
            {/* Heading */}
            <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Register User</h1>
                <p className="text-muted-foreground text-sm text-balance">
                    Enter your information below to create an account
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 shadow-md">
                <div className="space-y-2">
                    <Label
                        htmlFor="first_name"
                    >
                        First Name
                        <RequiredSign />
                    </Label>
                    <InputField errors={errors}>
                        <Input
                            type="text"
                            id="first_name"
                            name="first_name"
                            placeholder="Enter First Name"
                            className={`${errors?.first_name ? 'border-2 border-red-500' : ''}`}
                            {...register("first_name", {
                                required: "First name is required"
                            })}
                        />
                    </InputField>
                </div>

                <div className="relative space-y-2">
                    <Label
                        htmlFor="last_name"
                    >
                        Last Name
                        <RequiredSign />
                    </Label>
                    <InputField errors={errors}>
                        <Input
                            type="text"
                            id="last_name"
                            name="last_name"
                            placeholder="Enter Last Name"
                            className={`${errors?.last_name ? 'border-2 border-red-500' : ''}`}
                            {...register("last_name", {
                                required: "Last name is required"
                            })}
                        />
                    </InputField>
                </div>

                <div className="relative space-y-2">
                    <Label
                        htmlFor="phone"
                    >
                        Phone
                        <RequiredSign />
                    </Label>
                    <InputField errors={errors}>
                        <Input
                            type="phone"
                            id="phone"
                            name="phone"
                            placeholder="Enter Phone Number"
                            className={`${errors?.phone ? 'border-2 border-red-500' : ''}`}
                            {...register("phone", {
                                required: "Phone number is required"
                            })}
                        />
                    </InputField>

                </div>

                <div className="relative space-y-2">
                    <Label
                        htmlFor="email"
                    >
                        Email
                        <RequiredSign />
                    </Label>
                    <InputField errors={errors}>
                        <Input
                            type="text"
                            id="email"
                            name="email"
                            placeholder="Enter Email Address"
                            className={`${errors?.email ? 'border-2 border-red-500' : ''}`}
                            {...register("email", {
                                required: "Email is required",
                                pattern: {
                                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // basic email regex
                                    message: "Please enter a valid email address",
                                },
                            })}
                        />
                    </InputField>
                </div>

                <div className="space-y-2">
                    <Label
                    >
                        Gender
                        <RequiredSign />
                    </Label>
                    <Controller
                        name="gender"
                        control={control}
                        rules={{ required: "Gender is required" }}
                        render={({ field }) => (
                            <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="male" id="male" />
                                    <Label htmlFor="male">Male</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="female" id="female" />
                                    <Label htmlFor="female">Female</Label>
                                </div>
                            </RadioGroup>
                        )}
                    />

                </div>

                <div className="space-y-2">
                    <Label
                    >
                        Date of Birth
                        <RequiredSign />
                    </Label>
                    <InputField errors={errors}>
                        <Controller
                            name="date_of_birth"
                            control={control}
                            rules={{ required: "Please give date of birth" }}
                            render={({ field }) => (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            data-empty={!field.value}
                                            className={`data-[empty=true]:text-muted-foreground w-full justify-start text-left font-normal ${errors?.date_of_birth ? 'border-2 border-red-500' : ''}`}
                                        >
                                            <CalendarIcon />
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                                    </PopoverContent>
                                </Popover>
                            )}
                        />

                    </InputField>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <InputField errors={errors}>
                        <Textarea
                            id="bio"
                            name="bio"
                            rows="4"
                            placeholder="Tell us about yourself..."
                            {...register("bio")}
                        />
                    </InputField>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="address">
                        Address
                        <RequiredSign />
                    </Label>
                    <InputField errors={errors}>
                        <Textarea
                            id="address"
                            name="address"
                            rows="4"
                            placeholder="Tell us about yourself..."
                            className={`${errors?.address ? 'border-2 border-red-500' : ''}`}
                            {...register("address", {
                                required: "Address is required"
                            })}
                        />
                    </InputField>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password">
                        Password
                        <RequiredSign />
                    </Label>
                    <InputField errors={errors}>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            className={`${errors?.password ? 'border-2 border-red-500' : ''}`}
                            {...register("password", {
                                required: "Password is required",
                                minLength: {
                                    value: 6,
                                    message: "Password must be at least 6 characters."
                                }
                            })}
                        />
                    </InputField>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                        Confirm Password
                        <RequiredSign />
                    </Label>
                    <InputField errors={errors}>
                        <Input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="pssword"
                            className={`${errors?.confirmPassword ? 'border-2 border-red-500' : ''}`}
                            {...register("confirmPassword", {
                                required: "Confirm your password",
                                validate: (value) => value === watch("password") || "Passwords do not match"

                            })}
                        />
                    </InputField>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-4 text-center text-sm">
                <Button
                    type="submit"
                    className="w-1/3"
                // disabled={loading}
                >
                    {/* {loading && <Loader2 className="animate-spin" />} */}
                    Sign Up
                </Button>
                <div>
                    Already have an account?{" "}
                    <Link href="/login" className="underline underline-offset-4">
                        Login
                    </Link>
                </div>
            </div>
        </form>
    );
}
