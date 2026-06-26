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
import MultiSelect from '@/components/MultiSelect';

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
        <div className="min-h-screen bg-background py-8 px-4">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground">Grounds Management</h1>
                    <p className="text-muted-foreground mt-2">Add and manage sports grounds</p>
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
                                    <div className="flex flex-col gap-1.5">
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
                                        <div className="flex flex-col gap-1.5">
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

                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`grounds.${index}.sport_type`}>Sport Type <RequiredSign /> </Label>
                                            <InputField errors={errors}>
                                                <Controller
                                                    name={`grounds.${index}.sport_type`}
                                                    control={control}
                                                    rules={{ required: "Select a sport" }}
                                                    render={({ field }) => (
                                                        <MultiSelect
                                                            options={SPORTS.map(type => ({ label: type, value: type }))}
                                                            values={SPORTS
                                                                .map(type => ({ label: type, value: type }))
                                                                .filter(opt => field.value?.includes(opt.value)
                                                                )}
                                                            onChange={(selectedItems) => {
                                                                const values = selectedItems.map(item => item.value);
                                                                field.onChange(values);
                                                            }}
                                                            placeholder="Select sport type"
                                                        />
                                                    )}
                                                />
                                            </InputField>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
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

                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`grounds.${index}.capacity_players`}>Player Capacity <RequiredSign /> </Label>
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

                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`grounds.${index}.dimensions_length_m`}>Length (m) <RequiredSign /></Label>
                                            <InputField errors={errors}>
                                                <Input
                                                    id={`grounds.${index}.dimensions_length_m`}
                                                    type="number"
                                                    // step="10"
                                                    className={`${errors?.grounds?.[index]?.dimensions_length_m ? 'border-2 border-red-500' : ''}`}
                                                    {...register(`grounds.${index}.dimensions_length_m`, {
                                                        required: "Length is required",
                                                        min: {
                                                            value: 1,
                                                            message: "Ground length must be a positive number",
                                                        }
                                                    })}
                                                    placeholder="100"
                                                />
                                            </InputField>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`grounds.${index}.dimensions_width_m`}>Width (m) <RequiredSign /></Label>
                                            <InputField errors={errors}>
                                                <Input
                                                    id={`grounds.${index}.dimensions_width_m`}
                                                    type="number"
                                                    className={`${errors?.grounds?.[index]?.dimensions_width_m ? 'border-2 border-red-500' : ''}`}
                                                    {...register(`grounds.${index}.dimensions_width_m`, {
                                                        required: "Width is required",
                                                        min: {
                                                            value: 1,
                                                            message: "Ground width must be a positive number",
                                                        }
                                                    })}
                                                    placeholder="100"
                                                />
                                            </InputField>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
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
                                        <Label>Amenities <RequiredSign /></Label>
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
                                        <input
                                            type="hidden"
                                            {...register(`grounds.${index}.amenities`, {
                                                validate: (value) =>
                                                    value && value.length > 0 || "Select at least one amenity"
                                            })}
                                        />

                                        {errors?.grounds?.[index]?.amenities && (
                                            <span className="text-red-500 text-sm">
                                                {errors.grounds[index].amenities.message}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-1.5">
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