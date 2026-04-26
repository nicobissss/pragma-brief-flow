import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, Loader2, Share2, Eye, Copy, Plus, Trash2, Save, Workflow,
} from "lucide-react";
import { toast } from "sonner";

type FlowNode = {
  id: string;
  label: string;
  channel: string;
  week: number;
  description?: string;
  objective?: string;
  sub_tool_hint?: string;
};
type FlowEdge = { id: string; source: string; target: string; label?: string };
type Flow = {
  id: string;
  campaign_id: string;
  client_id: string;
  version: number;
  status: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  share_token: string | null;
  generated_from_offering: boolean;
};

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

function NodeCard({
  node, editable, onChange, onDelete,
}: {
  node: FlowNode;
  editable: boolean;
  onChange?: (n: FlowNode) => void;
  onDelete?: () => void;
}) {
  const cls = CHANNEL_COLORS[node.channel] || "bg-secondary text-foreground border-border";
  return (
    <div className={`rounded-lg border p-3 text-xs ${cls} min-w-[200px] max-w-[260px]`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{node.channel}</Badge>
        <span className="text-[10px] opacity-70">W{node.week}</span>
      </div>
      {editable ? (
        <Input
          value={node.label}
          onChange={(e) => onChange?.({ ...node, label: e.target.value })}
          className="h-7 text-xs mb-1 bg-background"
        />
      ) : (
        <p className="font-semibold text-sm leading-tight mb-1">{node.label}</p>
      )}
      {node.objective && <p className="text-[11px] opacity-80 leading-snug line-clamp-2">{node.objective}</p>}
      {editable && onDelete && (
        <Button size="sm" variant="ghost" className="h-6 px-1 mt-1" onClick={onDelete}>
          <Trash2 className="w-3 h-3 text-destructive" />
        </Button>
      )}
    </div>
  );
}

function JourneyView({ nodes, edges }: { nodes: FlowNode[]; edges: FlowEdge[] }) {
  // Group nodes by week, render top-down
  const weeks = useMemo(() => {
    const map = new Map<number, FlowNode[]>();
    nodes.forEach((n) => {
      const w = n.week || 1;
      if (!map.has(w)) map.set(w, []);
      map.get(w)!.push(n);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [nodes]);

  return (
    <div className="space-y-6">
      {weeks.map(([w, ws]) => (
        <div key={w} className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Semana {w}</div>
          <div className="flex flex-wrap gap-3">
            {ws.map((n) => <NodeCard key={n.id} node={n} editable={false} />)}
          </div>
        </div>
      ))}
      {edges.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <strong>Conexiones:</strong> {edges.map(e => `${e.source}→${e.target}${e.label ? ` (${e.label})` : ""}`).join(", ")}
        </div>
      )}
    </div>
  );
}

function TimelineView({ nodes }: { nodes: FlowNode[] }) {
  const maxWeek = Math.max(1, ...nodes.map((n) => n.week || 1));
  const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1);
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-2" style={{ gridTemplateColumns: `100px repeat(${maxWeek}, minmax(180px, 1fr))` }}>
        <div />
        {weeks.map((w) => (
          <div key={w} className="text-xs font-semibold text-muted-foreground text-center pb-2 border-b border-border">
            Semana {w}
          </div>
        ))}
        {Array.from(new Set(nodes.map((n) => n.channel))).map((ch) => (
          <div key={ch} className="contents">
            <div className="text-xs font-medium text-muted-foreground py-2 self-start sticky left-0 bg-background">{ch}</div>
            {weeks.map((w) => (
              <div key={`${ch}-${w}`} className="space-y-1 py-1 min-h-[60px] border-l border-dashed border-border/50 px-1">
                {nodes
                  .filter((n) => n.channel === ch && (n.week || 1) === w)
                  .map((n) => <NodeCard key={n.id} node={n} editable={false} />)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditView({
  nodes, onChange,
}: { nodes: FlowNode[]; onChange: (n: FlowNode[]) => void }) {
  const update = (i: number, patch: Partial<FlowNode>) => {
    const copy = [...nodes];
    copy[i] = { ...copy[i], ...patch };
    onChange(copy);
  };
  const remove = (i: number) => onChange(nodes.filter((_, idx) => idx !== i));
  const add = () => onChange([...nodes, {
    id: `n_${Date.now()}`, label: "Nuevo touchpoint", channel: "social_post", week: 1, description: "", objective: "",
  }]);

  return (
    <div className="space-y-2">
      {nodes.map((n, i) => (
        <div key={n.id} className="grid grid-cols-12 gap-2 items-start p-2 rounded-md border border-border bg-secondary/10">
          <Input className="col-span-3 h-8 text-xs" value={n.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Label" />
          <Input className="col-span-2 h-8 text-xs" value={n.channel} onChange={(e) => update(i, { channel: e.target.value })} placeholder="Channel" />
          <Input className="col-span-1 h-8 text-xs" type="number" value={n.week} onChange={(e) => update(i, { week: parseInt(e.target.value) || 1 })} />
          <Input className="col-span-5 h-8 text-xs" value={n.objective || ""} onChange={(e) => update(i, { objective: e.target.value })} placeholder="Objective" />
          <Button size="sm" variant="ghost" className="col-span-1 h-8" onClick={() => remove(i)}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Añadir nodo
      </Button>
    </div>
  );
}

export function CampaignFlowEditor({ campaignId, clientId }: { campaignId: string; clientId: string }) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftNodes, setDraftNodes] = useState<FlowNode[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("campaign_flows")
      .select("*")
      .eq("campaign_id", campaignId)
      .maybeSingle();
    setFlow((data as any) || null);
    setDraftNodes(((data as any)?.nodes as FlowNode[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [campaignId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-campaign-flow", {
        body: { campaign_id: campaignId },
      });
      if (error) throw error;
      if (data?.skipped) { toast.info(data.reason); return; }
      toast.success("Flow generado");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setGenerating(false); }
  };

  const saveDraft = async () => {
    if (!flow) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("campaign_flows")
        .update({ nodes: draftNodes }).eq("id", flow.id);
      if (error) throw error;
      toast.success("Cambios guardados");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const togglePublish = async () => {
    if (!flow) return;
    const next = flow.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("campaign_flows").update({ status: next }).eq("id", flow.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "published" ? "Flow publicado" : "Vuelto a draft");
    await load();
  };

  const copyShareLink = () => {
    if (!flow?.share_token) return;
    const url = `${window.location.origin}/flow/${flow.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  if (loading) return <div className="p-4 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Cargando…</div>;

  if (!flow) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Aún no hay flow para esta campaña. La IA expandirá los deliverables de la oferta vinculada y los enriquecerá.
        </p>
        <Button size="sm" onClick={generate} disabled={generating}>
          {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
          Generar flow con IA
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Campaign Flow</span>
          <Badge variant="outline" className="text-xs">v{flow.version}</Badge>
          <Badge className={flow.status === "published" ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]" : "bg-muted text-muted-foreground"}>
            {flow.status}
          </Badge>
          {flow.generated_from_offering && (
            <Badge variant="outline" className="text-[10px]">desde oferta</Badge>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
            Regenerar IA
          </Button>
          <Button size="sm" variant="outline" onClick={togglePublish}>
            <Share2 className="w-3.5 h-3.5 mr-1" />
            {flow.status === "published" ? "Despublicar" : "Publicar"}
          </Button>
          {flow.status === "published" && flow.share_token && (
            <Button size="sm" variant="outline" onClick={copyShareLink}>
              <Copy className="w-3.5 h-3.5 mr-1" /> Link público
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="journey">
        <TabsList>
          <TabsTrigger value="journey">Journey</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="edit">Editar nodos</TabsTrigger>
        </TabsList>
        <TabsContent value="journey" className="mt-4">
          <JourneyView nodes={flow.nodes} edges={flow.edges} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <TimelineView nodes={flow.nodes} />
        </TabsContent>
        <TabsContent value="edit" className="mt-4 space-y-3">
          <EditView nodes={draftNodes} onChange={setDraftNodes} />
          <Button size="sm" onClick={saveDraft} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            Guardar cambios
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CampaignFlowEditor;
