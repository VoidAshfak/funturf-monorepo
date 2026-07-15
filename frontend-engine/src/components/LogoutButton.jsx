"use client"

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { disconnectSocket } from "@/lib/socket";
import { Button } from "./ui/button";

export default function LogoutButton() {
    return (
        <Button
            variant="ghost"
            onClick={() => {
                // Close the notification socket before the token is gone,
                // otherwise a dead authenticated connection lingers.
                disconnectSocket();
                signOut({ callbackUrl: "/" });
            }}
            className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
            <LogOut className="h-4 w-4" />
            <span>Log out</span>
        </Button>
    )
}