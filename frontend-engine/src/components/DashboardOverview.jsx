"use client";

import Link from "next/link";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    ArrowUpRight,
    BadgeCheck,
    CalendarClock,
    CircleDollarSign,
    Loader2,
    Star,
    TicketCheck,
    TrendingUp,
    Users,
} from "lucide-react";
import { slotRangeLabel } from "@/utils/slots";
import { bookingRef } from "@/utils/ticket";
import { selectToken } from "@/store/slices/authSlice";
import { useGetDashboardStatsQuery } from "@/store/api/apiSlice";

// Booking status -> reserved status color (matches the badges elsewhere in the
// app). Always shown WITH a label in the legend, so colour is never the only cue.
const STATUS_COLORS = {
    confirmed: "#1DB954",
    completed: "#3b82f6",
    pending: "#f59e0b",
    cancelled: "#ef4444",
    no_show: "#6b7280",
};

const money = (n) => `BDT ${Number(n ?? 0).toLocaleString()}`;
const compact = (n) => {
    const v = Number(n ?? 0);
    if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
    return String(v);
};

export default function DashboardOverview() {
    // The bearer token is bridged from the NextAuth session into the store by
    // AuthSync AFTER first paint. Firing before it lands sends an unauthenticated
    // request -> 401 -> "couldn't load" on the very first render. Wait for it.
    const token = useSelector(selectToken);
    const { data, isLoading, isError } = useGetDashboardStatsQuery(undefined, {
        skip: !token,
    });

    if (isLoading || !token) {
        return (
            <div className="grid min-h-[50vh] place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }
    if (isError || !data) {
        return (
            <div className="glass-card rounded-2xl p-10 text-center text-muted-foreground">
                Couldn&apos;t load your dashboard. Try again.
            </div>
        );
    }

    const k = data.kpis;
    const series = data.series ?? [];
    const statusData = (data.status_breakdown ?? []).filter((s) => s.count > 0);
    const topGrounds = data.top_grounds ?? [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                        Overview
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Your turfs at a glance · {format(new Date(), "EEE, d MMM yyyy")}
                    </p>
                </div>
                {k.pending_verifications > 0 && (
                    <Link
                        href="/dashboard/bookings?status=pending"
                        className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-600 dark:text-amber-400"
                    >
                        <BadgeCheck className="h-4 w-4" />
                        {k.pending_verifications} payment{k.pending_verifications === 1 ? "" : "s"} to verify
                    </Link>
                )}
            </div>

            {/* KPI tiles */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <StatTile
                    icon={CircleDollarSign}
                    label="Revenue this month"
                    value={money(k.revenue_month)}
                    sub={`${money(k.revenue_all)} all time`}
                    accent
                />
                <StatTile
                    icon={TrendingUp}
                    label="Bookings this month"
                    value={k.bookings_month}
                    sub={`${k.bookings_total} all time`}
                />
                <StatTile icon={CalendarClock} label="Upcoming" value={k.upcoming} sub="pending + confirmed" />
                <StatTile
                    icon={TicketCheck}
                    label="To verify"
                    value={k.pending_verifications}
                    sub="paid, awaiting you"
                    warn={k.pending_verifications > 0}
                />
                <StatTile icon={Users} label="Players" value={k.unique_players} sub={`${k.grounds} grounds`} />
                <StatTile
                    icon={Star}
                    label="Avg rating"
                    value={k.avg_rating ?? "—"}
                    sub={k.rating_count ? `${k.rating_count} reviews` : "no reviews yet"}
                />
            </div>

            {/* Occupancy strip */}
            <div className="glass-card rounded-2xl p-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">Occupancy (last 30 days)</span>
                    <span className="font-bold text-primary">{k.occupancy_pct}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-brand to-teal"
                        style={{ width: `${Math.min(k.occupancy_pct, 100)}%` }}
                    />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                    Booked slots vs capacity across {k.grounds} ground{k.grounds === 1 ? "" : "s"}.
                </p>
            </div>

            {/* Charts */}
            <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Bookings" subtitle="Last 30 days">
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                            <defs>
                                <linearGradient id="fillBookings" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#1DB954" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="#1DB954" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tickFormatter={xTick} {...axisProps} minTickGap={28} />
                            <YAxis allowDecimals={false} width={28} {...axisProps} />
                            <Tooltip content={<ChartTip kind="bookings" />} cursor={{ stroke: "var(--border)" }} />
                            <Area
                                type="monotone"
                                dataKey="bookings"
                                stroke="#1DB954"
                                strokeWidth={2}
                                fill="url(#fillBookings)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Revenue" subtitle="Realized, last 30 days">
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={series} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
                            <defs>
                                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#1DB954" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="#1DB954" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tickFormatter={xTick} {...axisProps} minTickGap={28} />
                            <YAxis width={40} tickFormatter={compact} {...axisProps} />
                            <Tooltip content={<ChartTip kind="revenue" />} cursor={{ stroke: "var(--border)" }} />
                            <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="#1DB954"
                                strokeWidth={2}
                                fill="url(#fillRevenue)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Booking status" subtitle="All bookings">
                    {statusData.length === 0 ? (
                        <EmptyChart />
                    ) : (
                        <div className="flex items-center gap-4">
                            <ResponsiveContainer width="55%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        dataKey="count"
                                        nameKey="status"
                                        innerRadius={52}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        stroke="var(--card)"
                                        strokeWidth={2}
                                    >
                                        {statusData.map((s) => (
                                            <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? "#6b7280"} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<StatusTip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Legend — label + count, so identity isn't colour-only. */}
                            <ul className="flex-1 space-y-2">
                                {statusData.map((s) => (
                                    <li key={s.status} className="flex items-center gap-2 text-sm">
                                        <span
                                            className="h-3 w-3 shrink-0 rounded-sm"
                                            style={{ background: STATUS_COLORS[s.status] ?? "#6b7280" }}
                                        />
                                        <span className="capitalize text-foreground">{s.status}</span>
                                        <span className="ml-auto font-bold text-muted-foreground">{s.count}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </ChartCard>

                <ChartCard title="Top grounds" subtitle="By realized revenue">
                    {topGrounds.length === 0 ? (
                        <EmptyChart />
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart
                                data={topGrounds}
                                layout="vertical"
                                margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
                            >
                                <XAxis type="number" tickFormatter={compact} {...axisProps} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={92}
                                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<GroundTip />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
                                <Bar dataKey="revenue" fill="#1DB954" radius={[0, 4, 4, 0]} barSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

            {/* Action lists */}
            <div className="grid gap-4 lg:grid-cols-3">
                <BookingList
                    title="Verify payments"
                    href="/dashboard/bookings?status=pending"
                    rows={data.pending_verifications_list}
                    empty="No payments waiting."
                    variant="warn"
                />
                <BookingList
                    title="Upcoming"
                    href="/dashboard/bookings"
                    rows={data.upcoming_bookings}
                    empty="Nothing booked ahead."
                />
                <BookingList
                    title="Recent activity"
                    href="/dashboard/bookings"
                    rows={data.recent_bookings}
                    empty="No bookings yet."
                />
            </div>
        </div>
    );
}

// --- Axis / formatting -----------------------------------------------------

const axisProps = {
    tick: { fill: "var(--muted-foreground)", fontSize: 11 },
    tickLine: false,
    axisLine: false,
};
const xTick = (v) => {
    try {
        return format(new Date(v), "d/M");
    } catch {
        return v;
    }
};

// --- Small pieces ----------------------------------------------------------

function StatTile({ icon: Icon, label, value, sub, accent, warn }) {
    return (
        <div
            className={
                "glass-card rounded-2xl p-4 " +
                (warn ? "border-amber-500/40" : accent ? "border-primary/40" : "")
            }
        >
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                </span>
                <Icon className={"h-4 w-4 " + (warn ? "text-amber-500" : "text-primary")} />
            </div>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
    );
}

function ChartCard({ title, subtitle, children }) {
    return (
        <div className="glass-card rounded-2xl p-5">
            <div className="mb-4">
                <h3 className="font-bold text-foreground">{title}</h3>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            {children}
        </div>
    );
}

function EmptyChart() {
    return (
        <div className="grid h-[200px] place-items-center text-sm text-muted-foreground">
            No data yet.
        </div>
    );
}

// Shared tooltip shell (glass, tokens — never the series colour for text).
function TipShell({ label, children }) {
    return (
        <div className="glass-card rounded-xl border border-border px-3 py-2 text-xs shadow-lg">
            {label && <p className="mb-0.5 font-semibold text-foreground">{label}</p>}
            {children}
        </div>
    );
}
function ChartTip({ active, payload, label, kind }) {
    if (!active || !payload?.length) return null;
    const v = payload[0].value;
    return (
        <TipShell label={format(new Date(label), "EEE, d MMM")}>
            <p className="text-muted-foreground">
                {kind === "revenue" ? money(v) : `${v} booking${v === 1 ? "" : "s"}`}
            </p>
        </TipShell>
    );
}
function StatusTip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
        <TipShell>
            <p className="capitalize text-foreground">
                {p.status}: <span className="font-bold">{p.count}</span>
            </p>
        </TipShell>
    );
}
function GroundTip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
        <TipShell label={p.name}>
            <p className="text-muted-foreground">
                {money(p.revenue)} · {p.bookings} booking{p.bookings === 1 ? "" : "s"}
            </p>
        </TipShell>
    );
}

function BookingList({ title, href, rows = [], empty, variant }) {
    return (
        <div className="glass-card rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-foreground">{title}</h3>
                <Link href={href} className="text-xs font-semibold text-primary hover:underline">
                    View all
                </Link>
            </div>
            {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
            ) : (
                <ul className="space-y-2.5">
                    {rows.map((b) => {
                        const owner = b.users_bookings_user_idTousers;
                        const name =
                            [owner?.first_name, owner?.last_name].filter(Boolean).join(" ") || "Player";
                        return (
                            <li key={b.id}>
                                <Link
                                    href={`/dashboard/bookings/verify/${b.id}`}
                                    className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-foreground/5"
                                >
                                    <span
                                        className={
                                            "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold " +
                                            (variant === "warn"
                                                ? "bg-amber-500/15 text-amber-500"
                                                : "bg-primary/10 text-primary")
                                        }
                                    >
                                        {name.slice(0, 2).toUpperCase()}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {b.grounds?.name}
                                            {b.slot?.code ? ` · ${slotRangeLabel(b.slot.code)}` : ""}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-[11px] text-muted-foreground">
                                            {bookingRef(b.id)}
                                        </p>
                                        <p className="text-xs font-semibold text-foreground">
                                            {b.booking_date ? format(new Date(b.booking_date), "d MMM") : ""}
                                        </p>
                                    </div>
                                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
