import InputField from "@/components/InputField";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FACILITIES, SPORTS } from "@/utils/constants";
import { stepTwoSchema } from "@/utils/turf-schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload, X } from "lucide-react";
import { useForm } from "react-hook-form";
import ButtonContainer from "./ButtonContainer";

export default function StepTwo({ formdata, setFormdata, step, setStep }) {
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(stepTwoSchema),
        defaultValues: { ...formdata },
    });

    const selectedSports = watch("sports_available") || [];
    const selectedFacilities = watch("facilities") || [];
    const inputImage = watch("images");

    const submitHandler = (values) => {
        setFormdata((prev) => ({ ...prev, ...values }));
        setStep((prev) => prev + 1);
    };

    const toggleFrom = (list, item) =>
        list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setValue("images", { file, preview: URL.createObjectURL(file), name: file.name });
    };

    return (
        <form className="space-y-6" onSubmit={handleSubmit(submitHandler)}>
            {/* Operating hours (native clock inputs) */}
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="openingTime">Opening Time</Label>
                    <Input id="openingTime" type="time" {...register("operating_hours.opening_time")} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="closingTime">Closing Time</Label>
                    <Input id="closingTime" type="time" {...register("operating_hours.closing_time")} />
                </div>
            </div>
            {errors?.operating_hours?.message && (
                <span className="text-sm text-red-500">{errors.operating_hours.message}</span>
            )}

            {/* Sports */}
            <div>
                <Label>Sports Available</Label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {SPORTS.map((sport) => (
                        <button
                            type="button"
                            key={sport}
                            onClick={() => setValue("sports_available", toggleFrom(selectedSports, sport))}
                            className={`rounded-lg border-2 p-3 text-center text-sm transition-all ${
                                selectedSports.includes(sport)
                                    ? "border-primary bg-primary/15 text-primary"
                                    : "border-border hover:border-primary/40"
                            }`}
                        >
                            {sport}
                        </button>
                    ))}
                </div>
            </div>

            {/* Facilities */}
            <div>
                <Label>Facilities</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                    {FACILITIES.map((facility) => (
                        <div key={facility} className="flex items-center space-x-2">
                            <Checkbox
                                id={facility}
                                checked={selectedFacilities.includes(facility)}
                                onCheckedChange={() => setValue("facilities", toggleFrom(selectedFacilities, facility))}
                            />
                            <label htmlFor={facility} className="cursor-pointer text-sm">{facility}</label>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="advanceBookingDays">Advance Booking (days)</Label>
                    <InputField errors={errors}>
                        <Input id="advanceBookingDays" type="number" placeholder="7" {...register("advance_booking_days")} />
                    </InputField>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="cancellation_policy">Cancellation Policy</Label>
                <InputField errors={errors}>
                    <Textarea
                        id="cancellation_policy"
                        rows={3}
                        placeholder="e.g., Free cancellation up to 24 hours before booking time…"
                        {...register("cancellation_policy")}
                    />
                </InputField>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="rules_and_regulations">Rules & Regulations</Label>
                <InputField errors={errors}>
                    <Textarea
                        id="rules_and_regulations"
                        rows={3}
                        placeholder="e.g., No outside food, proper sports attire required…"
                        {...register("rules_and_regulations")}
                    />
                </InputField>
            </div>

            {/* Venue cover image */}
            <div>
                <h4 className="mb-3 font-semibold text-foreground">Venue Image</h4>
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="venue-image-upload"
                />
                <Label
                    htmlFor="venue-image-upload"
                    className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border transition-colors hover:bg-accent"
                >
                    <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to upload a cover image</span>
                    <span className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP up to 10MB</span>
                </Label>

                {inputImage && (
                    <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div className="group relative">
                            <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={inputImage.preview || inputImage} alt={inputImage.name || "Venue"} className="h-full w-full object-cover" />
                            </div>
                            <button
                                type="button"
                                onClick={() => setValue("images", null)}
                                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white opacity-0 shadow-lg transition-opacity hover:bg-red-600 group-hover:opacity-100"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <ButtonContainer currentStep={step} setStep={setStep} />
        </form>
    );
}
