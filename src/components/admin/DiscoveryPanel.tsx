import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, ChevronDown, Plus, X, Sparkles, Users, MessageSquareQuote, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Competitor = { name: string; website_url: string; ig_handle: string };

export default function DiscoveryPanel({ clientId }: { clientId: string }) {
  // ============ Competitors ============
  const [competitors, setCompetitors] = useState<Competitor[]>([{ name: "", website_url: "", ig_handle: "" }]);
  const [runningCompetitors, setRunningCompetitors] = useState(false);
  const [competitorRows, setCompetitorRows] = useState<any[]>([]);

  // ============ VoC ============
  const [reviewsText, setReviewsText] = useState("");
  const [runningVoc, setRunningVoc] = useState(false);
  const [vocSnapshots, setVocSnapshots] = useState<any[]>([]);

  // ============ Winning Patterns ============
  const [assetType, setAssetType] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [perfMetric, setPerfMetric] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [runningPatterns, setRunningPatterns] = useState(false);
  const [patternRows, setPatternRows] = useState<any[]>([]);

  const loadAll = async () => {
    const [comp, voc, pat] = await Promise.all([
      supabase.from("client_competitor_analyses").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("client_context_snapshots").select("*").eq("client_id", clientId).eq("snapshot_type", "voc").order("created_at", { ascending: false }),
      supabase.from("client_winning_patterns").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    setCompetitorRows(comp.data || []);
    setVocSnapshots(voc.data || []);
    setPatternRows(pat.data || []);
  };

  useEffect(() => { loadAll(); }, [clientId]);

  // ====== Competitors handlers ======
  const updateCompetitor = (i: number, field: keyof Competitor, value: string) => {
    setCompetitors((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  };
  const addCompetitorRow = () => setCompetitors((p) => [...p, { name: "", website_url: "", ig_handle: "" }]);
  const removeCompetitorRow = (i: number) => setCompetitors((p) => p.filter((_, idx) => idx !== i));

  const runCompetitorAnalysis = async () => {
    const valid = competitors.filter((c) => c.website_url.trim() || c.ig_handle.trim());
    if (valid.length === 0) {
      toast.error("Añade al menos un competidor con URL o handle de Instagram");
      return;
    }
    setRunningCompetitors(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-local-competitors", {
        body: { client_id: clientId, competitors: valid },
      });
      if (error) throw error;
      toast.success(`Análisis iniciado: ${data?.results?.length || 0} competidores`);
      await loadAll();
    } catch (e: any) {
      toast.error(e.message || "Error analizando competidores");
    } finally {
      setRunningCompetitors(false);
    }
  };

  // ====== VoC handlers ======
  const runVocExtraction = async () => {
    if (reviewsText.trim().length < 50) {
      toast.error("Pega al menos 50 caracteres de reseñas reales");
      return;
    }
    setRunningVoc(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-voice-of-customer", {
        body: { client_id: clientId, reviews_text: reviewsText },
      });
      if (error) throw error;
      toast.success("Voice of Customer extraído");
      setReviewsText("");
      await loadAll();
    } catch (e: any) {
      toast.error(e.message || "Error extrayendo VoC");
    } finally {
      setRunningVoc(false);
    }
  };

  // ====== Patterns handlers ======
  const runPatternAnalysis = async () => {
    if (sourceContent.trim().length < 30) {
      toast.error("Pega el contenido del asset performante (min 30 caracteres)");
      return;
    }
    setRunningPatterns(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-winning-patterns", {
        body: {
          client_id: clientId,
          asset_type: assetType || undefined,
          source_label: sourceLabel || undefined,
          performance_metric: perfMetric || undefined,
          source_content: sourceContent,
        },
      });
      if (error) throw error;
      toast.success("Patrón ganador extraído");
      setSourceContent("");
      setSourceLabel("");
      setPerfMetric("");
      await loadAll();
    } catch (e: any) {
      toast.error(e.message || "Error analizando patrones");
    } finally {
      setRunningPatterns(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="p-5 border-b border-border bg-secondary/20">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Discovery & Inteligencia de mercado</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Enriquece el contexto del cliente con análisis de competencia, voz del cliente real y patrones de assets ganadores.
        </p>
      </div>

      {/* ============ Competitors ============ */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Competidores locales</span>
            <Badge variant="secondary" className="text-xs">{competitorRows.length}</Badge>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              {competitors.map((c, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_auto] gap-2 items-center">
                  <Input placeholder="Nombre" value={c.name} onChange={(e) => updateCompetitor(i, "name", e.target.value)} />
                  <Input placeholder="https://..." value={c.website_url} onChange={(e) => updateCompetitor(i, "website_url", e.target.value)} />
                  <Input placeholder="@instagram" value={c.ig_handle} onChange={(e) => updateCompetitor(i, "ig_handle", e.target.value)} />
                  <Button size="icon" variant="ghost" onClick={() => removeCompetitorRow(i)} disabled={competitors.length === 1}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addCompetitorRow}>
                <Plus className="w-4 h-4 mr-1" /> Añadir competidor
              </Button>
            </div>
            <Button onClick={runCompetitorAnalysis} disabled={runningCompetitors}>
              {runningCompetitors && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Analizar competidores
            </Button>

            {competitorRows.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground">Análisis previos</p>
                {competitorRows.map((r) => (
                  <div key={r.id} className="text-xs border border-border rounded p-3 bg-secondary/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{r.competitor_name || r.competitor_url || r.competitor_ig_handle}</span>
                      <StatusPill status={r.status} />
                    </div>
                    {r.ai_summary && <p className="text-muted-foreground line-clamp-3">{r.ai_summary}</p>}
                    {r.error && <p className="text-destructive text-xs mt-1">{r.error}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ============ VoC ============ */}
      <Collapsible>
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Voice of Customer</span>
            <Badge variant="secondary" className="text-xs">{vocSnapshots.length}</Badge>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Pega 5-10 reseñas reales (Google, Trustpilot, IG, encuestas) para extraer JTBD, objeciones y frases utilizables.
            </p>
            <Textarea
              placeholder="Pega aquí las reseñas reales del cliente..."
              value={reviewsText}
              onChange={(e) => setReviewsText(e.target.value)}
              className="min-h-[140px]"
            />
            <Button onClick={runVocExtraction} disabled={runningVoc}>
              {runningVoc && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Extraer Voice of Customer
            </Button>

            {vocSnapshots.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground">Snapshots previos</p>
                {vocSnapshots.map((s) => {
                  const d = (s.context_data || {}) as any;
                  return (
                    <div key={s.id} className="text-xs border border-border rounded p-3 bg-secondary/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{new Date(s.created_at).toLocaleDateString()}</span>
                        <Badge variant="secondary" className="text-xs">{d.real_phrases?.length || 0} frases</Badge>
                      </div>
                      {d.summary && <p className="text-muted-foreground line-clamp-2">{d.summary}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ============ Winning Patterns ============ */}
      <Collapsible>
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Patrones ganadores</span>
            <Badge variant="secondary" className="text-xs">{patternRows.length}</Badge>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Pega un asset que ya funcionó (email, post, landing) para extraer la fórmula replicable.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input placeholder="Tipo (email, post, landing...)" value={assetType} onChange={(e) => setAssetType(e.target.value)} />
              <Input placeholder="Etiqueta (opcional)" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
              <Input placeholder="Métrica (CTR 8%, ROAS 4x...)" value={perfMetric} onChange={(e) => setPerfMetric(e.target.value)} />
            </div>
            <Textarea
              placeholder="Pega el contenido del asset performante..."
              value={sourceContent}
              onChange={(e) => setSourceContent(e.target.value)}
              className="min-h-[140px]"
            />
            <Button onClick={runPatternAnalysis} disabled={runningPatterns}>
              {runningPatterns && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Extraer patrón ganador
            </Button>

            {patternRows.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground">Patrones extraídos</p>
                {patternRows.map((r) => {
                  const p = (r.extracted_patterns || {}) as any;
                  return (
                    <div key={r.id} className="text-xs border border-border rounded p-3 bg-secondary/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.source_label || r.asset_type || "Asset"}</span>
                        {r.performance_metric && <Badge variant="secondary" className="text-xs">{r.performance_metric}</Badge>}
                      </div>
                      {p.replicable_formula && <p className="text-muted-foreground">{p.replicable_formula}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "completed") return <Badge variant="secondary" className="text-xs gap-1"><CheckCircle2 className="w-3 h-3" />completado</Badge>;
  if (status === "error") return <Badge variant="destructive" className="text-xs gap-1"><AlertCircle className="w-3 h-3" />error</Badge>;
  return <Badge variant="secondary" className="text-xs gap-1"><Loader2 className="w-3 h-3 animate-spin" />{status}</Badge>;
}
