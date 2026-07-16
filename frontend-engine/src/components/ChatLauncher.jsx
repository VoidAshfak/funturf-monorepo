"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { onOpenDm } from "@/lib/chat-bus";
import { useGetConversationsQuery } from "@/store/api/apiSlice";
import MatchChatPanel from "./MatchChatPanel";
import DmChatPanel from "./DmChatPanel";

const initials = (name = "") =>
    name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "?";

// One row in the conversation list.
function ConversationRow({ c, onOpen }) {
    const preview = c.last_message
        ? `${c.last_message.from_me ? "You: " : ""}${c.last_message.content || ""}`
        : "No messages yet";
    const when = c.last_message?.created_at
        ? formatDistanceToNow(new Date(c.last_message.created_at), { addSuffix: false })
        : "";

    return (
        <button
            type="button"
            onClick={() => onOpen(c)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60"
        >
            {c.type === "match" ? (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                    <Users className="h-5 w-5" />
                </span>
            ) : (
                <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={c.avatar || undefined} alt={c.title} />
                    <AvatarFallback className="text-xs">{initials(c.title)}</AvatarFallback>
                </Avatar>
            )}

            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                        {c.title}
                        {c.type === "match" && (
                            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                Match
                            </span>
                        )}
                    </p>
                    {when && <span className="shrink-0 text-[11px] text-muted-foreground">{when}</span>}
                </div>
                <p className="truncate text-xs text-muted-foreground">{preview}</p>
            </div>

            {c.unread > 0 && (
                <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {c.unread > 9 ? "9+" : c.unread}
                </span>
            )}
        </button>
    );
}

// Navbar chat box: a dropdown listing ALL conversations (1:1 DMs + squad/match
// chats). Selecting one opens its thread inside the same panel. Other pages can
// pop a specific DM open via the chat bus (see lib/chat-bus.js) — e.g. a profile
// "Message" button.
export default function ChatLauncher() {
    const { data: session } = useSession();
    const [open, setOpen] = useState(false);
    // The open thread, or null to show the list. { type:'dm'|'match', id, title, avatar }
    const [active, setActive] = useState(null);

    const { data, isLoading } = useGetConversationsQuery(undefined, { skip: !session });
    const conversations = data?.conversations ?? [];
    const totalUnread = data?.total_unread ?? 0;

    // Let other components request a DM (e.g. the profile "Message" button).
    useEffect(() => {
        return onOpenDm(({ userId, title, avatar }) => {
            setActive({ type: "dm", id: userId, title, avatar });
            setOpen(true);
        });
    }, []);

    if (!session) return null;

    const openConversation = (c) =>
        setActive({ type: c.type, id: c.id, title: c.title, avatar: c.avatar });
    const back = () => setActive(null);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    aria-label={`Messages${totalUnread ? `, ${totalUnread} unread` : ""}`}
                    className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card/60 text-foreground transition-all duration-300 hover:border-primary/40 hover:text-primary data-[state=open]:border-primary data-[state=open]:text-primary"
                >
                    <MessageSquare className="h-5 w-5" />
                    {totalUnread > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-[0_0_10px_rgba(29,185,84,0.6)]">
                            {totalUnread > 9 ? "9+" : totalUnread}
                        </span>
                    )}
                </button>
            </PopoverTrigger>

            <PopoverContent
                align="end"
                sideOffset={12}
                className="w-[min(92vw,380px)] overflow-hidden rounded-2xl border-border p-0"
            >
                {/* A fixed-height frame so the list and the thread share one size. */}
                <div className="flex h-[30rem] max-h-[70vh] flex-col">
                    {active ? (
                        active.type === "match" ? (
                            <MatchChatPanel eventId={active.id} onBack={back} />
                        ) : (
                            <DmChatPanel
                                userId={active.id}
                                initialTitle={active.title}
                                initialAvatar={active.avatar}
                                onBack={back}
                            />
                        )
                    ) : (
                        <>
                            <div className="border-b border-border px-4 py-3">
                                <h3 className="text-sm font-bold text-foreground">Messages</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {isLoading ? (
                                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                        Loading…
                                    </div>
                                ) : conversations.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                                        <MessageSquare className="h-6 w-6 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground">
                                            No conversations yet. Join a match or message a player to start.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {conversations.map((c) => (
                                            <ConversationRow
                                                key={`${c.type}:${c.id}`}
                                                c={c}
                                                onOpen={openConversation}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
