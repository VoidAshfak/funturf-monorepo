"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FORM_STEPS, venuedata } from "@/utils/constants";
import { useEffect, useState } from "react";
import ProgressSteps from "./_components/ProgressSteps";
import StepFour from './_components/StepFour';
import StepOne from './_components/StepOne';
import StepThree from './_components/StepThree';
import StepTwo from './_components/StepTwo';
import StepFive from './_components/StepFive';
import { useSession } from 'next-auth/react';

export default function TurfCreationForm() {

    const { data: session } = useSession();
    const user = session?.user;

    const [step, setStep] = useState(1);
    const [formdata, setFormdata] = useState({
        ...venuedata,
    });

    useEffect(() => {
        if (user?.id) {
            setFormdata((prev) => ({
                ...prev,
                admin_user_id: user.id,
            }));
        }
    }, [user]);

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <StepOne
                        formdata={formdata}
                        setFormdata={setFormdata}
                        step={step}
                        setStep={setStep}
                    />
                );
            case 2:
                return (
                    <StepTwo
                        formdata={formdata}
                        setFormdata={setFormdata}
                        step={step}
                        setStep={setStep}
                    />
                );
            case 3:
                return (
                    <StepThree
                        formdata={formdata}
                        setFormdata={setFormdata}
                        step={step}
                        setStep={setStep}
                    />
                );
            case 4:
                return (
                    <StepFour
                        formdata={formdata}
                        setFormdata={setFormdata}
                        step={step}
                        setStep={setStep}
                    />
                );
            case 5:
                return (
                    <StepFive
                        formdata={formdata}
                        setStep={setStep}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-foreground mb-2">Create New Turf</h1>
                    <p className="text-muted-foreground">Add your sports venue to the platform</p>
                </div>

                <ProgressSteps currentStep={step} steps={FORM_STEPS} />

                <Card className="shadow-xl">
                    <CardHeader>
                        <CardTitle>Step {step} of {FORM_STEPS.length}</CardTitle>
                        <CardDescription>{FORM_STEPS[step - 1].title}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div>
                            {renderStep()}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}