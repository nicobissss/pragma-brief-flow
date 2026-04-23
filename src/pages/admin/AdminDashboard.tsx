import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow, isToday, isBefore, startOfDay, differenceInDays, startOfWeek } from "date-fns";
import {
  Users, Building2, FileWarning, CalendarClock, Eye,
  FileText, Phone, UserCheck, UserX, Archive, MessageSquare, CheckCircle2, Clock, AlertTriangle, ArrowRight,
} from "lucide-react";
import { deriveNextAction } from "@/hooks/useNextAction";

type KPIData = {
  totalProspects: number;
  newThisWeek: number;
  activeClients: number;
  verticalsCount: number;
  pendingAssets: number;
  waitingClientApproval: number;
  followUpsDue: number;
  overdueCount: number;
  openProposals: number;
  agingProposals: number;
};

type ClientWithContext = {
  id: string;
  name: string;
  company_name: string;
  vertical: string;
  created_at: string;
  kickoff_done: boolean;
  has_kickoff_transcript: boolean;
  offering: { status: string | null; proposed_at: string | null } | null;
  open_task_count: number;
  next_task_title: string | null;
};

type FollowUp = {
  id: string;
  name: string;
  company_name: string;
  vertical: string;
  follow_up_date: string;
  call_status: string;
};

type ActivityItem = {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  action: string;
  created_at: string;
};

const VERTICAL_COLORS: Record<string, string> = {
  "Salud & Estética": "bg-[hsl(216,72%,22%)]",
  "E-Learning": "bg-[hsl(153,54%,16%)]",
  "Deporte Offline": "bg-[hsl(281,52%,36%)]",
};

const CALL_ICONS: Record<string, string> = {
  scheduled: "📅",
  done_positive: "✅",
  done_negative: "❌",
  no_show: "👻",
};

function getActivityIcon(action: string) {
  if (action.includes("briefing")) return <FileText className="w-3.5 h-3.5 text-primary" />;
  if (action.includes("proposal")) return <FileText className="w-3.5 h-3.5 text-status-proposal-ready" />;
  if (action.includes("call")) return <Phone className="w-3.5 h-3.5 text-status-call-scheduled" />;
  if (action.includes("accepted")) return <UserCheck className="w-3.5 h-3.5 text-status-accepted" />;
  if (action.includes("rejected")) return <UserX className="w-3.5 h-3.5 text-status-rejected" />;
  if (action.includes("archived")) return <Archive className="w-3.5 h-3.5 text-muted-foreground" />;
  if (action.includes("approved")) return <CheckCircle2 className="w-3.5 h-3.5 text-status-accepted" />;
  if (action.includes("changes")) return <MessageSquare className="w-3.5 h-3.5 text-status-change-requested" />;
  return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
}

