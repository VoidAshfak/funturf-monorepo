import React from 'react';
import { Button } from '@/components/ui/button';

export default function FormNavigation({
    currentStep,
    totalSteps,
    onPrevious,
    onNext,
    onSubmit
}) {
    return (
        <div className="flex justify-between mt-8">
            {currentStep > 1 && (
                <Button variant="outline" onClick={onPrevious}>
                    Previous
                </Button>
            )}
            {currentStep < totalSteps ? (
                <Button
                    onClick={onNext}
                    className="ml-auto bg-green-600 hover:bg-green-700"
                >
                    Next
                </Button>
            ) : (
                <Button
                    onClick={onSubmit}
                    className="ml-auto bg-green-600 hover:bg-green-700"
                >
                    Create Turf
                </Button>
            )}
        </div>
    );
}