import { ArrowRight, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NextActionVariant = "primary" | "warning" | "success";

export function NextActionCard({
  title,
  description,
  ctaLabel,
  onCta,
  variant = "primary",
  icon,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
  variant?: NextActionVariant;
  icon?: React.ReactNode;
}) {
  const variantStyles = {
    primary: "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20",
    warning: "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/30",
    success: "bg-gradient-to-br from-[hsl(142,71%,35%)]/10 to-[hsl(142,71%,35%)]/5 border-[hsl(142,71%,35%)]/30",
  };

  const iconBg = {
    primary: "bg-primary/15 text-primary",
    warning: "bg-amber-500/15 text-amber-700",
    success: "bg-[hsl(142,71%,35%)]/15 text-[hsl(142,71%,35%)]",
  };

  const defaultIcon = {
    primary: <Sparkles className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    success: <CheckCircle2 className="w-5 h-5" />,
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-6 flex flex-col gap-4 h-full transition-all hover:shadow-md",
        variantStyles[variant],
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", iconBg[variant])}>
          {icon || defaultIcon[variant]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground leading-tight">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
      <Button onClick={onCta} className="self-start mt-auto">
        {ctaLabel}
        <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}
