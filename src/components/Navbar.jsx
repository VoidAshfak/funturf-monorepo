import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import NavLink from "./NavLink"
import ProfileMenu from "./ProfileMenu"

export default function Navbar({ session }) {

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

            <NavLink />

            <div>
                {!session ? (
                    <>
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
