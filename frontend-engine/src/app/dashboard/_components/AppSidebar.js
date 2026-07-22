"use client";

import { Button } from "@/components/ui/button";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Building2, CalendarCheck, LayoutDashboard, LogOut, Plus, ScanLine, Ticket, User } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useGetVenuesByAdminQuery } from "@/store/api/apiSlice";
import { disconnectSocket } from "@/lib/socket";
import Image from "next/image";
import Link from "next/link";
import Logo from "@/components/Logo";
import { usePathname } from "next/navigation";

const MANAGE_LINKS = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck, exact: true },
    { href: "/dashboard/bookings/verify", label: "Verify Tickets", icon: ScanLine },
    { href: "/dashboard/turfs", label: "Manage Grounds", icon: Building2 },
    { href: "/dashboard/promotions", label: "Coupons", icon: Ticket },
];

export default function AppSidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();

    const isActive = (href, exact) =>
        exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

    const user = session?.user;
    const profileHref = user?.id ? `/profile/${user.id}` : "/dashboard";

    // One turf per admin: once the turf exists, "Create Turf" becomes "Add Ground".
    // The dashboard layout already guarantees a turf_admin here HAS a turf, so
    // default to that while the list loads (avoids a Create->Add flicker).
    const { data: venues } = useGetVenuesByAdminQuery(user?.id, { skip: !user?.id });
    const hasTurf = venues ? venues.length > 0 : user?.user_type === "turf_admin";
    const primaryAction = hasTurf
        ? { href: "/dashboard/turfs/add-ground", label: "Add Ground" }
        : { href: "/dashboard/turfs/add-new-turf", label: "Create Turf" };

    // Display name + initials for the avatar fallback (no email on the session).
    const displayName =
        [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
        user?.username ||
        "Account";
    const initials =
        (user?.first_name?.[0] ?? user?.username?.[0] ?? "U").toUpperCase();
    // turf_admin -> "Turf Admin"
    const roleLabel = user?.user_type
        ? user.user_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "";

    return (
        <Sidebar>
            <SidebarHeader className="border-b border-border">
                <Link href="/" className="flex items-center gap-2.5 px-2 py-3">
                    <Logo height={22} />
                    <span className="text-xl font-extrabold tracking-tight text-primary">FUNTURF</span>
                </Link>
                <div className="px-2 pb-2">
                    <Button asChild className="green-glow w-full rounded-full">
                        <Link href={primaryAction.href}>
                            <Plus className="mr-2 h-4 w-4" />
                            {primaryAction.label}
                        </Link>
                    </Button>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Manage</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {MANAGE_LINKS.map(({ href, label, icon: Icon, exact }) => (
                                <SidebarMenuItem key={href}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive(href, exact)}
                                        className="data-[active=true]:bg-primary/15 data-[active=true]:text-primary"
                                    >
                                        <Link href={href}>
                                            <Icon />
                                            {label}
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-border">
                {/* Profile card: avatar (image or initials fallback) + name + role. */}
                <Link
                    href={profileHref}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-primary/10"
                >
                    {user?.image ? (
                        <Image
                            src={user.image}
                            alt={displayName}
                            width={40}
                            height={40}
                            className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                    ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                            {initials}
                        </span>
                    )}
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold text-foreground">
                            {displayName}
                        </span>
                        {roleLabel && (
                            <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
                        )}
                    </div>
                </Link>

                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={pathname.startsWith("/profile")}
                            className="data-[active=true]:bg-primary/15 data-[active=true]:text-primary"
                        >
                            <Link href={profileHref}>
                                <User />
                                Profile
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        {/* Real <button> owned by SidebarMenuButton (no asChild wrapping a
                            component that renders its own <button> — that nesting caused the
                            hydration error on click). signOut redirects home afterward. */}
                        <SidebarMenuButton
                            onClick={() => {
                                disconnectSocket();
                                signOut({ callbackUrl: "/" });
                            }}
                            className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                        >
                            <LogOut className="text-red-400" />
                            Log out
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
