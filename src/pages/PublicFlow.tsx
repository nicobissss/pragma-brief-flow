import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Workflow } from "lucide-react";

type FlowNode = { id: string; label: string; channel: string; week: number; objective?: string };
type FlowEdge = { id: string; source: string; target: string; label?: string };

const CHANNEL_COLORS: Record<string, string> = {
  email: "bg-blue-500/10 text-blue-700 border-blue-300",
  landing_page: "bg-purple-500/10 text-purple-700 border-purple-300",
  social_post: "bg-pink-500/10 text-pink-700 border-pink-300",
  paid_meta: "bg-indigo-500/10 text-indigo-700 border-indigo-300",
  paid_ig: "bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-300",
  ads_google: "bg-amber-500/10 text-amber-700 border-amber-300",
  whatsapp: "bg-green-500/10 text-green-700 border-green-300",
  sms: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  retargeting: "bg-orange-500/10 text-orange-700 border-orange-300",
  thank_you: "bg-slate-500/10 text-slate-700 border-slate-300",
};

export default function PublicFlow() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [flow, setFlow] = useState<any>(null);
  const [campaignName, setCampaignName] = useState<string>("");

  useEffect(() => {
    document.title = "Campaign Flow";
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data } = await supabase
        .from("campaign_flows")
        .select("nodes, edges, version, status, campaign_id")
        .eq("share_token", token)
        .eq("status", "published")
        .maybeSingle();
      if (data) {
        setFlow(data);
        const { data: c } = await supabase
          .from("campaigns").select("name").eq("id", (data as any).campaign_id).maybeSingle();
        setCampaignName(c?.name || "");
        document.title = `Campaign Flow — ${c?.name || ""}`;
      }
      setLoading(false);
    })();
  }, [token]);

  const weeks = useMemo(() => {
    if (!flow) return [];
    const map = new Map<number, FlowNode[]>();
    (flow.nodes as FlowNode[]).forEach((n) => {
      const w = n.week || 1;
      if (!map.has(w)) map.set(w, []);
      map.get(w)!.push(n);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [flow]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando…
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold mb-2">Flow no disponible</h1>
          <p className="text-sm text-muted-foreground">El link no es válido o el flow ya no está publicado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-3">
          <Workflow className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold">{campaignName || "Campaign Flow"}</h1>
            <p className="text-xs text-muted-foreground">v{flow.version} · publicado</p>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {weeks.map(([w, ws]) => (
          <section key={w} className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Semana {w}</div>
            <div className="flex flex-wrap gap-3">
              {ws.map((n) => {
                const cls = CHANNEL_COLORS[n.channel] || "bg-secondary text-foreground border-border";
                return (
                  <div key={n.id} className={`rounded-lg border p-3 text-xs ${cls} min-w-[220px] max-w-[280px]`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{n.channel}</Badge>
                      <span className="text-[10px] opacity-70">W{n.week}</span>
                    </div>
                    <p className="font-semibold text-sm leading-tight mb-1">{n.label}</p>
                    {n.objective && <p className="text-[11px] opacity-80 leading-snug">{n.objective}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {(flow.edges as FlowEdge[]).length > 0 && (
          <section className="text-xs text-muted-foreground border-t border-border pt-4">
            <strong className="text-foreground">Secuencia:</strong>{" "}
            {(flow.edges as FlowEdge[]).map((e) => `${e.source}→${e.target}${e.label ? ` (${e.label})` : ""}`).join(" · ")}
          </section>
        )}
      </main>
    </div>
  );
}
