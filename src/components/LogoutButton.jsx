"use client"

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "./ui/button";

export default function LogoutButton() {
    return (
        <Button
            variant="ghost"
            onClick={() => signOut()}
            className="justify-start"
        >
            <LogOut className="text-red-400" />
            <span className="text-red-400" >Log out</span>
        </Button>
    )
}