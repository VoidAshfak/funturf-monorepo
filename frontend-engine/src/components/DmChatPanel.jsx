"use client";

import EmojiPicker from "@/components/EmojiPicker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
    useGetDmThreadQuery,
    useMarkDmReadMutation,
    useReactDmMutation,
    useSendDmMutation,
} from "@/store/api/apiSlice";
import { getApiErrorMessage } from "@/utils/apiError";
import { uploadSingleImageObj } from "@/utils/image-upload";
import { format } from "date-fns";
import { ChevronLeft, Loader2, Paperclip, Reply, Send, Smile, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

const fullName = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "Player";
const initials = (u) => fullName(u).slice(0, 2).toUpperCase();

// One DM bubble — supports replies + emoji reactions (text/image; no edits).
function DmMessage({ m, me, onReply, onReact }) {
    const mine = (m.sender?.id ?? m.sender_id) === me;

    return (
        <div className={cn("group flex items-end gap-2", mine && "flex-row-reverse")}>
            {!mine && (
                <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={m.sender?.profile_picture_url || undefined} alt={fullName(m.sender)} />
                    <AvatarFallback className="text-[10px]">{initials(m.sender)}</AvatarFallback>
                </Avatar>
            )}
            <div className={cn("relative max-w-[78%]", mine && "text-right")}>
                {/* hover toolbar: react + reply */}
                {!m.is_deleted && (
                    <div
                        className={cn(
                            "absolute -top-3 z-10 flex items-center gap-0.5 rounded-full border border-border bg-card px-1 py-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100",
                            mine ? "right-0" : "left-0"
                        )}
                    >
                        <EmojiPicker
                            onSelect={(emoji) => onReact(m.id, emoji)}
                            trigger={
                                <button type="button" className="rounded-full p-1 hover:bg-accent" title="React">
                                    <Smile className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                            }
                        />
                        <button
                            type="button"
                            onClick={() => onReply(m)}
                            className="rounded-full p-1 hover:bg-accent"
                            title="Reply"
                        >
                            <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                    </div>
                )}

                <div
                    className={cn(
                        "inline-block rounded-2xl px-3 py-2 text-left text-sm",
                        m.is_deleted
                            ? "bg-muted/60 italic text-muted-foreground"
                            : mine
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                    )}
                >
                    {m.is_deleted ? (
                        "This message was deleted"
                    ) : (
                        <>
                            {m.reply_to && (
                                <div
                                    className={cn(
                                        "mb-1 rounded-lg border-l-2 px-2 py-1 text-xs",
                                        mine
                                            ? "border-primary-foreground/50 bg-black/10"
                                            : "border-primary/50 bg-background/60"
                                    )}
                                >
                                    <span className="font-semibold">{m.reply_to.sender_name}</span>
                                    <p className="truncate opacity-80">{m.reply_to.content}</p>
                                </div>
                            )}
                            {m.attachment_url && (
                                <a href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={m.attachment_url}
                                        alt="attachment"
                                        className="mb-1 max-h-48 rounded-lg object-cover"
                                    />
                                </a>
                            )}
                            {m.content}
                        </>
                    )}
                </div>

                {/* reactions */}
                {!m.is_deleted && m.reactions?.length > 0 && (
                    <div className={cn("mt-1 flex flex-wrap gap-1", mine && "justify-end")}>
                        {m.reactions.map((r) => {
                            const mineReacted = r.user_ids?.includes(me);
                            return (
                                <button
                                    key={r.emoji}
                                    type="button"
                                    onClick={() => onReact(m.id, r.emoji)}
                                    className={cn(
                                        "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                                        mineReacted
                                            ? "border-primary/40 bg-primary/15 text-primary"
                                            : "border-border bg-muted/50 text-muted-foreground hover:bg-accent"
                                    )}
                                >
                                    <span>{r.emoji}</span>
                                    <span className="font-semibold">{r.count}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                <p className={cn("mt-0.5 px-1 text-[10px] text-muted-foreground", mine && "text-right")}>
                    {m.created_at ? format(new Date(m.created_at), "p") : ""}
                </p>
            </div>
        </div>
    );
}

/**
 * Embeddable 1:1 DM thread — used INSIDE the navbar chat box. Live via socket
 * (`dm:new`). Marks the thread read on open and whenever new messages arrive.
 * `initialTitle` seeds the header before the thread loads (from the conv list).
 */
export default function DmChatPanel({ userId, initialTitle, initialAvatar, onBack }) {
    const { data: session } = useSession();
    const me = session?.user?.id;

    const { data, isLoading } = useGetDmThreadQuery(userId, { skip: !userId });
    const other = data?.user;
    const messages = data?.messages ?? [];

    const [send, { isLoading: sending }] = useSendDmMutation();
    const [react] = useReactDmMutation();
    const [markRead] = useMarkDmReadMutation();

    const [text, setText] = useState("");
    const [replyTo, setReplyTo] = useState(null); // message being replied to
    const [attachment, setAttachment] = useState({ url: null });
    const [uploading, setUploading] = useState(false);
    const listRef = useRef(null);
    const inputRef = useRef(null);
    const fileRef = useRef(null);

    const startReply = (m) => {
        setReplyTo(m);
        inputRef.current?.focus();
    };
    const toggleReaction = async (messageId, emoji) => {
        try {
            await react({ userId, messageId, emoji }).unwrap();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't react."));
        }
    };

    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
    };
    // Pin to newest + clear unread as messages load/arrive.
    useEffect(() => {
        scrollToBottom();
        if (userId) markRead(userId);
    }, [messages.length, userId, markRead]);

    const pickImage = async (file) => {
        if (!file) return;
        setUploading(true);
        try {
            const url = await uploadSingleImageObj({ file });
            if (url) setAttachment({ url });
            else notifyError("Upload failed.");
        } catch {
            notifyError("Upload failed.");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        const content = text.trim();
        if (!content && !attachment.url) return;
        const staged = { text: content, attachment, replyTo };
        setText("");
        setAttachment({ url: null });
        setReplyTo(null);
        try {
            await send({
                userId,
                content,
                attachment_url: attachment.url || undefined,
                reply_to_id: staged.replyTo?.id || undefined,
            }).unwrap();
            scrollToBottom();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't send the message."));
            setText(staged.text);
            setAttachment(staged.attachment);
            setReplyTo(staged.replyTo);
        }
    };

    const headerName = other ? fullName(other) : initialTitle || "Chat";
    const headerAvatar = other?.profile_picture_url || initialAvatar || undefined;

    return (
        <div className="flex h-full w-full flex-col">
            {/* header */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <button
                    type="button"
                    onClick={onBack}
                    className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Back to conversations"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <Avatar className="h-8 w-8">
                    <AvatarImage src={headerAvatar} alt={headerName} />
                    <AvatarFallback className="text-[11px]">{initials(other || { first_name: headerName })}</AvatarFallback>
                </Avatar>
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{headerName}</p>
            </div>

            {/* messages */}
            <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4">
                {isLoading ? (
                    <div className="mt-8 flex justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : messages.length === 0 ? (
                    <p className="mt-8 text-center text-sm text-muted-foreground">
                        No messages yet. Say hi 👋
                    </p>
                ) : (
                    messages.map((m) => (
                        <DmMessage
                            key={m.id}
                            m={m}
                            me={me}
                            onReply={startReply}
                            onReact={toggleReaction}
                        />
                    ))
                )}
            </div>

            {/* reply context strip */}
            {replyTo && (
                <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-3 py-1.5 text-xs">
                    <div className="min-w-0 flex-1">
                        <span className="font-semibold text-primary">
                            Replying to {replyTo.sender ? fullName(replyTo.sender) : "message"}
                        </span>
                        <p className="truncate text-muted-foreground">
                            {replyTo.content || (replyTo.attachment_url ? "Photo" : "")}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        className="rounded-full p-1 text-muted-foreground hover:bg-accent"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* staged attachment preview */}
            {attachment.url && (
                <div className="flex items-center gap-2 border-t border-border px-3 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={attachment.url} alt="to send" className="h-12 w-12 rounded-lg object-cover" />
                    <span className="flex-1 text-xs text-muted-foreground">Photo ready to send</span>
                    <button
                        type="button"
                        onClick={() => setAttachment({ url: null })}
                        className="rounded-full p-1 text-muted-foreground hover:bg-accent"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* composer */}
            <form onSubmit={onSubmit} className="flex items-center gap-1.5 border-t border-border p-2.5">
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => pickImage(e.target.files?.[0])}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    title="Attach a photo"
                >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
                <EmojiPicker
                    align="start"
                    onSelect={(emoji) => setText((t) => t + emoji)}
                    trigger={
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                            title="Emoji"
                        >
                            <Smile className="h-4 w-4" />
                        </Button>
                    }
                />
                <Input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type a message…"
                    maxLength={2000}
                    className="flex-1"
                />
                <Button
                    type="submit"
                    size="icon"
                    disabled={sending || uploading || (!text.trim() && !attachment.url)}
                    className="green-glow h-9 w-9 shrink-0"
                >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
            </form>
        </div>
    );
}
