import { CalendarCheck2, MapPin, Users } from "lucide-react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { cn } from "@/lib/utils";

const FEATURES = [
    {
        icon: CalendarCheck2,
        title: "Book in seconds",
        text: "Reserve premium turfs near you, any time of day.",
    },
    {
        icon: Users,
        title: "Find your squad",
        text: "Join open matches and rally teammates this week.",
    },
    {
        icon: MapPin,
        title: "Play anywhere",
        text: "Discover grounds across the city on the map.",
    },
];

export default function AuthBrandPanel({ className }) {
    return (
        <div
            className={cn(
                "relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between",
                className
            )}
        >
            {/* ambient glows */}
            <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/25 blur-[120px]" />
            <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-teal/20 blur-[120px]" />
            {/* dotted texture */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.15] dark:opacity-[0.1]"
                style={{
                    backgroundImage:
                        "radial-gradient(rgba(29,185,84,0.5) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                    maskImage: "radial-gradient(ellipse at center, black, transparent 80%)",
                    WebkitMaskImage:
                        "radial-gradient(ellipse at center, black, transparent 80%)",
                }}
            />

            {/* logo */}
            <Link href="/" className="relative inline-flex w-fit items-center gap-2">
                <Logo height={32} />
                <span className="text-2xl font-extrabold tracking-tight text-foreground">
                    Fun
                    <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                        turf
                    </span>
                </span>
            </Link>

            {/* headline */}
            <div className="relative">
                <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground">
                    Your next match{" "}
                    <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                        starts here.
                    </span>
                </h2>
                <p className="mt-3 max-w-sm text-muted-foreground">
                    Join the community of players booking turfs and building squads every day.
                </p>

                <ul className="mt-8 space-y-5">
                    {FEATURES.map(({ icon: Icon, title, text }) => (
                        <li key={title} className="flex items-start gap-4">
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                                <Icon className="h-5 w-5" />
                            </span>
                            <div>
                                <p className="font-bold text-foreground">{title}</p>
                                <p className="text-sm text-muted-foreground">{text}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <p className="relative text-xs text-muted-foreground">
                © {new Date().getFullYear()} Funturf. Play more.
            </p>
        </div>
    );
}
