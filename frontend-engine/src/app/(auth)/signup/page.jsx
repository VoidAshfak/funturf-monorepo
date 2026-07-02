import Link from "next/link";
import { ArrowRight, Building2, User } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";

// Onboarding entry point: pick an account type, then go to the matching signup
// form. The chosen type is sent as user_type on register (whitelisted server-side).
const options = [
    {
        href: "/signup/player",
        icon: User,
        title: "I'm a Player",
        desc: "Find matches, book turfs, and connect with turfmates.",
    },
    {
        href: "/signup/turf-admin",
        icon: Building2,
        title: "I'm a Turf Owner",
        desc: "List your grounds, manage bookings, and grow your venue.",
    },
];

export default function SignupChooserPage() {
    return (
        <AuthShell>
            <div className="flex flex-col gap-6">
                <div className="text-center">
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                        Join FunTurf
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Choose how you want to get started.
                    </p>
                </div>

                <div className="grid gap-4">
                    {options.map(({ href, icon: Icon, title, desc }) => (
                        <Link
                            key={href}
                            href={href}
                            className="group flex items-center gap-4 rounded-2xl border border-border p-5 transition-all duration-300 hover:border-primary hover:bg-primary/5"
                        >
                            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                                <Icon className="h-6 w-6" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <h2 className="font-bold text-foreground">{title}</h2>
                                <p className="text-sm text-muted-foreground">{desc}</p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                        </Link>
                    ))}
                </div>

                <p className="text-center text-sm">
                    Already have an account?{" "}
                    <Link href="/login" className="underline underline-offset-4">
                        Login
                    </Link>
                </p>
            </div>
        </AuthShell>
    );
}
