import { Badge } from "@/components/ui/badge";
import { Bot, Loader2 } from "lucide-react";
import { useAIAgentStatus } from "@/hooks/useAIAgentStatus";
import { Link } from "react-router-dom";

type Props = {
  agentKey: string;
  clientId?: string | null;
  label?: string;
  /** Show a small explanatory line next to the badge */
  verbose?: boolean;
  /** Show link to settings */
  showSettingsLink?: boolean;
};

export function AIAgentBadge({
  agentKey,
  clientId,
  label,
  verbose = false,
  showSettingsLink = false,
}: Props) {
  const { enabled, loading, source } = useAIAgentStatus(agentKey, clientId);
  const displayLabel = label || agentKey;

  if (loading) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 font-normal">
        <Loader2 className="w-3 h-3 animate-spin" />
        {displayLabel}
      </Badge>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap text-xs">
      <Badge
        variant="outline"
        className={`text-[10px] gap-1 font-normal ${
          enabled
            ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"
            : "border-border text-muted-foreground"
        }`}
      >
        <Bot className="w-3 h-3" />
        {displayLabel}: {enabled ? "ON" : "OFF"}
        {source === "override" && (
          <span className="ml-1 text-[9px] opacity-70">(cliente)</span>
        )}
      </Badge>
      {verbose && !enabled && (
        <span className="text-muted-foreground">
          no se ejecutará automáticamente
        </span>
      )}
      {showSettingsLink && (
        <Link
          to="/admin/settings"
          className="text-[10px] text-primary hover:underline"
        >
          configurar
        </Link>
      )}
    </span>
  );
}
