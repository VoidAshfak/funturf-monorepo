"use client"

import Link from "next/link"
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList
} from "@/components/ui/navigation-menu"
import { usePathname } from "next/navigation"
import { LandPlot, Ticket, Users } from "lucide-react"
import SoccerBall from "@/components/icons/SoccerBall"

export default function NavLink() {

    const pathname = usePathname();

    return (
        <NavigationMenu>
            <NavigationMenuList className="gap-5">

                <NavigationMenuItem>
                    <Link
                        href="/events"
                        className={`flex items-center p-2 rounded-2xl gap-1 ${pathname.startsWith("/events") ? "backdrop-blur-sm bg-green-700/10" : ""}`}
                    >
                        <SoccerBall className="h-6 w-6 text-foreground" />
                        <span className="text-xl"> Play </span>
                    </Link>
                </NavigationMenuItem>

                <NavigationMenuItem>
                    <Link
                        href="/venues"
                        className={`flex items-center p-2 rounded-2xl gap-1 ${pathname.startsWith("/venues") ? "backdrop-blur-sm bg-green-700/10" : ""}`}
                    >
                        <LandPlot className="h-6 w-6 text-foreground" />
                        <span className="text-xl"> Book </span>
                    </Link>
                </NavigationMenuItem>

                <NavigationMenuItem>
                    <Link
                        href="/turfmates"
                        className={`flex items-center p-2 rounded-2xl gap-1 ${pathname.startsWith("/turfmates") ? "backdrop-blur-sm bg-green-700/10" : ""}`}
                    >
                        <Users className="h-6 w-6 text-foreground" />
                        <span className="text-xl"> Turfmates </span>
                    </Link>
                </NavigationMenuItem>

                <NavigationMenuItem>
                    <Link
                        href="/bookings"
                        className={`flex items-center p-2 rounded-2xl gap-1 ${pathname.startsWith("/bookings") ? "backdrop-blur-sm bg-green-700/10" : ""}`}
                    >
                        <Ticket className="h-6 w-6 text-foreground" />
                        <span className="text-xl"> Bookings </span>
                    </Link>
                </NavigationMenuItem>

            </NavigationMenuList>
        </NavigationMenu>
    )
}