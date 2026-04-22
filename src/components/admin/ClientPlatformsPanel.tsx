import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, Settings2 } from "lucide-react";

type SupportedPlatform = {
  id: string;
  name: string;
  category: string;
  icon: string | null;
};

type ClientPlatform = {
  id: string;
  client_id: string;
  platform_id: string;
  has_access: boolean;
  account_identifier: string | null;
  access_notes: string | null;
  integration_status: string | null;
  list_size: number | null;
  monthly_volume: number | null;
  plan_tier: string | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  not_setup: { label: "Sin configurar", cls: "bg-muted text-muted-foreground" },
  pending_access: { label: "Acceso pendiente", cls: "bg-amber-100 text-amber-800" },
  configured: { label: "Configurado", cls: "bg-[hsl(142,55%,93%)] text-[hsl(142,55%,32%)]" },
  needs_attention: { label: "Necesita atención", cls: "bg-destructive/15 text-destructive" },
};

interface Props {
  clientId: string;
}

export default function ClientPlatformsPanel({ clientId }: Props) {
  const [supported, setSupported] = useState<SupportedPlatform[]>([]);
  const [clientPlatforms, setClientPlatforms] = useState<ClientPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newPlatformId, setNewPlatformId] = useState<string>("");

  const fetchAll = async () => {
    setLoading(true);
    const [supRes, cliRes] = await Promise.all([
      supabase.from("supported_platforms").select("*").order("category").order("sort_order"),
      supabase.from("client_platforms").select("*").eq("client_id", clientId),
    ]);
    if (supRes.error) toast.error(supRes.error.message);
    if (cliRes.error) toast.error(cliRes.error.message);
    setSupported((supRes.data || []) as SupportedPlatform[]);
    setClientPlatforms((cliRes.data || []) as ClientPlatform[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [clientId]);

  const platformById = (id: string) => supported.find((p) => p.id === id);

  const updateField = (id: string, patch: Partial<ClientPlatform>) => {
    setClientPlatforms((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
  };

  const saveRow = async (cp: ClientPlatform) => {
    setSaving(cp.id);
    const { error } = await supabase.from("client_platforms").update({
      has_access: cp.has_access,
      account_identifier: cp.account_identifier,
      access_notes: cp.access_notes,
      integration_status: cp.integration_status,
      list_size: cp.list_size,
    }).eq("id", cp.id);
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Plataforma actualizada");
  };

  const removeRow = async (id: string) => {
    const prev = clientPlatforms;
    setClientPlatforms(clientPlatforms.filter((p) => p.id !== id));
    const { error } = await supabase.from("client_platforms").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      setClientPlatforms(prev);
    }
  };

  const addPlatform = async () => {
    if (!newPlatformId) return;
    const { data, error } = await supabase.from("client_platforms").insert({
      client_id: clientId,
      platform_id: newPlatformId,
      has_access: false,
      integration_status: "not_setup",
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setClientPlatforms((prev) => [...prev, data as ClientPlatform]);
    setNewPlatformId("");
    setAddOpen(false);
    toast.success("Plataforma añadida");
  };

  const usedIds = new Set(clientPlatforms.map((p) => p.platform_id));
  const availableToAdd = supported.filter((p) => !usedIds.has(p.id));

  // Raggruppa per categoria
  const grouped = clientPlatforms.reduce<Record<string, ClientPlatform[]>>((acc, cp) => {
    const cat = platformById(cp.platform_id)?.category || "Otros";
    (acc[cat] = acc[cat] || []).push(cp);
    return acc;
  }, {});

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground text-base flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Plataformas del cliente
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Email, SMS, reservas y demás herramientas que usa el cliente.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Añadir plataforma
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : clientPlatforms.length === 0 ? (
        <div className="text-sm text-muted-foreground bg-secondary/30 border border-dashed border-border rounded-lg p-6 text-center">
          Aún no hay plataformas configuradas.<br />
          <span className="text-xs">Añade las herramientas que usa el cliente para preparar el setup.</span>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([cat, rows]) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{cat}</p>
              <div className="space-y-2">
                {rows.map((cp) => {
                  const meta = platformById(cp.platform_id);
                  const status = STATUS_META[cp.integration_status || "not_setup"] || STATUS_META.not_setup;
                  const isEmail = meta?.category === "email";
                  return (
                    <div key={cp.id} className="bg-background border border-border rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl shrink-0 leading-none mt-0.5">
                          {meta?.icon || "🔌"}
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground">{meta?.name || cp.platform_id}</span>
                              <Badge className={`text-[10px] ${status.cls}`}>{status.label}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground m-0">Acceso</Label>
                              <Switch
                                checked={cp.has_access}
                                onCheckedChange={(v) => updateField(cp.id, { has_access: v })}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Cuenta / identificador</Label>
                              <Input
                                value={cp.account_identifier || ""}
                                onChange={(e) => updateField(cp.id, { account_identifier: e.target.value })}
                                placeholder="email@cuenta o ID"
                                className="h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Estado integración</Label>
                              <Select
                                value={cp.integration_status || "not_setup"}
                                onValueChange={(v) => updateField(cp.id, { integration_status: v })}
                              >
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(STATUS_META).map(([k, m]) => (
                                    <SelectItem key={k} value={k}>{m.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {isEmail && (
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Tamaño base de datos</Label>
                                <Input
                                  type="number"
                                  value={cp.list_size ?? ""}
                                  onChange={(e) => updateField(cp.id, { list_size: e.target.value ? Number(e.target.value) : null })}
                                  placeholder="ej. 1500"
                                  className="h-8 text-xs"
                                />
                              </div>
                            )}
                          </div>

                          <div>
                            <Label className="text-[10px] text-muted-foreground">Notas de acceso</Label>
                            <Textarea
                              value={cp.access_notes || ""}
                              onChange={(e) => updateField(cp.id, { access_notes: e.target.value })}
                              placeholder="Cómo conseguir acceso, contacto técnico, restricciones..."
                              rows={2}
                              className="text-xs"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive h-7"
                              onClick={() => removeRow(cp.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => saveRow(cp)}
                              disabled={saving === cp.id}
                              className="h-7"
                            >
                              {saving === cp.id ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                              ) : (
                                <Save className="w-3.5 h-3.5 mr-1" />
                              )}
                              Guardar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir plataforma</DialogTitle>
            <DialogDescription>Selecciona la herramienta que usa el cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Select value={newPlatformId} onValueChange={setNewPlatformId}>
              <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
              <SelectContent>
                {availableToAdd.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Todas las plataformas ya están añadidas.</div>
                ) : (
                  availableToAdd.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.icon ? `${p.icon} ` : ""}{p.name} <span className="text-muted-foreground text-xs ml-1">({p.category})</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={addPlatform} disabled={!newPlatformId}>
              <Plus className="w-4 h-4 mr-2" /> Añadir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
