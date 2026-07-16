"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { gsap } from "@/lib/animations";
import NavLink from "./NavLink";
import ChatLauncher from "./ChatLauncher";
import NotificationBell from "./NotificationBell";
import ProfileMenu from "./ProfileMenu";
import ThemeToggle from "./ThemeToggle";

// Floating glass pill navbar. Single look, no morph.
// Hides when scrolling down, slides back in when scrolling up (always shown near top).
export default function Navbar({ session }) {
    const barRef = useRef(null);
    const lastY = useRef(0);
    const hidden = useRef(false);

    useEffect(() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const moveTo = gsap.quickTo(barRef.current, "yPercent", {
            duration: 0.4,
            ease: "power3.out",
        });
        const show = () => {
            hidden.current = false;
            reduce ? gsap.set(barRef.current, { yPercent: 0 }) : moveTo(0);
        };
        const hide = () => {
            hidden.current = true;
            reduce ? gsap.set(barRef.current, { yPercent: -140 }) : moveTo(-140);
        };

        const onScroll = () => {
            const y = window.scrollY;
            const goingDown = y > lastY.current;
            lastY.current = y;

            if (y < 80) {
                if (hidden.current) show();
                return;
            }
            if (goingDown && !hidden.current) hide();
            else if (!goingDown && hidden.current) show();
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header className="fixed inset-x-0 top-0 z-50 flex justify-center">
            <nav
                ref={barRef}
                className="glass-nav mt-3 flex w-[min(94%,1080px)] items-center justify-between gap-6 rounded-full border border-border px-6 py-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.28)] will-change-transform"
            >
                <Link href="/" className="shrink-0">
                    <Image
                        src="/assets/icons/logo.svg"
                        alt="Logo"
                        width={40}
                        height={40}
                    />
                </Link>

                <NavLink />

                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    {!session ? (
                        <>
                            <Button className="mx-1 rounded-full" asChild>
                                <Link href="/login">Login</Link>
                            </Button>
                            <Button className="mx-1 rounded-full" variant="outline" asChild>
                                <Link href="/signup">Signup</Link>
                            </Button>
                        </>
                    ) : (
                        <div className="flex items-center gap-3">
                            <ChatLauncher />
                            <NotificationBell />
                            <ProfileMenu session={session} />
                        </div>
                    )}
                </div>
            </nav>
        </header>
    );
}
