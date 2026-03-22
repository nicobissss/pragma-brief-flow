import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { FileText, Image, Mail, PenTool, ChevronDown, CheckCircle2, Target, AlertCircle, Paperclip } from "lucide-react";
import { format } from "date-fns";

const typeIcons: Record<string, any> = {
  landing_page: FileText,
  email_flow: Mail,
  social_post: Image,
  blog_article: PenTool,
};

const typeLabels: Record<string, string> = {
  landing_page: "Landing Page",
  email_flow: "Email Flow",
  social_post: "Social Posts",
  blog_article: "Blog Articles",
};

const ASSET_SHORT: Record<string, string> = {
  landing_page: "LP",
  email_flow: "Email",
  social_post: "Social",
  blog_article: "Blog",
};

const briefingFields = {
  "About your business": [
    { key: "name", label: "Full name", source: "prospect" },
    { key: "company_name", label: "Company", source: "prospect" },
    { key: "email", label: "Email", source: "prospect" },
    { key: "phone", label: "Phone", source: "prospect" },
    { key: "vertical", label: "Vertical", source: "prospect" },
    { key: "sub_niche", label: "Sub-niche", source: "prospect" },
    { key: "market", label: "Market", source: "prospect" },
  ],
  "Your current situation": [
    { key: "years_in_operation", label: "Years in operation" },
    { key: "monthly_new_clients", label: "Monthly new clients" },
    { key: "client_sources", label: "Client sources" },
    { key: "runs_paid_ads", label: "Runs paid ads" },
    { key: "ad_platforms", label: "Ad platforms" },
    { key: "monthly_budget", label: "Monthly budget" },
    { key: "has_email_list", label: "Has email list" },
    { key: "email_list_size", label: "Email list size" },
    { key: "has_website", label: "Has website" },
    { key: "website_url", label: "Website URL" },
    { key: "uses_crm", label: "Uses CRM" },
    { key: "crm_name", label: "CRM system" },
  ],
  "Your goals": [
    { key: "main_goal", label: "Main goal" },
    { key: "average_ticket", label: "Average ticket" },
    { key: "biggest_challenge", label: "Biggest challenge" },
    { key: "differentiator", label: "Differentiator" },
    { key: "additional_info", label: "Additional info" },
  ],
};

type AssetItem = {
  id: string;
  asset_name: string;
  asset_type: string;
  status: string;
  version: number;
  created_at: string;
  campaign_id: string | null;
};

type CampaignItem = {
  id: string;
  name: string;
  objective: string | null;
  status: string;
};

