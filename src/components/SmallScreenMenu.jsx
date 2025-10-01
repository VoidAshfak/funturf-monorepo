import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { Menu } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default function SmallScreenMenu({ session }) {
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
                        <Link href="/">Home</Link>
                    </DrawerClose>
                    <DrawerClose
                        asChild
                        className="px-5 py-2 hover:bg-white"
                    >
                        <Link href="/events">Play</Link>
                    </DrawerClose>
                    <DrawerClose
                        asChild
                        className="px-5 py-2 hover:bg-white"
                    >
                        <Link href="/venues">Book</Link>
                    </DrawerClose>

                </div>

                <DrawerFooter>
                    {session ? (
                        <>
                            <DrawerClose
                                asChild
                                className="px-5 py-2 hover:bg-white"
                            >
                                <Link href="#">Profile</Link>
                            </DrawerClose>
                            <DrawerClose
                                asChild
                                className="px-5 py-2 hover:bg-white"
                            >
                                <Link href="#">Settings</Link>
                            </DrawerClose>
                            <DrawerClose
                                asChild
                                className="px-5 py-2 hover:bg-white"
                            >
                                <Link href="#">Team</Link>
                            </DrawerClose>
                            <DrawerClose
                                asChild
                                className="px-5 py-2 hover:bg-white"
                            >
                                {/* <Link href="#">Team</Link> */}
                               <LogoutButton/>
                            </DrawerClose>
                        </>
                    )
                        : (
                            <>
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
                            </>
                        )
                    }

                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}

















// import {
//     Drawer,
//     DrawerClose,
//     DrawerContent,
//     DrawerDescription,
//     DrawerFooter,
//     DrawerHeader,
//     DrawerTitle,
//     DrawerTrigger,
// } from "@/components/ui/drawer";
// import { Menu } from "lucide-react";
// import { Button } from "./ui/button";
// import { Label } from "./ui/label";
// import Link from "next/link";

// export default function SmallScreenMenu() {
//     return (
//         <Drawer direction="left">
//             <DrawerTrigger>
//                 <Menu className="text-7xl" />
//             </DrawerTrigger>

//             <DrawerContent className="backdrop-blur-lg bg-green-200/30" width="1/2">
//                 <DrawerHeader>
//                     <DrawerTitle>Menu</DrawerTitle>
//                     {/* <DrawerDescription>{address}</DrawerDescription> */}
//                 </DrawerHeader>

//                 {/* <div>
//                     <div className="px-5 py-2 hover:bg-white">
//                         <Link href="/">Home</Link>
//                     </div>
//                     <div className="px-5 py-2 hover:bg-white">
//                         <Link href="/events">Play</Link>
//                     </div>
//                     <div className="px-5 py-2 hover:bg-white">
//                         <Link href="/venues">Book</Link>
//                     </div>
//                 </div> */}





//                 <DrawerFooter>
//                     <Button>Login</Button>
//                     <Button>Register</Button>
//                     {/* <DrawerClose asChild>
//                         <Button variant="outline">Cancel</Button>
//                     </DrawerClose> */}
//                 </DrawerFooter>
//             </DrawerContent>
//         </Drawer>
//     )
// }