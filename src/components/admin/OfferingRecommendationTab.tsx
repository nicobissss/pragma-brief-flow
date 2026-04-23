import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CheckCircle2, AlertTriangle, Sparkles, ArrowRight, ChevronDown, ChevronUp, Trophy, Loader2, Play, RefreshCw,
  Pencil, Send, Wand2, Eye, EyeOff,
} from "lucide-react";
import { OfferingDetails } from "@/components/shared/OfferingDetails";
import { Textarea } from "@/components/ui/textarea";

type Offering = {
  id: string;
  name: string;
  short_name: string;
  tier: number;
  category: string;
  description: string | null;
  value_proposition: string | null;
  deliverables: any;
  task_templates: any;
  expected_outcomes: any;
  applicable_verticals: any;
  applicable_sub_niches: any;
  required_platforms: any;
  recommended_platforms: any;
  monthly_fee_eur: number | null;
  setup_fee_eur: number | null;
  one_shot_fee_eur: number | null;
  setup_hours_estimate: number | null;
  recommendation_rules: any;
  is_featured: boolean | null;
  is_active: boolean | null;
};

type Recommendation = Offering & {
  score: number;
  reasons: string[];
  missingPlatforms: string[];
};

type ClientOffering = {
  id: string;
  client_id: string;
  offering_template_id: string;
  custom_name: string | null;
  custom_price_eur: number | null;
  status: string;
  was_recommended: boolean | null;
  recommendation_score: number | null;
  recommendation_reasons: any;
  proposed_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
};

type Task = { id: string; status: string | null };

const TIER_LABELS: Record<number, string> = {
  1: "Entry",
  2: "Retainer",
  3: "One-shot",
};

