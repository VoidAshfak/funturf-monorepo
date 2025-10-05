import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger
} from "@/components/ui/drawer";
import { Menu } from "lucide-react";
import NavLinksForSmallScreen from "./NavLinksForSmallScreen";

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

                <NavLinksForSmallScreen session={session} />

            </DrawerContent>
        </Drawer>
    );
}