import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CampaignManager } from "@/components/admin/CampaignManager";
import { supabase } from "@/integrations/supabase/client";
import { AIAgentBadge } from "@/components/admin/AIAgentBadge";
import { useAIAgentStatus } from "@/hooks/useAIAgentStatus";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

type Props = {
  client: any;
  assets: any[];
  setAssets: (a: any[]) => void;
  campaigns: any[];
  setCampaigns: (c: any[] | ((prev: any[]) => any[])) => void;
  onApproveStrategicNote: (id: string) => void;
  promptsTabContent?: React.ReactNode;
};

const ASSET_LABELS: Record<string, string> = {
  landing_page: "LP", email_flow: "Email", social_post: "Social", blog_article: "Blog",
};

const statusIcon = (s: string) => s === "approved" ? "✅" : s === "pending_review" ? "⏳" : s === "change_requested" ? "💬" : "—";

export default function AssetsTab({ client, assets, setAssets, campaigns, setCampaigns, onApproveStrategicNote, promptsTabContent }: Props) {
  const qaStatus = useAIAgentStatus("qa_asset_review", client?.id);
  const [qaReports, setQaReports] = useState<Record<string, any>>({});
  const [runningQa, setRunningQa] = useState<string | null>(null);

  useEffect(() => {
    if (!client?.id) return;
    (async () => {
      const { data } = await supabase
        .from("asset_qa_reports")
        .select("asset_id, overall_score, blocked, summary, created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });
      const map: Record<string, any> = {};
      for (const r of data || []) {
        if (!map[r.asset_id]) map[r.asset_id] = r; // latest first
      }
      setQaReports(map);
    })();
  }, [client?.id, assets.length]);

  const runQaNow = async (assetId: string) => {
    setRunningQa(assetId);
    const { data, error } = await supabase.functions.invoke("qa-asset-review", {
      body: { asset_id: assetId, force: true },
    });
    setRunningQa(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data?.skipped) {
      toast.info(`QA omitida: ${data.reason}`);
      return;
    }
    toast.success(`QA completada — Score ${data?.overall_score ?? "?"}/100`);
    // refresh reports
    const { data: refreshed } = await supabase
      .from("asset_qa_reports")
      .select("asset_id, overall_score, blocked, summary, created_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    const map: Record<string, any> = {};
    for (const r of refreshed || []) if (!map[r.asset_id]) map[r.asset_id] = r;
    setQaReports(map);
  };

  const getAssetStatus = (type: string) => {
    const matching = assets.filter((a) => a.asset_type === type);
    if (matching.length === 0) return "none";
    if (matching.some((a) => a.status === "change_requested")) return "change_requested";
    if (matching.some((a) => a.status === "pending_review")) return "pending_review";
    if (matching.every((a) => a.status === "approved")) return "approved";
    return "pending_review";
  };

  const reviewableAssets = assets.filter(
    (a) => a.status === "pending_review" || qaReports[a.id]
  );

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="font-semibold text-foreground mb-4">Asset Status</h3>
        <div className="grid grid-cols-4 gap-3">
          {(["landing_page", "email_flow", "social_post", "blog_article"] as const).map((type) => {
            const status = getAssetStatus(type);
            return (
              <div key={type} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30 border border-border">
                <span>{statusIcon(status)}</span>
                <span className="text-sm text-foreground font-medium">{ASSET_LABELS[type]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* QA Agent panel */}
      <div className="bg-card rounded-lg border border-border p-6 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground text-sm">QA Agent</h3>
            <AIAgentBadge agentKey="qa_asset_review" clientId={client?.id} label="QA" showSettingsLink />
          </div>
          {!qaStatus.loading && !qaStatus.enabled && (
            <span className="text-xs text-muted-foreground">
              No automático — usa "Evaluar ahora" para evaluar manualmente.
            </span>
          )}
        </div>
        {reviewableAssets.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay assets para evaluar.</p>
        ) : (
          <div className="space-y-2">
            {reviewableAssets.slice(0, 8).map((asset) => {
              const report = qaReports[asset.id];
              return (
                <div
                  key={asset.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-md bg-secondary/20 border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{asset.asset_name}</div>
                    {report ? (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            report.blocked
                              ? "border-destructive/50 text-destructive"
                              : report.overall_score >= 80
                              ? "border-emerald-300 text-emerald-700"
                              : "border-amber-300 text-amber-700"
                          }`}
                        >
                          QA: {report.overall_score}/100{report.blocked ? " · bloqueado" : ""}
                        </Badge>
                        {report.summary && (
                          <span className="text-xs text-muted-foreground truncate max-w-md">
                            {report.summary}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin evaluación</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={runningQa === asset.id}
                    onClick={() => runQaNow(asset.id)}
                    className="text-xs h-8"
                  >
                    {runningQa === asset.id ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="w-3 h-3 mr-1" />
                    )}
                    {report ? "Re-evaluar" : "Evaluar ahora"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {assets.filter(a => a.strategic_note || a.strategic_note_approved !== null).length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6 space-y-3">
          <h3 className="font-semibold text-foreground text-sm">Notas estratégicas</h3>
          {assets.map((asset) => {
            if (!asset.strategic_note && !asset.strategic_note_approved) return null;
            return (
              <div key={asset.id} className="p-3 rounded-md bg-secondary/20 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{asset.asset_name}</span>
                  {asset.strategic_note_approved && <Badge className="badge-accepted text-xs">✅ Aprobada</Badge>}
                </div>
                {asset.strategic_note && <p className="text-sm text-muted-foreground">{asset.strategic_note}</p>}
                {asset.strategic_note && !asset.strategic_note_approved && (
                  <Button size="sm" variant="outline" onClick={() => onApproveStrategicNote(asset.id)}>Aprobar nota →</Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CampaignManager
        clientId={client.id}
        campaigns={campaigns}
        assets={assets.map((a: any) => ({ ...a, campaign_id: a.campaign_id || null }))}
        promptsTabContent={promptsTabContent}
        onCampaignCreated={(c) => setCampaigns((prev: any[]) => [c, ...prev])}
        onCampaignUpdated={(c) => setCampaigns((prev: any[]) => prev.map((p: any) => p.id === c.id ? c : p))}
        onAssetsChanged={async () => {
          const { data } = await supabase.from("assets").select("id, asset_name, asset_title, asset_type, status, file_url, content, version, client_comment, correction_prompt, created_at, campaign_id, strategic_note, strategic_note_approved, assigned_to, due_date, incorporated").eq("client_id", client.id);
          setAssets((data || []) as any[]);
        }}
      />
    </div>
  );
}