const VARIANT_STYLES: Record<string, string> = {
  warning: "border-l-amber-500",
  primary: "border-l-primary",
  success: "border-l-[hsl(142,71%,35%)]",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPIData>({ totalProspects: 0, newThisWeek: 0, activeClients: 0, verticalsCount: 0, pendingAssets: 0, waitingClientApproval: 0, followUpsDue: 0, overdueCount: 0, openProposals: 0, agingProposals: 0 });
  const [clients, setClients] = useState<ClientWithContext[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss");

      const [prospectsRes, clientsRes, assetsRes, followUpsRes, activityRes, offeringsRes, kickoffsRes, tasksRes] = await Promise.all([
        supabase.from("prospects").select("id, created_at"),
        supabase.from("clients").select("id, name, company_name, vertical, created_at, status").eq("status", "active"),
        supabase.from("assets").select("id, status"),
        supabase.from("prospects").select("id, name, company_name, vertical, follow_up_date, call_status").not("follow_up_date", "is", null).lte("follow_up_date", today).order("follow_up_date", { ascending: true }),
        supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("client_offerings").select("id, client_id, status, proposed_at"),
        supabase.from("kickoff_briefs").select("client_id, transcript_text, pragma_approved"),
        supabase.from("action_plan_tasks").select("id, client_offering_id, title, status, order_index"),
      ]);

      const allProspects = (prospectsRes.data || []) as any[];
      const allClients = (clientsRes.data || []) as any[];
      const allAssets = (assetsRes.data || []) as any[];
      const allFollowUps = (followUpsRes.data || []) as FollowUp[];
      const allActivity = (activityRes.data || []) as ActivityItem[];
      const allOfferings = (offeringsRes.data || []) as any[];
      const allKickoffs = (kickoffsRes.data || []) as any[];
      const allTasks = (tasksRes.data || []) as any[];

      const newThisWeek = allProspects.filter(p => p.created_at >= weekStart).length;
      const verticals = new Set(allClients.map((c: any) => c.vertical));
      const pendingAssets = allAssets.filter((a: any) => a.status === "pending_review" || a.status === "change_requested").length;
      const waitingClient = allAssets.filter((a: any) => a.status === "pending_review").length;
      const overdueCount = allFollowUps.filter(f => isBefore(new Date(f.follow_up_date), startOfDay(new Date())) && !isToday(new Date(f.follow_up_date))).length;
      const openOfferings = allOfferings.filter(o => o.status === "proposed");
      const agingProposals = openOfferings.filter(o => o.proposed_at && differenceInDays(new Date(), new Date(o.proposed_at)) > 5).length;

      // Build per-client context for next-action derivation
      const enriched: ClientWithContext[] = allClients.map((c: any) => {
        const k = allKickoffs.find(k => k.client_id === c.id);
        const offerings = allOfferings.filter(o => o.client_id === c.id);
        const offering = offerings[0] || null;
        const offeringId = offering?.id;
        const tasks = offeringId ? allTasks.filter(t => t.client_offering_id === offeringId && t.status !== "done") : [];
        tasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        return {
          id: c.id,
          name: c.name,
          company_name: c.company_name,
          vertical: c.vertical,
          created_at: c.created_at,
          kickoff_done: !!k?.pragma_approved,
          has_kickoff_transcript: !!k?.transcript_text,
          offering: offering ? { status: offering.status, proposed_at: offering.proposed_at } : null,
          open_task_count: tasks.length,
          next_task_title: tasks[0]?.title || null,
        };
      });

      setKpis({
        totalProspects: allProspects.length,
        newThisWeek,
        activeClients: allClients.length,
        verticalsCount: verticals.size,
        pendingAssets,
        waitingClientApproval: waitingClient,
        followUpsDue: allFollowUps.length,
        overdueCount,
        openProposals: openOfferings.length,
        agingProposals,
      });
      setClients(enriched);
      setFollowUps(allFollowUps);
      setActivity(allActivity);
      setLoading(false);
    };
    fetchAll();
  }, []);

  if (loading) return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  );

  const isOverdue = (dateStr: string) => isBefore(new Date(dateStr), startOfDay(new Date())) && !isToday(new Date(dateStr));

  // Derive next-action for each client and order by urgency
  const clientsWithActions = clients.map(c => {
    const action = deriveNextAction({
      audience: "admin",
      briefDone: c.kickoff_done,
      offering: c.offering,
      openTaskCount: c.open_task_count,
      nextTaskTitle: c.next_task_title,
      hasKickoffTranscript: c.has_kickoff_transcript,
    });
    return { client: c, action };
  });

  // Sort: warning first (with highest aging), then primary, then success
  const variantWeight: Record<string, number> = { warning: 0, primary: 1, success: 2 };
  clientsWithActions.sort((a, b) => {
    const w = variantWeight[a.action.variant] - variantWeight[b.action.variant];
    if (w !== 0) return w;
    const ag = (b.action.proposalAgingDays || 0) - (a.action.proposalAgingDays || 0);
    if (ag !== 0) return ag;
    return a.client.name.localeCompare(b.client.name);
  });

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Dashboard</h1>
      <p className="text-muted-foreground text-sm mb-6">PRAGMA operations overview</p>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content (70%) */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard icon={<Users className="w-5 h-5" />} label="Total Prospects" value={kpis.totalProspects} subtitle={`+${kpis.newThisWeek} this week`} color="hsl(216 72% 22%)" />
            <KPICard icon={<Building2 className="w-5 h-5" />} label="Active Clients" value={kpis.activeClients} subtitle={`${kpis.verticalsCount} verticals covered`} color="hsl(153 54% 16%)" />
            <KPICard icon={<FileText className="w-5 h-5" />} label="Propuestas abiertas" value={kpis.openProposals} subtitle={kpis.agingProposals > 0 ? `⚠ ${kpis.agingProposals} sin respuesta +5d` : "Sin retrasos"} color={kpis.agingProposals > 0 ? "hsl(0 84% 60%)" : "hsl(216 72% 22%)"} pulse={kpis.agingProposals > 0} />
            <KPICard icon={<FileWarning className="w-5 h-5" />} label="Assets Pending" value={kpis.pendingAssets} subtitle={`${kpis.waitingClientApproval} waiting client approval`} color="hsl(25 95% 53%)" pulse={kpis.pendingAssets > 0} />
            <KPICard icon={<CalendarClock className="w-5 h-5" />} label="Follow Ups Due" value={kpis.followUpsDue} subtitle={`${kpis.overdueCount} overdue`} color={kpis.overdueCount > 0 ? "hsl(0 84% 60%)" : "hsl(215 16% 47%)"} />
          </div>

          {/* Follow ups alert */}
          {followUps.length > 0 && (
            <div className="bg-[hsl(54,100%,89%)] border border-[hsl(45,100%,72%)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-[hsl(45,93%,47%)]" />
                <h3 className="font-semibold text-foreground text-sm">Follow ups due</h3>
                <Badge className="bg-destructive text-destructive-foreground border-0 text-xs">{followUps.length}</Badge>
              </div>
              <div className="space-y-1.5">
                {followUps.map(fu => {
                  const overdue = isOverdue(fu.follow_up_date);
                  const daysOverdue = overdue ? differenceInDays(startOfDay(new Date()), new Date(fu.follow_up_date)) : 0;
                  return (
                    <div key={fu.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-card/60 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-foreground">{fu.name}</span>
                        <span className="text-muted-foreground">{fu.company_name}</span>
                        <Badge className={`${VERTICAL_COLORS[fu.vertical] || "bg-muted"} text-primary-foreground border-0 text-[10px]`}>{fu.vertical}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        {fu.call_status !== "not_scheduled" && <span className="text-xs">{CALL_ICONS[fu.call_status] || ""}</span>}
                        <span className={`text-xs font-medium ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                          {overdue ? `Overdue ${daysOverdue}d` : format(new Date(fu.follow_up_date), "dd MMM")}
                        </span>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/admin/prospect/${fu.id}`)}>
                          <Eye className="w-3 h-3 mr-1" /> View
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Clients — Next Actions */}
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Active Clients — Next Actions</h2>
              <button onClick={() => navigate("/admin/clients")} className="text-xs text-muted-foreground hover:text-foreground">Ver todos →</button>
            </div>
            {clientsWithActions.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
                No hay clientes activos todavía.
              </div>
            ) : (
              <div className="space-y-2">
                {clientsWithActions.map(({ client, action }) => {
                  const tabHash = action.ctaTab ? `?tab=${action.ctaTab}` : "";
                  return (
                    <div
                      key={client.id}
                      onClick={() => navigate(`/admin/client/${client.id}${tabHash}`)}
                      className={`bg-card border border-border border-l-4 ${VARIANT_STYLES[action.variant] || "border-l-primary"} rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-foreground text-sm">{client.name}</span>
                            <span className="text-xs text-muted-foreground">· {client.company_name}</span>
                            <Badge className={`${VERTICAL_COLORS[client.vertical] || "bg-muted"} text-primary-foreground border-0 text-[10px]`}>{client.vertical}</Badge>
                            {action.proposalAgingDays && action.proposalAgingDays > 5 && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{action.proposalAgingDays}d sin respuesta</Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium text-foreground">{action.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{action.description}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-primary shrink-0">
                          <span className="hidden sm:inline">{action.ctaLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed (right sidebar) */}
        <div className="w-full lg:w-[30%] lg:min-w-[280px] hidden lg:block">
          <div className="bg-card rounded-lg border border-border p-4 sticky top-6">
            <h3 className="font-semibold text-foreground text-sm mb-4">Recent Activity</h3>
            {activity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent activity.</p>
            ) : (
              <div className="space-y-3">
                {activity.map(item => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2.5 cursor-pointer hover:bg-secondary/30 rounded p-1.5 -mx-1.5 transition-colors"
                    onClick={() => {
                      if (item.entity_type === "prospect") navigate(`/admin/prospect/${item.entity_id}`);
                      else if (item.entity_type === "asset") {
                        supabase.from("assets").select("client_id").eq("id", item.entity_id).single().then(({ data }) => {
                          if (data?.client_id) navigate(`/admin/client/${data.client_id}?tab=assets`);
                        });
                      } else if (item.entity_type === "client") {
                        navigate(`/admin/client/${item.entity_id}`);
                      }
                    }}
                  >
                    <div className="mt-0.5">{getActivityIcon(item.action)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">
                        <span className="font-medium">{item.entity_name || "Unknown"}</span>{" "}
                        {item.action}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, subtitle, color, pulse }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtitle: string;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div className={`bg-card rounded-lg border border-border p-4 shadow-sm ${pulse ? "animate-pulse-subtle" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-md" style={{ backgroundColor: color, color: "white" }}>
          {icon}
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}
