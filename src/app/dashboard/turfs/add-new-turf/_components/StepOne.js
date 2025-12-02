import InputField from "@/components/InputField";
import RequiredSign from "@/components/RequiredSign";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form"
import ButtonContainer from "./ButtonContainer";

export default function StepOne({ formdata, setFormdata, step, setStep }) {

    const {
        register,
        handleSubmit,
        formState: { errors },
        watch
    } = useForm({
        defaultValues: { ...formdata }
    });

    const submitHandler = (values) => {
        setFormdata(prev => ({ ...prev, ...values }));
        setStep(prev => prev + 1);
    };

    return (
        <form
            className="space-y-4"
            onSubmit={handleSubmit(submitHandler)}
        >
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="venueName">Venue Name <RequiredSign /></Label>
                <InputField errors={errors}>
                    <Input
                        id="venueName"
                        placeholder="e.g., Green Valley Sports Arena"
                        className={`${errors?.name ? 'border-2 border-red-500' : ''}`}
                        {...register('name', { required: 'Venue name is required' })}
                    />
                </InputField>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <InputField errors={errors}>
                    <Textarea
                        id="description"
                        placeholder="Describe your venue, facilities, and any special features..."
                        rows={4}
                        {...register('description')}
                    />
                </InputField>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="city">City <RequiredSign /></Label>
                    <InputField errors={errors}>
                        <Input
                            id="city"
                            placeholder="City"
                            className={`${errors?.address_line_1?.city ? 'border-2 border-red-500' : ''}`}
                            {...register('address_line_1.city', { required: 'City is required' })}
                        />
                    </InputField>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="state">State <RequiredSign /></Label>
                    <InputField errors={errors}>
                        <Input
                            id="state"
                            placeholder="State"
                            className={`${errors?.address_line_1?.state ? 'border-2 border-red-500' : ''}`}
                            {...register('address_line_1.state', { required: 'State is required' })}
                        />
                    </InputField>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="postalCode">Postal Code <RequiredSign /></Label>
                    <InputField errors={errors}>
                        <Input
                            id="postalCode"
                            placeholder="Postal Code"
                            className={`${errors?.address_line_1?.postal_code ? 'border-2 border-red-500' : ''}`}
                            {...register('address_line_1.postal_code', { required: 'Postal code is required' })}
                        />
                    </InputField>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="country">Country <RequiredSign /></Label>
                    <InputField errors={errors}>
                        <Input
                            id="country"
                            placeholder="State"
                            className={`${errors?.address_line_1?.country ? 'border-2 border-red-500' : ''}`}
                            {...register('address_line_1.country', { required: 'Country is required' })}
                        />
                    </InputField>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="latitude">Latitude </Label>
                    <InputField errors={errors}>
                        <Input
                            id="latitude"
                            placeholder="Latitude"
                            {...register('address_line_1.latitude')}
                        />
                    </InputField>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="longitude">Longitude </Label>
                    <InputField errors={errors}>
                        <Input
                            id="longitude"
                            placeholder="Longitude"
                            {...register('address_line_1.longitude')}
                        />
                    </InputField>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="address_line_2">Secondary Address <RequiredSign /> </Label>
                <InputField errors={errors}>
                    <Textarea
                        id="address_line_2"
                        placeholder="Beside uttara boro miyar bari"
                        className={`${errors?.address_line_2 ? 'border-2 border-red-500' : ''}`}
                        {...register('address_line_2', {
                            required: 'Secondary address is required'
                        })}
                    />
                </InputField>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="phone">Contact Phone <RequiredSign /></Label>
                    <InputField errors={errors}>
                        <Input
                            id="phone"
                            placeholder="+88 01234 112233"
                            className={`${errors?.phone ? 'border-2 border-red-500' : ''}`}
                            {...register('phone', {
                                required: 'Phone is required',
                                pattern: { value: /^[+]?[\d\s-()]+$/, message: 'Invalid phone' }
                            })}
                        />
                    </InputField>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Email <RequiredSign /> </Label>
                    <InputField errors={errors}>
                        <Input
                            id="email"
                            type="email"
                            placeholder="venue@example.com"
                            className={`${errors?.email ? 'border-2 border-red-500' : ''}`}
                            {...register('email', {
                                required: 'Email is required',
                                pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' }
                            })}
                        />
                    </InputField>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="website_url">Website URL </Label>
                    <InputField errors={errors}>
                        <Input
                            id="website_url"
                            placeholder="www.helloworld.com"
                            {...register('website_url')}
                        />
                    </InputField>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="establishment_year">Establishment Year</Label>
                    <InputField errors={errors}>
                        <Input
                            id="establishment_year"
                            placeholder="2020"
                            {...register('establishment_year')}
                        />
                    </InputField>
                </div>
            </div>

            <ButtonContainer
                currentStep={step}
                setStep={setStep}
            />

        </form>
    )
}