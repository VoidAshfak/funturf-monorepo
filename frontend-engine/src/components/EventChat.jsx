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
    useReactEventMessageMutation,
    useSendEventMessageMutation,
} from "@/store/api/apiSlice";
import { getApiErrorMessage } from "@/utils/apiError";
import { uploadSingleImageObj } from "@/utils/image-upload";
import { format } from "date-fns";
import {
    Loader2,
    MessageCircle,
    Paperclip,
    Pencil,
    Reply,
    Send,
    Smile,
    Trash2,
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
                            // Anchor to the bubble edge nearest the panel wall so the
                            // toolbar always opens INWARD — never off the panel, even
                            // for a 1-character bubble.
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
                            {/* reply preview */}
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
                            {/* attachment */}
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

                {/* meta */}
                <p className={cn("mt-0.5 px-1 text-[10px] text-muted-foreground", mine && "text-right")}>
                    {m.created_at ? format(new Date(m.created_at), "p") : ""}
                    {m.is_edited && !m.is_deleted ? " · edited" : ""}
                </p>
            </div>
        </div>
    );
}

/**
 * Floating squad group chat for a match. Members only (approved players +
 * organizer/co-organizers). Live via socket. Supports text, image attachments,
 * emoji, replies, edits, deletes, and reactions.
 */
export default function EventChat({ eventId, initialEvent }) {
    const { data: session } = useSession();
    const me = session?.user?.id;

    const { data: liveEvent } = useGetEventByIdQuery(eventId, { skip: !eventId });
    const event = liveEvent ?? initialEvent ?? {};
    const isOrganizer = Boolean(me && event.organizer?.id === me);
    const myPart = (event.participants || []).find((p) => (p.user_id ?? p.users?.id) === me);
    const isMember = Boolean(isOrganizer || myPart?.status === "approved");
    const isAdmin =
        isOrganizer || (myPart?.role === "co_organizer" && myPart?.status === "approved");

    const [open, setOpen] = useState(false);
    const [pop, setPop] = useState(false);
    const [unread, setUnread] = useState(0);
    const [text, setText] = useState("");
    const [replyTo, setReplyTo] = useState(null); // message being replied to
    const [editingId, setEditingId] = useState(null); // message being edited
    const [attachment, setAttachment] = useState({ url: null }); // staged image
    const [uploading, setUploading] = useState(false);

    const seenRef = useRef(0);
    const prevLenRef = useRef(null);
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

    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
    };

    // Unread / pop bookkeeping (first history load is not "unread").
    useEffect(() => {
        const len = messages.length;
        if (prevLenRef.current === null) {
            prevLenRef.current = len;
            seenRef.current = len;
            return;
        }
        if (len > prevLenRef.current) {
            if (open) {
                seenRef.current = len;
                scrollToBottom();
            } else {
                setUnread(len - seenRef.current);
                setPop(true);
            }
        }
        prevLenRef.current = len;
    }, [messages.length, open]);

    useEffect(() => {
        if (!pop) return;
        const t = setTimeout(() => setPop(false), 1500);
        return () => clearTimeout(t);
    }, [pop]);

    const openChat = () => {
        setOpen(true);
        seenRef.current = messages.length;
        setUnread(0);
        scrollToBottom();
    };
    const closeChat = () => {
        setOpen(false);
        seenRef.current = messages.length;
        setUnread(0);
    };

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
        // Deletion is destructive (soft, but hides content for everyone) — confirm.
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

        // Edit mode.
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

        // Send mode — need text or an attachment.
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

    if (!eventId || !isMember) return null;

    return (
        <div className="fixed bottom-5 right-5 z-40 print:hidden">
            {open ? (
                <div className="glass-card flex h-[30rem] w-[23rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl shadow-2xl">
                    {/* header */}
                    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary">
                            <MessageCircle className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-foreground">Squad chat</p>
                            <p className="truncate text-xs text-muted-foreground">{event.title || "Match"}</p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={closeChat}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

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
                                    {editingId ? "Editing message" : `Replying to ${replyTo?.sender ? fullName(replyTo.sender) : "message"}`}
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
                        {/* attachment (hidden in edit mode) */}
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

                        {/* emoji insert */}
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
                </div>
            ) : (
                <button
                    type="button"
                    onClick={openChat}
                    aria-label="Open squad chat"
                    className={cn(
                        "green-glow relative grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform duration-300",
                        pop ? "scale-110 ring-4 ring-primary/40" : "hover:scale-105"
                    )}
                >
                    <MessageCircle className="h-6 w-6" />
                    {unread > 0 && (
                        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-xs font-bold text-white">
                            {unread > 9 ? "9+" : unread}
                        </span>
                    )}
                </button>
            )}
        </div>
    );
}
