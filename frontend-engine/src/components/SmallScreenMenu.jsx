import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger
} from "@/components/ui/drawer";
import { Menu } from "lucide-react";
import NavLinksForSmallScreen from "./NavLinksForSmallScreen";
import ThemeToggle from "./ThemeToggle";

export default function SmallScreenMenu({ session }) {
    return (
        <Drawer direction="left">
            <DrawerTrigger>
                <Menu className="text-7xl" />
            </DrawerTrigger>

            <DrawerContent className="glass-neutral text-foreground border-r border-border" width="1/2">
                <DrawerHeader className="flex flex-row items-center justify-between">
                    <DrawerTitle className="text-primary">Menu</DrawerTitle>
                    <ThemeToggle />
                </DrawerHeader>

                <NavLinksForSmallScreen session={session} />

            </DrawerContent>
        </Drawer>
    );
}