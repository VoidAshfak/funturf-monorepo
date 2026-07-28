import Logo from "@/components/Logo";
import { cn } from "@/lib/utils";

function LoadingDots() {
    return (
        <span className="inline-flex gap-1">
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                />
            ))}
        </span>
    );
}

export default function FullPageLoader({ message, className }) {
    return (
        <div
            className={cn(
                "relative flex-col gap-8 w-full flex items-center justify-center min-h-dvh overflow-hidden",
                className
            )}
        >
            {/* soft animated gradient orbs */}
            <div className="pointer-events-none absolute -inset-40 opacity-30 dark:opacity-20">
                <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl animate-logo-breathe" />
                <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-400/20 blur-3xl animate-logo-breathe" style={{ animationDelay: "0.8s" }} />
            </div>

            {/* logo with spinning orbit ring */}
            <div className="relative flex items-center justify-center">
                <div className="absolute h-20 w-20 rounded-full border-2 border-transparent border-t-primary/30 border-r-primary/10 animate-spin" />
                <div className="absolute h-16 w-16 rounded-full border-2 border-transparent border-b-primary/20 border-l-primary/10 animate-spin" style={{ animationDirection: "reverse", animationDuration: "2s" }} />
                <div className="animate-logo-breathe relative">
                    <Logo height={44} priority />
                </div>
            </div>

            <div className="flex flex-col items-center gap-2">
                {message && (
                    <p className="animate-logo-fade text-sm text-muted-foreground">
                        {message}
                    </p>
                )}
                <LoadingDots />
            </div>
        </div>
    );
}
