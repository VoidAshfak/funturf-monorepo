"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import { useGSAP } from "@gsap/react";
import {
    Bell,
    BellOff,
    Calendar,
    CalendarX,
    CheckCheck,
    CreditCard,
    MessageSquare,
    Star,
    UserCheck,
    UserPlus,
    Megaphone,
} from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    useGetNotificationsQuery,
    useMarkAllNotificationsReadMutation,
    useMarkNotificationReadMutation,
} from "@/store/api/apiSlice";
import { gsap } from "@/lib/animations";
import { cn } from "@/lib/utils";

// Map each notification_type to an icon (keeps the box scannable at a glance).
// Unmapped types fall back to the bell.
const TYPE_ICON = {
    booking_confirmed: Calendar,
    booking_cancelled: CalendarX,
    booking_reminder: Calendar,
    event_invitation: Calendar,
    event_join_request: UserPlus,
    event_cancelled: CalendarX,
    event_reminder: Calendar,
    event_full: Calendar,
    event_completed: CheckCheck,
    payment_received: CreditCard,
    payment_pending: CreditCard,
    connection_request: UserPlus,
    connection_accepted: UserCheck,
    message_received: MessageSquare,
    rating_received: Star,
    system_announcement: Megaphone,
    comment_added: MessageSquare,
    comment_reply: MessageSquare,
};

export default function NotificationBell() {
    const { data: session } = useSession();
    const router = useRouter();
    const [open, setOpen] = useState(false);

    // Only fetch/stream when logged in.
    const { data, isLoading } = useGetNotificationsQuery(undefined, { skip: !session });
    const [markRead] = useMarkNotificationReadMutation();
    const [markAllRead] = useMarkAllNotificationsReadMutation();

    const notifications = data?.notifications ?? [];
    const unreadCount = data?.unreadCount ?? 0;

    // Stagger the list in each time the box opens.
    const listRef = useRef(null);
    useGSAP(
        () => {
            if (!open) return;
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            const items = gsap.utils.toArray(".notif-item");
            if (!items.length) return;
            if (reduce) {
                gsap.set(items, { opacity: 1, x: 0 });
                return;
            }
            gsap.fromTo(
                items,
                { opacity: 0, x: 12 },
                { opacity: 1, x: 0, duration: 0.35, ease: "power3.out", stagger: 0.04 }
            );
        },
        { dependencies: [open, notifications.length], scope: listRef }
    );

    if (!session) return null;

    const handleItemClick = (n) => {
        if (!n.is_read) markRead(n.id);
        setOpen(false);
        if (n.action_url) router.push(n.action_url);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                    className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card/60 text-foreground transition-all duration-300 hover:border-primary/40 hover:text-primary data-[state=open]:border-primary data-[state=open]:text-primary"
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 animate-in zoom-in place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-[0_0_10px_rgba(29,185,84,0.6)]">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </button>
            </PopoverTrigger>

            <PopoverContent
                align="end"
                sideOffset={12}
                className="w-[min(92vw,380px)] rounded-2xl border-border p-0"
            >
                {/* header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">Notifications</h3>
                        {unreadCount > 0 && (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={() => markAllRead()}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-brand-dark"
                        >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Mark all read
                        </button>
                    )}
                </div>

                {/* list */}
                <div ref={listRef} className="max-h-[min(70vh,420px)] overflow-y-auto">
                    {isLoading ? (
                        <div className="space-y-2 p-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="h-16 animate-pulse rounded-xl bg-muted/60"
                                />
                            ))}
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                            <BellOff className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm font-semibold text-foreground">All caught up</p>
                            <p className="text-xs text-muted-foreground">
                                You have no notifications yet.
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-border">
                            {notifications.map((n) => {
                                const Icon = TYPE_ICON[n.type] ?? Bell;
                                return (
                                    <li key={n.id}>
                                        <button
                                            onClick={() => handleItemClick(n)}
                                            className={cn(
                                                "notif-item flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                                                !n.is_read && "bg-primary/[0.06]"
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full",
                                                    n.is_read
                                                        ? "bg-muted text-muted-foreground"
                                                        : "bg-primary/15 text-primary"
                                                )}
                                            >
                                                <Icon className="h-4.5 w-4.5" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-2">
                                                    <span className="line-clamp-1 text-sm font-semibold text-foreground">
                                                        {n.title}
                                                    </span>
                                                    {!n.is_read && (
                                                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                                                    )}
                                                </span>
                                                <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                                                    {n.message}
                                                </span>
                                                {n.created_at && (
                                                    <span className="mt-1 block text-[11px] font-medium text-muted-foreground/80">
                                                        {formatDistanceToNow(new Date(n.created_at), {
                                                            addSuffix: true,
                                                        })}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
