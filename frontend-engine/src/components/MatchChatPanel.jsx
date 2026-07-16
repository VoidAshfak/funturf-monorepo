"use client";

import EmojiPicker from "@/components/EmojiPicker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
    useDeleteEventMessageMutation,
    useEditEventMessageMutation,
    useGetEventByIdQuery,
    useGetEventMessagesQuery,
    useMarkEventChatReadMutation,
    useReactEventMessageMutation,
    useSendEventMessageMutation,
} from "@/store/api/apiSlice";
import { getApiErrorMessage } from "@/utils/apiError";
import { uploadSingleImageObj } from "@/utils/image-upload";
import { format } from "date-fns";
import {
    ChevronLeft,
    Loader2,
    Paperclip,
    Pencil,
    Reply,
    Send,
    Smile,
    Trash2,
    Users,
    X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

const fullName = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "Player";
const initials = (u) => fullName(u).slice(0, 2).toUpperCase();

// ---- one message bubble + its hover actions + reactions ----
function ChatMessage({ m, me, isAdmin, onReply, onEdit, onDelete, onReact }) {
    const mine = (m.sender?.id ?? m.sender_id) === me;
    const canEdit = mine && !m.is_deleted && Boolean(m.content);
    const canDelete = (mine || isAdmin) && !m.is_deleted;

    return (
        <div className={cn("group flex items-end gap-2", mine && "flex-row-reverse")}>
            {!mine && (
                <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={m.sender?.profile_picture_url || undefined} alt={fullName(m.sender)} />
                    <AvatarFallback className="text-[10px]">{initials(m.sender)}</AvatarFallback>
                </Avatar>
            )}

            <div className={cn("relative max-w-[78%]", mine && "text-right")}>
                {!mine && (
                    <p className="mb-0.5 px-1 text-[11px] font-medium text-muted-foreground">
                        {fullName(m.sender)}
                    </p>
                )}

                {/* hover action toolbar */}
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
                        {canEdit && (
                            <button
                                type="button"
                                onClick={() => onEdit(m)}
                                className="rounded-full p-1 hover:bg-accent"
                                title="Edit"
                            >
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                        )}
                        {canDelete && (
                            <button
                                type="button"
                                onClick={() => onDelete(m)}
                                className="rounded-full p-1 hover:bg-accent"
                                title="Delete"
                            >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                        )}
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
                    {m.is_edited && !m.is_deleted ? " · edited" : ""}
                </p>
            </div>
        </div>
    );
}

/**
 * Embeddable squad (match) chat panel — used INSIDE the navbar chat box (no
 * floating shell of its own). Members only (approved players + organizer /
 * co-organizers). Live via socket; supports text, images, emoji, replies, edits,
 * deletes and reactions. Fills its parent container.
 */
export default function MatchChatPanel({ eventId, onBack }) {
    const { data: session } = useSession();
    const me = session?.user?.id;

    const { data: event = {}, isLoading: eventLoading } = useGetEventByIdQuery(eventId, {
        skip: !eventId,
    });
    const isOrganizer = Boolean(me && event.organizer?.id === me);
    const myPart = (event.participants || []).find((p) => (p.user_id ?? p.users?.id) === me);
    const isMember = Boolean(isOrganizer || myPart?.status === "approved");
    const isAdmin =
        isOrganizer || (myPart?.role === "co_organizer" && myPart?.status === "approved");

    const [text, setText] = useState("");
    const [replyTo, setReplyTo] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [attachment, setAttachment] = useState({ url: null });
    const [uploading, setUploading] = useState(false);

    const listRef = useRef(null);
    const fileRef = useRef(null);
    const inputRef = useRef(null);

    const { data: messages = [] } = useGetEventMessagesQuery(eventId, {
        skip: !eventId || !isMember,
    });
    const [send, { isLoading: sending }] = useSendEventMessageMutation();
    const [edit] = useEditEventMessageMutation();
    const [del] = useDeleteEventMessageMutation();
    const [react] = useReactEventMessageMutation();
    const [markRead] = useMarkEventChatReadMutation();

    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
    };
    // Keep pinned to the newest message, and clear this chat's unread badge, as
    // history loads / new ones arrive (only while the caller is actually a member).
    useEffect(() => {
        scrollToBottom();
        if (eventId && isMember) markRead(eventId);
    }, [messages.length, eventId, isMember, markRead]);

    const clearComposerContext = () => {
        setReplyTo(null);
        setEditingId(null);
        setText("");
        setAttachment({ url: null });
    };
    const startReply = (m) => {
        setEditingId(null);
        setReplyTo(m);
        inputRef.current?.focus();
    };
    const startEdit = (m) => {
        setReplyTo(null);
        setAttachment({ url: null });
        setEditingId(m.id);
        setText(m.content || "");
        inputRef.current?.focus();
    };
    const doDelete = async (m) => {
        if (typeof window !== "undefined" && !window.confirm("Delete this message?")) return;
        try {
            await del({ eventId, messageId: m.id }).unwrap();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't delete the message."));
        }
    };
    const toggleReaction = async (messageId, emoji) => {
        try {
            await react({ eventId, messageId, emoji }).unwrap();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't react."));
        }
    };

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

        if (editingId) {
            if (!content) return;
            const id = editingId;
            setEditingId(null);
            setText("");
            try {
                await edit({ eventId, messageId: id, content }).unwrap();
            } catch (err) {
                notifyError(getApiErrorMessage(err, "Couldn't edit the message."));
                setEditingId(id);
                setText(content);
            }
            return;
        }

        if (!content && !attachment.url) return;
        const body = {
            eventId,
            content,
            attachment_url: attachment.url || undefined,
            reply_to_id: replyTo?.id || undefined,
        };
        const staged = { text: content, replyTo, attachment };
        setText("");
        setReplyTo(null);
        setAttachment({ url: null });
        try {
            await send(body).unwrap();
            scrollToBottom();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't send the message."));
            setText(staged.text);
            setReplyTo(staged.replyTo);
            setAttachment(staged.attachment);
        }
    };

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
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary">
                    <Users className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">Squad chat</p>
                    <p className="truncate text-xs text-muted-foreground">{event.title || "Match"}</p>
                </div>
            </div>

            {eventLoading ? (
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            ) : !isMember ? (
                <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    Only players in this match can use its chat.
                </div>
            ) : (
                <>
                    {/* messages */}
                    <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4">
                        {messages.length === 0 ? (
                            <p className="mt-8 text-center text-sm text-muted-foreground">
                                No messages yet. Say hi to your squad!
                            </p>
                        ) : (
                            messages.map((m) => (
                                <ChatMessage
                                    key={m.id}
                                    m={m}
                                    me={me}
                                    isAdmin={isAdmin}
                                    onReply={startReply}
                                    onEdit={startEdit}
                                    onDelete={doDelete}
                                    onReact={toggleReaction}
                                />
                            ))
                        )}
                    </div>

                    {/* reply / edit context strip */}
                    {(replyTo || editingId) && (
                        <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-3 py-1.5 text-xs">
                            <div className="min-w-0 flex-1">
                                <span className="font-semibold text-primary">
                                    {editingId
                                        ? "Editing message"
                                        : `Replying to ${replyTo?.sender ? fullName(replyTo.sender) : "message"}`}
                                </span>
                                {!editingId && replyTo && (
                                    <p className="truncate text-muted-foreground">
                                        {replyTo.content || (replyTo.attachment_url ? "Photo" : "")}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={clearComposerContext}
                                className="rounded-full p-1 text-muted-foreground hover:bg-accent"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}

                    {/* staged attachment preview */}
                    {attachment.url && !editingId && (
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
                        {!editingId && (
                            <>
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
                            </>
                        )}

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
                            placeholder={editingId ? "Edit your message…" : "Message your squad…"}
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
                </>
            )}
        </div>
    );
}
