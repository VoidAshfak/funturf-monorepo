"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LandPlot } from "lucide-react";
import SoccerBall from "./icons/SoccerBall";
import { DrawerClose, DrawerFooter } from "./ui/drawer";
import { Button } from "./ui/button";
import LogoutButton from "./LogoutButton";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { cn } from "@/lib/utils";
import {
    displayName,
    getProfileMenuSections,
    roleLabel,
    userInitials,
} from "@/lib/profileMenu";

// Primary nav for the mobile drawer. The account half of it renders from the
// SAME model as the desktop ProfileMenu (@/lib/profileMenu) so the two menus
// can't drift — and so a player never sees a dashboard link that only bounces
// them back to "/".
export default function NavLinksForSmallScreen({ session }) {
    const pathname = usePathname();
    const user = session?.user;

    const rowClass = (active) =>
        cn(
            "flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-foreground/5",
            active && "bg-primary/10 text-primary"
        );

    const isActive = (href) =>
        href === "/dashboard" ? pathname === href : pathname.startsWith(href);

    return (
        <>
            <div className="flex flex-col">
                <DrawerClose asChild className={rowClass(pathname === "/")}>
                    <Link href="/">
                        <House className="h-5 w-5" />
                        Home
                    </Link>
                </DrawerClose>
                <DrawerClose asChild className={rowClass(pathname.startsWith("/events"))}>
                    <Link href="/events">
                        <SoccerBall className="h-5 w-5" />
                        Play
                    </Link>
                </DrawerClose>
                <DrawerClose asChild className={rowClass(pathname.startsWith("/venues"))}>
                    <Link href="/venues">
                        <LandPlot className="h-5 w-5" />
                        Book
                    </Link>
                </DrawerClose>
            </div>

            <DrawerFooter className="gap-0 px-0">
                {session ? (
                    <>
                        {/* Identity header, mirrors the desktop dropdown. */}
                        <DrawerClose asChild>
                            <Link
                                href={`/profile/${user?.id}`}
                                className="mb-1 flex items-center gap-3 border-y border-border px-5 py-3 hover:bg-foreground/5"
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
                                    <p className="truncate text-xs text-muted-foreground">
                                        {roleLabel(user?.user_type)}
                                    </p>
                                </div>
                            </Link>
                        </DrawerClose>

                        {getProfileMenuSections(user).map((section) => (
                            <div key={section.id} className="flex flex-col">
                                {section.label && (
                                    <p className="px-5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        {section.label}
                                    </p>
                                )}
                                {section.items.map(({ href, label, icon: Icon }) => (
                                    <DrawerClose
                                        key={href}
                                        asChild
                                        className={rowClass(isActive(href))}
                                    >
                                        <Link href={href}>
                                            <Icon className="h-4 w-4" />
                                            {label}
                                        </Link>
                                    </DrawerClose>
                                ))}
                            </div>
                        ))}

                        <DrawerClose asChild className="mt-2 px-2">
                            <LogoutButton />
                        </DrawerClose>
                    </>
                ) : (
                    <div className="flex flex-col gap-3 px-5">
                        <DrawerClose asChild>
                            <Button className="w-full green-glow" asChild>
                                <Link href="/login">Login</Link>
                            </Button>
                        </DrawerClose>
                        <DrawerClose asChild>
                            <Button className="w-full" variant="outline" asChild>
                                <Link href="/signup">Signup</Link>
                            </Button>
                        </DrawerClose>
                    </div>
                )}
            </DrawerFooter>
        </>
    );
}
