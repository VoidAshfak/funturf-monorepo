"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useGSAP } from "@gsap/react";
import { gsap, MOTION } from "@/lib/animations";
import { FORM_STEPS, venuedata } from "@/utils/constants";
import ProgressSteps from "./ProgressSteps";
import StepOne from "./StepOne";
import StepTwo from "./StepTwo";
import StepThree from "./StepThree";
import StepFour from "./StepFour";
import StepFive from "./StepFive";

/**
 * The Create-New-Turf journey — a single self-contained client component shared
 * by both the dashboard route and the owner onboarding route. (Kept as a real
 * component, NOT imported as a route page, which previously caused a hydration
 * mismatch on /onboarding/turf.)
 *
 * @param {string} redirectTo - where StepFive navigates after a successful create
 * @param {string} heading / subheading - contextual copy (dashboard vs onboarding)
 */
export default function TurfWizard({
    redirectTo = "/dashboard/turfs",
    heading = "Create New Turf",
    subheading = "List your venue and grounds so players can discover and book them.",
}) {
    const { data: session } = useSession();
    const user = session?.user;

    const [step, setStep] = useState(1);
    const [formdata, setFormdata] = useState({ ...venuedata });

    const stepRef = useRef(null);

    // Stamp the owner id once the session is available.
    useEffect(() => {
        if (user?.id) {
            setFormdata((prev) => ({ ...prev, admin_user_id: user.id }));
        }
    }, [user]);

    // Subtle fade/lift as each step mounts. Runs after hydration, so no SSR
    // mismatch; skipped when the user prefers reduced motion.
    useGSAP(
        () => {
            if (typeof window !== "undefined" &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                return;
            }
            if (!stepRef.current) return;
            gsap.from(stepRef.current, {
                y: MOTION.yLift,
                opacity: 0,
                duration: MOTION.duration.base,
                ease: MOTION.ease.out,
            });
        },
        { dependencies: [step], scope: stepRef }
    );

    const stepProps = { formdata, setFormdata, step, setStep };

    const renderStep = () => {
        switch (step) {
            case 1:
                return <StepOne {...stepProps} />;
            case 2:
                return <StepTwo {...stepProps} />;
            case 3:
                return <StepThree {...stepProps} />;
            case 4:
                return <StepFour {...stepProps} />;
            case 5:
                return <StepFive formdata={formdata} setStep={setStep} redirectTo={redirectTo} />;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-background px-4 py-10 md:px-8 md:py-16">
            <div className="mx-auto max-w-4xl">
                {/* Header */}
                <div className="mb-8 text-center">
                    <span className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                        Step {step} of {FORM_STEPS.length}
                    </span>
                    <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
                        {heading}
                    </h1>
                    <p className="mx-auto mt-2 max-w-lg text-muted-foreground">{subheading}</p>
                </div>

                <ProgressSteps currentStep={step} steps={FORM_STEPS} />

                {/* Active step */}
                <div className="glass-card mt-8 rounded-3xl p-6 md:p-8">
                    <h2 className="mb-6 text-xl font-bold text-foreground">
                        {FORM_STEPS[step - 1].title}
                    </h2>
                    <div ref={stepRef}>{renderStep()}</div>
                </div>
            </div>
        </div>
    );
}
