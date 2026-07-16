"use client";

import { MessageCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "./ui/button";
import { openDm } from "@/lib/chat-bus";

// "Message" action on a player's profile. Opens a DM thread in the navbar chat
// box. Hidden when you're viewing your OWN profile — a player can't message
// themselves (the backend also rejects it with SELF_MESSAGE_FORBIDDEN).
export default function MessageButton({ userId, name, avatar }) {
    const { data: session } = useSession();
    const me = session?.user?.id;

    // No self-DM, and no messaging while signed out.
    if (!me || me === userId) return null;

    return (
        <Button
            variant="outline"
            className="rounded-full"
            onClick={() => openDm({ userId, title: name, avatar })}
        >
            <MessageCircle className="h-4 w-4" />
            Message
        </Button>
    );
}
