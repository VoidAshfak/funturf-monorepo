import { Check } from "lucide-react";

/**
 * Wizard stepper. Glass rail with three circle states:
 *  - completed  -> solid green + check
 *  - active     -> green tint + glow ring
 *  - upcoming   -> muted outline
 * Connector between steps fills green once the step is completed.
 * Labels hide on mobile (circles + connectors remain).
 */
export default function ProgressSteps({ currentStep, steps }) {
    return (
        <div className="glass-card rounded-2xl px-4 py-5 md:px-6">
            <div className="flex items-center">
                {steps.map((s, idx) => {
                    const Icon = s.icon;
                    const isCompleted = currentStep > s.number;
                    const isActive = currentStep === s.number;
                    return (
                        <div key={s.number} className="flex flex-1 items-center last:flex-none">
                            <div className="flex flex-col items-center gap-2">
                                <div
                                    className={`grid h-11 w-11 place-items-center rounded-full border-2 transition-all duration-300 ${
                                        isCompleted
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : isActive
                                                ? "border-primary bg-primary/15 text-primary shadow-[0_0_20px_rgba(29,185,84,0.35)]"
                                                : "border-border bg-card text-muted-foreground"
                                    }`}
                                >
                                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                                </div>
                                <span
                                    className={`hidden text-xs font-medium sm:block ${
                                        isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
                                    }`}
                                >
                                    {s.title}
                                </span>
                            </div>

                            {idx < steps.length - 1 && (
                                <div className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                                    <div
                                        className={`h-full rounded-full bg-primary transition-all duration-500 ${
                                            isCompleted ? "w-full" : "w-0"
                                        }`}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
