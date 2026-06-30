import Link from "next/link";
import Image from "next/image";
import {
    MapPin,
    Mail,
    Phone,
    ArrowUpRight,
    Instagram,
    Twitter,
    Facebook,
    Youtube,
} from "lucide-react";

const SOCIALS = [
    { href: "https://instagram.com", label: "Instagram", icon: Instagram },
    { href: "https://twitter.com", label: "Twitter", icon: Twitter },
    { href: "https://facebook.com", label: "Facebook", icon: Facebook },
    { href: "https://youtube.com", label: "YouTube", icon: Youtube },
];

const LINKS = {
    Play: [
        { label: "Find Turfs", href: "/venues" },
        { label: "Open Matches", href: "/events" },
        { label: "Host a Game", href: "/events" },
        { label: "Find Teammates", href: "/events" },
    ],
    Company: [
        { label: "About Us", href: "/" },
        { label: "List Your Turf", href: "/dashboard" },
        { label: "Careers", href: "/" },
        { label: "Contact", href: "/" },
    ],
    Support: [
        { label: "Help Center", href: "/" },
        { label: "Terms of Service", href: "/" },
        { label: "Privacy Policy", href: "/" },
        { label: "FAQ", href: "/" },
    ],
};

export default function Footer() {
    return (
        <footer className="relative isolate mt-16 overflow-hidden border-t border-border bg-gradient-to-b from-[#eef3ef] to-[#e7f1ea] dark:from-[#0c1410] dark:to-[#0a0a0a]">
            {/* ambient glows */}
            <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/20 blur-[120px]" />
            <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-teal/15 blur-[120px]" />
            {/* dotted texture */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.15] dark:opacity-[0.1]"
                style={{
                    backgroundImage:
                        "radial-gradient(rgba(29,185,84,0.5) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                    maskImage:
                        "radial-gradient(ellipse at top, black, transparent 70%)",
                    WebkitMaskImage:
                        "radial-gradient(ellipse at top, black, transparent 70%)",
                }}
            />

            <div className="relative mx-auto max-w-7xl px-6 py-14 md:px-12 md:py-16 lg:px-20">
                {/* top: brand + CTA */}
                <div className="flex flex-col gap-10 border-b border-border pb-12 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-sm">
                        <Link href="/" className="inline-flex items-center gap-2">
                            <Image
                                src="/assets/icons/logo.svg"
                                alt="Funturf"
                                width={40}
                                height={40}
                            />
                            <span className="text-2xl font-extrabold tracking-tight text-foreground">
                                Fun
                                <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                                    turf
                                </span>
                            </span>
                        </Link>
                        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                            Book the best turfs, join open matches, and find your
                            squad. The home ground for your local sports community.
                        </p>

                        {/* socials */}
                        <div className="mt-6 flex items-center gap-3">
                            {SOCIALS.map(({ href, label, icon: Icon }) => (
                                <a
                                    key={label}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={label}
                                    className="grid h-10 w-10 place-items-center rounded-full border border-border text-muted-foreground transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:bg-primary hover:text-primary-foreground"
                                >
                                    <Icon className="h-[18px] w-[18px]" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* link columns */}
                    <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:gap-16">
                        {Object.entries(LINKS).map(([heading, items]) => (
                            <div key={heading}>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                                    {heading}
                                </h3>
                                <ul className="mt-4 space-y-3">
                                    {items.map(({ label, href }) => (
                                        <li key={label}>
                                            <Link
                                                href={href}
                                                className="group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
                                            >
                                                {label}
                                                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* contact row */}
                <div className="grid gap-6 py-10 sm:grid-cols-3">
                    <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                            <MapPin className="h-5 w-5" />
                        </span>
                        <p className="text-sm text-muted-foreground">
                            Dhaka · Rajshahi · Chittagong
                        </p>
                    </div>
                    <a
                        href="mailto:hello@funturf.com"
                        className="flex items-center gap-3"
                    >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                            <Mail className="h-5 w-5" />
                        </span>
                        <p className="text-sm text-muted-foreground transition-colors hover:text-primary">
                            support@funturf.com
                        </p>
                    </a>
                    <a href="tel:+910000000000" className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                            <Phone className="h-5 w-5" />
                        </span>
                        <p className="text-sm text-muted-foreground transition-colors hover:text-primary">
                            +8801783980758
                        </p>
                    </a>
                </div>

                {/* bottom bar */}
                <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-center sm:flex-row sm:text-left">
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} Funturf. All rights reserved.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Made for players, by players.
                    </p>
                </div>
            </div>
        </footer>
    );
}
