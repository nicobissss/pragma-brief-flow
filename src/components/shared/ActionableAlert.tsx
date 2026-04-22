import { AlertCircle, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AlertSeverity = "info" | "warning" | "error";

export function ActionableAlert({
  severity = "info",
  title,
  description,
  actionLabel,
  onAction,
}: {
  severity?: AlertSeverity;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = {
    info: "bg-primary/10 border-primary/20 text-foreground",
    warning: "bg-amber-500/10 border-amber-500/30 text-foreground",
    error: "bg-destructive/10 border-destructive/30 text-foreground",
  };
  const iconColor = {
    info: "text-primary",
    warning: "text-amber-600",
    error: "text-destructive",
  };
  const Icon = severity === "info" ? Info : severity === "warning" ? AlertTriangle : AlertCircle;

  return (
    <div className={cn("rounded-xl border px-4 py-3 flex items-start gap-3", styles[severity])}>
      <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", iconColor[severity])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" onClick={onAction} className="shrink-0">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
