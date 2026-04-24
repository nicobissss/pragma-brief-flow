import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Check, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ApplyableField = "objective" | "target_audience" | "key_message" | "timeline";

type Suggestion = {
  field: string;
  current_value: string;
  issue: string;
  suggested_value: string;
  rationale: string;
};

type EnrichResult = {
  completeness_score: number;
  overall_assessment: string;
  suggestions: Suggestion[];
  missing_questions: string[];
};

const FIELD_LABELS: Record<string, string> = {
  objective: "Objetivo",
  target_audience: "Audiencia",
  key_message: "Mensaje clave",
  timeline: "Timeline",
  description: "Descripción",
};

interface BriefEnrichmentPanelProps {
  clientId: string;
  campaignId: string;
  brief: {
    name?: string;
    objective?: string;
    target_audience?: string;
    key_message?: string;
    timeline?: string;
    description?: string;
  };
  onApply: (field: ApplyableField, value: string) => void;
}

export function BriefEnrichmentPanel({ clientId, campaignId, brief, onApply }: BriefEnrichmentPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnrichResult | null>(null);
  const [open, setOpen] = useState(true);
  const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set());

  const run = async () => {
    setLoading(true);
    setAppliedFields(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("enrich-campaign-brief", {
        body: { client_id: clientId, campaign_id: campaignId, brief },
      });
      if (error) throw error;
      if ((data as any)?.skipped) {
        toast.info("El agente Briefer Enrichment está desactivado para este cliente.");
        return;
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as EnrichResult);
      setOpen(true);
      toast.success(`Análisis listo (completeness ${(data as any)?.completeness_score ?? "?"}/100)`);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo analizar el brief");
    } finally {
      setLoading(false);
    }
  };

  const apply = (s: Suggestion) => {
    if (!(["objective", "target_audience", "key_message", "timeline"] as string[]).includes(s.field)) {
      toast.info(`Campo "${s.field}" no editable desde aquí. Cópialo a mano.`);
      return;
    }
    onApply(s.field as ApplyableField, s.suggested_value);
    setAppliedFields((prev) => new Set(prev).add(s.field));
    toast.success(`Aplicado a ${FIELD_LABELS[s.field] || s.field}`);
  };

  const scoreColor = (score: number) => {
    if (score >= 75) return "bg-[hsl(var(--status-approved))]/15 text-[hsl(var(--status-approved))] border-[hsl(var(--status-approved))]/30";
    if (score >= 50) return "bg-[hsl(var(--status-pending-review))]/15 text-[hsl(var(--status-pending-review))] border-[hsl(var(--status-pending-review))]/30";
    return "bg-destructive/15 text-destructive border-destructive/30";
  };

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Sugerencias IA del brief</span>
          {result && (
            <Badge variant="outline" className={`text-[10px] ${scoreColor(result.completeness_score)}`}>
              {result.completeness_score}/100
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {result && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen((o) => !o)}>
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={run} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
            {result ? "Reanalizar" : "Analizar brief"}
          </Button>
        </div>
      </div>

      {result && open && (
        <div className="space-y-3">
          {result.overall_assessment && (
            <p className="text-xs text-muted-foreground italic">{result.overall_assessment}</p>
          )}

          {result.suggestions.length === 0 ? (
            <p className="text-xs text-[hsl(var(--status-approved))] flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              El brief está completo, no hay sugerencias.
            </p>
          ) : (
            <div className="space-y-2">
              {result.suggestions.map((s, i) => {
                const applied = appliedFields.has(s.field);
                const editable = ["objective", "target_audience", "key_message", "timeline"].includes(s.field);
                return (
                  <div key={i} className="rounded border border-border bg-background p-2.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {FIELD_LABELS[s.field] || s.field}
                      </Badge>
                      <Button
                        size="sm"
                        variant={applied ? "ghost" : "default"}
                        className="h-6 px-2 text-[11px]"
                        disabled={applied || !editable}
                        onClick={() => apply(s)}
                      >
                        {applied ? <><Check className="w-3 h-3 mr-1" /> Aplicado</> : "Aplicar"}
                      </Button>
                    </div>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Problema:</span> {s.issue}</p>
                    <div className="rounded bg-secondary/50 p-2">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Sugerencia:</p>
                      <p className="text-foreground">{s.suggested_value}</p>
                    </div>
                    {s.rationale && (
                      <p className="text-[10px] text-muted-foreground">→ {s.rationale}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {result.missing_questions?.length > 0 && (
            <div className="rounded border border-dashed border-border p-2.5 space-y-1">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                Preguntas que el brief no responde
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 pl-4 list-disc">
                {result.missing_questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
