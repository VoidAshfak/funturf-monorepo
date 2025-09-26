import { SignupForm } from "@/components/forms/signup-form"
import Image from "next/image"

const SignupPage = () => {
    return (
        <div className="grid min-h-svh lg:grid-cols-5 backdrop-blur-sm">
            <div className="col-span-3 flex flex-col gap-4 p-6 md:p-10">
                <div className="flex flex-1 justify-center">
                    <div className="w-full gap-4">
                        <SignupForm />
                    </div>
                </div>
            </div>
            <div className="col-span-2 bg-muted relative hidden lg:block">
                <Image
                    src="/assets/images/login.png"
                    alt="Image"
                    fill   // replaces absolute + inset-0 + w-full + h-full
                    className="object-cover dark:brightness-[0.2] dark:grayscale"
                    priority // optional: preload since it’s on login page
                />
            </div>
        </div>
    )
}

export default SignupPage