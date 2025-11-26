import { Button } from "@/components/ui/button";

export default function ButtonContainer({ currentStep, setStep }) {
    return (
        <div className="flex justify-between">
            {currentStep !== 1 &&
                <Button
                    type="button"
                    onClick={() => setStep(prev => prev - 1)}
                >Previous</Button>
            }

            <Button
                type="submit"
                className='ml-auto'
            >Next</Button>
        </div>
    )
}