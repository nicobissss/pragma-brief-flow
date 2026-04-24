import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  History,
  ChevronDown,
  ChevronUp,
  Wand2,
  RefreshCw,
  Plus,
  Telescope,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Scope = "prospect" | "post_kickoff";

interface Recommendation {
  section: string;
  change: string;
  how: string;
  priority: "low" | "medium" | "high";
  target_field?: string;
  new_value?: any;
  applied?: boolean;
  applied_at?: string;
}
interface Weakness {
  area: string;
  issue: string;
  severity: "low" | "medium" | "high";
}
interface CritiqueReport {
  id: string;
  scope: Scope;
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

interface Props {
  prospectId?: string;
  clientOfferingId?: string;
  scope?: Scope;
  title?: string;
  subtitle?: string;
}

export function ProposalCritiquePanel({
  prospectId,
  clientOfferingId,
  scope = "prospect",
  title,
  subtitle,
}: Props) {
  const [reports, setReports] = useState<CritiqueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [hasTarget, setHasTarget] = useState<boolean>(false);
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const [editingRec, setEditingRec] = useState<{ idx: number; rec: Recommendation } | null>(null);
  const [editedValue, setEditedValue] = useState<string>("");
  const [regenerating, setRegenerating] = useState(false);
  const [extending, setExtending] = useState(false);
  const [deepDivingIdx, setDeepDivingIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("proposal_critique_reports")
      .select("*")
      .eq("scope", scope)
      .order("created_at", { ascending: false });
    if (scope === "prospect" && prospectId) q = q.eq("prospect_id", prospectId);
    if (scope === "post_kickoff" && clientOfferingId)
      q = q.eq("client_offering_id", clientOfferingId);
    const { data: reportsData, error } = await q;

    // Check target existence
    let targetExists = false;
    if (scope === "prospect" && prospectId) {
      const { data } = await supabase
        .from("proposals")
        .select("id")
        .eq("prospect_id", prospectId)
        .limit(1)
        .maybeSingle();
      targetExists = !!data;
    } else if (scope === "post_kickoff" && clientOfferingId) {
      targetExists = true; // offering id is the target itself
    }

    if (error) toast.error("No se pudo cargar el historial de crítica");
    else setReports((reportsData as any) || []);
    setHasTarget(targetExists);
    setLoading(false);
  }, [prospectId, clientOfferingId, scope]);

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
          client_offering_id: clientOfferingId,
          scope,
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
        toast.info("Agente desactivado — actívalo en /admin/settings.");
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

