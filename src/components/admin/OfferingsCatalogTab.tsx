import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Pencil, Copy, Loader2, Mail, FileText, MessageSquare, Layers, Star, Save,
} from "lucide-react";

type Offering = {
  id: string;
  code: string;
  name: string;
  short_name: string;
  tier: number;
  category: string;
  applicable_verticals: any;
  description: string | null;
  value_proposition: string | null;
  expected_outcomes: any;
  deliverables: any;
  required_platforms: any;
  recommended_platforms: any;
  optional_platforms: any;
  setup_fee_eur: number | null;
  monthly_fee_eur: number | null;
  one_shot_fee_eur: number | null;
  setup_hours_estimate: number | null;
  monthly_hours_estimate: number | null;
  task_templates: any;
  recommendation_rules: any;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
};

const TIER_META: Record<number, { label: string; cls: string; ring: string }> = {
  1: {
    label: "Tier 1 — Entry Offers",
    cls: "bg-[hsl(265,60%,95%)] text-[hsl(265,60%,40%)] border-[hsl(265,60%,80%)]",
    ring: "border-[hsl(265,60%,80%)]",
  },
  2: {
    label: "Tier 2 — Retainers",
    cls: "bg-[hsl(210,70%,95%)] text-[hsl(210,70%,40%)] border-[hsl(210,70%,80%)]",
    ring: "border-[hsl(210,70%,80%)]",
  },
  3: {
    label: "Tier 3 — One-shot",
    cls: "bg-[hsl(142,55%,93%)] text-[hsl(142,55%,32%)] border-[hsl(142,55%,75%)]",
    ring: "border-[hsl(142,55%,75%)]",
  },
};

function deliverableIcon(type?: string) {
  switch (type) {
    case "email": return <Mail className="w-3.5 h-3.5" />;
    case "landing": return <FileText className="w-3.5 h-3.5" />;
    case "sms": return <MessageSquare className="w-3.5 h-3.5" />;
    case "bundle": return <Layers className="w-3.5 h-3.5" />;
    default: return <FileText className="w-3.5 h-3.5" />;
  }
}

function formatPrice(o: Offering): string {
  if (o.monthly_fee_eur) return `${o.monthly_fee_eur}€/mes`;
  if (o.one_shot_fee_eur) return `${o.one_shot_fee_eur}€ once`;
  if (o.setup_fee_eur) return `${o.setup_fee_eur}€ setup`;
  return "—";
}

