"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, Plus, Save, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AiRephraseButton from "@/components/AiRephraseButton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import MultiSelect from "@/components/MultiSelect";
import RequiredSign from "@/components/RequiredSign";
import { AMENITIES, GROUND_BOOKING_STATUS, GROUND_TYPES, SPORTS, SURFACE_TYPES } from "@/utils/constants";
import { uploadImageObjArray } from "@/utils/image-upload";
import { notifyError } from "@/lib/notify";

const prettify = (s = "") =>
    String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const asOptions = (arr) => arr.map((v) => ({ label: prettify(v), value: v }));
const str = (v) => (v === null || v === undefined ? "" : String(v));

// Shared add/edit form for a single ground. Owns field state + image handling
// (existing URLs kept as removable thumbnails, plus newly picked files). On
// submit it uploads new files, merges them with kept URLs, and hands the caller
// a ready payload — the caller runs the create/update mutation and redirects.
export default function GroundForm({ initial = null, onSubmit, submitLabel, pending = false, showStatus = false }) {
    const [form, setForm] = useState(() => ({
        name: str(initial?.name),
        sport_type: initial?.sport_type ?? [],
        ground_type: str(initial?.ground_type),
        surface_type: str(initial?.surface_type),
        dimensions_length_m: str(initial?.dimensions_length_m),
        dimensions_width_m: str(initial?.dimensions_width_m),
        capacity_players: str(initial?.capacity_players),
        hourly_rate: str(initial?.hourly_rate),
        weekend_hourly_rate: str(initial?.weekend_hourly_rate),
        peak_hour_rate: str(initial?.peak_hour_rate),
        off_peak_hour_rate: str(initial?.off_peak_hour_rate),
        minimum_booking_hours: str(initial?.minimum_booking_hours),
        maximum_booking_hours: str(initial?.maximum_booking_hours),
        amenities: initial?.amenities ?? [],
        notes: str(initial?.notes),
        status: initial?.status ?? "available",
    }));
    // Existing hosted images (URLs) vs newly picked files ({ file, preview }).
    const [keptImages, setKeptImages] = useState(initial?.images ?? []);
    const [newImages, setNewImages] = useState([]);
    const [uploading, setUploading] = useState(false);

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    const busy = pending || uploading;

    const addImages = (fileList) => {
        const files = Array.from(fileList ?? []);
        setNewImages((prev) => [
            ...prev,
            ...files.map((file) => ({ file, preview: URL.createObjectURL(file) })),
        ]);
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return notifyError("Name your ground.");
        if (form.sport_type.length === 0) return notifyError("Pick at least one sport.");
        if (!form.hourly_rate || Number(form.hourly_rate) <= 0)
            return notifyError("Set an hourly rate greater than 0.");

        try {
            let uploaded = [];
            if (newImages.length) {
                setUploading(true);
                uploaded = await uploadImageObjArray(newImages.map(({ file }) => ({ file })));
                setUploading(false);
            }
            const payload = { ...form, images: [...keptImages, ...uploaded] };
            if (!showStatus) delete payload.status; // status only edited in edit mode
            await onSubmit(payload);
        } catch (err) {
            setUploading(false);
            notifyError(err?.message || "Something went wrong.");
        }
    };

    return (
        <form onSubmit={submit} className="glass-card space-y-6 rounded-3xl p-6 md:p-8">
            {/* Basics */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5 md:col-span-2">
                    <Label htmlFor="name">Ground name <RequiredSign /></Label>
                    <Input id="name" placeholder="e.g., Ground A (7-a-side)" value={form.name} onChange={(e) => set("name", e.target.value)} />
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                    <Label>Sports <RequiredSign /></Label>
                    <MultiSelect
                        options={asOptions(SPORTS)}
                        values={asOptions(form.sport_type)}
                        onChange={(items) => set("sport_type", items.map((it) => it.value))}
                        placeholder="Select sports"
                    />
                </div>

                <SelectField label="Ground type" value={form.ground_type} onChange={(v) => set("ground_type", v)} options={GROUND_TYPES} placeholder="Select type" />
                <SelectField label="Surface" value={form.surface_type} onChange={(v) => set("surface_type", v)} options={SURFACE_TYPES} placeholder="Select surface" />

                <NumberField label="Length (m)" value={form.dimensions_length_m} onChange={(v) => set("dimensions_length_m", v)} />
                <NumberField label="Width (m)" value={form.dimensions_width_m} onChange={(v) => set("dimensions_width_m", v)} />
                <NumberField label="Capacity (players)" value={form.capacity_players} onChange={(v) => set("capacity_players", v)} />

                {showStatus && (
                    <div className="flex flex-col gap-1.5">
                        <Label>Booking status</Label>
                        <Select value={form.status} onValueChange={(v) => set("status", v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {GROUND_BOOKING_STATUS.map((s) => (
                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Pricing */}
            <div className="space-y-4 rounded-2xl border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">Pricing (BDT / hour)</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <NumberField label={<>Hourly rate <RequiredSign /></>} value={form.hourly_rate} onChange={(v) => set("hourly_rate", v)} />
                    <NumberField label="Weekend rate" value={form.weekend_hourly_rate} onChange={(v) => set("weekend_hourly_rate", v)} />
                    <NumberField label="Peak-hour rate" value={form.peak_hour_rate} onChange={(v) => set("peak_hour_rate", v)} />
                    <NumberField label="Off-peak rate" value={form.off_peak_hour_rate} onChange={(v) => set("off_peak_hour_rate", v)} />
                    <NumberField label="Min booking (hrs)" value={form.minimum_booking_hours} onChange={(v) => set("minimum_booking_hours", v)} />
                    <NumberField label="Max booking (hrs)" value={form.maximum_booking_hours} onChange={(v) => set("maximum_booking_hours", v)} />
                </div>
            </div>

            {/* Amenities */}
            <div className="flex flex-col gap-1.5">
                <Label>Amenities</Label>
                <MultiSelect
                    options={asOptions(AMENITIES)}
                    values={asOptions(form.amenities)}
                    onChange={(items) => set("amenities", items.map((it) => it.value))}
                    placeholder="Select amenities"
                />
            </div>

            {/* Images */}
            <div className="flex flex-col gap-2">
                <Label>Photos</Label>
                <div className="flex flex-wrap gap-3">
                    {keptImages.map((url, i) => (
                        <Thumb key={url} src={url} onRemove={() => setKeptImages((p) => p.filter((_, idx) => idx !== i))} />
                    ))}
                    {newImages.map((img, i) => (
                        <Thumb key={img.preview} src={img.preview} onRemove={() => setNewImages((p) => p.filter((_, idx) => idx !== i))} />
                    ))}
                    <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary/60">
                        <Upload className="h-5 w-5" />
                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
                    </label>
                </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes">Notes</Label>
                <div className="relative">
                    <Textarea id="notes" rows={3} className="pb-12" placeholder="Anything players should know… (Banglish is fine — AI can polish it)" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
                    <AiRephraseButton
                        kind="ground"
                        getText={() => form.notes}
                        onResult={(t) => set("notes", t)}
                    />
                </div>
            </div>

            <Button type="submit" className="green-glow w-full rounded-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : initial ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {uploading ? "Uploading photos…" : submitLabel}
            </Button>
        </form>
    );
}

function SelectField({ label, value, onChange, options, placeholder }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label>{label}</Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((t) => (
                        <SelectItem key={t} value={t}>{prettify(t)}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function NumberField({ label, value, onChange }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label>{label}</Label>
            <Input type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    );
}

function Thumb({ src, onRemove }) {
    return (
        <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
            <Image src={src} alt="" fill className="object-cover" />
            <button
                type="button"
                onClick={onRemove}
                className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
            >
                <X className="h-3 w-3" />
            </button>
        </div>
    );
}
