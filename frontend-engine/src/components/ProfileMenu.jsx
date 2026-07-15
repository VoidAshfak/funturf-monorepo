"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { disconnectSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import {
    displayName,
    getProfileMenuSections,
    roleLabel,
    userInitials,
} from "@/lib/profileMenu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// Account menu in the navbar. Items come from the shared model in
// @/lib/profileMenu, so the mobile drawer shows exactly the same set and every
// link resolves to a real route (no dead "#" entries, no admin links for players).
export default function ProfileMenu({ session }) {
    const user = session?.user;
    const pathname = usePathname();
    const sections = getProfileMenuSections(user);

    // Highlight the section of the app you're currently in. Exact match for the
    // dashboard root so /dashboard/turfs doesn't light up two rows at once.
    const isActive = (href) =>
        href === "/dashboard" ? pathname === href : pathname.startsWith(href);

    const handleLogout = () => {
        // Kill the notification socket before the token disappears, otherwise the
        // client keeps a dead authenticated connection open.
        disconnectSocket();
        signOut({ callbackUrl: "/" });
    };

    return (
        // Non-modal: a modal dropdown locks body scroll and pads the body to
        // compensate for the removed scrollbar, which shoves the fixed, centered
        // navbar to the right on open. Non-modal skips the scroll-lock entirely.
        <DropdownMenu modal={false}>
            {/* A real <button> — the old bare <Avatar> div could not be reached
                or opened with the keyboard. */}
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Open account menu"
                    className="rounded-full outline-none ring-offset-2 ring-offset-background transition focus-visible:ring-2 focus-visible:ring-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/60"
                >
                    <Avatar className="h-10 w-10 cursor-pointer border border-border">
                        <AvatarImage src={user?.image} alt={displayName(user)} />
                        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                            {userInitials(user)}
                        </AvatarFallback>
                    </Avatar>
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                sideOffset={10}
                className="glass-neutral w-64 rounded-2xl border-border p-1.5"
            >
                {/* Identity header — who am I actually signed in as. */}
                <DropdownMenuLabel className="p-0">
                    <Link
                        href={`/profile/${user?.id}`}
                        className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-foreground/5"
                    >
                        <Avatar className="h-10 w-10 border border-border">
                            <AvatarImage src={user?.image} alt={displayName(user)} />
                            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                                {userInitials(user)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                                {displayName(user)}
                            </p>
                            <p className="truncate text-xs font-normal text-muted-foreground">
                                {user?.email}
                            </p>
                        </div>
                    </Link>
                </DropdownMenuLabel>

                <div className="px-2 pb-1.5">
                    <span className="glass-chip inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium text-primary">
                        {roleLabel(user?.user_type)}
                    </span>
                </div>

                {sections.map((section) => (
                    <div key={section.id}>
                        <DropdownMenuSeparator className="bg-border" />
                        {section.label && (
                            <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {section.label}
                            </DropdownMenuLabel>
                        )}
                        <DropdownMenuGroup>
                            {section.items.map(({ href, label, icon: Icon }) => (
                                <DropdownMenuItem key={href} asChild>
                                    <Link
                                        href={href}
                                        className={cn(
                                            "cursor-pointer gap-2.5 rounded-xl px-2 py-2 text-sm",
                                            isActive(href) &&
                                                "bg-primary/10 text-primary focus:bg-primary/15 focus:text-primary"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span>{label}</span>
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                    </div>
                ))}

                <DropdownMenuSeparator className="bg-border" />

                {/* onSelect, not a nested <Button> — a button inside a menu item is
                    two interactive elements stacked and breaks keyboard activation. */}
                <DropdownMenuItem
                    variant="destructive"
                    onSelect={handleLogout}
                    className="cursor-pointer gap-2.5 rounded-xl px-2 py-2 text-sm"
                >
                    <LogOut className="h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
