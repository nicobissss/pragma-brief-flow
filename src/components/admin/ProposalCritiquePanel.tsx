import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, AlertCircle, CheckCircle2, History, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Recommendation {
  section: string;
  change: string;
  how: string;
  priority: "low" | "medium" | "high";
}
interface Weakness {
  area: string;
  issue: string;
  severity: "low" | "medium" | "high";
}
interface CritiqueReport {
  id: string;
  version: number;
  overall_score: number;
  clarity_score: number | null;
  persuasion_score: number | null;
  pricing_score: number | null;
  objection_handling_score: number | null;
  brief_alignment_score: number | null;
  strengths: string[];
  weaknesses: Weakness[];
  missing_elements: string[];
  recommendations: Recommendation[];
  summary: string | null;
  triggered_by: string;
  created_at: string;
  cost_estimate_eur: number | null;
}

const scoreColor = (s: number) =>
  s >= 80 ? "text-emerald-600" : s >= 60 ? "text-amber-600" : "text-destructive";

const priorityBadgeVariant = (p: string) =>
  p === "high" ? "destructive" : p === "medium" ? "default" : "secondary";

export function ProposalCritiquePanel({ prospectId }: { prospectId: string }) {
  const [reports, setReports] = useState<CritiqueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("proposal_critique_reports")
      .select("*")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("No se pudo cargar el historial de crítica");
    } else {
      setReports((data as any) || []);
    }
    setLoading(false);
  }, [prospectId]);

  useEffect(() => {
    load();
  }, [load]);

  const runCritique = async () => {
    setRunning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("proposal-critique", {
        body: {
          prospect_id: prospectId,
          force: true,
          triggered_by: "manual",
          triggered_by_user_id: user?.id,
        },
      });
      if (error) {
        const ctx: any = (error as any).context;
        let parsed: any = null;
        try {
          if (ctx && typeof ctx.json === "function") parsed = await ctx.json();
        } catch {}
        const msg = parsed?.error || error.message || "Error";
        if (msg.includes("402") || msg.toLowerCase().includes("payment")) {
          toast.error("Sin créditos en Lovable AI", { description: "Recarga el workspace." });
        } else if (msg.includes("429")) {
          toast.error("Demasiadas peticiones, reintenta en unos segundos.");
        } else {
          toast.error(msg);
        }
        return;
      }
      if (data?.skipped) {
        toast.info("Agente desactivado — usa 'force' funcionó? revisar settings.");
      } else {
        toast.success("Crítica generada");
        await load();
      }
    } catch (e: any) {
      toast.error(e.message || "Error inesperado");
    } finally {
      setRunning(false);
    }
  };

  const latest = reports[0];
  const history = reports.slice(1);

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Crítica IA de la propuesta</h3>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Un Sales Strategist IA revisa la propuesta antes de enviarla al cliente.
          </p>
        </div>
        <Button onClick={runCritique} disabled={running} size="sm">
          {running ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analizando...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />{latest ? "Re-analizar" : "Analizar ahora"}</>
          )}
        </Button>
      </div>

      {loading && (
        <div className="text-center py-6 text-muted-foreground text-sm">Cargando...</div>
      )}

      {!loading && !latest && (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <p className="text-muted-foreground text-sm">
            Aún no hay crítica. Pulsa "Analizar ahora" o genera una nueva propuesta con el agente activado.
          </p>
        </div>
      )}

      {latest && (
        <div className="space-y-4">
          {/* Header scores */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-baseline gap-2">
              <span className={cn("text-4xl font-bold", scoreColor(latest.overall_score))}>
                {latest.overall_score}
              </span>
              <span className="text-muted-foreground text-sm">/100</span>
            </div>
            <Badge variant="outline" className="text-xs">v{latest.version}</Badge>
            <Badge variant="outline" className="text-xs capitalize">{latest.triggered_by}</Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(latest.created_at).toLocaleString()}
            </span>
          </div>

          {/* Sub-scores */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            {[
              ["Claridad", latest.clarity_score],
              ["Persuasión", latest.persuasion_score],
              ["Pricing", latest.pricing_score],
              ["Objeciones", latest.objection_handling_score],
              ["Brief", latest.brief_alignment_score],
            ].map(([label, s]) => (
              <div key={label as string} className="bg-muted/40 rounded p-2">
                <div className={cn("text-lg font-semibold", scoreColor((s as number) || 0))}>
                  {s ?? "—"}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          {latest.summary && (
            <div className="bg-muted/30 border-l-4 border-primary p-3 rounded text-sm">
              {latest.summary}
            </div>
          )}

          {latest.strengths?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Puntos fuertes
              </h4>
              <ul className="text-sm space-y-1 pl-5 list-disc text-muted-foreground">
                {latest.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {latest.weaknesses?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-destructive" />
                Debilidades
              </h4>
              <ul className="space-y-2">
                {latest.weaknesses.map((w, i) => (
                  <li key={i} className="text-sm border-l-2 border-destructive/40 pl-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{w.area}</span>
                      <Badge variant={priorityBadgeVariant(w.severity)} className="text-[10px] h-4">
                        {w.severity}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">{w.issue}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {latest.missing_elements?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Elementos faltantes</h4>
              <div className="flex flex-wrap gap-1.5">
                {latest.missing_elements.map((m, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{m}</Badge>
                ))}
              </div>
            </div>
          )}

          {latest.recommendations?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Recomendaciones ejecutables</h4>
              <ol className="space-y-2">
                {[...latest.recommendations]
                  .sort((a, b) => {
                    const o: any = { high: 0, medium: 1, low: 2 };
                    return (o[a.priority] ?? 3) - (o[b.priority] ?? 3);
                  })
                  .map((r, i) => (
                    <li key={i} className="text-sm border rounded p-2 bg-card">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={priorityBadgeVariant(r.priority)} className="text-[10px] h-4 uppercase">
                          {r.priority}
                        </Badge>
                        <span className="font-medium">{r.section}</span>
                      </div>
                      <p className="text-foreground">{r.change}</p>
                      {r.how && (
                        <p className="text-muted-foreground text-xs mt-1">→ {r.how}</p>
                      )}
                    </li>
                  ))}
              </ol>
            </div>
          )}

          {history.length > 0 && (
            <div className="border-t pt-3">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <History className="w-3.5 h-3.5" />
                Historial ({history.length})
                {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showHistory && (
                <ul className="mt-2 space-y-1">
                  {history.map((r) => (
                    <li key={r.id} className="text-xs flex items-center gap-2 text-muted-foreground">
                      <span className={cn("font-mono font-semibold w-8", scoreColor(r.overall_score))}>
                        {r.overall_score}
                      </span>
                      <span>v{r.version}</span>
                      <span className="capitalize">{r.triggered_by}</span>
                      <span>· {new Date(r.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
