import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, Loader2, Star, StarOff, Check, RefreshCw, Trash2, Image as ImageIcon, Layers,
} from "lucide-react";
import { toast } from "sonner";

type MasterAsset = {
  id: string;
  campaign_id: string;
  client_id: string;
  label: string;
  is_primary: boolean;
  version: number;
  status: string;
  brand_kit: any;
  visual_layout: any;
  source_image_url: string | null;
  visual_preview_url: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_VARIANT: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]",
  archived: "bg-secondary/30 text-muted-foreground",
};

export function MasterAssetsTab({ campaignId, clientId }: { campaignId: string; clientId: string }) {
  const [items, setItems] = useState<MasterAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [instructions, setInstructions] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editHero, setEditHero] = useState("");
  const [editCta, setEditCta] = useState("");
  const [variationFormats, setVariationFormats] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renderingId, setRenderingId] = useState<string | null>(null);
  const [editPrompts, setEditPrompts] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("campaign_master_assets")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data || []) as MasterAsset[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [campaignId]);

  const generate = async (master_asset_id?: string) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-master-asset", {
        body: {
          campaign_id: campaignId,
          master_asset_id,
          source_image_url: sourceUrl || undefined,
          instructions: instructions || undefined,
        },
      });
      if (error) throw error;
      if (data?.skipped) { toast.info(data.reason || "Agente desactivado"); return; }
      toast.success(master_asset_id ? "Master regenerado" : "Master generado");
      setSourceUrl(""); setInstructions("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Error generando master");
    } finally { setGenerating(false); }
  };

  const setPrimary = async (id: string) => {
    setBusyId(id);
    try {
      await supabase.from("campaign_master_assets").update({ is_primary: false }).eq("campaign_id", campaignId);
      await supabase.from("campaign_master_assets").update({ is_primary: true }).eq("id", id);
      toast.success("Master primario actualizado");
      await load();
    } finally { setBusyId(null); }
  };

  const setStatus = async (id: string, status: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase.from("campaign_master_assets").update({ status }).eq("id", id);
      if (error) throw error;
      toast.success(`Estado: ${status}`);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusyId(null); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este master?")) return;
    setBusyId(id);
    try {
      const { error } = await supabase.from("campaign_master_assets").delete().eq("id", id);
      if (error) throw error;
      toast.success("Eliminado");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusyId(null); }
  };

  const startEdit = (m: MasterAsset) => {
    setEditingId(m.id);
    setEditLabel(m.label || "");
    setEditHero(m.visual_layout?.hero_message || "");
    setEditCta(m.visual_layout?.cta_label || "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const m = items.find(i => i.id === editingId);
    if (!m) return;
    const newLayout = { ...(m.visual_layout || {}), hero_message: editHero, cta_label: editCta };
    const { error } = await supabase.from("campaign_master_assets")
      .update({ label: editLabel, visual_layout: newLayout })
      .eq("id", editingId);
    if (error) { toast.error(error.message); return; }
    toast.success("Cambios guardados");
    setEditingId(null);
    await load();
  };

  const generateVariations = async (id: string) => {
    const raw = (variationFormats[id] || "").trim();
    if (!raw) { toast.error("Indica los formatos (ej: ig_post, email, paid_meta)"); return; }
    const formats = raw.split(",").map(s => s.trim()).filter(Boolean);
    setBusyId(id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-master-asset-variations", {
        body: { master_asset_id: id, formats },
      });
      if (error) throw error;
      if (data?.skipped) { toast.info(data.reason); return; }
      toast.success(`${data?.created_count || 0} variantes creadas`);
      setVariationFormats(prev => ({ ...prev, [id]: "" }));
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusyId(null); }
  };

  const renderImage = async (id: string, opts: { regenerate?: boolean; edit_instructions?: string } = {}) => {
    setRenderingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("render-master-asset-image", {
        body: {
          master_asset_id: id,
          regenerate: opts.regenerate || false,
          edit_instructions: opts.edit_instructions || undefined,
        },
      });
      if (error) throw error;
      if (data?.skipped) { toast.info(data.reason); return; }
      toast.success("Mockup actualizado");
      setEditPrompts(prev => ({ ...prev, [id]: "" }));
      await load();
    } catch (e: any) {
      toast.error(e.message || "Error generando imagen");
    } finally { setRenderingId(null); }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Generation header */}
      <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold">Generar nuevo Master Asset</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          La IA usa el contexto del cliente (kickoff, voz, materiales) y la oferta vinculada para crear un Master coherente.
          Puedes (opcional) anclar una imagen de referencia o dar instrucciones específicas.
        </p>
        <Input
          placeholder="URL de imagen de referencia (opcional)"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        />
        <Textarea
          placeholder="Instrucciones específicas (opcional): ej. 'usar paleta azul/dorado, tono más institucional'"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
        />
        <Button size="sm" onClick={() => generate()} disabled={generating}>
          {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
          Generar Master
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Aún no hay Master Assets. Genera el primero arriba.</p>
      ) : (
        <div className="space-y-3">
          {items.map((m) => {
            const vl = m.visual_layout || {};
            const bk = m.brand_kit || {};
            const isEditing = editingId === m.id;
            return (
              <div key={m.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {m.is_primary && <Star className="w-4 h-4 text-primary fill-primary" />}
                    {isEditing ? (
                      <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="w-64" />
                    ) : (
                      <span className="font-semibold text-sm">{m.label}</span>
                    )}
                    <Badge variant="outline" className="text-xs">v{m.version}</Badge>
                    <Badge className={STATUS_VARIANT[m.status] || ""}>{m.status}</Badge>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {!m.is_primary && (
                      <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => setPrimary(m.id)}>
                        <Star className="w-3.5 h-3.5 mr-1" /> Set primary
                      </Button>
                    )}
                    {m.status !== "approved" ? (
                      <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => setStatus(m.id, "approved")}>
                        <Check className="w-3.5 h-3.5 mr-1" /> Aprobar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => setStatus(m.id, "draft")}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Volver a draft
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={generating} onClick={() => generate(m.id)}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Regenerar
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busyId === m.id} onClick={() => remove(m.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Hero message</p>
                    {isEditing ? (
                      <Textarea value={editHero} onChange={(e) => setEditHero(e.target.value)} rows={2} />
                    ) : (
                      <p>{vl.hero_message || <span className="text-muted-foreground italic">—</span>}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">CTA</p>
                    {isEditing ? (
                      <Input value={editCta} onChange={(e) => setEditCta(e.target.value)} />
                    ) : (
                      <p>{vl.cta_label || <span className="text-muted-foreground italic">—</span>}</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Composition</p>
                    <p className="text-sm">{vl.composition || <span className="text-muted-foreground italic">—</span>}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Imagery direction</p>
                    <p className="text-sm">{vl.imagery_direction || <span className="text-muted-foreground italic">—</span>}</p>
                  </div>
                  {Array.isArray(bk.colors) && bk.colors.length > 0 && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Paleta</p>
                      <div className="flex gap-2 flex-wrap">
                        {bk.colors.map((c: any, i: number) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs">
                            <span className="w-4 h-4 rounded-full border border-border" style={{ background: c.hex }} />
                            <span className="text-muted-foreground">{c.role}</span>
                            <span className="font-mono">{c.hex}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(vl.formats) && vl.formats.length > 0 && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Formatos sugeridos</p>
                      <div className="flex gap-1 flex-wrap">
                        {vl.formats.map((f: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {m.source_image_url && (
                    <div className="md:col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <a href={m.source_image_url} target="_blank" rel="noreferrer" className="underline truncate">
                        Imagen referencia
                      </a>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>Guardar</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => startEdit(m)}>Editar</Button>
                )}

                {/* Visual mockup */}
                <div className="rounded-md border border-dashed border-border p-3 space-y-2 bg-secondary/10">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-medium flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" /> Mockup visual
                    </p>
                    <div className="flex items-center gap-1">
                      {m.visual_preview_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={renderingId === m.id}
                          onClick={() => renderImage(m.id, { regenerate: true })}
                        >
                          {renderingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                          Regenerar imagen
                        </Button>
                      )}
                      {!m.visual_preview_url && (
                        <Button
                          size="sm"
                          disabled={renderingId === m.id}
                          onClick={() => renderImage(m.id)}
                        >
                          {renderingId === m.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                          Generar mockup
                        </Button>
                      )}
                    </div>
                  </div>

                  {m.visual_preview_url ? (
                    <a href={m.visual_preview_url} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={m.visual_preview_url}
                        alt={`Mockup ${m.label}`}
                        className="w-full max-h-96 object-contain rounded border border-border bg-background"
                      />
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Aún no se ha generado un mockup visual. La IA usará el Strategic DNA (paleta, tipografía, hero, CTA) para producir un PNG fotorealista.
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {m.visual_preview_url
                        ? "Indica al AI cómo modificarla (ej: 'fondo más oscuro', 'mover el CTA abajo', 'usar foto en lugar de ilustración')."
                        : "Instrucciones iniciales (opcional)."}
                    </p>
                    <Textarea
                      placeholder={m.visual_preview_url ? "Ej: cambia el fondo a azul oscuro y agranda el CTA" : "Ej: estilo editorial, hero centrado"}
                      value={editPrompts[m.id] || ""}
                      onChange={(e) => setEditPrompts(prev => ({ ...prev, [m.id]: e.target.value }))}
                      rows={2}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={renderingId === m.id || !(editPrompts[m.id] || "").trim()}
                      onClick={() => renderImage(m.id, { edit_instructions: editPrompts[m.id] })}
                    >
                      {renderingId === m.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                      {m.visual_preview_url ? "Aplicar cambios" : "Generar con instrucciones"}
                    </Button>
                  </div>
                </div>

                {/* Variations */}
                {m.status === "approved" && !m.label.includes("—") && (
                  <div className="rounded-md border border-dashed border-border p-3 space-y-2 bg-secondary/10">
                    <p className="text-xs font-medium">Generar variantes por formato</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="ig_post, email, paid_meta, lp_hero"
                        value={variationFormats[m.id] || ""}
                        onChange={(e) => setVariationFormats(prev => ({ ...prev, [m.id]: e.target.value }))}
                      />
                      <Button size="sm" onClick={() => generateVariations(m.id)} disabled={busyId === m.id}>
                        {busyId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Generar"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MasterAssetsTab;