function BriefingRow({ label, value }: { label: string; value: any }) {
  const isEmpty = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  const display = isEmpty ? null : Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <div className="py-3 border-b border-border last:border-0">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      {isEmpty ? (
        <p className="text-sm text-muted-foreground italic">Not provided</p>
      ) : (
        <p className="text-sm text-foreground">{display}</p>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-[hsl(142,71%,35%)]/10 text-[hsl(142,71%,35%)] border-[hsl(142,71%,35%)]/30",
  completed: "bg-primary/10 text-primary border-primary/30",
};

const getStatusIcon = (s: string) => s === "approved" ? "✅" : s === "change_requested" ? "💬" : "⏳";

export default function ClientDashboard() {
  const [companyName, setCompanyName] = useState("");
  const [allAssets, setAllAssets] = useState<AssetItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [briefingAnswers, setBriefingAnswers] = useState<Record<string, any> | null>(null);
  const [prospectData, setProspectData] = useState<Record<string, any> | null>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [projectPlan, setProjectPlan] = useState<any>(null);
  const [projectPlanShared, setProjectPlanShared] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: client } = await supabase
        .from("clients")
        .select("id, company_name, prospect_id, project_plan, project_plan_shared")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (!client) { setLoading(false); return; }
      setCompanyName(client.company_name);
      setProjectPlan(client.project_plan);
      setProjectPlanShared(client.project_plan_shared || false);

      const [assetsRes, campaignsRes, prospectRes, requestsRes] = await Promise.all([
        supabase.from("assets").select("id, asset_name, asset_type, status, version, created_at, campaign_id").eq("client_id", client.id).order("created_at"),
        supabase.from("campaigns").select("id, name, objective, status").eq("client_id", client.id).order("created_at", { ascending: false }),
        client.prospect_id
          ? supabase.from("prospects").select("name, company_name, email, phone, vertical, sub_niche, market, briefing_answers").eq("id", client.prospect_id).single()
          : Promise.resolve({ data: null }),
        (supabase.from("client_asset_requests" as any) as any)
          .select("requested_items, status")
          .eq("client_id", client.id)
          .in("status", ["pending", "partial"])
          .limit(1),
      ]);

      if (assetsRes.data) setAllAssets(assetsRes.data as AssetItem[]);
      if (campaignsRes.data) setCampaigns(campaignsRes.data as CampaignItem[]);

      if (prospectRes.data) {
        setProspectData(prospectRes.data);
        setBriefingAnswers((prospectRes.data as any).briefing_answers || {});
      }

      if (requestsRes.data && requestsRes.data.length > 0) {
        const pending = (requestsRes.data[0].requested_items as any[]).filter((i: any) => i.status === "pending").length;
        setPendingRequestCount(pending);
      }

      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      {[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
    </div>
  );

  const totalAssets = allAssets.length;
  const approvedCount = allAssets.filter((a) => a.status === "approved").length;
  const allApproved = totalAssets > 0 && approvedCount === totalAssets;
  const progressPercent = totalAssets > 0 ? Math.round((approvedCount / totalAssets) * 100) : 0;

  const uncategorizedAssets = allAssets.filter((a) => !a.campaign_id);
  const hasCampaigns = campaigns.length > 0;

  const typeGroups = new Map<string, { statuses: string[]; count: number }>();
  for (const a of uncategorizedAssets) {
    if (!typeGroups.has(a.asset_type)) typeGroups.set(a.asset_type, { statuses: [], count: 0 });
    const g = typeGroups.get(a.asset_type)!;
    g.statuses.push(a.status);
    g.count++;
  }

  const pendingGroups: { type: string; status: string; count: number }[] = [];
  typeGroups.forEach(({ statuses, count }, type) => {
    let displayStatus = "approved";
    if (statuses.includes("change_requested")) displayStatus = "change_requested";
    else if (statuses.includes("pending_review")) displayStatus = "pending_review";
    if (displayStatus !== "approved") pendingGroups.push({ type, status: displayStatus, count });
  });

  const approvedAssets = allAssets.filter((a) => a.status === "approved");

  const getCampaignCardStyle = (campaignAssets: AssetItem[]) => {
    if (campaignAssets.length === 0) return { border: "border-border", label: null };
    const allCampaignApproved = campaignAssets.every((a) => a.status === "approved");
    const hasChangeRequested = campaignAssets.some((a) => a.status === "change_requested");
    if (allCampaignApproved) return { border: "border-l-4 border-l-[hsl(142,71%,35%)] border-border", label: "✅ Approved" };
    if (hasChangeRequested) return { border: "border-l-4 border-l-[hsl(var(--status-pending-review))] border-border", label: "Action needed — we uploaded a new version" };
    return { border: "border-border", label: null };
  };

  return (
    <div>
      {allApproved && (
        <div className="mb-6 rounded-lg p-5 bg-gradient-to-r from-[hsl(142,71%,35%)] to-[hsl(152,60%,42%)] text-white">
          <p className="text-lg font-bold">🎉 All assets approved!</p>
          <p className="text-sm mt-1 text-white/90">Your campaigns are being activated. We'll be in touch shortly.</p>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Welcome, {companyName}</h1>
        <p className="text-muted-foreground mt-1">Here you can review your assets and briefing information.</p>

        {totalAssets > 0 && (
          <div className="mt-4 max-w-md">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-muted-foreground">Assets approved: {approvedCount} of {totalAssets}</span>
              <span className="text-sm font-medium text-foreground">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2.5 [&>div]:bg-[hsl(142,71%,35%)]" />
          </div>
        )}

        <div className="mt-6 flex items-center gap-0 max-w-2xl">
          {["Contacto inicial", "Kickoff call", "Materiales subidos", "En producción", "Revisión y aprobación"].map((label, i) => {
            const stepDone = totalAssets > 0
              ? i <= (allApproved ? 4 : approvedCount > 0 ? 3 : hasCampaigns ? 2 : 1)
              : i === 0;
            return (
              <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${stepDone ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </div>
                <span className={`text-[10px] text-center leading-tight ${stepDone ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets">My Assets</TabsTrigger>
          <TabsTrigger value="briefing">My Briefing</TabsTrigger>
          <TabsTrigger value="collect" className="relative">
            📎 Files requested
            {pendingRequestCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 min-w-4">
                {pendingRequestCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="mt-6">
          {/* FEAT-11: Project plan for client */}
          {projectPlanShared && projectPlan && (
            <div className="bg-card rounded-lg border border-border p-6 mb-6 space-y-3">
              <h2 className="text-lg font-semibold text-foreground">📋 Tu plan de proyecto</h2>
              {Array.isArray(projectPlan) ? (
                <div className="space-y-2">
                  {projectPlan.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.name || item.asset_name || `Item ${i + 1}`}</p>
                        {item.due_date && <p className="text-xs text-muted-foreground">Fecha: {item.due_date}</p>}
                      </div>
                      {item.status && <StatusBadge status={item.status} />}
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="text-xs bg-secondary/30 p-3 rounded-md whitespace-pre-wrap text-muted-foreground">
                  {typeof projectPlan === "string" ? projectPlan : JSON.stringify(projectPlan, null, 2)}
                </pre>
              )}
            </div>
          )}

          {hasCampaigns && (
            <div className="space-y-4 mb-8">
              <h2 className="text-lg font-semibold text-foreground">Your Campaigns</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {campaigns.map((campaign) => {
                  const cAssets = allAssets.filter((a) => a.campaign_id === campaign.id);
                  const assetsByType = new Map<string, string[]>();
                  for (const a of cAssets) {
                    if (!assetsByType.has(a.asset_type)) assetsByType.set(a.asset_type, []);
                    assetsByType.get(a.asset_type)!.push(a.status);
                  }
                  const { border, label } = getCampaignCardStyle(cAssets);

                  return (
                    <div key={campaign.id} className={`bg-card rounded-lg border ${border} p-5 space-y-3`}>
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-foreground">{campaign.name}</h3>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[campaign.status] || ""}`}>
                          {campaign.status}
                        </Badge>
                      </div>

                      {label && (
                        <p className={`text-xs font-medium flex items-center gap-1 ${label.startsWith("✅") ? "text-[hsl(142,71%,35%)]" : "text-[hsl(var(--status-pending-review))]"}`}>
                          {!label.startsWith("✅") && <AlertCircle className="w-3 h-3" />}
                          {label}
                        </p>
                      )}

                      {campaign.objective && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 line-clamp-1">
                          <Target className="w-3 h-3 shrink-0" /> {campaign.objective}
                        </p>
                      )}

                      {cAssets.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from(assetsByType.entries()).map(([type, statuses]) => {
                            const worstStatus = statuses.includes("change_requested") ? "change_requested" : statuses.includes("pending_review") ? "pending_review" : "approved";
                            return (
                              <span key={type} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary font-medium">
                                {ASSET_SHORT[type] || type} {getStatusIcon(worstStatus)}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <Button asChild size="sm">
                        <Link to={`/client/campaign/${campaign.id}`}>Review campaign assets →</Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!hasCampaigns && allAssets.length === 0 && (
            <div className="bg-card rounded-lg border border-border p-8 text-center space-y-3">
              <p className="text-2xl">🚀</p>
              <h3 className="text-lg font-semibold text-foreground">Your campaigns are being prepared</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Check back soon — your PRAGMA team is working on your marketing assets. We'll notify you when they're ready for review.
              </p>
            </div>
          )}

          {pendingGroups.length > 0 && (
            <div className="space-y-4 mb-8">
              <h2 className="text-lg font-semibold text-foreground">{hasCampaigns ? "Other Assets" : "Needs Your Review"}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {pendingGroups.map((g) => {
                  const Icon = typeIcons[g.type] || FileText;
                  return (
                    <div key={g.type} className="bg-card rounded-lg border border-border p-5 flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-md bg-secondary">
                          <Icon className="w-5 h-5 text-foreground" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">{typeLabels[g.type] || g.type}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <StatusBadge status={g.status} />
                            <span className="text-xs text-muted-foreground">{g.count} item{g.count > 1 ? "s" : ""}</span>
                          </div>
                        </div>
                      </div>
                      <Button asChild size="sm">
                        <Link to={`/client/assets/${g.type}`}>Review now</Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {approvedAssets.length > 0 && (
            <div className="space-y-4 mb-8">
              <div>
                <h2 className="text-lg font-semibold text-foreground">✅ Approved assets</h2>
                <p className="text-sm text-muted-foreground mt-0.5">These have been approved and are being activated by the PRAGMA team.</p>
              </div>
              <div className="rounded-lg border-2 border-[hsl(142,71%,35%)]/30 bg-[hsl(142,71%,35%)]/5 divide-y divide-border">
                {approvedAssets.map((asset) => {
                  const Icon = typeIcons[asset.asset_type] || FileText;
                  return (
                    <div key={asset.id} className="flex items-center gap-3 p-4">
                      <CheckCircle2 className="w-4 h-4 text-[hsl(142,71%,35%)] shrink-0" />
                      <div className="p-1.5 rounded bg-secondary shrink-0">
                        <Icon className="w-4 h-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{asset.asset_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Approved on {format(new Date(asset.created_at), "dd MMM yyyy")} — Version {asset.version || 1}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="briefing" className="mt-6 space-y-6">
          {briefingAnswers ? (
            Object.entries(briefingFields).map(([section, fields]) => (
              <Collapsible key={section} defaultOpen>
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                  <CollapsibleTrigger className="w-full flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors">
                    <h3 className="font-semibold text-foreground text-sm">{section}</h3>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-5 pb-5">
                      {fields.map((f) => {
                        const val = (f as any).source === "prospect"
                          ? prospectData?.[f.key]
                          : briefingAnswers[f.key];
                        return <BriefingRow key={f.key} label={f.label} value={val} />;
                      })}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))
          ) : (
            <div className="bg-card rounded-lg border border-border p-8 text-center space-y-3">
              <p className="text-2xl">📋</p>
              <h3 className="text-lg font-semibold text-foreground">Briefing not available</h3>
              <p className="text-sm text-muted-foreground">Your briefing information will appear here once processed.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="collect" className="mt-6">
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-2">Files Requested by PRAGMA</h3>
            <p className="text-sm text-muted-foreground">
              Go to the <Link to="/client/collect" className="text-primary underline">upload page</Link> to submit the requested files.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
