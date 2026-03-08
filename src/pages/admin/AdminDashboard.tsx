import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, formatDistanceToNow, isToday, isBefore, startOfDay, differenceInDays, startOfWeek, startOfMonth } from "date-fns";
import {
  Users, FileText, Phone, UserCheck, UserX, Archive,
  CheckCircle2, Clock, AlertTriangle, CalendarClock, Eye, ExternalLink
} from "lucide-react";

type ProspectCard = {
  id: string;
  name: string;
  company_name: string;
  vertical: string;
  created_at: string;
  call_status: string;
  status: string;
};

type ClientRow = {
  id: string;
  name: string;
  company_name: string;
  vertical: string;
  created_at: string;
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
  if (action.includes("accepted") || action.includes("Briefer")) return <UserCheck className="w-3.5 h-3.5 text-status-accepted" />;
  if (action.includes("rejected")) return <UserX className="w-3.5 h-3.5 text-status-rejected" />;
  if (action.includes("archived")) return <Archive className="w-3.5 h-3.5 text-muted-foreground" />;
  return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [prospects, setProspects] = useState<ProspectCard[]>([]);
  const [recentClients, setRecentClients] = useState<ClientRow[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [brieferUrl, setBrieferUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd'T'HH:mm:ss");

      const [prospectsRes, clientsRes, followUpsRes, activityRes, brieferRes] = await Promise.all([
        supabase.from("prospects").select("id, name, company_name, vertical, created_at, call_status, status, follow_up_date"),
        supabase.from("clients").select("id, name, company_name, vertical, created_at, status").eq("status", "active"),
        supabase.from("prospects").select("id, name, company_name, vertical, follow_up_date, call_status").not("follow_up_date", "is", null).lte("follow_up_date", today).order("follow_up_date", { ascending: true }),
        supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("connected_tools" as any).select("config").eq("tool_name", "briefer").maybeSingle(),
      ]);

      const allProspects = (prospectsRes.data || []) as ProspectCard[];
      const allClients = (clientsRes.data || []) as ClientRow[];

      // Filter clients accepted this month
      const thisMonthClients = allClients.filter(c => c.created_at >= monthStart);

      setProspects(allProspects);
      setRecentClients(thisMonthClients);
      setFollowUps((followUpsRes.data || []) as FollowUp[]);
      setActivity((activityRes.data || []) as ActivityItem[]);

      const brieferConfig = (brieferRes as any)?.data?.config;
      if (brieferConfig?.url) setBrieferUrl(brieferConfig.url);

      setLoading(false);
    };
    fetchAll();
  }, []);

  if (loading) return <div className="p-8 text-muted-foreground">Loading dashboard...</div>;

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd'T'HH:mm:ss");

  const totalProspects = prospects.length;
  const proposalsReady = prospects.filter(p => p.status === "proposal_ready").length;
  const callsScheduled = prospects.filter(p => p.status === "call_scheduled").length;
  const acceptedThisMonth = prospects.filter(p => p.status === "accepted" && p.created_at >= monthStart).length;
  const rejectedThisMonth = prospects.filter(p => p.status === "rejected" && p.created_at >= monthStart).length;

  const pipelineGroups = PIPELINE_STATUSES.reduce((acc, status) => {
    acc[status] = prospects.filter(p => p.status === status);
    return acc;
  }, {} as Record<string, ProspectCard[]>);

  const isOverdue = (dateStr: string) => isBefore(new Date(dateStr), startOfDay(new Date())) && !isToday(new Date(dateStr));

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Dashboard</h1>
      <p className="text-muted-foreground text-sm mb-6">CRM by PRAGMA — operations overview</p>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-8">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard icon={<Users className="w-5 h-5" />} label="Total Prospects" value={totalProspects} color="hsl(216 72% 22%)" />
            <KPICard icon={<FileText className="w-5 h-5" />} label="Proposals Ready" value={proposalsReady} color="hsl(25 95% 53%)" />
            <KPICard icon={<CalendarClock className="w-5 h-5" />} label="Calls Scheduled" value={callsScheduled} color="hsl(215 16% 47%)" />
            <KPICard icon={<UserCheck className="w-5 h-5" />} label="Accepted (month)" value={acceptedThisMonth} color="hsl(153 54% 16%)" />
            <KPICard icon={<UserX className="w-5 h-5" />} label="Rejected (month)" value={rejectedThisMonth} color="hsl(0 84% 60%)" />
          </div>

          {/* Follow ups */}
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
                      </div>
                      <div className="flex items-center gap-3">
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

          {/* Active Clients */}
          {recentClients.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-foreground mb-4">Clients Accepted This Month</h2>
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Vertical</TableHead>
                      <TableHead>Since</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentClients.map(c => (
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
                          {brieferUrl ? (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); window.open(`${brieferUrl}/admin/client/${c.id}`, "_blank"); }}>
                              <ExternalLink className="w-3 h-3 mr-1" /> View in Briefer
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/admin/client/${c.id}`); }}>
                              View
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* Activity Feed */}
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

function KPICard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-md" style={{ backgroundColor: color, color: "white" }}>
          {icon}
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}
