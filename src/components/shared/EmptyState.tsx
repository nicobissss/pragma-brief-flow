import { Button } from "@/components/ui/button";

export function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  ctaAction,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaAction?: () => void;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border p-10 text-center space-y-4 max-w-md mx-auto">
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground [&>svg]:w-7 [&>svg]:h-7">
          {icon}
        </div>
      )}
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {ctaLabel && ctaAction && (
        <Button onClick={ctaAction} variant="outline">
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
