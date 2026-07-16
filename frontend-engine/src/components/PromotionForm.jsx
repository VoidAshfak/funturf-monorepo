"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Ticket } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { cn } from "@/lib/utils";
import { notifySuccess, notifyError } from "@/lib/notify";
import { getApiErrorMessage } from "@/utils/apiError";
import {
    useCreatePromotionMutation,
    useUpdatePromotionMutation,
} from "@/store/api/apiSlice";

const DAYS = [
    { n: 0, label: "Sun" },
    { n: 1, label: "Mon" },
    { n: 2, label: "Tue" },
    { n: 3, label: "Wed" },
    { n: 4, label: "Thu" },
    { n: 5, label: "Fri" },
    { n: 6, label: "Sat" },
];

// An ISO / Date -> value for <input type="datetime-local"> ("YYYY-MM-DDTHH:mm").
const toLocalInput = (v) => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Toggle a value in an array.
const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/**
 * Create / edit a coupon. `grounds` are the manager's grounds (for the scope
 * selector). Pass `initial` (a promotion) to edit, or null to create.
 */
export default function PromotionForm({ open, onOpenChange, grounds = [], initial = null }) {
    const editing = Boolean(initial);
    const [create, createState] = useCreatePromotionMutation();
    const [update, updateState] = useUpdatePromotionMutation();
    const busy = createState.isLoading || updateState.isLoading;

    const seed = useMemo(
        () => ({
            code: initial?.code ?? "",
            title: initial?.title ?? "",
            description: initial?.description ?? "",
            discount_type: initial?.discount_type ?? "percentage",
            discount_value: initial?.discount_value != null ? String(initial.discount_value) : "",
            minimum_booking_amount:
                initial?.minimum_booking_amount != null ? String(initial.minimum_booking_amount) : "",
            maximum_discount_amount:
                initial?.maximum_discount_amount != null ? String(initial.maximum_discount_amount) : "",
            valid_from: toLocalInput(initial?.valid_from),
            valid_until: toLocalInput(initial?.valid_until),
            usage_limit: initial?.usage_limit != null ? String(initial.usage_limit) : "",
            ground_id: initial?.ground_id ?? "",
            applicable_days: Array.isArray(initial?.applicable_days) ? initial.applicable_days : [],
            applicable_users: Array.isArray(initial?.applicable_users)
                ? initial.applicable_users.join(", ")
                : "",
            status: initial?.status ?? "active",
        }),
        [initial]
    );

    const [form, setForm] = useState(seed);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    // Re-seed whenever the dialog opens or the target changes. `useState(seed)`
    // only runs once (the dialog stays mounted), and Radix's onOpenChange doesn't
    // fire on a PROGRAMMATIC open — so without this an edit would show stale/empty
    // fields. `seed` is memoised on `initial`, so this won't clobber typing.
    useEffect(() => {
        if (open) setForm(seed);
    }, [open, seed]);

    const submit = async () => {
        // Client-side sanity so the API round-trip only fails on real conflicts.
        if (!form.code.trim() || !form.title.trim()) return notifyError("Code and title are required.");
        if (!form.discount_value || Number(form.discount_value) <= 0)
            return notifyError("Enter a positive discount value.");
        if (form.discount_type === "percentage" && Number(form.discount_value) > 100)
            return notifyError("A percentage can't exceed 100.");
        if (!form.valid_from || !form.valid_until) return notifyError("Pick a start and end date.");
        if (new Date(form.valid_from) >= new Date(form.valid_until))
            return notifyError("End must be after start.");

        const payload = {
            code: form.code.trim().toUpperCase(),
            title: form.title.trim(),
            description: form.description.trim() || null,
            discount_type: form.discount_type,
            discount_value: Number(form.discount_value),
            minimum_booking_amount: form.minimum_booking_amount ? Number(form.minimum_booking_amount) : null,
            maximum_discount_amount: form.maximum_discount_amount ? Number(form.maximum_discount_amount) : null,
            valid_from: new Date(form.valid_from).toISOString(),
            valid_until: new Date(form.valid_until).toISOString(),
            usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
            ground_id: form.ground_id || null,
            applicable_days: form.applicable_days,
            applicable_users: form.applicable_users
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            status: form.status,
        };

        try {
            if (editing) await update({ id: initial.id, ...payload }).unwrap();
            else await create(payload).unwrap();
            notifySuccess(editing ? "Coupon updated" : "Coupon created");
            onOpenChange(false);
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't save the coupon."));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Ticket className="h-5 w-5 text-primary" />
                        {editing ? "Edit coupon" : "New coupon"}
                    </DialogTitle>
                    <DialogDescription>
                        Set the discount, when it's valid, and who/what it applies to. Leave a scope
                        empty to apply it broadly.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Code">
                            <Input
                                value={form.code}
                                onChange={(e) => set("code", e.target.value.toUpperCase())}
                                placeholder="EID25"
                            />
                        </Field>
                        <Field label="Status">
                            <Select value={form.status} onValueChange={(v) => set("status", v)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                    </div>

                    <Field label="Title">
                        <Input
                            value={form.title}
                            onChange={(e) => set("title", e.target.value)}
                            placeholder="Eid special — 25% off"
                        />
                    </Field>

                    <Field label="Description (optional)">
                        <Textarea
                            className="min-h-16"
                            value={form.description}
                            onChange={(e) => set("description", e.target.value)}
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Discount type">
                            <Select
                                value={form.discount_type}
                                onValueChange={(v) => set("discount_type", v)}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                                    <SelectItem value="fixed_amount">Flat amount (৳)</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label={form.discount_type === "percentage" ? "Percent off" : "Amount off (৳)"}>
                            <Input
                                type="number"
                                min={0}
                                value={form.discount_value}
                                onChange={(e) => set("discount_value", e.target.value)}
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Min booking (৳, optional)">
                            <Input
                                type="number"
                                min={0}
                                value={form.minimum_booking_amount}
                                onChange={(e) => set("minimum_booking_amount", e.target.value)}
                            />
                        </Field>
                        <Field label="Max discount (৳, optional)">
                            <Input
                                type="number"
                                min={0}
                                value={form.maximum_discount_amount}
                                onChange={(e) => set("maximum_discount_amount", e.target.value)}
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Valid from">
                            <Input
                                type="datetime-local"
                                value={form.valid_from}
                                onChange={(e) => set("valid_from", e.target.value)}
                            />
                        </Field>
                        <Field label="Valid until">
                            <Input
                                type="datetime-local"
                                value={form.valid_until}
                                onChange={(e) => set("valid_until", e.target.value)}
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Usage limit (optional)">
                            <Input
                                type="number"
                                min={1}
                                value={form.usage_limit}
                                onChange={(e) => set("usage_limit", e.target.value)}
                                placeholder="Unlimited"
                            />
                        </Field>
                        <Field label="Ground scope">
                            <Select
                                value={form.ground_id || "all"}
                                onValueChange={(v) => set("ground_id", v === "all" ? "" : v)}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Whole turf</SelectItem>
                                    {grounds.map((g) => (
                                        <SelectItem key={g.id} value={g.id}>
                                            {g.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    </div>

                    {/* day targeting */}
                    <Field label="Valid days (optional — empty = every day)">
                        <div className="flex flex-wrap gap-2">
                            {DAYS.map((d) => {
                                const on = form.applicable_days.includes(d.n);
                                return (
                                    <button
                                        key={d.n}
                                        type="button"
                                        onClick={() => set("applicable_days", toggle(form.applicable_days, d.n))}
                                        className={cn(
                                            "w-11 rounded-full border py-1 text-xs font-semibold transition-colors",
                                            on
                                                ? "border-primary/40 bg-primary/15 text-primary"
                                                : "border-border bg-muted/40 text-muted-foreground hover:bg-accent"
                                        )}
                                    >
                                        {d.label}
                                    </button>
                                );
                            })}
                        </div>
                    </Field>

                    {/* user targeting */}
                    <Field label="Specific users (optional — comma-separated user IDs)">
                        <Textarea
                            className="min-h-14 font-mono text-xs"
                            value={form.applicable_users}
                            onChange={(e) => set("applicable_users", e.target.value)}
                            placeholder="Leave empty for everyone"
                        />
                    </Field>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={busy} className="green-glow gap-2">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                        {editing ? "Save changes" : "Create coupon"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Field({ label, children }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            {children}
        </div>
    );
}
