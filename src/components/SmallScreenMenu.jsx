import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { House, Menu, Settings, User, Users } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import LogoutButton from "./LogoutButton";
import Image from "next/image";

export default function SmallScreenMenu({ session }) {
    const { user } = session ?? {};
    return (
        <Drawer direction="left">
            <DrawerTrigger>
                <Menu className="text-7xl" />
            </DrawerTrigger>

            <DrawerContent className="backdrop-blur-lg bg-green-200/30" width="1/2">
                <DrawerHeader>
                    <DrawerTitle>Menu</DrawerTitle>
                </DrawerHeader>

                <div className="flex flex-col">
                    <DrawerClose
                        asChild
                        className="px-5 py-2 hover:bg-white"
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
                        className="px-5 py-2 hover:bg-white"
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
                        className="px-5 py-2 hover:bg-white"
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
                                className="px-5 py-2 hover:bg-white"
                            >
                                <Link
                                    href={`/profile/${user?.id}`}
                                    className="flex items-center gap-3"
                                >
                                    <User className="w-4" />
                                    Profile
                                </Link>
                            </DrawerClose>
                            <DrawerClose
                                asChild
                                className="px-5 py-2 hover:bg-white"
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
                                className="px-5 py-2 hover:bg-white"
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
                                className="px-5 py-2 hover:bg-white"
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
            </DrawerContent>
        </Drawer>
    );
}