const STATUS_BADGE: Record<string, string> = {
  selected_internal: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  proposed: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  accepted: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  active: "bg-green-500/10 text-green-700 border-green-500/30",
  completed: "bg-primary/10 text-primary border-primary/30",
  paused: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

const STATUS_LABEL: Record<string, string> = {
  selected_internal: "Selección interna",
  proposed: "Propuesta al cliente",
  accepted: "Aceptada",
  active: "Activa",
  completed: "Completada",
  paused: "Pausada",
  cancelled: "Cancelada",
};

function formatPricing(o: Pick<Offering, "monthly_fee_eur" | "setup_fee_eur" | "one_shot_fee_eur">) {
  if (o.one_shot_fee_eur) return `${o.one_shot_fee_eur}€ one-shot`;
  if (o.monthly_fee_eur) {
    return `${o.monthly_fee_eur}€/mes${o.setup_fee_eur ? ` + ${o.setup_fee_eur}€ setup` : ""}`;
  }
  if (o.setup_fee_eur) return `${o.setup_fee_eur}€ setup`;
  return "Pricing custom";
}

export default function OfferingRecommendationTab({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [activeOffering, setActiveOffering] = useState<(ClientOffering & { template: Offering | null }) | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [allOfferings, setAllOfferings] = useState<Offering[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [proposing, setProposing] = useState<string | null>(null);
  const [confirmOffering, setConfirmOffering] = useState<Recommendation | Offering | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [changing, setChanging] = useState(false);
  // Editable fields in the propose dialog
  const [proposeName, setProposeName] = useState("");
  const [proposeNotes, setProposeNotes] = useState("");
  const [includePrice, setIncludePrice] = useState(false);
  const [proposePrice, setProposePrice] = useState<string>("");
  // AI customization
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiCustomizing, setAiCustomizing] = useState(false);
  const [customDeliverables, setCustomDeliverables] = useState<any[] | null>(null);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  // Edit dialog for active offering
  const [editingActive, setEditingActive] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDeliverables, setEditDeliverables] = useState<any[]>([]);
  const [editAiInstructions, setEditAiInstructions] = useState("");
  const [editAiLoading, setEditAiLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [sendingToClient, setSendingToClient] = useState(false);

  const load = async () => {
    setLoading(true);

    // Active offering
    const { data: existingArr } = await supabase
      .from("client_offerings")
      .select("*")
      .eq("client_id", clientId)
      .order("proposed_at", { ascending: false })
      .limit(1);
    const existing = existingArr?.[0] as any;

    if (existing && !changing) {
      const { data: tpl } = await supabase
        .from("offering_templates")
        .select("*")
        .eq("id", existing.offering_template_id)
        .maybeSingle();
      const { data: t } = await supabase
        .from("action_plan_tasks")
        .select("id, status")
        .eq("client_offering_id", existing.id);
      setActiveOffering({ ...(existing as ClientOffering), template: (tpl as Offering) || null });
      setTasks((t || []) as Task[]);
      setLoading(false);
      return;
    }

    // Recommendations
    const [{ data: client }, { data: kickoff }, { data: cPlatforms }, { data: offerings }] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
      supabase.from("kickoff_briefs").select("transcript_text, client_materials").eq("client_id", clientId).maybeSingle(),
      supabase.from("client_platforms").select("platform_id, has_access").eq("client_id", clientId),
      supabase.from("offering_templates").select("*").eq("is_active", true).order("tier").order("sort_order"),
    ]);

    const all = (offerings || []) as Offering[];
    setAllOfferings(all);

    // Build platform → category map
    const platformIds = (cPlatforms || []).map((p: any) => p.platform_id);
    const { data: platformMeta } = platformIds.length
      ? await supabase.from("supported_platforms").select("id, category, name").in("id", platformIds)
      : { data: [] as any[] };
    const clientCategories = new Set((platformMeta || []).map((p: any) => p.category));

    const transcript = (kickoff?.transcript_text || "").toLowerCase();
    const clientVertical = client?.vertical || "";

    const recs: Recommendation[] = all.map((offering) => {
      let score = 0;
      const reasons: string[] = [];
      const missing: string[] = [];

      // Vertical match (30%)
      const verticals = (offering.applicable_verticals as any) || [];
      const verticalsArr = Array.isArray(verticals) ? verticals : [];
      if (verticalsArr.length === 0 || verticalsArr.includes(clientVertical) || verticalsArr.includes("all")) {
        score += 0.3;
        if (clientVertical) reasons.push(`Adatta al vertical ${clientVertical}`);
      }

      // Keywords in transcript (25%)
      const rules = (offering.recommendation_rules as any) || {};
      const keywords: string[] = Array.isArray(rules.keywords_in_transcript) ? rules.keywords_in_transcript : [];
      if (keywords.length > 0 && transcript) {
        const matched = keywords.filter((k) => transcript.includes(String(k).toLowerCase()));
        if (matched.length > 0) {
          score += 0.25 * (matched.length / keywords.length);
          reasons.push(`Mencionado en kickoff: ${matched.slice(0, 3).join(", ")}`);
        }
      }

      // Platform check (15%)
      const required: string[] = Array.isArray(offering.required_platforms) ? (offering.required_platforms as string[]) : [];
      if (required.length === 0) {
        score += 0.15;
      } else {
        const missingCats = required.filter((cat) => !clientCategories.has(cat));
        if (missingCats.length === 0) {
          score += 0.15;
          reasons.push("Tiene todas las plataformas necesarias");
        } else {
          missing.push(...missingCats);
        }
      }

      // Sub-niche bonus (15%)
      const subNiches = (offering.applicable_sub_niches as any) || [];
      if (Array.isArray(subNiches) && client?.sub_niche && subNiches.includes(client.sub_niche)) {
        score += 0.15;
        reasons.push(`Especializada en ${client.sub_niche}`);
      }

      // Featured (15%)
      if (offering.is_featured) {
        score += 0.15;
        reasons.push("Oferta destacada");
      }

      return {
        ...offering,
        score: Math.min(score, 1),
        reasons,
        missingPlatforms: missing,
      };
    }).sort((a, b) => b.score - a.score);

    setRecommendations(recs.slice(0, 3));
    setActiveOffering(null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, changing]);

  const handlePropose = async (offering: Recommendation | Offering, initialStatus: "selected_internal" | "proposed" = "selected_internal") => {
    setProposing(offering.id);
    try {
      const score = "score" in offering ? offering.score : null;
      const reasons = "reasons" in offering ? offering.reasons : [];
      const wasRecommended = recommendations.some((r) => r.id === offering.id);

      const customNameTrimmed = proposeName.trim();
      const useCustomName = customNameTrimmed && customNameTrimmed !== offering.name;
      const notesTrimmed = proposeNotes.trim();
      const parsedPrice = includePrice && proposePrice ? Number(proposePrice) : null;

      const insertPayload: any = {
        client_id: clientId,
        offering_template_id: offering.id,
        status: initialStatus,
        was_recommended: wasRecommended,
        recommendation_score: score,
        recommendation_reasons: reasons as any,
        proposed_at: new Date().toISOString(),
        custom_name: useCustomName ? customNameTrimmed : null,
        custom_price_eur: parsedPrice && !isNaN(parsedPrice) ? Math.round(parsedPrice) : null,
        notes: notesTrimmed || null,
      };
      if (customDeliverables && customDeliverables.length > 0) {
        insertPayload.custom_deliverables = customDeliverables;
      }

      const { data: created, error } = await supabase
        .from("client_offerings")
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      // Auto-generate tasks
      const { error: rpcErr } = await supabase.rpc("generate_tasks_for_offering" as any, {
        p_client_offering_id: created.id,
      });
      if (rpcErr) {
        console.warn("Task generation failed:", rpcErr);
        toast.warning("Oferta creada, pero falló la generación de tareas");
      } else {
        toast.success(initialStatus === "selected_internal"
          ? "Oferta seleccionada para uso interno (cliente no la ve aún)"
          : "Oferta propuesta al cliente");
      }

      setConfirmOffering(null);
      setCustomDeliverables(null);
      setAiRationale(null);
      setAiInstructions("");
      setChanging(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Error al proponer oferta");
    } finally {
      setProposing(null);
    }
  };

  const handleCustomizeWithAI = async (offering: Recommendation | Offering) => {
    if (!aiInstructions.trim()) {
      toast.error("Escribe instrucciones para la IA");
      return;
    }
    setAiCustomizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("customize-offering", {
        body: {
          offering_template_id: offering.id,
          current_overrides: {
            name: proposeName,
            notes: proposeNotes,
            deliverables: customDeliverables,
          },
          instructions: aiInstructions,
          client_id: clientId,
        },
      });
      if (error) throw error;
      if (!data?.suggestion) throw new Error("Sin sugerencia de la IA");
      const s = data.suggestion;
      if (s.name) setProposeName(s.name);
      if (s.notes !== undefined) setProposeNotes(s.notes || "");
      if (Array.isArray(s.deliverables)) setCustomDeliverables(s.deliverables);
      setAiRationale(s.rationale || null);
      toast.success("IA actualizó la oferta");
    } catch (e: any) {
      toast.error(e.message || "Error al consultar IA");
    } finally {
      setAiCustomizing(false);
    }
  };

  // Reset edit fields whenever a new offering is selected
  useEffect(() => {
    if (confirmOffering) {
      setProposeName(confirmOffering.name);
      setProposeNotes("");
      setIncludePrice(false);
      setProposePrice("");
      setCustomDeliverables(null);
      setAiInstructions("");
      setAiRationale(null);
    }
  }, [confirmOffering]);

  const updateOfferingStatus = async (status: string, extra: Record<string, any> = {}) => {
    if (!activeOffering) return;
    const { error } = await supabase
      .from("client_offerings")
      .update({ status, ...extra } as any)
      .eq("id", activeOffering.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Estado actualizado");
    await load();
  };

  const openEditActive = () => {
    if (!activeOffering) return;
    const tpl = activeOffering.template;
    setEditName(activeOffering.custom_name || tpl?.name || "");
    setEditNotes(activeOffering.notes || "");
    const baseDeliv = (activeOffering as any).custom_deliverables || tpl?.deliverables || [];
    setEditDeliverables(Array.isArray(baseDeliv) ? baseDeliv : []);
    setEditAiInstructions("");
    setEditingActive(true);
  };

  const handleEditAI = async () => {
    if (!activeOffering || !editAiInstructions.trim()) {
      toast.error("Escribe instrucciones para la IA");
      return;
    }
    setEditAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customize-offering", {
        body: {
          offering_template_id: activeOffering.offering_template_id,
          current_overrides: {
            name: editName,
            notes: editNotes,
            deliverables: editDeliverables,
          },
          instructions: editAiInstructions,
          client_id: clientId,
        },
      });
      if (error) throw error;
      const s = data?.suggestion;
      if (!s) throw new Error("Sin sugerencia de la IA");
      if (s.name) setEditName(s.name);
      if (s.notes !== undefined) setEditNotes(s.notes || "");
      if (Array.isArray(s.deliverables)) setEditDeliverables(s.deliverables);
      toast.success("IA actualizó la propuesta");
      setEditAiInstructions("");
    } catch (e: any) {
      toast.error(e.message || "Error IA");
    } finally {
      setEditAiLoading(false);
    }
  };

  const saveEditActive = async () => {
    if (!activeOffering) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("client_offerings")
        .update({
          custom_name: editName.trim() || null,
          notes: editNotes.trim() || null,
          custom_deliverables: editDeliverables as any,
        } as any)
        .eq("id", activeOffering.id);
      if (error) throw error;
      toast.success("Cambios guardados");
      setEditingActive(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Error guardando");
    } finally {
      setEditSaving(false);
    }
  };

  const sendToClient = async () => {
    if (!activeOffering) return;
    setSendingToClient(true);
    try {
      const { error } = await supabase
        .from("client_offerings")
        .update({ status: "proposed", proposed_at: new Date().toISOString() } as any)
        .eq("id", activeOffering.id);
      if (error) throw error;
      toast.success("Oferta enviada al cliente");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setSendingToClient(false);
    }
  };

  const toggleEditDeliverable = (index: number) => {
    setEditDeliverables((prev) => prev.map((d, i) => i === index ? { ...d, _excluded: !d._excluded } : d));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // ─── Active offering view ────────────────────────────
  if (activeOffering && !changing) {
    const tpl = activeOffering.template;
    const name = activeOffering.custom_name || tpl?.name || "Oferta";
    const doneTasks = tasks.filter((t) => t.status === "done").length;
    const totalTasks = tasks.length;
    const taskProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-semibold text-foreground">{name}</h2>
                <Badge variant="outline" className={STATUS_BADGE[activeOffering.status] || ""}>
                  {activeOffering.status}
                </Badge>
                {activeOffering.was_recommended && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    <Sparkles className="w-3 h-3 mr-1" /> Recomendada
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Pricing interno: <span className="font-medium text-foreground">{tpl ? formatPricing(tpl) : "—"}</span>
                {tpl?.setup_hours_estimate ? ` · ~${tpl.setup_hours_estimate}h setup` : ""}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setChanging(true)}>
              <RefreshCw className="w-4 h-4 mr-1" /> Cambiar oferta
            </Button>
          </div>

          {tpl && <OfferingDetails offering={tpl as any} audience="admin" />}

          {totalTasks > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-muted-foreground">
                  Progreso del plan: {doneTasks} / {totalTasks}
                </span>
                <span className="text-sm font-medium text-foreground">{taskProgress}%</span>
              </div>
              <Progress value={taskProgress} className="h-2" />
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {activeOffering.status === "proposed" && (
              <Button onClick={() => updateOfferingStatus("accepted", { accepted_at: new Date().toISOString() })}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Marcar como aceptada
              </Button>
            )}
            {activeOffering.status === "accepted" && (
              <Button onClick={() => updateOfferingStatus("active", { started_at: new Date().toISOString() })}>
                <Play className="w-4 h-4 mr-1" /> Iniciar ejecución
              </Button>
            )}
            {activeOffering.status === "active" && (
              <Button variant="outline" onClick={() => updateOfferingStatus("completed", { completed_at: new Date().toISOString() })}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Marcar completada
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Recommendations view ────────────────────────────
  return (
    <div className="space-y-6">
      {changing && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-foreground">Cambio de oferta</p>
            <p className="text-xs text-muted-foreground">
              Si propones una nueva oferta, la anterior quedará en historial. Los tasks ya creados se mantendrán.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setChanging(false)}>
            Cancelar
          </Button>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Recomendaciones
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Top 3 ofertas según vertical, kickoff y plataformas del cliente.
        </p>
      </div>

      {recommendations.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">No hay ofertas activas en el catálogo.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec, idx) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              isBest={idx === 0}
              onPropose={() => setConfirmOffering(rec)}
              proposing={proposing === rec.id}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => setShowAll(!showAll)}
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Ver todas las ofertas ({allOfferings.length})
      </button>

      {showAll && (
        <div className="grid sm:grid-cols-2 gap-4">
          {allOfferings.map((o) => (
            <div key={o.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-foreground text-sm">{o.name}</h4>
                  <p className="text-xs text-muted-foreground">Tier {o.tier} · {TIER_LABELS[o.tier]}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{o.category}</Badge>
              </div>
              <p className="text-sm text-foreground font-medium">{formatPricing(o)}</p>
              {o.description && <p className="text-xs text-muted-foreground line-clamp-2">{o.description}</p>}
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2"
                onClick={() => setConfirmOffering(o)}
                disabled={proposing === o.id}
              >
                Proponer
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Confirm dialog — editable proposal */}
      <Dialog open={!!confirmOffering} onOpenChange={(open) => !open && setConfirmOffering(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Revisar antes de proponer</DialogTitle>
            <DialogDescription>
              Personaliza nombre, notas y (opcionalmente) un precio antes de proponer la oferta al cliente. El precio queda oculto si no lo añades.
            </DialogDescription>
          </DialogHeader>
          {confirmOffering && (
            <div className="space-y-4 py-2">
              <div className="bg-secondary/40 rounded-lg p-3 text-xs text-muted-foreground">
                <p>Plantilla: <span className="font-medium text-foreground">{confirmOffering.name}</span></p>
                {confirmOffering.value_proposition && (
                  <p className="mt-1">{confirmOffering.value_proposition}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Nombre que verá el cliente</label>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={proposeName}
                  onChange={(e) => setProposeName(e.target.value)}
                  placeholder="Nombre de la oferta"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Notas internas (opcional)</label>
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[70px]"
                  value={proposeNotes}
                  onChange={(e) => setProposeNotes(e.target.value)}
                  placeholder="Contexto solo para el equipo Pragma…"
                />
              </div>

              <div className="rounded-md border border-border p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePrice}
                    onChange={(e) => setIncludePrice(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Añadir precio personalizado
                </label>
                {includePrice && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={proposePrice}
                      onChange={(e) => setProposePrice(e.target.value)}
                      placeholder="Ej. 1500"
                    />
                    <span className="text-sm text-muted-foreground">€</span>
                  </div>
                )}
                {!includePrice && (
                  <p className="text-[11px] text-muted-foreground">
                    Sin precio el cliente solo verá el alcance — útil para acuerdos personalizados.
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOffering(null)}>Cancelar</Button>
            <Button
              onClick={() => confirmOffering && handlePropose(confirmOffering)}
              disabled={!!proposing || !proposeName.trim()}
            >
              {proposing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-1" />}
              Confirmar y proponer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecommendationCard({
  rec, isBest, onPropose, proposing,
}: {
  rec: Recommendation;
  isBest: boolean;
  onPropose: () => void;
  proposing: boolean;
}) {
  const scorePct = Math.round(rec.score * 100);
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div className={`bg-card border rounded-2xl p-5 space-y-4 shadow-sm ${isBest ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isBest && (
              <Badge className="bg-primary text-primary-foreground border-0">
                <Trophy className="w-3 h-3 mr-1" /> MEJOR MATCH
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">Tier {rec.tier}</Badge>
            <Badge variant="outline" className="text-[10px]">{rec.category}</Badge>
          </div>
          <h3 className="text-lg font-semibold text-foreground">{rec.name}</h3>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold text-foreground">{formatPricing(rec)}</p>
          {rec.setup_hours_estimate && (
            <p className="text-xs text-muted-foreground">~{rec.setup_hours_estimate}h setup</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">Match score</span>
          <span className="text-xs font-semibold text-foreground">{scorePct}%</span>
        </div>
        <Progress value={scorePct} className="h-2" />
      </div>

      <OfferingDetails offering={rec as any} audience="admin" showSteps={showDetails} />

      <button
        onClick={() => setShowDetails((v) => !v)}
        className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
      >
        {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {showDetails ? "Ocultar pasos de la campaña" : "Ver pasos de la campaña"}
      </button>

      {rec.reasons.length > 0 && (
        <div className="bg-secondary/30 rounded-lg p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Por qué encaja
          </p>
          <ul className="space-y-1">
            {rec.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 className="w-4 h-4 text-[hsl(142,71%,35%)] mt-0.5 shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rec.missingPlatforms.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
            <AlertTriangle className="w-4 h-4" />
            Plataformas faltantes
          </div>
          {rec.missingPlatforms.map((p, i) => (
            <p key={i} className="text-xs text-foreground pl-6">
              Falta categoría <strong>{p}</strong> → sugerir plan inicial gratuito o setup asistido
            </p>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-border">
        <Button onClick={onPropose} disabled={proposing} className="flex-1">
          {proposing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-1" />}
          Proponer al cliente
        </Button>
      </div>
    </div>
  );
}
