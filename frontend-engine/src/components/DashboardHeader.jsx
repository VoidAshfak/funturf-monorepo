"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";

// Known dashboard routes -> readable label. Anything not listed falls back to a
// prettified last path segment (and skips UUID segments like /verify/<id>).
const LABELS = {
    dashboard: "Overview",
    bookings: "Bookings",
    verify: "Verify Tickets",
    turfs: "Manage Grounds",
    "add-new-turf": "Create Turf",
    "add-ground": "Add Ground",
    grounds: "Ground",
    edit: "Edit",
};

const isId = (seg) => /^[0-9a-f]{8}-/.test(seg) || /^\d+$/.test(seg);
const prettify = (seg) =>
    seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const labelFor = (seg) => LABELS[seg] ?? prettify(seg);

export default function DashboardHeader() {
    const pathname = usePathname() || "/dashboard";

    // Build the breadcrumb trail from the path, dropping id segments so a deep
    // link like /dashboard/bookings/verify/<uuid> reads "Overview / Bookings /
    // Verify Tickets" instead of showing a raw id.
    const segments = pathname.split("/").filter(Boolean); // ["dashboard", ...]
    const crumbs = [];
    let href = "";
    for (const seg of segments) {
        href += `/${seg}`;
        if (isId(seg)) continue;
        crumbs.push({ href, label: labelFor(seg) });
    }
    const title = crumbs[crumbs.length - 1]?.label ?? "Overview";
    const trail = crumbs.slice(0, -1); // everything above the current page

    return (
        <header className="glass-nav sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border px-4 md:px-5">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
            <div className="hidden h-6 w-px bg-border sm:block" />

            {/* Title + breadcrumb trail */}
            <div className="min-w-0">
                <h1 className="truncate text-sm font-bold leading-tight text-foreground">
                    {title}
                </h1>
                {trail.length > 0 && (
                    <nav className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                        {trail.map((c, i) => (
                            <span key={c.href} className="inline-flex items-center gap-1">
                                {i > 0 && <ChevronRight className="h-3 w-3" />}
                                <Link href={c.href} className="hover:text-foreground">
                                    {c.label}
                                </Link>
                            </span>
                        ))}
                        <ChevronRight className="h-3 w-3" />
                        <span className="text-foreground/70">{title}</span>
                    </nav>
                )}
            </div>

            {/* Right cluster */}
            <div className="ml-auto flex items-center gap-1.5">
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
                >
                    <Link href="/" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" /> View site
                    </Link>
                </Button>
                <ThemeToggle />
                <NotificationBell />
            </div>
        </header>
    );
}
