export default function ProgressSteps({ currentStep, steps }) {
    return (
        <div className="flex justify-between mb-8">
            {steps.map((s, idx) => {
                const Icon = s.icon;
                return (
                    <div key={s.number} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${currentStep >= s.number
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'bg-card border-border text-muted-foreground'
                                }`}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <span className={`text-xs mt-2 font-medium ${currentStep >= s.number ? 'text-primary' : 'text-muted-foreground'
                                }`}>
                                {s.title}
                            </span>
                        </div>
                        {idx < steps.length - 1 && (
                            <div className={`h-1 flex-1 mx-2 rounded transition-all ${currentStep > s.number ? 'bg-primary' : 'bg-border'
                                }`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}