export default function OfferingsCatalogTab() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Offering | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("offering_templates")
      .select("*")
      .order("tier")
      .order("sort_order");
    if (error) toast.error(error.message);
    setOfferings((data || []) as Offering[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const toggleActive = async (o: Offering, value: boolean) => {
    setOfferings((prev) => prev.map((x) => x.id === o.id ? { ...x, is_active: value } : x));
    const { error } = await supabase.from("offering_templates").update({ is_active: value }).eq("id", o.id);
    if (error) {
      toast.error(error.message);
      setOfferings((prev) => prev.map((x) => x.id === o.id ? { ...x, is_active: !value } : x));
    }
  };

  const duplicate = async (o: Offering) => {
    const { id, ...rest } = o;
    const newCode = `${o.code}_COPY_${Date.now().toString(36).toUpperCase()}`;
    const newName = `${o.name} (copia)`;
    const { error } = await supabase.from("offering_templates").insert({
      ...rest,
      code: newCode,
      name: newName,
      is_featured: false,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Offering duplicada");
    fetchAll();
  };

  const tiers = [1, 2, 3];

  if (loading) {
    return (
      <div className="space-y-6">
        {tiers.map((t) => (
          <div key={t} className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {tiers.map((tier) => {
        const list = offerings.filter((o) => o.tier === tier);
        const meta = TIER_META[tier];
        return (
          <section key={tier}>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-foreground">{meta.label}</h2>
              <Badge variant="outline" className="text-xs">{list.length}</Badge>
            </div>
            {list.length === 0 ? (
              <div className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-6">
                No hay offerings en este tier.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {list.map((o) => (
                  <OfferingCard
                    key={o.id}
                    offering={o}
                    meta={meta}
                    onEdit={() => setEditing(o)}
                    onDuplicate={() => duplicate(o)}
                    onToggleActive={(v) => toggleActive(o, v)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {editing && (
        <EditOfferingDialog
          offering={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchAll(); }}
        />
      )}
    </div>
  );
}

function OfferingCard({
  offering: o, meta, onEdit, onDuplicate, onToggleActive,
}: {
  offering: Offering;
  meta: { label: string; cls: string; ring: string };
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleActive: (v: boolean) => void;
}) {
  const deliverables = Array.isArray(o.deliverables) ? o.deliverables : [];
  const reqPlatforms = Array.isArray(o.required_platforms) ? o.required_platforms : [];
  const verticals = Array.isArray(o.applicable_verticals) ? o.applicable_verticals : [];

  return (
    <div className={`bg-card rounded-xl border-2 p-5 transition-all ${o.is_featured ? meta.ring : "border-border"} ${!o.is_active ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground text-base truncate">{o.name}</h3>
            {o.is_featured && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground">{o.short_name} · <code className="text-[10px]">{o.code}</code></p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={o.is_active} onCheckedChange={onToggleActive} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge className={`text-[10px] ${meta.cls}`}>Tier {o.tier}</Badge>
        <Badge variant="outline" className="text-[10px]">{o.category}</Badge>
        {verticals.slice(0, 2).map((v: string) => (
          <Badge key={v} variant="secondary" className="text-[10px]">{v}</Badge>
        ))}
      </div>

      {o.value_proposition && (
        <div className="bg-secondary/40 rounded-lg p-3 mb-3 border border-border/50">
          <p className="text-sm font-medium text-foreground leading-snug">{o.value_proposition}</p>
        </div>
      )}

      {o.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{o.description}</p>
      )}

      <div className="flex items-center justify-between mb-3 text-sm">
        <span className="font-bold text-foreground">{formatPrice(o)}</span>
        {(o.setup_hours_estimate || o.monthly_hours_estimate) && (
          <span className="text-xs text-muted-foreground">
            {o.setup_hours_estimate ? `${o.setup_hours_estimate}h setup` : ""}
            {o.setup_hours_estimate && o.monthly_hours_estimate ? " · " : ""}
            {o.monthly_hours_estimate ? `${o.monthly_hours_estimate}h/mes` : ""}
          </span>
        )}
      </div>

      {deliverables.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Deliverables</p>
          <ul className="space-y-1">
            {deliverables.slice(0, 5).map((d: any, i: number) => (
              <li key={i} className="flex items-center gap-2 text-xs text-foreground">
                <span className="text-muted-foreground">{deliverableIcon(d.type)}</span>
                <span>{d.count ? `${d.count}× ` : ""}{d.name || d.type || "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reqPlatforms.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Plataformas necesarias</p>
          <div className="flex flex-wrap gap-1">
            {reqPlatforms.map((p: string) => (
              <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <Button size="sm" variant="outline" onClick={onEdit} className="flex-1">
          <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
        </Button>
        <Button size="sm" variant="ghost" onClick={onDuplicate}>
          <Copy className="w-3.5 h-3.5 mr-1.5" /> Duplicar
        </Button>
      </div>
    </div>
  );
}

function EditOfferingDialog({
  offering: initial, onClose, onSaved,
}: {
  offering: Offering;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [jsonErrors, setJsonErrors] = useState<Record<string, string | null>>({});

  // serializza i JSON in stringhe per il textarea
  const [jsonText, setJsonText] = useState({
    deliverables: JSON.stringify(initial.deliverables ?? [], null, 2),
    task_templates: JSON.stringify(initial.task_templates ?? [], null, 2),
    expected_outcomes: JSON.stringify(initial.expected_outcomes ?? [], null, 2),
    required_platforms: JSON.stringify(initial.required_platforms ?? [], null, 2),
    recommended_platforms: JSON.stringify(initial.recommended_platforms ?? [], null, 2),
    optional_platforms: JSON.stringify(initial.optional_platforms ?? [], null, 2),
    applicable_verticals: JSON.stringify(initial.applicable_verticals ?? [], null, 2),
    recommendation_rules: JSON.stringify(initial.recommendation_rules ?? {}, null, 2),
  });

  const updateJson = (key: keyof typeof jsonText, value: string) => {
    setJsonText((prev) => ({ ...prev, [key]: value }));
    try {
      JSON.parse(value);
      setJsonErrors((prev) => ({ ...prev, [key]: null }));
    } catch (e: any) {
      setJsonErrors((prev) => ({ ...prev, [key]: e.message || "JSON inválido" }));
    }
  };

  const save = async () => {
    // valida tutti i JSON
    const parsed: Record<string, any> = {};
    for (const [k, v] of Object.entries(jsonText)) {
      try {
        parsed[k] = JSON.parse(v);
      } catch (e: any) {
        toast.error(`JSON inválido en ${k}: ${e.message}`);
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase.from("offering_templates").update({
      name: form.name,
      short_name: form.short_name,
      code: form.code,
      tier: form.tier,
      category: form.category,
      description: form.description,
      value_proposition: form.value_proposition,
      setup_fee_eur: form.setup_fee_eur,
      monthly_fee_eur: form.monthly_fee_eur,
      one_shot_fee_eur: form.one_shot_fee_eur,
      setup_hours_estimate: form.setup_hours_estimate,
      monthly_hours_estimate: form.monthly_hours_estimate,
      is_active: form.is_active,
      is_featured: form.is_featured,
      sort_order: form.sort_order,
      ...parsed,
    } as any).eq("id", form.id);
    setSaving(false);

    if (error) { toast.error(error.message); return; }
    toast.success("Offering actualizada");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar offering</DialogTitle>
          <DialogDescription>Modifica todos los campos. Los JSON deben ser válidos.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Short name</Label>
              <Input value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
            </div>
            <div>
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="font-mono text-xs" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <Label>Tier</Label>
              <Input type="number" value={form.tier} onChange={(e) => setForm({ ...form, tier: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Sort order</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
          </div>

          <div>
            <Label>Value proposition</Label>
            <Textarea
              value={form.value_proposition || ""}
              onChange={(e) => setForm({ ...form, value_proposition: e.target.value })}
              rows={2}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Setup fee (€)</Label>
              <Input type="number" value={form.setup_fee_eur ?? ""} onChange={(e) => setForm({ ...form, setup_fee_eur: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div>
              <Label>Monthly fee (€)</Label>
              <Input type="number" value={form.monthly_fee_eur ?? ""} onChange={(e) => setForm({ ...form, monthly_fee_eur: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div>
              <Label>One-shot fee (€)</Label>
              <Input type="number" value={form.one_shot_fee_eur ?? ""} onChange={(e) => setForm({ ...form, one_shot_fee_eur: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div>
              <Label>Setup hours est.</Label>
              <Input type="number" value={form.setup_hours_estimate ?? ""} onChange={(e) => setForm({ ...form, setup_hours_estimate: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div>
              <Label>Monthly hours est.</Label>
              <Input type="number" value={form.monthly_hours_estimate ?? ""} onChange={(e) => setForm({ ...form, monthly_hours_estimate: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="m-0">Activa</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
              <Label className="m-0">Destacada</Label>
            </div>
          </div>

          {(["applicable_verticals", "deliverables", "required_platforms", "recommended_platforms", "optional_platforms", "expected_outcomes", "task_templates", "recommendation_rules"] as const).map((k) => (
            <div key={k}>
              <Label className="flex items-center justify-between">
                <span className="font-mono text-xs">{k}</span>
                {jsonErrors[k] && <span className="text-[10px] text-destructive">{jsonErrors[k]}</span>}
              </Label>
              <Textarea
                value={jsonText[k]}
                onChange={(e) => updateJson(k, e.target.value)}
                rows={k === "task_templates" ? 12 : 5}
                className={`font-mono text-[11px] ${jsonErrors[k] ? "border-destructive" : ""}`}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || Object.values(jsonErrors).some(Boolean)}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
