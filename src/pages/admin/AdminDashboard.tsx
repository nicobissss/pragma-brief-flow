import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, formatDistanceToNow, isToday, isBefore, startOfDay, differenceInDays, startOfWeek } from "date-fns";
import {
  Users, Building2, FileWarning, CalendarClock, Eye,
  FileText, Phone, UserCheck, UserX, Archive, MessageSquare, CheckCircle2, Clock, AlertTriangle
} from "lucide-react";

type KPIData = {
  totalProspects: number;
  newThisWeek: number;
  activeClients: number;
  verticalsCount: number;
  pendingAssets: number;
  waitingClientApproval: number;
  followUpsDue: number;
  overdueCount: number;
};

type ProspectCard = {
  id: string;
  name: string;
  company_name: string;
  vertical: string;
  created_at: string;
  call_status: string;
  call_date: string | null;
  status: string;
};

type ClientRow = {
  id: string;
  name: string;
  company_name: string;
  vertical: string;
  pipeline_status: string | null;
  created_at: string;
  assets: { id: string; asset_type: string; status: string; created_at: string; asset_title: string | null; asset_name: string; client_id: string }[];
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

const PIPELINE_STATUSES = ["new", "proposal_ready", "call_scheduled", "accepted", "rejected"] as const;
const PIPELINE_LABELS: Record<string, string> = {
  new: "New",
  proposal_ready: "Proposal Ready",
  call_scheduled: "Call Scheduled",
  accepted: "Accepted",
  rejected: "Rejected",
};

const CLIENT_PIPELINE = ["kickoff", "materials", "production", "review", "completed"] as const;
const CLIENT_PIPELINE_LABELS: Record<string, string> = {
  kickoff: "Kickoff",
  materials: "Materiales",
  production: "Producción",
  review: "Revisión",
  completed: "Completado",
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

const ASSET_TYPES = ["landing_page", "email_flow", "social_post", "blog_article"] as const;
const ASSET_LABELS: Record<string, string> = {
  landing_page: "LP",
  email_flow: "Email",
  social_post: "Social",
  blog_article: "Blog",
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

type TodayAction = { text: string; link: string; type: "urgent" | "normal" };

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPIData>({ totalProspects: 0, newThisWeek: 0, activeClients: 0, verticalsCount: 0, pendingAssets: 0, waitingClientApproval: 0, followUpsDue: 0, overdueCount: 0 });
  const [prospects, setProspects] = useState<ProspectCard[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayActions, setTodayActions] = useState<TodayAction[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss");

      const [prospectsRes, clientsRes, assetsRes, followUpsRes, activityRes] = await Promise.all([
        supabase.from("prospects").select("id, name, company_name, vertical, created_at, call_status, call_date, status, follow_up_date"),
        supabase.from("clients").select("id, name, company_name, vertical, pipeline_status, created_at, status").eq("status", "active"),
        supabase.from("assets").select("id, client_id, asset_type, asset_name, asset_title, status, created_at"),
        supabase.from("prospects").select("id, name, company_name, vertical, follow_up_date, call_status").not("follow_up_date", "is", null).lte("follow_up_date", today).order("follow_up_date", { ascending: true }),
        supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(20),
      ]);

      const allProspects = (prospectsRes.data || []) as any[];
      const allClients = (clientsRes.data || []) as any[];
      const allAssets = (assetsRes.data || []) as any[];
      const allFollowUps = (followUpsRes.data || []) as FollowUp[];
      const allActivity = (activityRes.data || []) as ActivityItem[];

      const newThisWeek = allProspects.filter(p => p.created_at >= weekStart).length;
      const verticals = new Set(allClients.map((c: any) => c.vertical));
      const pendingAssets = allAssets.filter((a: any) => a.status === "pending_review" || a.status === "change_requested").length;
      const waitingClient = allAssets.filter((a: any) => a.status === "pending_review").length;
      const overdueCount = allFollowUps.filter(f => isBefore(new Date(f.follow_up_date), startOfDay(new Date())) && !isToday(new Date(f.follow_up_date))).length;

      const clientRows: ClientRow[] = allClients.map((c: any) => ({
        ...c,
        assets: allAssets.filter((a: any) => a.client_id === c.id),
      }));

      // Build today actions (UX-01)
      const actions: TodayAction[] = [];
      const newProspects = allProspects.filter(p => p.status === "new");
      if (newProspects.length > 0) {
        actions.push({
          text: `${newProspects.length} prospect${newProspects.length > 1 ? "s" : ""} sin revisar`,
          link: "/admin/prospects", type: "urgent"
        });
      }
      const todayCalls = allProspects.filter(p => p.call_date && isToday(new Date(p.call_date)));
      todayCalls.forEach(p => {
        actions.push({
          text: `Call con ${p.name} a las ${format(new Date(p.call_date), "HH:mm")}`,
          link: `/admin/prospect/${p.id}`, type: "normal"
        });
      });
      const pendingFeedback = allAssets.filter(a => a.status === "change_requested");
      pendingFeedback.forEach(a => {
        actions.push({
          text: `Feedback pendiente: ${a.asset_title || a.asset_name}`,
          link: `/admin/client/${a.client_id}`, type: "urgent"
        });
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
      });
      setProspects(allProspects);
      setClients(clientRows);
      setFollowUps(allFollowUps);
      setActivity(allActivity);
      setTodayActions(actions);
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

  const pipelineGroups = PIPELINE_STATUSES.reduce((acc, status) => {
    acc[status] = prospects.filter(p => p.status === status);
    return acc;
  }, {} as Record<string, ProspectCard[]>);

  const clientPipelineGroups = CLIENT_PIPELINE.reduce((acc, status) => {
    acc[status] = clients.filter(c => (c.pipeline_status || "kickoff") === status);
    return acc;
  }, {} as Record<string, ClientRow[]>);

  const isOverdue = (dateStr: string) => isBefore(new Date(dateStr), startOfDay(new Date())) && !isToday(new Date(dateStr));

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Dashboard</h1>
      <p className="text-muted-foreground text-sm mb-6">PRAGMA operations overview</p>

      {/* UX-01: Today's Work */}
      <div className="bg-card rounded-lg border border-border p-4 mb-6 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Lo que toca hoy</h3>
        {todayActions.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-[hsl(142,71%,35%)]">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-medium">✅ Todo al día</span>
          </div>
        ) : (
          <div className="space-y-2">
            {todayActions.map((action, i) => (
              <div
                key={i}
                onClick={() => navigate(action.link)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-secondary/50 border-l-4 ${
                  action.type === "urgent" ? "border-l-destructive" : "border-l-primary"
                }`}
              >
                {action.type === "urgent" ? (
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                )}
                <span className="text-sm text-foreground">{action.text}</span>
                <span className="ml-auto text-xs text-muted-foreground">→</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content (70%) */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard icon={<Users className="w-5 h-5" />} label="Total Prospects" value={kpis.totalProspects} subtitle={`+${kpis.newThisWeek} this week`} color="hsl(216 72% 22%)" />
            <KPICard icon={<Building2 className="w-5 h-5" />} label="Active Clients" value={kpis.activeClients} subtitle={`${kpis.verticalsCount} verticals covered`} color="hsl(153 54% 16%)" />
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

          {/* Prospect Pipeline */}
          <div>
            <h2 className="text-lg font-bold text-foreground mb-4">Prospect Pipeline</h2>
            <div className="grid grid-cols-5 gap-3">
              {PIPELINE_STATUSES.map(status => (
                <div key={status} className="flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{PIPELINE_LABELS[status]}</span>
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{pipelineGroups[status].length}</Badge>
                  </div>
                  <ScrollArea className="max-h-[400px] pr-1">
                    <div className="space-y-2">
                      {pipelineGroups[status].length === 0 ? (
                        <div className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">Empty</div>
                      ) : (
                        pipelineGroups[status].map(p => (
                          <div key={p.id} onClick={() => navigate(`/admin/prospect/${p.id}`)} className="bg-card rounded-lg border border-border p-3 cursor-pointer hover:shadow-md transition-shadow">
                            <p className="text-sm font-semibold text-foreground leading-tight">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.company_name}</p>
                            <div className="flex items-center gap-1.5 mt-2">
                              <Badge className={`${VERTICAL_COLORS[p.vertical] || "bg-muted"} text-primary-foreground border-0 text-[10px] px-1.5 py-0`}>{p.vertical}</Badge>
                              {p.call_status !== "not_scheduled" && <span className="text-xs">{CALL_ICONS[p.call_status]}</span>}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1.5">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ))}
            </div>
          </div>

          {/* UX-02: Client Pipeline Kanban */}
          {clients.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-foreground mb-4">Client Pipeline</h2>
              <div className="grid grid-cols-5 gap-3">
                {CLIENT_PIPELINE.map(status => (
                  <div key={status} className="flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{CLIENT_PIPELINE_LABELS[status]}</span>
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{clientPipelineGroups[status].length}</Badge>
                    </div>
                    <ScrollArea className="max-h-[400px] pr-1">
                      <div className="space-y-2">
                        {clientPipelineGroups[status].length === 0 ? (
                          <div className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">—</div>
                        ) : (
                          clientPipelineGroups[status].map(c => {
                            const pendingCount = c.assets.filter(a => a.status === "pending_review" || a.status === "change_requested").length;
                            return (
                              <div key={c.id} onClick={() => navigate(`/admin/client/${c.id}`)} className="bg-card rounded-lg border border-border p-3 cursor-pointer hover:shadow-md transition-shadow">
                                <p className="text-sm font-semibold text-foreground leading-tight">{c.name}</p>
                                <p className="text-xs text-muted-foreground">{c.company_name}</p>
                                <div className="flex items-center gap-1.5 mt-2">
                                  <Badge className={`${VERTICAL_COLORS[c.vertical] || "bg-muted"} text-primary-foreground border-0 text-[10px] px-1.5 py-0`}>{c.vertical}</Badge>
                                  {pendingCount > 0 && (
                                    <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{pendingCount} pending</Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1.5">Since {format(new Date(c.created_at), "dd MMM")}</p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Clients Table */}
          {clients.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-foreground mb-4">Active Clients</h2>
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Vertical</TableHead>
                      <TableHead>Since</TableHead>
                      <TableHead>Assets Status</TableHead>
                      <TableHead>Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map(c => {
                      const lastAssetDate = c.assets.length > 0
                        ? c.assets.reduce((latest, a) => a.created_at > latest ? a.created_at : latest, c.assets[0].created_at)
                        : null;
                      return (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-secondary/50" onClick={() => navigate(`/admin/client/${c.id}`)}>
                          <TableCell>
                            <p className="font-medium text-foreground">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.company_name}</p>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${VERTICAL_COLORS[c.vertical] || "bg-muted"} text-primary-foreground border-0 text-[10px]`}>{c.vertical}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                          <TableCell>
                            <div className="flex gap-1.5">
                              {ASSET_TYPES.map(type => {
                                const asset = c.assets.find(a => a.asset_type === type);
                                const icon = asset
                                  ? asset.status === "approved" ? "✅" : asset.status === "change_requested" ? "💬" : "⏳"
                                  : null;
                                return (
                                  <span key={type} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${asset ? "bg-secondary" : "bg-muted/50 text-muted-foreground"}`}>
                                    {ASSET_LABELS[type]} {icon || "—"}
                                  </span>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {lastAssetDate ? formatDistanceToNow(new Date(lastAssetDate), { addSuffix: true }) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
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
