import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function ProgressIndicator({
  value,
  label,
  sublabel,
  size = "md",
  tone = "primary",
}: {
  value: number; // 0-1
  label?: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg";
  tone?: "primary" | "success" | "warning";
}) {
  const pct = Math.round(value * 100);
  const heightClass = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";
  const toneClass =
    tone === "success"
      ? "[&>div]:bg-[hsl(142,71%,35%)]"
      : tone === "warning"
        ? "[&>div]:bg-amber-500"
        : "[&>div]:bg-primary";

  return (
    <div className="w-full">
      {(label || sublabel) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-sm text-muted-foreground">{label}</span>}
          {sublabel && <span className="text-sm font-medium text-foreground">{sublabel}</span>}
        </div>
      )}
      <Progress value={pct} className={cn(heightClass, toneClass)} />
    </div>
  );
}
