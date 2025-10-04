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
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

const signIn = (formData) => {
    console.log(formData)
}

export function SignupForm({
    className,
    ...props
}) {

    const [date, setDate] = useState()

    return (
        <form
            action={formAction}
            className={cn("flex flex-col gap-6", className)}
            {...props}
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
                        htmlFor="firstName"
                    >
                        First Name
                    </Label>
                    <Input
                        type="text"
                        id="firstName"
                        name="firstName"
                        placeholder="Enter First Name"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label
                        htmlFor="lastName"
                    >
                        Last Name
                    </Label>
                    <Input
                        type="text"
                        id="lastName"
                        name="lastName"
                        placeholder="Enter Last Name"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label
                        htmlFor="phone"
                    >
                        Phone
                    </Label>
                    <Input
                        type="phone"
                        id="phone"
                        name="phone"
                        placeholder="Enter Phone  Number"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label
                        htmlFor="email"
                    >
                        Email
                    </Label>
                    <Input
                        type="email"
                        id="email"
                        name="email"
                        placeholder="Enter Email Address"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label
                    >
                        Gender
                    </Label>
                    <RadioGroup defaultValue="male" className="flex">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="male" id="male" />
                            <Label htmlFor="male">Male</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="female" id="female" />
                            <Label htmlFor="female">Female</Label>
                        </div>
                    </RadioGroup>
                </div>

                <div className="space-y-2">
                    <Label
                    >
                        Date of Birth
                    </Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                data-empty={!date}
                                className="data-[empty=true]:text-muted-foreground w-[280px] justify-start text-left font-normal"
                            >
                                <CalendarIcon />
                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={date} onSelect={setDate} />
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                        id="bio"
                        name="bio"
                        rows="4"
                        placeholder="Tell us about yourself..."
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                        id="address"
                        name="address"
                        rows="4"
                        placeholder="Tell us about yourself..."
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password">
                        Password <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        required
                        className="w-full border rounded-md px-4 py-2"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                        Confirm Password <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="pssword"
                        required
                        className="w-full border rounded-md px-4 py-2"
                    />
                </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-4 text-center text-sm">
                <Button type="submit" className="w-1/3" disabled={loading}>
                    {loading && <Loader2 className="animate-spin" />}
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
