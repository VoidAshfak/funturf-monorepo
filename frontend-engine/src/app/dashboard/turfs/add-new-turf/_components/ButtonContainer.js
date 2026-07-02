import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

/**
 * Wizard step footer: outlined "Previous" (hidden on step 1) + solid green
 * "Next" CTA. The Next button is type="submit" so each step's form validation
 * runs before advancing.
 */
export default function ButtonContainer({ currentStep, setStep }) {
    return (
        <div className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-6">
            {currentStep !== 1 ? (
                <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setStep((prev) => prev - 1)}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous
                </Button>
            ) : (
                <span />
            )}

            <Button type="submit" className="green-glow ml-auto rounded-full">
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
    );
}
