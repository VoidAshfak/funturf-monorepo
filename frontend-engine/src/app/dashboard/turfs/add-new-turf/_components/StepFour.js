import InputField from "@/components/InputField";
import RequiredSign from "@/components/RequiredSign";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { stepFourSchema } from "@/utils/turf-schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { DollarSign, Upload, X } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import ButtonContainer from "./ButtonContainer";

export default function StepFour({ formdata, setFormdata, step, setStep }) {
    const {
        register,
        handleSubmit,
        watch,
        control,
        setValue,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(stepFourSchema),
        defaultValues: { ...formdata },
    });

    const { fields } = useFieldArray({ control, name: "grounds" });

    const submitHandler = (values) => {
        setFormdata((prev) => ({ ...prev, ...values }));
        setStep((prev) => prev + 1);
    };

    const handleImageUpload = (i, e) => {
        const files = Array.from(e.target.files);
        const current = watch(`grounds.${i}.images`) || [];
        const added = files.map((file) => ({ file, preview: URL.createObjectURL(file), name: file.name }));
        setValue(`grounds.${i}.images`, [...current, ...added]);
    };

    const removeImage = (i, imgIdx) => {
        const current = watch(`grounds.${i}.images`) || [];
        setValue(`grounds.${i}.images`, current.filter((_, idx) => idx !== imgIdx));
    };

    // BDT-prefixed money input.
    const RateField = ({ index, name, label, required, placeholder }) => (
        <div>
            <Label className="mb-1 block text-sm font-medium text-foreground">
                {label} {required && <RequiredSign />}
            </Label>
            <div className="relative">
                <InputField errors={errors}>
                    <Input
                        type="number"
                        step="50"
                        placeholder={placeholder}
                        className={`pl-12 ${errors?.grounds?.[index]?.[name] ? "border-2 border-red-500" : ""}`}
                        {...register(`grounds.${index}.${name}`)}
                    />
                </InputField>
                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">BDT</span>
            </div>
        </div>
    );

    return (
        <form className="space-y-6" onSubmit={handleSubmit(submitHandler)}>
            {fields.map((field, index) => {
                const ground = watch(`grounds.${index}`);
                const images = watch(`grounds.${index}.images`) || [];

                return (
                    <div key={field.id} className="glass-card space-y-6 rounded-2xl p-6">
                        <div className="border-b border-border pb-4">
                            <h3 className="text-lg font-semibold text-foreground">
                                {ground?.name || `Ground ${index + 1}`}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {Array.isArray(ground?.sport_type) ? ground.sport_type.join(", ") : ground?.sport_type}
                            </p>
                        </div>

                        {/* Pricing */}
                        <div>
                            <div className="mb-4 flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-muted-foreground" />
                                <h4 className="font-semibold text-foreground">Pricing (per hour)</h4>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <RateField index={index} name="hourly_rate" label="Standard Rate" required placeholder="1000" />
                                <RateField index={index} name="weekend_hourly_rate" label="Weekend Rate" placeholder="1500" />
                                <RateField index={index} name="peak_hour_rate" label="Peak Hour Rate" placeholder="2000" />
                                <RateField index={index} name="off_peak_hour_rate" label="Off-Peak Rate" placeholder="800" />
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <Label className="mb-1 block text-sm font-medium text-foreground">Minimum Booking Hours</Label>
                                    <InputField errors={errors}>
                                        <Input type="number" step="0.5" placeholder="1" {...register(`grounds.${index}.minimum_booking_hours`)} />
                                    </InputField>
                                </div>
                                <div>
                                    <Label className="mb-1 block text-sm font-medium text-foreground">Maximum Booking Hours</Label>
                                    <InputField errors={errors}>
                                        <Input type="number" step="0.5" placeholder="8" {...register(`grounds.${index}.maximum_booking_hours`)} />
                                    </InputField>
                                </div>
                            </div>
                        </div>

                        {/* Images (optional) */}
                        <div>
                            <h4 className="mb-3 font-semibold text-foreground">Ground Images</h4>
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => handleImageUpload(index, e)}
                                className="hidden"
                                id={`ground-image-${index}`}
                            />
                            <Label
                                htmlFor={`ground-image-${index}`}
                                className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border transition-colors hover:bg-accent"
                            >
                                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Click to upload images</span>
                                <span className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP up to 10MB</span>
                            </Label>

                            {images.length > 0 && (
                                <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                                    {images.map((img, imgIdx) => (
                                        <div key={imgIdx} className="group relative">
                                            <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={img.preview || img} alt={img.name || `Image ${imgIdx + 1}`} className="h-full w-full object-cover" />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index, imgIdx)}
                                                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white opacity-0 shadow-lg transition-opacity hover:bg-red-600 group-hover:opacity-100"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            <ButtonContainer currentStep={step} setStep={setStep} />
        </form>
    );
}
