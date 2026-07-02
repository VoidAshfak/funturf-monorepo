import InputField from "@/components/InputField";
import MultiSelect from "@/components/MultiSelect";
import RequiredSign from "@/components/RequiredSign";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GROUND_BOOKING_STATUS, GROUND_TYPES, groundData, SPORTS, SURFACE_TYPES } from "@/utils/constants";
import { stepThreeSchema } from "@/utils/turf-schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import ButtonContainer from "./ButtonContainer";

export default function StepThree({ formdata, setFormdata, step, setStep }) {
    // Ground amenities are inherited from the turf-level facilities chosen in step 2.
    const inheritedAmenities = formdata.facilities || [];

    const {
        control,
        register,
        handleSubmit,
        setValue,
        watch,
        getValues,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(stepThreeSchema),
        defaultValues: { ...formdata },
    });

    const { fields, append, remove } = useFieldArray({ control, name: "grounds" });

    // Seed each existing ground's amenities from the turf facilities (once),
    // and default the booking status to "available".
    useEffect(() => {
        fields.forEach((_, i) => {
            if (!(getValues(`grounds.${i}.amenities`) || []).length && inheritedAmenities.length) {
                setValue(`grounds.${i}.amenities`, [...inheritedAmenities]);
            }
            if (!getValues(`grounds.${i}.status`)) {
                setValue(`grounds.${i}.status`, "available");
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const submitHandler = (values) => {
        setFormdata((prev) => ({ ...prev, ...values }));
        setStep((prev) => prev + 1);
    };

    const addGround = () => {
        append({ ...groundData, status: "available", amenities: [...inheritedAmenities] });
    };

    const toggleAmenity = (i, amenity) => {
        const current = watch(`grounds.${i}.amenities`) || [];
        setValue(
            `grounds.${i}.amenities`,
            current.includes(amenity) ? current.filter((a) => a !== amenity) : [...current, amenity]
        );
    };

    return (
        <form className="space-y-6" onSubmit={handleSubmit(submitHandler)}>
            {fields.map((field, index) => {
                const groundAmenities = watch(`grounds.${index}.amenities`) || [];
                const sportError = errors?.grounds?.[index]?.sport_type?.message;

                return (
                    <Card key={field.id}>
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle>Ground {fields.length > 1 ? index + 1 : ""}</CardTitle>
                                    <CardDescription>Enter ground details</CardDescription>
                                </div>
                                {fields.length > 1 && (
                                    <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)}>
                                        <Trash2 className="mr-1 h-4 w-4" />
                                        Remove
                                    </Button>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <Label>Ground Name <RequiredSign /></Label>
                                <InputField errors={errors}>
                                    <Input
                                        placeholder="e.g., Main Football Field"
                                        className={errors?.grounds?.[index]?.name ? "border-2 border-red-500" : ""}
                                        {...register(`grounds.${index}.name`)}
                                    />
                                </InputField>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <Label>Sport Type <RequiredSign /></Label>
                                    <Controller
                                        name={`grounds.${index}.sport_type`}
                                        control={control}
                                        render={({ field: f }) => (
                                            <MultiSelect
                                                options={SPORTS.map((s) => ({ label: s, value: s }))}
                                                values={SPORTS.map((s) => ({ label: s, value: s })).filter((o) =>
                                                    f.value?.includes(o.value)
                                                )}
                                                onChange={(items) => f.onChange(items.map((it) => it.value))}
                                                placeholder="Select sport type"
                                            />
                                        )}
                                    />
                                    {sportError && <span className="text-sm text-red-500">{sportError}</span>}
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label>Ground Type</Label>
                                    <Controller
                                        name={`grounds.${index}.ground_type`}
                                        control={control}
                                        render={({ field: f }) => (
                                            <Select value={f.value} onValueChange={f.onChange}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select ground type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {GROUND_TYPES.map((t) => (
                                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label>Surface Type</Label>
                                    <Controller
                                        name={`grounds.${index}.surface_type`}
                                        control={control}
                                        render={({ field: f }) => (
                                            <Select value={f.value} onValueChange={f.onChange}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select surface type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {SURFACE_TYPES.map((t) => (
                                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label>Player Capacity</Label>
                                    <InputField errors={errors}>
                                        <Input type="number" placeholder="22" {...register(`grounds.${index}.capacity_players`)} />
                                    </InputField>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label>Length (m)</Label>
                                    <InputField errors={errors}>
                                        <Input type="number" placeholder="100" {...register(`grounds.${index}.dimensions_length_m`)} />
                                    </InputField>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label>Width (m)</Label>
                                    <InputField errors={errors}>
                                        <Input type="number" placeholder="64" {...register(`grounds.${index}.dimensions_width_m`)} />
                                    </InputField>
                                </div>
                            </div>

                            {/* Booking availability (maps to grounds.status) */}
                            <div className="flex flex-col gap-1.5">
                                <Label>Booking Availability</Label>
                                <Controller
                                    name={`grounds.${index}.status`}
                                    control={control}
                                    render={({ field: f }) => (
                                        <Select value={f.value || "available"} onValueChange={f.onChange}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select availability" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {GROUND_BOOKING_STATUS.map((s) => (
                                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Controls whether players can book this ground. Set to “Open for booking” to go live.
                                </p>
                            </div>

                            {/* Amenities — inherited from turf facilities, editable per ground */}
                            <div>
                                <Label>Amenities</Label>
                                {inheritedAmenities.length ? (
                                    <>
                                        <p className="mb-2 mt-1 text-xs text-muted-foreground">
                                            Inherited from your turf facilities — toggle off any this ground doesn&apos;t have.
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {inheritedAmenities.map((amenity) => (
                                                <Badge
                                                    key={amenity}
                                                    variant={groundAmenities.includes(amenity) ? "default" : "outline"}
                                                    className="cursor-pointer"
                                                    onClick={() => toggleAmenity(index, amenity)}
                                                >
                                                    {amenity}
                                                </Badge>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Select facilities in the previous step to assign amenities here.
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label>Notes</Label>
                                <InputField errors={errors}>
                                    <Textarea rows={3} placeholder="Additional information about the ground…" {...register(`grounds.${index}.notes`)} />
                                </InputField>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            <Button type="button" variant="outline" onClick={addGround} className="w-full rounded-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Another Ground
            </Button>

            {errors?.grounds?.message && (
                <span className="text-sm text-red-500">{errors.grounds.message}</span>
            )}

            <ButtonContainer currentStep={step} setStep={setStep} />
        </form>
    );
}
