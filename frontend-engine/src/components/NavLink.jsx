"use client"

import Link from "next/link"
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList
} from "@/components/ui/navigation-menu"
import Image from "next/image"
import { usePathname } from "next/navigation"

export default function NavLink() {

    const pathname = usePathname();

    return (
        <NavigationMenu>
            <NavigationMenuList className="gap-5">

                <NavigationMenuItem>
                    <Link
                        href="/events"
                        className={`flex p-2 rounded-2xl gap-1 ${pathname.startsWith("/events") ? "backdrop-blur-sm bg-green-700/10" : ""}`}
                    >
                        <Image
                            src="/assets/icons/play.png"
                            alt="play"
                            width={25}
                            height={25}
                            className="transition-[filter] duration-300 dark:invert"
                        />
                        <span className="text-xl"> Play </span>
                    </Link>
                </NavigationMenuItem>

                <NavigationMenuItem>
                    <Link
                        href="/venues"
                        className={`flex p-2 rounded-2xl gap-1 ${pathname.startsWith("/venues") ? "backdrop-blur-sm bg-green-700/10" : ""}`}
                    >
                        <Image
                            src="/assets/icons/book.png"
                            alt="book"
                            width={25}
                            height={20}
                            className="transition-[filter] duration-300 dark:invert"
                        /><span className="text-xl"> Book </span>
                    </Link>
                </NavigationMenuItem>

            </NavigationMenuList>
        </NavigationMenu>
    )
}