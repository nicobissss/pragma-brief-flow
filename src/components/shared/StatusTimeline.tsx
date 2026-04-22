import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type TimelineStep = {
  label: string;
  status: "done" | "current" | "todo";
};

export function StatusTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="w-full flex items-center">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const nextDone = !isLast && steps[i + 1].status !== "todo" && step.status === "done";
        return (
          <div key={step.label} className="flex-1 flex items-center">
            <div className="flex flex-col items-center gap-2 min-w-0">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                  step.status === "done" && "bg-[hsl(142,71%,35%)] text-white",
                  step.status === "current" &&
                    "bg-primary text-primary-foreground ring-4 ring-primary/20 animate-pulse",
                  step.status === "todo" && "bg-muted text-muted-foreground border border-border",
                )}
              >
                {step.status === "done" ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[11px] text-center leading-tight max-w-[80px] truncate",
                  step.status === "todo" ? "text-muted-foreground" : "text-foreground font-medium",
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 -mt-6 transition-colors",
                  nextDone || steps[i + 1].status === "current"
                    ? "bg-[hsl(142,71%,35%)]"
                    : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
