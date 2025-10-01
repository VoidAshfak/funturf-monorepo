"use client"

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "./ui/button";
import { DropdownMenuShortcut } from "./ui/dropdown-menu";

export default function LogoutButton() {
    return (
        <Button
            variant="ghost"
            onClick={() => signOut()}
        >
            <LogOut className="text-red-400" />
            <span className="text-red-400" >Log out</span>
            <DropdownMenuShortcut className="text-red-400">⇧⌘Q</DropdownMenuShortcut>
        </Button>
    )
}