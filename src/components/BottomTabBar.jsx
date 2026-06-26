"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, MapPin, User } from "lucide-react";

// Mobile-only bottom tab bar (DESIGN.md navigation). Frosted glass, fixed bottom,
// safe-area aware. Hidden from tablet up where the top nav takes over.
export default function BottomTabBar({ userId }) {
    const pathname = usePathname();

    const tabs = [
        { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
        { href: "/venues", label: "Book", icon: MapPin, match: (p) => p.startsWith("/venues") },
        { href: "/events", label: "Matches", icon: CalendarDays, match: (p) => p.startsWith("/events") },
        {
            href: userId ? `/profile/${userId}` : "/login",
            label: "Profile",
            icon: User,
            match: (p) => p.startsWith("/profile"),
        },
    ];

    return (
        <nav
            className="md:hidden fixed bottom-0 inset-x-0 z-50 glass-nav border-t border-[rgba(255,255,255,0.1)]"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <ul className="flex items-stretch justify-around h-[60px]">
                {tabs.map(({ href, label, icon: Icon, match }) => {
                    const active = match(pathname);
                    return (
                        <li key={label} className="flex-1">
                            <Link
                                href={href}
                                className={`flex h-full min-h-[60px] flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <Icon className="w-6 h-6" />
                                {label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
