import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, FileText, Upload, MessageSquare, Sparkles, Clock } from "lucide-react";

export type ActivityItem = {
  id: string;
  type: "approved" | "generated" | "uploaded" | "comment" | "created" | "other";
  description: string;
  timestamp: string | Date;
  actor?: string;
};

const TYPE_ICON: Record<ActivityItem["type"], { icon: React.ComponentType<any>; color: string }> = {
  approved: { icon: CheckCircle2, color: "text-[hsl(142,71%,35%)]" },
  generated: { icon: Sparkles, color: "text-primary" },
  uploaded: { icon: Upload, color: "text-blue-600" },
  comment: { icon: MessageSquare, color: "text-amber-600" },
  created: { icon: FileText, color: "text-muted-foreground" },
  other: { icon: Clock, color: "text-muted-foreground" },
};

export function ActivityFeed({ activities, emptyLabel = "No hay actividad reciente" }: { activities: ActivityItem[]; emptyLabel?: string }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground italic">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-3">
      {activities.map((a) => {
        const { icon: Icon, color } = TYPE_ICON[a.type] || TYPE_ICON.other;
        const ts = typeof a.timestamp === "string" ? new Date(a.timestamp) : a.timestamp;
        return (
          <li key={a.id} className="flex items-start gap-3">
            <div className={`w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-snug">{a.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(ts, { addSuffix: true })}
                {a.actor && ` · ${a.actor}`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
