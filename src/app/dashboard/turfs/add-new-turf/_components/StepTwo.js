import InputField from "@/components/InputField";
import RequiredSign from "@/components/RequiredSign";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FACILITIES, SPORTS } from "@/utils/constants";
import { Upload, X } from "lucide-react";
import { useForm } from "react-hook-form";
import ButtonContainer from "./ButtonContainer";

export default function StepTwo({ formdata, setFormdata, step, setStep }) {

    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
        setValue
    } = useForm({
        defaultValues: { ...formdata }
    });

    const selectedSports = watch('sports_available') || [];
    const selectedAmenities = watch('facilities') || [];
    const inputImage = watch('images');

    const submitHandler = (values) => {
        setFormdata(prev => ({ ...prev, ...values }));
        setStep(prev => prev + 1);
    };

    const toggleSport = (sport) => {
        const current = selectedSports;
        const updated = current.includes(sport)
            ? current.filter(s => s !== sport)
            : [...current, sport];
        setValue('sports_available', updated);
    };

    const toggleAmenity = (amenity) => {
        const current = selectedAmenities;
        const updated = current.includes(amenity)
            ? current.filter(a => a !== amenity)
            : [...current, amenity];
        setValue('facilities', updated);
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const imageObj = {
            file,
            preview: URL.createObjectURL(file),
            name: file.name,
        };

        setValue("images", imageObj);
    };

    return (
        <form
            className="space-y-4"
            onSubmit={handleSubmit(submitHandler)}
        >

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="openingTime">Opening Time <RequiredSign /> </Label>
                    <InputField errors={errors}>
                        <Input
                            id="openingTime"
                            type="time"
                            className={`${errors?.operating_hours?.opening_time ? 'border-2 border-red-500' : ''}`}
                            {...register('operating_hours.opening_time', { required: 'Opening time is required' })}
                        />
                    </InputField>
                </div>
                <div>
                    <Label htmlFor="closingTime">Closing Time <RequiredSign /> </Label>
                    <InputField errors={errors}>
                        <Input
                            id="closingTime"
                            type="time"
                            className={`${errors?.operating_hours?.closing_time ? 'border-2 border-red-500' : ''}`}
                            {...register('operating_hours.closing_time', { required: 'Closing time is required' })}
                        />
                    </InputField>
                </div>
            </div>

            <div>
                <Label>Sports Available *</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                    {SPORTS.map(sport => (
                        <div
                            key={sport}
                            onClick={() => toggleSport(sport)}
                            className={`cursor-pointer p-3 rounded-lg border-2 text-center transition-all ${selectedSports.includes(sport)
                                ? 'border-green-600 bg-green-50 text-green-700'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            {sport}
                        </div>
                    ))}
                </div>
                <input
                    type="hidden"
                    {...register('sports_available', {
                        validate: v => v.length > 0 || 'Select at least one sport'
                    })}
                />
                {errors.sports_available && (
                    <span className="text-red-500 text-sm">{errors.sports_available.message}</span>
                )}
            </div>

            <div>
                <Label>facilities</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                    {FACILITIES.map(amenity => (
                        <div key={amenity} className="flex items-center space-x-2">
                            <Checkbox
                                id={amenity}
                                checked={selectedAmenities.includes(amenity)}
                                onCheckedChange={() => toggleAmenity(amenity)}
                            />
                            <label htmlFor={amenity} className="text-sm cursor-pointer">
                                {amenity}
                            </label>
                        </div>
                    ))}
                </div>
                <input type="hidden" {...register('facilities')} />
            </div>

            <div>
                <Label htmlFor="advanceBookingDays">Advance Booking (days)</Label>
                <InputField errors={errors}>
                    <Input
                        id="advanceBookingDays"
                        type="number"
                        placeholder="7"
                        {...register('advance_booking_days', {
                            min: { value: 1, message: 'Min 1 day' }
                        })}
                    />
                </InputField>
            </div>

            <div>
                <Label htmlFor="cancellation_policy">Cancellation Policy</Label>
                <InputField errors={errors}>
                    <Textarea
                        id="cancellation_policy"
                        placeholder="e.g., Free cancellation up to 24 hours before booking time..."
                        rows={3}
                        {...register('cancellation_policy')}
                    />
                </InputField>
            </div>

            <div>
                <Label htmlFor="rules_and_regulations">Rules & Regulations</Label>
                <InputField errors={errors}>
                    <Textarea
                        id="rules_and_regulations"
                        placeholder="e.g., No outside food, proper sports attire required..."
                        rows={3}
                        {...register('rules_and_regulations')}
                    />
                </InputField>
            </div>

            <div>
                <h4 className="font-semibold text-gray-900 mb-4">Venue Image</h4>

                <div className="mb-4">
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e)}
                        className="hidden"
                        id={`image-upload`}
                    />
                    <Label
                        htmlFor={`image-upload`}
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-600">Click to upload images</span>
                        <span className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP up to 10MB</span>
                    </Label>
                </div>

                {inputImage ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="relative group">
                            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                                <img
                                    src={inputImage.preview || inputImage}
                                    alt={inputImage.name || "Image"}
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            <Button
                                type="button"
                                onClick={() => setValue("images", null)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                            >
                                <X className="h-4 w-4" />
                            </Button>

                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                {inputImage.name}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                        No image uploaded yet
                    </div>
                )}

            </div>

            <ButtonContainer
                currentStep={step}
                setStep={setStep}
            />
        </form>
    )
}