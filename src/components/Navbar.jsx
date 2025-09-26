import Link from "next/link"
import { Button } from "@/components/ui/button"

import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from "@/components/ui/navigation-menu"
import ProfileMenu from "./ProfileMenu"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import Image from "next/image"

export default async function Navbar({ className }) {

    const session = await getServerSession(authOptions);

    return (
        <>
            <Link href="/">
                <Image
                    src="/assets/icons/logo.svg"
                    alt="Logo"
                    width={40}
                    height={40}
                />
            </Link>

            <NavigationMenu className={` ${className}`}>
                <NavigationMenuList>

                    <NavigationMenuItem>
                        <NavigationMenuLink
                            href="/events"
                        // className={`${(pathName === "/events" || (pathName.startsWith("/events") && pathName !== "/")) ? "backdrop-blur-sm bg-green-700/10" : ""}`}
                        >
                            <div className="flex gap-2 items-center">
                                <Image
                                    src="/assets/icons/play.png"
                                    alt="play"
                                    width={30}
                                    height={20}
                                />
                                <span className="text-xl"> Play </span>
                            </div>
                        </NavigationMenuLink>
                    </NavigationMenuItem>

                    <NavigationMenuItem>
                        <NavigationMenuLink
                            href="/venues"
                        // className={`${(pathName === "/venues" || (pathName.startsWith("/venues") && pathName !== "/")) ? "backdrop-blur-sm bg-green-700/10" : ""}`}
                        >
                            <div className="flex gap-2 items-center">
                                <Image
                                    src="/assets/icons/book.png"
                                    alt="book"
                                    width={30}
                                    height={20}
                                /><span className="text-xl"> Book </span>
                            </div>
                        </NavigationMenuLink>
                    </NavigationMenuItem>

                </NavigationMenuList>
            </NavigationMenu>


            <div>
                {!session ? (
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
                            <ProfileMenu session={session} />
                        </div>
                    </>
                )}
            </div>

        </>
    )
}
