"use client"

import Link from "next/link";
import { DrawerClose, DrawerFooter } from "./ui/drawer";
import { House, Settings, User, Users } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "./ui/button";
import LogoutButton from "./LogoutButton";

export default function NavLinksForSmallScreen({ session }) {

    const pathname = usePathname();

    return (
        <>
            <div className="flex flex-col">
                <DrawerClose
                    asChild
                    className={`px-5 py-2 hover:bg-white/5 ${pathname === '/' ? 'bg-primary/10 text-primary' : ''}`}
                >
                    <Link
                        href="/"
                        className="flex items-center gap-3"
                    >
                        <House className="w-5" />
                        Home</Link>
                </DrawerClose>
                <DrawerClose
                    asChild
                    className={`px-5 py-2 hover:bg-white/5 ${pathname.startsWith('/events') ? 'bg-primary/10 text-primary' : ''}`}
                >
                    <Link
                        href="/events"
                        className="flex items-center gap-3"
                    >
                        <Image
                            src="/assets/icons/play.png"
                            alt="play"
                            width={20}
                            height={20}
                        />
                        Play</Link>
                </DrawerClose>
                <DrawerClose
                    asChild
                    className={`px-5 py-2 hover:bg-white/5 ${pathname.startsWith('/venues') ? 'bg-primary/10 text-primary' : ''}`}
                >
                    <Link
                        href="/venues"
                        className="flex items-center gap-3"
                    >
                        <Image
                            src="/assets/icons/book.png"
                            alt="book"
                            width={20}
                            height={20}
                        />
                        Book</Link>
                </DrawerClose>

            </div>

            <DrawerFooter className="px-0">
                {session ? (
                    <>
                        <DrawerClose
                            asChild
                            className={`px-5 py-2 hover:bg-white/5 ${pathname.startsWith('/profile') ? 'bg-primary/10 text-primary' : ''}`}
                        >
                            <Link
                                href={`/profile/${session?.user?.id}`}
                                className="flex items-center gap-3"
                            >
                                <User className="w-4" />
                                Profile
                            </Link>
                        </DrawerClose>
                        <DrawerClose
                            asChild
                            className={`px-5 py-2 hover:bg-white/5 ${pathname.startsWith('/settings') ? 'bg-primary/10 text-primary' : ''}`}
                        >
                            <Link
                                href="#"
                                className="flex items-center gap-3"
                            >
                                <Settings className="w-4" />
                                Settings</Link>
                        </DrawerClose>
                        <DrawerClose
                            asChild
                            className={`px-5 py-2 hover:bg-white/5 ${pathname.startsWith('/teams') ? 'bg-primary/10 text-primary' : ''}`}
                        >
                            <Link
                                href="#"
                                className="flex items-center gap-3"
                            >
                                <Users className="w-4" />
                                Team</Link>
                        </DrawerClose>
                        <DrawerClose
                            asChild
                            className="px-5 py-2 hover:bg-white/5"
                        >
                            <LogoutButton />
                        </DrawerClose>
                    </>
                )
                    : (
                        <div className="flex flex-col gap-3 px-5">
                            <DrawerClose asChild>
                                <Link href="/login">
                                    <Button className="w-full">
                                        Login
                                    </Button>
                                </Link>
                            </DrawerClose>
                            <DrawerClose asChild>
                                <Link href="/signup">
                                    <Button className="w-full">
                                        Signup
                                    </Button>
                                </Link>
                            </DrawerClose>
                        </div>
                    )
                }

            </DrawerFooter>
        </>
    )
}