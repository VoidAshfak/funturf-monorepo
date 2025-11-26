import InputField from '@/components/InputField';
import RequiredSign from '@/components/RequiredSign';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AMENITIES, GROUND_TYPES, groundData, SPORTS, STATUS_TYPES, SURFACE_TYPES } from '@/utils/constants';
import { Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import ButtonContainer from './ButtonContainer';

export default function StepThree({ formdata, setFormdata, step, setStep }) {
    const {
        register,
        control,
        handleSubmit,
        setValue,
        watch,
        formState: { errors }
    } = useForm({
        defaultValues: {
            ...formdata
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'grounds',
    });

    const submitHandler = (values) => {
        setFormdata(prev => ({ ...prev, ...values }));
        setStep(prev => prev + 1);
    };

    const addGround = () => {
        append(groundData);
    };

    const toggleAmenity = (groundIndex, amenity) => {
        const currentAmenities = watch(`grounds.${groundIndex}.amenities`) || [];
        const newAmenities = currentAmenities.includes(amenity)
            ? currentAmenities.filter((a) => a !== amenity)
            : [...currentAmenities, amenity];
        setValue(`grounds.${groundIndex}.amenities`, newAmenities);
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Grounds Management</h1>
                    <p className="text-gray-600 mt-2">Add and manage sports grounds</p>
                </div>

                <div className="space-y-6">
                    {fields.map((field, index) => (
                        <Card key={field.id}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle>Ground {fields.length > 1 && index + 1}</CardTitle>
                                        <CardDescription>Enter ground details</CardDescription>
                                    </div>
                                    {fields.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => remove(index)}
                                        >
                                            <Trash2 className="h-4 w-4 mr-1" />
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-6">
                                <form
                                    className="space-y-4"
                                    onSubmit={handleSubmit(submitHandler)}
                                >
                                    <div>
                                        <Label htmlFor={`grounds.${index}.name`}>Ground Name <RequiredSign /> </Label>
                                        <InputField errors={errors}>
                                            <Input
                                                id={`grounds.${index}.name`}
                                                className={`${errors?.grounds?.[index]?.name ? 'border-2 border-red-500' : ''}`}
                                                {...register(`grounds.${index}.name`, { required: 'Ground name is required' })}
                                                placeholder="e.g., Main Football Field"
                                            />
                                        </InputField>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor={`grounds.${index}.ground_type`}>Ground Type <RequiredSign /> </Label>
                                            <InputField errors={errors}>
                                                <Controller
                                                    name={`grounds.${index}.ground_type`}
                                                    control={control}
                                                    rules={{ required: "Select ground type" }}
                                                    render={({ field }) => (
                                                        <Select
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                        >
                                                            <SelectTrigger className={`w-full ${errors?.grounds?.[index]?.ground_type ? 'border-2 border-red-500' : ''}`}>
                                                                <SelectValue placeholder="Select ground type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {GROUND_TYPES.map((type) => (
                                                                    <SelectItem key={type} value={type}>
                                                                        {type}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                            </InputField>
                                        </div>

                                        <div>
                                            <Label htmlFor={`grounds.${index}.sport_type`}>Sport Type <RequiredSign /> </Label>
                                            <InputField errors={errors}>
                                                <Controller
                                                    name={`grounds.${index}.sport_type`}
                                                    control={control}
                                                    rules={{ required: "Select a sport" }}
                                                    render={({ field }) => (
                                                        <Select
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                        >
                                                            <SelectTrigger className={`w-full ${errors?.grounds?.[index]?.sport_type ? 'border-2 border-red-500' : ''}`}>
                                                                <SelectValue placeholder="Select sport type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {SPORTS.map((type) => (
                                                                    <SelectItem key={type} value={type}>
                                                                        {type}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                            </InputField>
                                        </div>

                                        <div>
                                            <Label htmlFor={`grounds.${index}.surface_type`}>Surface Type<RequiredSign /> </Label>
                                            <InputField errors={errors}>
                                                <Controller
                                                    name={`grounds.${index}.surface_type`}
                                                    control={control}
                                                    rules={{ required: 'Select a type' }}
                                                    render={({ field }) => (
                                                        <Select
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                        >
                                                            <SelectTrigger className={`w-full ${errors?.grounds?.[index]?.surface_type ? 'border-2 border-red-500' : ''}`}>
                                                                <SelectValue placeholder="Select surface type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {SURFACE_TYPES.map((type) => (
                                                                    <SelectItem key={type} value={type}>
                                                                        {type}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                            </InputField>
                                        </div>

                                        <div>
                                            <Label htmlFor={`grounds.${index}.capacity_players`}>Player Capacity</Label>
                                            <InputField errors={errors}>
                                                <Input
                                                    id={`grounds.${index}.capacity_players`}
                                                    type="number"
                                                    className={`${errors?.grounds?.[index]?.capacity_players ? 'border-2 border-red-500' : ''}`}
                                                    {...register(`grounds.${index}.capacity_players`, {
                                                        required: "Capacity is required",
                                                        min: {
                                                            value: 1,
                                                            message: "Capacity must be a positive number",
                                                        }
                                                    })}
                                                    placeholder="22"
                                                />
                                            </InputField>
                                        </div>

                                        <div>
                                            <Label htmlFor={`grounds.${index}.dimensions_length_m`}>Length (m)</Label>
                                            <InputField errors={errors}>
                                                <Input
                                                    id={`grounds.${index}.dimensions_length_m`}
                                                    type="number"
                                                    // step="10"
                                                    className={`${errors?.grounds?.[index]?.dimensions_length_m ? 'border-2 border-red-500' : ''}`}
                                                    {...register(`grounds.${index}.dimensions_length_m`, {
                                                        min: {
                                                            value: 1,
                                                            message: "Ground length must be a positive number",
                                                        }
                                                    })}
                                                    placeholder="100"
                                                />
                                            </InputField>
                                        </div>

                                        <div>
                                            <Label htmlFor={`grounds.${index}.dimensions_width_m`}>Length (m)</Label>
                                            <InputField errors={errors}>
                                                <Input
                                                    id={`grounds.${index}.dimensions_width_m`}
                                                    type="number"
                                                    className={`${errors?.grounds?.[index]?.dimensions_width_m ? 'border-2 border-red-500' : ''}`}
                                                    {...register(`grounds.${index}.dimensions_width_m`, {
                                                        min: {
                                                            value: 1,
                                                            message: "Ground width must be a positive number",
                                                        }
                                                    })}
                                                    placeholder="100"
                                                />
                                            </InputField>
                                        </div>

                                        <div>
                                            <Label htmlFor={`grounds.${index}.minimum_booking_hours`}>Min Booking Hours</Label>
                                            <InputField errors={errors}>
                                                <Input
                                                    id={`grounds.${index}.minimum_booking_hours`}
                                                    type="number"
                                                    step="0.5"
                                                    className={`${errors?.grounds?.[index]?.minimum_booking_hours ? 'border-2 border-red-500' : ''}`}
                                                    {...register(`grounds.${index}.minimum_booking_hours`, {
                                                        min: {
                                                            value: 0.5,
                                                            message: "Minimum booking must be atleast half an hour",
                                                        }
                                                    })}
                                                    placeholder="1"
                                                />
                                            </InputField>
                                        </div>

                                        <div>
                                            <Label htmlFor={`grounds.${index}.maximum_booking_hours`}>Max Booking Hours</Label>
                                            <InputField errors={errors}>
                                                <Input
                                                    id={`grounds.${index}.maximum_booking_hours`}
                                                    type="number"
                                                    step="0.5"
                                                    placeholder="8"
                                                    className={`${errors?.grounds?.[index]?.maximum_booking_hours ? 'border-2 border-red-500' : ''}`}
                                                    {...register(`grounds.${index}.maximum_booking_hours`, {
                                                        validate: (value) => {
                                                            const minValue = watch(`grounds.${index}.minimum_booking_hours`);

                                                            const min = parseFloat(minValue);
                                                            const max = parseFloat(value);

                                                            if (value && max < 0) {
                                                                return "Maximum booking hours cannot be negative";
                                                            }

                                                            if (!minValue) return true;

                                                            if (max < min) {
                                                                return "Maximum hours cannot be less than minimum hours";
                                                            }

                                                            return true;
                                                        },
                                                    })}
                                                />

                                            </InputField>
                                        </div>

                                        <div>
                                            <Label htmlFor={`grounds.${index}.status`}>Status <RequiredSign /> </Label>
                                            <InputField errors={errors}>
                                                <Controller
                                                    name={`grounds.${index}.status`}
                                                    control={control}
                                                    rules={{ required: 'Select a status' }}
                                                    render={({ field }) => (
                                                        <Select
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                        >
                                                            <SelectTrigger className={`w-full ${errors?.grounds?.[index]?.status ? 'border-2 border-red-500' : ''}`}>
                                                                <SelectValue placeholder="Select status" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {STATUS_TYPES.map((type) => (
                                                                    <SelectItem key={type} value={type}>
                                                                        {type}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                            </InputField>
                                        </div>
                                    </div>

                                    <div>
                                        <Label>Amenities</Label>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {AMENITIES.map((amenity) => (
                                                <Badge
                                                    key={amenity}
                                                    variant={
                                                        (watch(`grounds.${index}.amenities`) || []).includes(amenity)
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    className="cursor-pointer"
                                                    onClick={() => toggleAmenity(index, amenity)}
                                                >
                                                    {amenity}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor={`grounds.${index}.notes`}>Notes</Label>
                                        <InputField errors={errors}>
                                            <Textarea
                                                id={`grounds.${index}.notes`}
                                                {...register(`grounds.${index}.notes`)}
                                                placeholder="Additional information about the ground..."
                                                rows={3}
                                            />
                                        </InputField>
                                    </div>

                                    {index === fields.length - 1 && (
                                        <>
                                            <Button type="button" variant="outline" onClick={addGround} className="w-full flex-1">
                                                <Plus className="h-4 w-4 mr-2" />
                                                Add Another Ground
                                            </Button>

                                            <ButtonContainer
                                                currentStep={step}
                                                setStep={setStep}
                                            />
                                        </>
                                    )}
                                </form>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}