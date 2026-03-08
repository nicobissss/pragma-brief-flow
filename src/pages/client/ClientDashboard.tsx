import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { FileText, Image, Mail, PenTool, ChevronDown, CheckCircle2, Target, AlertCircle } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: client } = await supabase
        .from("clients")
        .select("id, company_name, prospect_id")
        .eq("user_id", session.user.id)
        .single();

      if (!client) { setLoading(false); return; }
      setCompanyName(client.company_name);

      const [assetsRes, campaignsRes, prospectRes] = await Promise.all([
        supabase.from("assets").select("id, asset_name, asset_type, status, version, created_at, campaign_id").eq("client_id", client.id).order("created_at"),
        supabase.from("campaigns").select("id, name, objective, status").eq("client_id", client.id).order("created_at", { ascending: false }),
        client.prospect_id
          ? supabase.from("prospects").select("name, company_name, email, phone, vertical, sub_niche, market, briefing_answers").eq("id", client.prospect_id).single()
          : Promise.resolve({ data: null }),
      ]);

      if (assetsRes.data) setAllAssets(assetsRes.data as AssetItem[]);
      if (campaignsRes.data) setCampaigns(campaignsRes.data as CampaignItem[]);

      if (prospectRes.data) {
        setProspectData(prospectRes.data);
        setBriefingAnswers((prospectRes.data as any).briefing_answers || {});
      }

      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="text-muted-foreground p-8">Loading...</div>;

  const totalAssets = allAssets.length;
  const approvedCount = allAssets.filter((a) => a.status === "approved").length;
  const allApproved = totalAssets > 0 && approvedCount === totalAssets;
  const progressPercent = totalAssets > 0 ? Math.round((approvedCount / totalAssets) * 100) : 0;

  // Assets not in any campaign
  const uncategorizedAssets = allAssets.filter((a) => !a.campaign_id);
  const hasCampaigns = campaigns.length > 0;

  // Group uncategorized by type for legacy cards
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

  // Campaign card helpers
  const getCampaignCardStyle = (campaignAssets: AssetItem[]) => {
    if (campaignAssets.length === 0) return { border: "border-border", label: null };
    const allCampaignApproved = campaignAssets.every((a) => a.status === "approved");
    const hasChangeRequested = campaignAssets.some((a) => a.status === "change_requested");
    if (allCampaignApproved) return { border: "border-l-4 border-l-[hsl(var(--status-approved))] border-border", label: "✅ Approved" };
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
      </div>

      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets">My Assets</TabsTrigger>
          <TabsTrigger value="briefing">My Briefing</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="mt-6">
          {/* Campaign cards */}
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
                        <p className={`text-xs font-medium flex items-center gap-1 ${label.startsWith("✅") ? "text-[hsl(var(--status-approved))]" : "text-[hsl(var(--status-pending-review))]"}`}>
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

          {/* No campaigns empty state */}
          {!hasCampaigns && allAssets.length === 0 && (
            <div className="bg-card rounded-lg border border-border p-8 text-center space-y-2">
              <p className="text-muted-foreground">Your campaigns are being prepared.</p>
              <p className="text-sm text-muted-foreground">We'll notify you when assets are ready for review.</p>
            </div>
          )}

          {/* Uncategorized pending review cards */}
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

          {/* Approved assets */}
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

        <TabsContent value="briefing" className="mt-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Your briefing summary</h2>
            <p className="text-sm text-muted-foreground mt-1">This is the information you shared with us at the start of our collaboration.</p>
          </div>

          {!briefingAnswers ? (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <p className="text-muted-foreground">Briefing information not available yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(briefingFields).map(([section, fields]) => (
                <Collapsible key={section} defaultOpen>
                  <div className="bg-card rounded-lg border border-border overflow-hidden">
                    <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                      <h3 className="font-semibold text-foreground">{section}</h3>
                      <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-6 pb-4">
                        {fields.map((f) => {
                          const value = f.source === "prospect" ? prospectData?.[f.key] : briefingAnswers[f.key];
                          return <BriefingRow key={f.key} label={f.label} value={value} />;
                        })}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
