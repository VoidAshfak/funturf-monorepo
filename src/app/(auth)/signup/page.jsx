import { SignupForm } from "@/components/forms/signup-form"
import Image from "next/image"

const SignupPage = () => {
    return (
        <div className="grid min-h-svh lg:grid-cols-5 backdrop-blur-sm">
            <div className="col-span-3 p-6 md:p-10">
                <SignupForm />
            </div>
            <div className="col-span-2 bg-muted relative hidden lg:block lg:sticky lg:top-0 lg:h-screen">
                <Image
                    src="/assets/images/login.png"
                    alt="Image"
                    fill
                    className="object-cover dark:brightness-[0.2] dark:grayscale"
                    priority
                />
            </div>
        </div>
    )
}

export default SignupPage