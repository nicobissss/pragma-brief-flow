import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { FileText, Image, Mail, PenTool } from "lucide-react";

type AssetSummary = {
  asset_type: string;
  status: string;
  count: number;
};

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

export default function ClientDashboard() {
  const [companyName, setCompanyName] = useState("");
  const [assetGroups, setAssetGroups] = useState<{ type: string; status: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: client } = await supabase
        .from("clients")
        .select("id, company_name")
        .eq("user_id", session.user.id)
        .single();

      if (!client) { setLoading(false); return; }
      setCompanyName(client.company_name);

      const { data: assets } = await supabase
        .from("assets")
        .select("asset_type, status")
        .eq("client_id", client.id);

      if (assets) {
        // Group by type, pick the "worst" status to show
        const grouped = new Map<string, { statuses: string[] }>();
        for (const a of assets) {
          if (!grouped.has(a.asset_type)) grouped.set(a.asset_type, { statuses: [] });
          grouped.get(a.asset_type)!.statuses.push(a.status);
        }

        const result: { type: string; status: string; count: number }[] = [];
        grouped.forEach((val, type) => {
          // Priority: change_requested > pending_review > approved
          let displayStatus = "approved";
          if (val.statuses.includes("change_requested")) displayStatus = "change_requested";
          else if (val.statuses.includes("pending_review")) displayStatus = "pending_review";
          result.push({ type, status: displayStatus, count: val.statuses.length });
        });
        setAssetGroups(result);
      }

      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  const pendingGroups = assetGroups.filter((g) => g.status !== "approved");
  const approvedGroups = assetGroups.filter((g) => g.status === "approved");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Welcome, {companyName}</h1>
        <p className="text-muted-foreground mt-1">Here you can review and approve your marketing assets.</p>
      </div>

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
    </div>
  );
}
