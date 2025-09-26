import Link from "next/link"
import { Button } from "@/components/ui/button"

import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from "@/components/ui/navigation-menu"
import ProfileMenu from "./ProfileMenu"

export default function Navbar({ className }) {

    const user = true

    return (
        <>
            <Link href={"/"} className="w-10 ml-14">
                <img src="/assets/icons/logo.svg" alt="Logo" />
            </Link>

            <NavigationMenu className={` ${className}`}>
                <NavigationMenuList>

                    <NavigationMenuItem>
                        <NavigationMenuLink
                            href="/events"
                        // className={`${(pathName === "/events" || (pathName.startsWith("/events") && pathName !== "/")) ? "backdrop-blur-sm bg-green-700/10" : ""}`}
                        >
                            <div className="flex gap-2 items-center">
                                <img className="w-8" src="/assets/icons/play.png" alt="play" /><span className="text-xl"> Play </span>
                            </div>
                        </NavigationMenuLink>
                    </NavigationMenuItem>

                    <NavigationMenuItem>
                        <NavigationMenuLink
                            href="/venues"
                        // className={`${(pathName === "/venues" || (pathName.startsWith("/venues") && pathName !== "/")) ? "backdrop-blur-sm bg-green-700/10" : ""}`}
                        >
                            <div className="flex gap-2 items-center">
                                <img className="w-8" src="/assets/icons/book.png" alt="book" /><span className="text-xl"> Book </span>
                            </div>
                        </NavigationMenuLink>
                    </NavigationMenuItem>

                </NavigationMenuList>
            </NavigationMenu>


            <div className="mr-10">
                {!user ? (
                    <>
                        <div>
                            <Button
                                className="mx-2"
                                asChild
                            >
                                <Link href="/login">Login</Link>
                            </Button>
                            <Button
                                className="mx-2"
                                variant='outline'
                                asChild
                            >
                                <Link href="/signup">Signup</Link>
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex gap-8 items-center">
                            {/* <Notification /> */}
                            <ProfileMenu />
                        </div>
                    </>
                )}
            </div>

        </>
    )
}
