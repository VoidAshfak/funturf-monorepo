import InputField from "@/components/InputField";
import RequiredSign from "@/components/RequiredSign";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BD_DIVISIONS } from "@/utils/constants";
import { stepOneSchema } from "@/utils/turf-schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { MapPin } from "lucide-react";
import ButtonContainer from "./ButtonContainer";

// Leaflet needs the browser — load the picker client-side only.
const MapPicker = dynamic(() => import("@/components/MapPicker"), {
    ssr: false,
    loading: () => (
        <div className="grid h-[320px] w-full place-items-center rounded-2xl border border-border bg-muted/30 text-sm text-muted-foreground">
            Loading map…
        </div>
    ),
});

export default function StepOne({ formdata, setFormdata, step, setStep }) {
    const { data: session } = useSession();

    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        getValues,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(stepOneSchema),
        defaultValues: { ...formdata },
    });

    // Contact defaults to the owner's account details (captured at signup),
    // but stays editable — a venue may list a different public contact.
    useEffect(() => {
        if (!session?.user) return;
        if (!getValues("phone") && session.user.phone) setValue("phone", session.user.phone);
        if (!getValues("email") && session.user.email) setValue("email", session.user.email);
    }, [session, getValues, setValue]);

    const submitHandler = (values) => {
        setFormdata((prev) => ({ ...prev, ...values }));
        setStep((prev) => prev + 1);
    };

    const lat = watch("address_line_1.latitude");
    const lng = watch("address_line_1.longitude");
    const divisionError = errors?.address_line_1?.state?.message;

    return (
        <form className="space-y-6" onSubmit={handleSubmit(submitHandler)}>
            {/* Basics */}
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Turf Name <RequiredSign /></Label>
                <InputField errors={errors}>
                    <Input
                        id="name"
                        placeholder="e.g., Green Valley Sports Arena"
                        className={errors?.name ? "border-2 border-red-500" : ""}
                        {...register("name")}
                    />
                </InputField>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <InputField errors={errors}>
                    <Textarea
                        id="description"
                        rows={4}
                        placeholder="Describe your venue, facilities, and any special features…"
                        {...register("description")}
                    />
                </InputField>
            </div>

            {/* Address (Bangladesh) */}
            <div className="space-y-4 rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Location</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <Label>Division <RequiredSign /></Label>
                        <Controller
                            name="address_line_1.state"
                            control={control}
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger className={`w-full ${divisionError ? "border-2 border-red-500" : ""}`}>
                                        <SelectValue placeholder="Select division" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {BD_DIVISIONS.map((d) => (
                                            <SelectItem key={d} value={d}>{d}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {divisionError && <span className="text-sm text-red-500">{divisionError}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="district">District <RequiredSign /></Label>
                        <InputField errors={errors}>
                            <Input
                                id="district"
                                placeholder="e.g., Gazipur"
                                className={errors?.address_line_1?.city ? "border-2 border-red-500" : ""}
                                {...register("address_line_1.city")}
                            />
                        </InputField>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="area">Area / Street <RequiredSign /></Label>
                    <InputField errors={errors}>
                        <Input
                            id="area"
                            placeholder="e.g., House 12, Road 5, Sector 7, Uttara"
                            className={errors?.address_line_1?.area ? "border-2 border-red-500" : ""}
                            {...register("address_line_1.area")}
                        />
                    </InputField>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="address_line_2">Landmark (optional)</Label>
                        <InputField errors={errors}>
                            <Input
                                id="address_line_2"
                                placeholder="e.g., Beside Uttara Boro Mosque"
                                {...register("address_line_2")}
                            />
                        </InputField>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="postal_code">Postal Code (optional)</Label>
                        <InputField errors={errors}>
                            <Input
                                id="postal_code"
                                placeholder="e.g., 1230"
                                {...register("address_line_1.postal_code")}
                            />
                        </InputField>
                    </div>
                </div>

                {/* Map pin */}
                <div className="flex flex-col gap-2">
                    <Label>Pin location on map (optional)</Label>
                    <p className="text-xs text-muted-foreground">
                        Click the map or drag the pin to set exact coordinates.
                    </p>
                    <MapPicker
                        value={{ lat, lng }}
                        onChange={({ lat: newLat, lng: newLng }) => {
                            setValue("address_line_1.latitude", newLat, { shouldDirty: true });
                            setValue("address_line_1.longitude", newLng, { shouldDirty: true });
                        }}
                    />
                    {lat && lng ? (
                        <p className="text-xs text-muted-foreground">
                            Selected: {lat}, {lng}
                        </p>
                    ) : null}
                </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="phone">Contact Phone</Label>
                    <InputField errors={errors}>
                        <Input
                            id="phone"
                            placeholder="01712345678"
                            className={errors?.phone ? "border-2 border-red-500" : ""}
                            {...register("phone")}
                        />
                    </InputField>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Contact Email</Label>
                    <InputField errors={errors}>
                        <Input
                            id="email"
                            type="email"
                            placeholder="venue@example.com"
                            className={errors?.email ? "border-2 border-red-500" : ""}
                            {...register("email")}
                        />
                    </InputField>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="website_url">Website (optional)</Label>
                    <InputField errors={errors}>
                        <Input id="website_url" placeholder="www.example.com" {...register("website_url")} />
                    </InputField>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="establishment_year">Establishment Year (optional)</Label>
                    <InputField errors={errors}>
                        <Input id="establishment_year" placeholder="2020" {...register("establishment_year")} />
                    </InputField>
                </div>
            </div>

            <ButtonContainer currentStep={step} setStep={setStep} />
        </form>
    );
}
