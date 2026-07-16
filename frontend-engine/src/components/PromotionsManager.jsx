"use client";

import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    CircleDollarSign,
    Loader2,
    Pencil,
    Plus,
    TicketCheck,
    Trash2,
    Users,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { notifySuccess, notifyError } from "@/lib/notify";
import { getApiErrorMessage } from "@/utils/apiError";
import { selectToken } from "@/store/slices/authSlice";
import {
    useGetPromotionsQuery,
    useGetPromotionAnalyticsQuery,
    useGetVenuesByAdminQuery,
    useDeletePromotionMutation,
} from "@/store/api/apiSlice";
import PromotionForm from "./PromotionForm";

const money = (n) => `৳${Number(n ?? 0).toLocaleString()}`;
const BRAND = "#1DB954";

// Effective-status pill colors (always shown WITH a label — never colour-only).
const STATUS_PILL = {
    active: "bg-primary/15 text-primary",
    inactive: "bg-muted text-muted-foreground",
    expired: "bg-destructive/15 text-destructive",
    exhausted: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

export default function PromotionsManager() {
    const { data: session } = useSession();
    const token = useSelector(selectToken);
    const ready = Boolean(token);
    const adminId = session?.user?.id;

    const { data: promotions = [], isLoading: loadingList } = useGetPromotionsQuery(undefined, {
        skip: !ready,
    });
    const { data: analytics, isLoading: loadingStats } = useGetPromotionAnalyticsQuery(30, {
        skip: !ready,
    });
    const { data: venues = [] } = useGetVenuesByAdminQuery(adminId, { skip: !adminId });
    const [del] = useDeletePromotionMutation();

    // All grounds across the manager's turf(s) — for the form's scope selector.
    const grounds = useMemo(
        () => venues.flatMap((v) => (v.grounds || []).map((g) => ({ id: g.id, name: g.name }))),
        [venues]
    );

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };
    const openEdit = (p) => {
        setEditing(p);
        setFormOpen(true);
    };
    const remove = async (p) => {
        if (typeof window !== "undefined" && !window.confirm(`Delete coupon "${p.code}"?`)) return;
        try {
            const res = await del(p.id).unwrap();
            notifySuccess(res?.message || "Coupon removed");
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't delete the coupon."));
        }
    };

    if (!ready || loadingList || loadingStats) {
        return (
            <div className="grid h-[60vh] place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const totals = analytics?.totals ?? { redemptions: 0, total_discount: 0, unique_users: 0 };
    const status = analytics?.status_counts ?? { active: 0, inactive: 0, expired: 0, exhausted: 0, total: 0 };
    const series = analytics?.timeseries ?? [];
    const byCoupon = (analytics?.by_coupon ?? []).filter((c) => c.redemptions > 0).slice(0, 8);

    return (
        <div className="space-y-6">
            {/* header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Coupons</h1>
                    <p className="text-sm text-muted-foreground">
                        Create and track discount codes for your turf.
                    </p>
                </div>
                <Button onClick={openCreate} className="green-glow gap-2">
                    <Plus className="h-4 w-4" /> New coupon
                </Button>
            </div>

            {/* KPI tiles */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi icon={TicketCheck} label="Redemptions" value={totals.redemptions} />
                <Kpi icon={CircleDollarSign} label="Discount given" value={money(totals.total_discount)} />
                <Kpi icon={Users} label="Unique users" value={totals.unique_users} />
                <Kpi icon={TicketCheck} label="Active coupons" value={status.active} />
            </div>

            {/* charts */}
            <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Redemptions" subtitle="Last 30 days">
                    {series.some((d) => d.redemptions > 0) ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="fillRedeem" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={BRAND} stopOpacity={0.4} />
                                        <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="day" tickFormatter={fmtDay} tick={AXIS} minTickGap={24} />
                                <YAxis allowDecimals={false} tick={AXIS} width={28} />
                                <Tooltip content={<Tip kind="count" />} />
                                <Area
                                    type="monotone"
                                    dataKey="redemptions"
                                    stroke={BRAND}
                                    strokeWidth={2}
                                    fill="url(#fillRedeem)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyChart />
                    )}
                </ChartCard>

                <ChartCard title="Discount given" subtitle="Last 30 days">
                    {series.some((d) => d.discount > 0) ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={series} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="fillDisc" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={BRAND} stopOpacity={0.4} />
                                        <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="day" tickFormatter={fmtDay} tick={AXIS} minTickGap={24} />
                                <YAxis tick={AXIS} width={44} tickFormatter={(v) => `৳${v}`} />
                                <Tooltip content={<Tip kind="money" />} />
                                <Area
                                    type="monotone"
                                    dataKey="discount"
                                    stroke={BRAND}
                                    strokeWidth={2}
                                    fill="url(#fillDisc)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyChart />
                    )}
                </ChartCard>

                <ChartCard title="Top coupons" subtitle="By redemptions">
                    {byCoupon.length ? (
                        <ResponsiveContainer width="100%" height={Math.max(byCoupon.length * 34, 120)}>
                            <BarChart
                                data={byCoupon}
                                layout="vertical"
                                margin={{ top: 0, right: 12, left: 8, bottom: 0 }}
                            >
                                <XAxis type="number" allowDecimals={false} tick={AXIS} />
                                <YAxis
                                    type="category"
                                    dataKey="code"
                                    tick={AXIS}
                                    width={84}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<CouponTip />} cursor={{ fill: "var(--accent)" }} />
                                <Bar dataKey="redemptions" fill={BRAND} radius={[0, 4, 4, 0]} barSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyChart />
                    )}
                </ChartCard>

                <ChartCard title="Coupon status" subtitle={`${status.total} total`}>
                    <div className="grid grid-cols-2 gap-3">
                        <StatusTile label="Active" value={status.active} tone="active" />
                        <StatusTile label="Inactive" value={status.inactive} tone="inactive" />
                        <StatusTile label="Expired" value={status.expired} tone="expired" />
                        <StatusTile label="Exhausted" value={status.exhausted} tone="exhausted" />
                    </div>
                </ChartCard>
            </div>

            {/* management table */}
            <div className="glass-card overflow-hidden rounded-2xl">
                <div className="border-b border-border px-5 py-4">
                    <h3 className="font-bold text-foreground">All coupons</h3>
                </div>
                {promotions.length === 0 ? (
                    <div className="grid place-items-center gap-2 p-10 text-center">
                        <TicketCheck className="h-6 w-6 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            No coupons yet. Create your first discount code.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-sm">
                            <thead>
                                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                    <Th>Code</Th>
                                    <Th>Discount</Th>
                                    <Th>Scope</Th>
                                    <Th>Validity</Th>
                                    <Th>Usage</Th>
                                    <Th>Status</Th>
                                    <Th className="text-right">Actions</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {promotions.map((p) => (
                                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                                        <Td>
                                            <div className="font-bold text-foreground">{p.code}</div>
                                            <div className="max-w-[160px] truncate text-xs text-muted-foreground">
                                                {p.title}
                                            </div>
                                        </Td>
                                        <Td>
                                            {p.discount_type === "percentage"
                                                ? `${Number(p.discount_value)}%`
                                                : money(p.discount_value)}
                                        </Td>
                                        <Td>
                                            <div className="flex flex-wrap gap-1">
                                                <Tag>{p.ground_rate?.name || "Whole turf"}</Tag>
                                                {(p.applicable_users?.length ?? 0) > 0 && (
                                                    <Tag>{p.applicable_users.length} user(s)</Tag>
                                                )}
                                            </div>
                                        </Td>
                                        <Td className="whitespace-nowrap text-xs text-muted-foreground">
                                            {format(new Date(p.valid_from), "d MMM")} –{" "}
                                            {format(new Date(p.valid_until), "d MMM yy")}
                                        </Td>
                                        <Td className="whitespace-nowrap">
                                            {p.used_count ?? 0}
                                            {p.usage_limit ? ` / ${p.usage_limit}` : ""}
                                        </Td>
                                        <Td>
                                            <span
                                                className={cn(
                                                    "inline-block rounded-full px-2 py-0.5 text-xs font-bold capitalize",
                                                    STATUS_PILL[p.effective_status] ?? STATUS_PILL.inactive
                                                )}
                                            >
                                                {p.effective_status}
                                            </span>
                                        </Td>
                                        <Td className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => openEdit(p)}
                                                    title="Edit"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => remove(p)}
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <PromotionForm
                open={formOpen}
                onOpenChange={setFormOpen}
                grounds={grounds}
                initial={editing}
            />
        </div>
    );
}

// ---- small presentational helpers ----
const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" };
const fmtDay = (d) => format(new Date(d), "d MMM");

function Kpi({ icon: Icon, label, value }) {
    return (
        <div className="glass-card flex items-center gap-3 rounded-2xl p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
                <p className="truncate text-lg font-extrabold text-foreground">{value}</p>
                <p className="truncate text-xs text-muted-foreground">{label}</p>
            </div>
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
            No redemptions yet.
        </div>
    );
}

function StatusTile({ label, value, tone }) {
    return (
        <div className="rounded-xl border border-border/60 p-3">
            <p className="text-xl font-extrabold text-foreground">{value}</p>
            <span
                className={cn(
                    "mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold",
                    STATUS_PILL[tone]
                )}
            >
                {label}
            </span>
        </div>
    );
}

function Tip({ active, payload, label, kind }) {
    if (!active || !payload?.length) return null;
    const v = payload[0].value;
    return (
        <div className="glass-card rounded-xl border border-border px-3 py-2 text-xs shadow-lg">
            <p className="mb-0.5 font-semibold text-foreground">{format(new Date(label), "EEE, d MMM")}</p>
            <p className="text-muted-foreground">
                {kind === "money" ? money(v) : `${v} redemption${v === 1 ? "" : "s"}`}
            </p>
        </div>
    );
}

function CouponTip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
        <div className="glass-card rounded-xl border border-border px-3 py-2 text-xs shadow-lg">
            <p className="mb-0.5 font-semibold text-foreground">{p.code}</p>
            <p className="text-muted-foreground">
                {p.redemptions} redemption{p.redemptions === 1 ? "" : "s"} · {money(p.total_discount)} off
            </p>
        </div>
    );
}

function Th({ children, className }) {
    return <th className={cn("px-4 py-3 font-semibold", className)}>{children}</th>;
}
function Td({ children, className }) {
    return <td className={cn("px-4 py-3 align-top", className)}>{children}</td>;
}
function Tag({ children, className }) {
    return (
        <span
            className={cn(
                "inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
                className
            )}
        >
            {children}
        </span>
    );
}
