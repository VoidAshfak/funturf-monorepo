import { useForm, useFieldArray } from "react-hook-form";
import { Upload, X, DollarSign } from "lucide-react";
import ButtonContainer from "./ButtonContainer";
import { Label } from "@/components/ui/label";
import InputField from "@/components/InputField";
import { Input } from "@/components/ui/input";
import RequiredSign from "@/components/RequiredSign";

export default function StepFour({ formdata, setFormdata, step, setStep }) {

    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
        control,
        setValue
    } = useForm({
        defaultValues: { ...formdata }
    });

    const { fields } = useFieldArray({
        control,
        name: 'grounds'
    });

    const submitHandler = (values) => {
        setFormdata(prev => ({ ...prev, ...values }));
        setStep(prev => prev + 1);
    };

    const handleImageUpload = (groundIndex, e) => {
        const files = Array.from(e.target.files);
        const currentImages = watch(`grounds.${groundIndex}.images`) || [];

        // Create file objects with preview URLs
        const newImages = files.map(file => ({
            file,
            preview: URL.createObjectURL(file),
            name: file.name
        }));

        setValue(`grounds.${groundIndex}.images`, [...currentImages, ...newImages]);
    };

    const removeImage = (groundIndex, imageIndex) => {
        const currentImages = watch(`grounds.${groundIndex}.images`) || [];
        const newImages = currentImages.filter((_, idx) => idx !== imageIndex);
        setValue(`grounds.${groundIndex}.images`, newImages);
    };

    return (
        <div className="space-y-4">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground">Pricing & Images</h2>
                <p className="text-muted-foreground mt-1">Set pricing and upload images for each ground</p>
            </div>

            <form
                className="space-y-4"
                onSubmit={handleSubmit(submitHandler)}
            >

                {fields.map((field, index) => {
                    const groundData = watch(`grounds.${index}`);

                    return (
                        <div key={field.id} className="glass-card rounded-2xl p-6 space-y-6">
                            {/* Ground Header */}
                            <div className="flex items-center justify-between pb-4 border-b">
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground">
                                        {groundData?.name || `Ground ${index + 1}`}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {groundData?.sport_type} • {groundData?.ground_type}
                                    </p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${groundData?.status === 'Active'
                                    ? 'bg-green-100 text-green-800'
                                    : groundData?.status === 'Under Maintenance'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                    {groundData?.status}
                                </span>
                            </div>

                            {/* Pricing Section */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                                    <h4 className="font-semibold text-foreground">Pricing Information</h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Hourly Rate */}
                                    <div>
                                        <Label className="block text-sm font-medium text-foreground mb-1">
                                            Standard Hourly Rate <RequiredSign />
                                        </Label>
                                        <div className="relative">
                                            <InputField errors={errors}>
                                                <Input
                                                    type="number"
                                                    step="50"
                                                    className={`py-4.5 pl-12 ${errors?.grounds?.[index]?.hourly_rate ? 'border-2 border-red-500' : ''}`}
                                                    placeholder="1000"
                                                    {...register(`grounds.${index}.hourly_rate`, {
                                                        required: 'Regular hourly rate is required',
                                                        min: {
                                                            value: 1,
                                                            message: "Regular hourly rate must be greater than 0"
                                                        }
                                                    })}
                                                />
                                            </InputField>
                                            <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">
                                                BDT
                                            </span>
                                        </div>
                                    </div>

                                    {/* Weekend Rate */}
                                    <div>
                                        <Label className="block text-sm font-medium text-foreground mb-1">
                                            Weekend Hourly Rate
                                        </Label>
                                        <div className="relative">
                                            <InputField errors={errors}>
                                                <Input
                                                    type="number"
                                                    step="50"
                                                    placeholder="1500"
                                                    className={`py-4.5 pl-12 ${errors?.grounds?.[index]?.weekend_hourly_rate ? 'border-2 border-red-500' : ''}`}
                                                    {...register(`grounds.${index}.weekend_hourly_rate`, {
                                                        required: 'Weekend hourly rate is required',
                                                        min: {
                                                            value: 1,
                                                            message: "Weekend hourly rate must be greater than 0"
                                                        }
                                                    })}
                                                />
                                            </InputField>
                                            <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">
                                                BDT
                                            </span>
                                        </div>
                                    </div>

                                    {/* Peak Hour Rate */}
                                    <div>
                                        <Label className="block text-sm font-medium text-foreground mb-1">
                                            Peak Hour Rate
                                        </Label>
                                        <div className="relative">
                                            <InputField errors={errors}>
                                                <Input
                                                    type="number"
                                                    step="50"
                                                    placeholder="2000"
                                                    className={`py-4.5 pl-12 ${errors?.grounds?.[index]?.peak_hour_rate ? 'border-2 border-red-500' : ''}`}
                                                    {...register(`grounds.${index}.peak_hour_rate`, {
                                                        required: 'Peak hourly rate is required',
                                                        min: {
                                                            value: 1,
                                                            message: "Peak hourly rate must be greater than 0"
                                                        }
                                                    })}
                                                />
                                            </InputField>
                                            <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">
                                                BDT
                                            </span>
                                        </div>
                                    </div>

                                    {/* Off-Peak Hour Rate */}
                                    <div>
                                        <Label className="block text-sm font-medium text-foreground mb-1">
                                            Off-Peak Hour Rate
                                        </Label>
                                        <div className="relative">
                                            <InputField errors={errors}>
                                                <Input
                                                    type="number"
                                                    step="50"
                                                    placeholder="800"
                                                    className={`py-4.5 pl-12 ${errors?.grounds?.[index]?.off_peak_hour_rate ? 'border-2 border-red-500' : ''}`}
                                                    {...register(`grounds.${index}.off_peak_hour_rate`, {
                                                        required: 'Off-peak hourly rate is required',
                                                        min: {
                                                            value: 1,
                                                            message: "Off-Peak hourly rate must be greater than 0"
                                                        }
                                                    })}
                                                />
                                            </InputField>
                                            <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">
                                                BDT
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Booking Hours */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <Label className="block text-sm font-medium text-foreground mb-1">
                                            Minimum Booking Hours <RequiredSign />
                                        </Label>
                                        <InputField errors={errors}>
                                            <Input
                                                type="number"
                                                step="0.5"
                                                placeholder="1"
                                                className={`${errors?.grounds?.[index]?.minimum_booking_hours ? 'border-2 border-red-500' : ''}`}
                                                {...register(`grounds.${index}.minimum_booking_hours`, {
                                                    required: "Minimum booking is required",
                                                    min: {
                                                        value: 0.5,
                                                        message: "Minimum booking hour must be atleast halt an hour"
                                                    }
                                                })}
                                            />
                                        </InputField>
                                    </div>

                                    <div>
                                        <Label className="block text-sm font-medium text-foreground mb-1">
                                            Maximum Booking Hours <RequiredSign/>
                                        </Label>
                                        <InputField errors={errors}>
                                            <Input
                                                type="number"
                                                step="0.5"
                                                placeholder="8"
                                                className={`${errors?.grounds?.[index]?.maximum_booking_hours ? 'border-2 border-red-500' : ''}`}
                                                {...register(`grounds.${index}.maximum_booking_hours`, {
                                                    validate: (value) => {
                                                        if (!value) return "Maximum booking hours is required";

                                                        const min = parseFloat(watch(`grounds.${index}.minimum_booking_hours`));
                                                        const max = parseFloat(value);

                                                        if (max < 0.5) {
                                                            return "Maximum booking hours must be at least 0.5 hours";
                                                        }

                                                        if (min && max < min) {
                                                            return "Maximum booking hours cannot be less than minimum booking hours";
                                                        }

                                                        return true;
                                                    },
                                                })}
                                            />
                                        </InputField>
                                    </div>
                                </div>
                            </div>

                            {/* Images Section */}
                            <div>
                                <h4 className="font-semibold text-foreground mb-4">Ground Images <RequiredSign/></h4>

                                {/* Upload Area */}
                                <div className="mb-4">
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(index, e)}
                                        className="hidden"
                                        id={`image-upload-${index}`}
                                    />
                                    <Label
                                        htmlFor={`image-upload-${index}`}
                                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                                    >
                                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                        <span className="text-sm text-muted-foreground">Click to upload images</span>
                                        <span className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 10MB</span>
                                    </Label>
                                </div>

                                <input
                                    type="hidden"
                                    {...register(`grounds.${index}.images`, {
                                        validate: (value) =>
                                            value && value.length > 0 || "At least one image is required"
                                    })}
                                />

                                {errors?.grounds?.[index]?.images && (
                                    <span className="text-red-500 text-sm">
                                        {errors.grounds[index].images.message}
                                    </span>
                                )}

                                {/* Image Preview Grid */}
                                {(watch(`grounds.${index}.images`) || []).length > 0 && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {(watch(`grounds.${index}.images`) || []).map((img, imgIdx) => (
                                            <div key={imgIdx} className="relative group">
                                                <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                                                    <img
                                                        src={img.preview || img}
                                                        alt={img.name || `Image ${imgIdx + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(index, imgIdx)}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {img.name || `Image ${imgIdx + 1}`}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {(watch(`grounds.${index}.images`) || []).length === 0 && (
                                    <div className="text-center py-4 text-muted-foreground text-sm">
                                        No images uploaded yet
                                    </div>
                                )}
                            </div>

                            {/* Dimensions Info (Read-only display) */}
                            <div className="pt-4 border-t border-border">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Length:</span>
                                        <span className="ml-2 font-medium">
                                            {groundData?.dimensions_length_m ? `${groundData.dimensions_length_m}m` : '-'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Width:</span>
                                        <span className="ml-2 font-medium">
                                            {groundData?.dimensions_width_m ? `${groundData.dimensions_width_m}m` : '-'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Capacity:</span>
                                        <span className="ml-2 font-medium">
                                            {groundData?.capacity_players ? `${groundData.capacity_players} players` : '-'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                <ButtonContainer
                    currentStep={step}
                    setStep={setStep}
                />

            </form>
        </div>
    );
}