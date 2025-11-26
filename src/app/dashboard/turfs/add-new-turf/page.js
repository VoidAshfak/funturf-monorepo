"use client"

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ProgressSteps from './_components/ProgressSteps';
import Step1BasicInfo from './_components/Step1BasicInfo';
import Step2VenueDetails from './_components/Step2VenueDetails';
import Step3PricingHours from './_components/Step3PricingHours';
import Step4Review from './_components/Step4Review';
import FormNavigation from './_components/FormNavigation';
import { FORM_STEPS, FIELDS_TO_VALIDATE } from '@/utils/constants';

export default function TurfCreationForm() {
    const [step, setStep] = useState(1);

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
        trigger
    } = useForm({
        mode: 'onChange',
        defaultValues: {
            sports: [],
            amenities: []
        }
    });

    const selectedSports = watch('sports') || [];
    const selectedAmenities = watch('amenities') || [];
    const formData = watch();

    const onSubmit = (data) => {
        console.log('Form submitted:', data);
        alert('Turf created successfully! Check console for data.');
    };

    const nextStep = async () => {
        const isValid = await trigger(FIELDS_TO_VALIDATE[step]);
        if (isValid) setStep(step + 1);
    };

    const prevStep = () => setStep(step - 1);

    const toggleSport = (sport) => {
        const current = selectedSports;
        const updated = current.includes(sport)
            ? current.filter(s => s !== sport)
            : [...current, sport];
        setValue('sports', updated);
    };

    const toggleAmenity = (amenity) => {
        const current = selectedAmenities;
        const updated = current.includes(amenity)
            ? current.filter(a => a !== amenity)
            : [...current, amenity];
        setValue('amenities', updated);
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <Step1BasicInfo
                        register={register}
                        errors={errors}
                    />
                );
            case 2:
                return (
                    <Step2VenueDetails
                        register={register}
                        errors={errors}
                        selectedSports={selectedSports}
                        selectedAmenities={selectedAmenities}
                        toggleSport={toggleSport}
                        toggleAmenity={toggleAmenity}
                        setValue={setValue}
                    />
                );
            case 3:
                return (
                    <Step3PricingHours
                        register={register}
                        errors={errors}
                    />
                );
            case 4:
                return (
                    <Step4Review
                        formData={formData}
                        selectedSports={selectedSports}
                        selectedAmenities={selectedAmenities}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">Create New Turf</h1>
                    <p className="text-gray-600">Add your sports venue to the platform</p>
                </div>

                <ProgressSteps currentStep={step} steps={FORM_STEPS} />

                <Card className="shadow-xl">
                    <CardHeader>
                        <CardTitle>Step {step} of 4</CardTitle>
                        <CardDescription>{FORM_STEPS[step - 1].title}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div>
                            {renderStep()}
                            <FormNavigation
                                currentStep={step}
                                totalSteps={4}
                                onPrevious={prevStep}
                                onNext={nextStep}
                                onSubmit={handleSubmit(onSubmit)}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}