  const applyRecommendation = async (idx: number, overrideValue?: any) => {
    if (!latest) return;
    setApplyingIdx(idx);
    try {
      const { data, error } = await supabase.functions.invoke(
        "apply-critique-recommendation",
        {
          body: {
            report_id: latest.id,
            recommendation_index: idx,
            override_value: overrideValue,
          },
        }
      );
      if (error) {
        const ctx: any = (error as any).context;
        let parsed: any = null;
        try {
          if (ctx && typeof ctx.json === "function") parsed = await ctx.json();
        } catch {}
        toast.error(parsed?.error || error.message || "No se pudo aplicar");
        return;
      }
      const beforeStr = data?.applied?.before !== undefined
        ? typeof data.applied.before === "string"
          ? data.applied.before.slice(0, 80)
          : JSON.stringify(data.applied.before).slice(0, 80)
        : null;
      const afterStr = data?.applied?.after !== undefined
        ? typeof data.applied.after === "string"
          ? data.applied.after.slice(0, 80)
          : JSON.stringify(data.applied.after).slice(0, 80)
        : null;
      toast.success("Recomendación aplicada", {
        description: beforeStr !== null && afterStr !== null
          ? `${data.applied.entity}: "${beforeStr || "(vacío)"}" → "${afterStr}"`
          : data?.applied
          ? `${data.applied.entity} actualizado`
          : undefined,
      });
      setEditingRec(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Error inesperado");
    } finally {
      setApplyingIdx(null);
    }
  };

  const regenerate = async () => {
    if (!latest) return;
    if (!confirm(scope === "prospect"
      ? "Esto regenerará la propuesta entera incorporando las críticas. ¿Continuar?"
      : "Esto añadirá las críticas a las notas del offering para revisión manual. ¿Continuar?"
    )) return;
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "regenerate-with-critique",
        { body: { report_id: latest.id } }
      );
      if (error) {
        const ctx: any = (error as any).context;
        let parsed: any = null;
        try {
          if (ctx && typeof ctx.json === "function") parsed = await ctx.json();
        } catch {}
        toast.error(parsed?.error || error.message || "No se pudo regenerar");
        return;
      }
      toast.success(
        scope === "prospect"
          ? "Propuesta regenerada con críticas"
          : "Críticas añadidas a notas del offering",
        { description: data?.message }
      );
      await load();
    } catch (e: any) {
      toast.error(e.message || "Error inesperado");
    } finally {
      setRegenerating(false);
    }
  };

  const openEditor = (idx: number, rec: Recommendation) => {
    setEditingRec({ idx, rec });
    setEditedValue(
      rec.new_value === undefined || rec.new_value === null
        ? ""
        : typeof rec.new_value === "string"
        ? rec.new_value
        : JSON.stringify(rec.new_value, null, 2)
    );
  };

  const submitEditor = () => {
    if (!editingRec) return;
    let val: any = editedValue;
    // Try parse JSON if it looks like one
    const trimmed = editedValue.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        val = JSON.parse(trimmed);
      } catch {
        // keep as string
      }
    } else if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      val = Number(trimmed);
    }
    applyRecommendation(editingRec.idx, val);
  };

  const latest = reports[0];
  const history = reports.slice(1);
  const headerTitle = title || (scope === "prospect" ? "Crítica IA de la propuesta" : "Crítica IA del offering (post-kickoff)");
  const headerSubtitle = subtitle || (scope === "prospect"
    ? "Un Sales Strategist IA revisa la propuesta antes de enviarla al cliente."
    : "Un Account Strategist IA valida el offering activado contra el contexto del kickoff.");
  const emptyTargetMsg = scope === "prospect"
    ? "Aún no hay propuesta generada. Genera primero la propuesta para poder analizarla."
    : "Falta el offering activado para analizar.";

  return (
    <>
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg">{headerTitle}</h3>
              <Badge variant="outline" className="text-[10px] uppercase">
                {scope === "prospect" ? "Pre-venta" : "Post-kickoff"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{headerSubtitle}</p>
          </div>
          <div className="flex gap-2">
            {latest && (
              <Button
                onClick={regenerate}
                disabled={regenerating}
                size="sm"
                variant="outline"
              >
                {regenerating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" />Regenerar con críticas</>
                )}
              </Button>
            )}
            <Button onClick={runCritique} disabled={running || !hasTarget} size="sm">
              {running ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analizando...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />{latest ? "Re-analizar" : "Analizar ahora"}</>
              )}
            </Button>
          </div>
        </div>

        {loading && (
          <div className="text-center py-6 text-muted-foreground text-sm">Cargando...</div>
        )}

        {!loading && !hasTarget && (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <p className="text-muted-foreground text-sm">{emptyTargetMsg}</p>
          </div>
        )}

        {!loading && hasTarget && !latest && (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <p className="text-muted-foreground text-sm">
              Aún no hay crítica. Pulsa "Analizar ahora".
            </p>
          </div>
        )}

        {latest && (
          <div className="space-y-4">
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
                    .map((r, originalIdx) => ({ r, originalIdx }))
                    .sort((a, b) => {
                      const o: any = { high: 0, medium: 1, low: 2 };
                      return (o[a.r.priority] ?? 3) - (o[b.r.priority] ?? 3);
                    })
                    .map(({ r, originalIdx }) => (
                      <li
                        key={originalIdx}
                        className={cn(
                          "text-sm border rounded p-3 bg-card space-y-2",
                          r.applied && "opacity-60"
                        )}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={priorityBadgeVariant(r.priority)} className="text-[10px] h-4 uppercase">
                            {r.priority}
                          </Badge>
                          <span className="font-medium">{r.section}</span>
                          {r.target_field && (
                            <Badge variant="secondary" className="text-[10px] h-4 font-mono">
                              {r.target_field}
                            </Badge>
                          )}
                          {r.applied && (
                            <Badge variant="outline" className="text-[10px] h-4 text-emerald-600 border-emerald-600">
                              Aplicada
                            </Badge>
                          )}
                        </div>
                        <p className="text-foreground">{r.change}</p>
                        {r.how && (
                          <p className="text-muted-foreground text-xs">→ {r.how}</p>
                        )}
                        {r.target_field && !r.applied && (
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="default"
                              disabled={applyingIdx === originalIdx}
                              onClick={() => applyRecommendation(originalIdx)}
                            >
                              {applyingIdx === originalIdx ? (
                                <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Aplicando</>
                              ) : (
                                <><Wand2 className="w-3 h-3 mr-1" />Aplicar</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditor(originalIdx, r)}
                            >
                              Editar y aplicar
                            </Button>
                          </div>
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

      <Dialog open={!!editingRec} onOpenChange={(o) => !o && setEditingRec(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar valor antes de aplicar</DialogTitle>
            <DialogDescription>
              {editingRec?.rec.target_field && (
                <span className="font-mono text-xs">{editingRec.rec.target_field}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{editingRec?.rec.change}</p>
            <Textarea
              value={editedValue}
              onChange={(e) => setEditedValue(e.target.value)}
              rows={10}
              className="font-mono text-xs"
              placeholder="Valor nuevo (texto plano, número o JSON)"
            />
            <p className="text-[11px] text-muted-foreground">
              Si el valor empieza con {`{`} o {`[`} será parseado como JSON. Si es un número puro, como número. Si no, como string.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRec(null)}>Cancelar</Button>
            <Button
              onClick={submitEditor}
              disabled={applyingIdx === editingRec?.idx}
            >
              {applyingIdx === editingRec?.idx ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Aplicando</>
              ) : (
                <><Wand2 className="w-4 h-4 mr-2" />Aplicar valor editado</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
