"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import ChatLauncher from "@/components/ChatLauncher";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import TurfBrand from "@/components/TurfBrand";

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

// Identify segments that are a record id rather than a page name, so the
// breadcrumb can skip them. Three forms: the 22-char masked public id that URLs
// now carry, a bare UUID (older links, and anything not yet masked), and a
// numeric id. Without the first case a deep link would render its raw token as a
// breadcrumb label.
const isId = (seg) =>
    /^[A-Za-z0-9_-]{22}$/.test(seg) || /^[0-9a-f]{8}-/.test(seg) || /^\d+$/.test(seg);
const prettify = (seg) =>
    seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const labelFor = (seg) => LABELS[seg] ?? prettify(seg);

/**
 * @param {{id:string,name:string,logo_url:string|null}|null} brand
 *   Turf identity from the dashboard layout. Repeated here (not just in the
 *   sidebar) because the sidebar collapses on mobile — without this the panel
 *   would lose every trace of whose turf it is on a phone.
 */
export default function DashboardHeader({ brand = null }) {
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

            {/* Turf mark — logo only, since the name is right there in the sidebar
                on desktop and the top bar is tight on mobile. */}
            {brand && (
                <Link href={`/dashboard/turfs/${brand.id}`} className="shrink-0">
                    <TurfBrand name={brand.name} logoUrl={brand.logo_url} size={26} showName={false} />
                </Link>
            )}

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
                <ChatLauncher />
                <NotificationBell />
            </div>
        </header>
    );
}
