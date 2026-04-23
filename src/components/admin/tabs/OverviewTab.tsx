import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusTimeline, type TimelineStep } from "@/components/shared/StatusTimeline";
import { NextActionCard } from "@/components/shared/NextActionCard";
import { ActivityFeed, type ActivityItem } from "@/components/shared/ActivityFeed";
import { ProgressIndicator } from "@/components/shared/ProgressIndicator";
import { deriveNextAction } from "@/hooks/useNextAction";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import ProspectInfoTable from "@/components/admin/ProspectInfoTable";

type Props = {
  client: any;
  kickoff: any | null;
  hasOffering: boolean;
  contextScorePct: number;
  assets: any[];
  prospect?: any | null;
  marketLabel?: string;
  onNavigateTab: (tab: string) => void;
};

export default function OverviewTab({ client, kickoff, hasOffering, contextScorePct, assets, prospect, marketLabel, onNavigateTab }: Props) {
  const [offering, setOffering] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [offRes, platRes, activityRes] = await Promise.all([
        supabase
          .from("client_offerings")
          .select("*, offering_templates(name, short_name, monthly_fee_eur, one_shot_fee_eur)")
          .eq("client_id", client.id)
          .order("proposed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("client_platforms").select("id, integration_status").eq("client_id", client.id),
        supabase.from("activity_log").select("*").eq("entity_id", client.id).order("created_at", { ascending: false }).limit(5),
      ]);
      if (cancelled) return;

      setPlatforms(platRes.data || []);
      const off = offRes.data;
      setOffering(off);

      if (off?.id) {
        const { data: t } = await supabase
          .from("action_plan_tasks")
          .select("id, title, status, category, assignee, order_index, blocked_reason")
          .eq("client_offering_id", off.id)
          .order("order_index");
        if (!cancelled) setTasks(t || []);
      } else {
        setTasks([]);
      }

      // Build activity feed
      const acts: ActivityItem[] = [];
      (activityRes.data || []).forEach((a: any) => {
        const lower = (a.action || "").toLowerCase();
        let type: ActivityItem["type"] = "other";
        if (lower.includes("approved") || lower.includes("accepted")) type = "approved";
        else if (lower.includes("generated") || lower.includes("proposal")) type = "generated";
        else if (lower.includes("upload") || lower.includes("submitted")) type = "uploaded";
        else if (lower.includes("change") || lower.includes("comment")) type = "comment";
        acts.push({ id: a.id, type, description: a.action, timestamp: a.created_at });
      });
      setActivity(acts);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [client.id]);

  // Derive timeline status
  const briefDone = !!kickoff?.transcript_text && !!kickoff?.voice_reference;
  const setupDone = offering?.status === "active" || offering?.status === "completed";
  const activeDone = assets.some((a: any) => a.status === "approved" || a.production_status === "deployed");

  const getStatus = (done: boolean, prevDone: boolean): TimelineStep["status"] =>
    done ? "done" : prevDone ? "current" : "todo";

  const steps: TimelineStep[] = [
    { label: "Brief", status: getStatus(briefDone, true) },
    { label: "Oferta", status: getStatus(!!offering, briefDone) },
    { label: "Setup", status: getStatus(setupDone, !!offering) },
    { label: "Activa", status: getStatus(activeDone, setupDone) },
  ];

  // Determine next action via shared hook
  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "skipped");
  const nextTodoTask = openTasks.find((t) => t.status !== "blocked");

  const nextAction = deriveNextAction({
    audience: "admin",
    briefDone,
    offering: offering ? { status: offering.status, proposed_at: offering.proposed_at } : null,
    openTaskCount: openTasks.length,
    nextTaskTitle: nextTodoTask?.title ?? null,
    hasKickoffTranscript: !!kickoff?.transcript_text,
  });

  // Quick stats
  const platformsConfigured = platforms.filter((p) => p.integration_status === "configured" || p.integration_status === "ready").length;
  const tasksDone = tasks.filter((t) => t.status === "done").length;
  const tasksTotal = tasks.length;
  const assetsApproved = assets.filter((a) => a.status === "approved").length;

  const scoreColor = contextScorePct >= 80 ? "text-[hsl(142,71%,35%)]" : contextScorePct >= 60 ? "text-amber-600" : "text-destructive";

  return (
    <div className="space-y-6">
      {/* Status Timeline */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">Estado del proyecto</h3>
        <StatusTimeline steps={steps} />
      </div>

      {/* Next Action + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 relative">
          {nextAction.proposalAgingDays !== undefined && nextAction.proposalAgingDays > 5 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 z-10 text-[10px]">
              SLA: {nextAction.proposalAgingDays}d
            </Badge>
          )}
          <NextActionCard
            title={nextAction.title}
            description={nextAction.description}
            ctaLabel={nextAction.ctaLabel}
            onCta={() => onNavigateTab(nextAction.ctaTab!)}
            variant={nextAction.variant}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Context" value={`${contextScorePct}%`} valueClass={scoreColor} />
          <StatCard label="Plataformas" value={`${platformsConfigured}/${platforms.length || 0}`} />
          <StatCard label="Tareas abiertas" value={`${openTasks.length}/${tasksTotal}`} />
          <StatCard label="Assets aprobados" value={String(assetsApproved)} />
        </div>
      </div>

      {/* Offering progress (if exists) */}
      {offering && tasksTotal > 0 && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">{offering.custom_name || offering.offering_templates?.name || "Oferta activa"}</h3>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">Estado: {offering.status}</p>
            </div>
          </div>
          <ProgressIndicator value={tasksTotal > 0 ? tasksDone / tasksTotal : 0} label="Progreso del plan" sublabel={`${tasksDone}/${tasksTotal} tareas`} tone="success" />
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Actividad reciente</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse bg-muted rounded-lg" />)}
          </div>
        ) : (
          <ActivityFeed activities={activity} emptyLabel="Sin actividad reciente para este cliente" />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 flex flex-col justify-between">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${valueClass || "text-foreground"}`}>{value}</p>
    </div>
  );
}
