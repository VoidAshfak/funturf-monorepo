import InputField from "@/components/InputField";
import RequiredSign from "@/components/RequiredSign";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FACILITIES, SPORTS } from "@/utils/constants";
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

            <ButtonContainer
                currentStep={step}
                setStep={setStep}
            />
        </form>
    )
}