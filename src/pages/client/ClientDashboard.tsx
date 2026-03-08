import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, Image, Mail, PenTool, ChevronDown } from "lucide-react";

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

function BriefingRow({ label, value }: { label: string; value: any }) {
  const isEmpty = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  const display = isEmpty
    ? null
    : Array.isArray(value) ? value.join(", ") : String(value);
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

export default function ClientDashboard() {
  const [companyName, setCompanyName] = useState("");
  const [assetGroups, setAssetGroups] = useState<{ type: string; status: string; count: number }[]>([]);
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

      // Fetch assets and prospect in parallel
      const [assetsRes, prospectRes] = await Promise.all([
        supabase.from("assets").select("asset_type, status").eq("client_id", client.id),
        client.prospect_id
          ? supabase.from("prospects").select("name, company_name, email, phone, vertical, sub_niche, market, briefing_answers").eq("id", client.prospect_id).single()
          : Promise.resolve({ data: null }),
      ]);

      if (assetsRes.data) {
        const grouped = new Map<string, string[]>();
        for (const a of assetsRes.data) {
          if (!grouped.has(a.asset_type)) grouped.set(a.asset_type, []);
          grouped.get(a.asset_type)!.push(a.status);
        }
        const result: { type: string; status: string; count: number }[] = [];
        grouped.forEach((statuses, type) => {
          let displayStatus = "approved";
          if (statuses.includes("change_requested")) displayStatus = "change_requested";
          else if (statuses.includes("pending_review")) displayStatus = "pending_review";
          result.push({ type, status: displayStatus, count: statuses.length });
        });
        setAssetGroups(result);
      }

      if (prospectRes.data) {
        setProspectData(prospectRes.data);
        setBriefingAnswers((prospectRes.data as any).briefing_answers || {});
      }

      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="text-muted-foreground p-8">Loading...</div>;

  const pendingGroups = assetGroups.filter((g) => g.status !== "approved");
  const approvedGroups = assetGroups.filter((g) => g.status === "approved");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Welcome, {companyName}</h1>
        <p className="text-muted-foreground mt-1">Here you can review your assets and briefing information.</p>
      </div>

      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets">My Assets</TabsTrigger>
          <TabsTrigger value="briefing">My Briefing</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="mt-6">
          {pendingGroups.length > 0 && (
            <div className="space-y-4 mb-8">
              <h2 className="text-lg font-semibold text-foreground">Needs Your Review</h2>
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

          {approvedGroups.length > 0 && (
            <div className="space-y-4 mb-8">
              <h2 className="text-lg font-semibold text-foreground">Approved</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {approvedGroups.map((g) => {
                  const Icon = typeIcons[g.type] || FileText;
                  return (
                    <div key={g.type} className="bg-card rounded-lg border border-border p-5 flex items-start gap-3 opacity-70">
                      <div className="p-2 rounded-md bg-secondary">
                        <Icon className="w-5 h-5 text-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{typeLabels[g.type] || g.type}</h3>
                        <StatusBadge status="approved" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {assetGroups.length === 0 && (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <p className="text-muted-foreground">No assets to review right now.</p>
              <p className="text-muted-foreground text-sm mt-1">We'll notify you by email when something is ready.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="briefing" className="mt-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Your briefing summary</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This is the information you shared with us at the start of our collaboration.
            </p>
          </div>

          {!briefingAnswers ? (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <p className="text-muted-foreground">No briefing data available.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(briefingFields).map(([section, fields]) => (
                <div key={section} className="bg-card rounded-lg border border-border p-6">
                  <h3 className="font-semibold text-foreground mb-3">{section}</h3>
                  {fields.map((f) => {
                    const value = f.source === "prospect"
                      ? prospectData?.[f.key]
                      : briefingAnswers[f.key];
                    return <BriefingRow key={f.key} label={f.label} value={value} />;
                  })}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
