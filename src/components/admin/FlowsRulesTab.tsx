import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, Play } from "lucide-react";

const SUB_NICHES: Record<string, string[]> = {
  "Salud & Estética": ["Dental", "Estética Corporal", "Psicología", "Nutrición", "Oftalmología", "Fisioterapia", "Audiometría", "Capilar"],
  "E-Learning": ["Agronomía/Veterinaria", "PRL", "Coaching/Mentoría", "B2B Corporativo", "Jurídico", "Salud Ocupacional", "Sostenibilidad", "Finanzas"],
  "Deporte Offline": ["Pádel/Tenis", "Danza", "Yoga/Pilates", "Artes Marciales", "Natación", "Fútbol", "Personal Trainer"],
};

type Rule = {
  id: string;
  name: string;
  category: string;
  content: string;
  is_active: boolean | null;
  updated_at: string | null;
};

// ─── Rule Modal ─────────────────────────────────────────
function RuleModal({ open, rule, category, onClose, onSaved }: {
  open: boolean;
  rule: Partial<Rule> | null;
  category: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Rule>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rule) setForm({ ...rule });
  }, [rule]);

  const isNew = !rule?.id;
  const isTool = category === "tools_available";

  const save = async () => {
    if (!form.name?.trim() || !form.content?.trim()) {
      toast.error("Nombre y contenido son obligatorios");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name!,
      content: form.content!,
      category,
      is_active: form.is_active ?? true,
      updated_at: new Date().toISOString(),
      updated_by: "admin",
    };
    let error;
    if (isNew) {
      ({ error } = await supabase.from("pragma_rules").insert(payload));
    } else {
      ({ error } = await supabase.from("pragma_rules").update(payload).eq("id", rule!.id!));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "Creado" : "Actualizado");
    onClose();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? (isTool ? "Añadir tool" : "Añadir regla") : (isTool ? "Editar tool" : "Editar regla")}</DialogTitle>
          <DialogDescription>{isTool ? "Configura un tool disponible." : "Configura una regla global."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Nombre *</label>
            <Input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{isTool ? "Descripción *" : "Contenido de la regla *"}</label>
            <Textarea value={form.content || ""} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="mt-1" rows={isTool ? 3 : 4} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active ?? true} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            <span className="text-sm text-foreground">Activo</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {isNew ? "Crear" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Test Config Modal ──────────────────────────────────
function TestConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [vertical, setVertical] = useState("Salud & Estética");
  const [subNiche, setSubNiche] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const niches = SUB_NICHES[vertical] || [];

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-kickoff-prompts", {
        body: { client_id: "test", test_mode: true, test_vertical: vertical, test_sub_niche: subNiche },
      });
      if (error) throw error;
      setResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    }
    setTesting(false);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Probar configuración actual</DialogTitle>
          <DialogDescription>Así generaría la IA los prompts con esta configuración</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Vertical</label>
              <Select value={vertical} onValueChange={v => { setVertical(v); setSubNiche(""); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(SUB_NICHES).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Sub-niche</label>
              <Select value={subNiche} onValueChange={setSubNiche}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {niches.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={runTest} disabled={testing || !subNiche}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Ejecutar prueba
          </Button>
          {result && (
            <pre className="bg-secondary rounded-xl p-4 text-xs font-mono overflow-auto max-h-96 text-foreground whitespace-pre-wrap">{result}</pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ─────────────────────────────────────
export function FlowsRulesTab() {
  const [tools, setTools] = useState<Rule[]>([]);
  const [globalRules, setGlobalRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  const [ruleModal, setRuleModal] = useState<{ open: boolean; rule: Partial<Rule> | null; category: string }>({ open: false, rule: null, category: "" });
  const [testModal, setTestModal] = useState(false);

  const fetchAll = async () => {
    const { data: rules } = await supabase.from("pragma_rules").select("*").order("category");
    if (rules) {
      setTools((rules as unknown as Rule[]).filter(r => r.category === "tools_available"));
      setGlobalRules((rules as unknown as Rule[]).filter(r => r.category === "global_rules"));
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const toggleRule = async (r: Rule) => {
    await supabase.from("pragma_rules").update({ is_active: !r.is_active }).eq("id", r.id);
    fetchAll();
  };

  if (loading) return <div className="text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-10">
      {/* Intro + Test button */}
      <div className="flex items-start justify-between gap-4">
        <div className="bg-secondary/30 rounded-xl p-4 flex-1">
          <p className="text-sm text-foreground mb-2">
            <strong>¿Qué hay aquí?</strong> Dos listas que la IA consulta en cada generación:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
            <li><strong className="text-foreground">Tools disponibles</strong> — automatizaciones que la IA puede proponer en propuestas y prompts. Si desactivas uno, la IA dejará de mencionarlo.</li>
            <li><strong className="text-foreground">Reglas globales</strong> — restricciones que la IA debe respetar siempre (tono, claims prohibidos, etc.), filtradas por vertical del cliente.</li>
          </ul>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <Button variant="outline" onClick={() => setTestModal(true)}>
            <Play className="w-4 h-4 mr-2" /> Probar configuración actual
          </Button>
          <p className="text-[10px] text-muted-foreground max-w-[200px] text-right">
            Simula los prompts que la IA generaría con la configuración actual, sin crear un cliente.
          </p>
        </div>
      </div>

      {/* Tools */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold text-foreground">Tools disponibles</h3>
          <Button size="sm" onClick={() => setRuleModal({ open: true, rule: { is_active: true }, category: "tools_available" })}>
            <Plus className="w-4 h-4 mr-1" /> Añadir tool
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">La IA elige entre estos tools cuando recomienda automatizaciones al cliente.</p>
        {tools.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay tools configurados.</p>
        ) : (
          <div className="space-y-2">
            {tools.map(t => (
              <div key={t.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{t.name}</span>
                    {!t.is_active && <Badge variant="outline" className="text-[10px]">Inactivo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{t.content}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={t.is_active ?? true} onCheckedChange={() => toggleRule(t)} />
                  <Button size="sm" variant="ghost" onClick={() => setRuleModal({ open: true, rule: t, category: "tools_available" })}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Global Rules */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold text-foreground">Reglas globales</h3>
          <Button size="sm" onClick={() => setRuleModal({ open: true, rule: { is_active: true }, category: "global_rules" })}>
            <Plus className="w-4 h-4 mr-1" /> Añadir regla
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Reglas siempre activas que filtran las generaciones por vertical.</p>
        {globalRules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay reglas configuradas.</p>
        ) : (
          <div className="space-y-2">
            {globalRules.map(r => (
              <div key={r.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{r.name}</span>
                    {!r.is_active && <Badge variant="outline" className="text-[10px]">Inactivo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.content}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={r.is_active ?? true} onCheckedChange={() => toggleRule(r)} />
                  <Button size="sm" variant="ghost" onClick={() => setRuleModal({ open: true, rule: r, category: "global_rules" })}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <RuleModal
        open={ruleModal.open}
        rule={ruleModal.rule}
        category={ruleModal.category}
        onClose={() => setRuleModal({ open: false, rule: null, category: "" })}
        onSaved={fetchAll}
      />
      <TestConfigModal open={testModal} onClose={() => setTestModal(false)} />
    </div>
  );
}

export default FlowsRulesTab;
