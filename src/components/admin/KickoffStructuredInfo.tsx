import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Field = {
  key: string;
  label: string;
  type?: "text" | "textarea";
  placeholder?: string;
};

const FIELDS: Field[] = [
  { key: "main_goal", label: "Objetivo principal", type: "textarea", placeholder: "¿Qué quiere lograr en los próximos 6-12 meses?" },
  { key: "biggest_challenge", label: "Mayor desafío", type: "textarea", placeholder: "¿Cuál es el mayor problema que enfrenta hoy?" },
  { key: "differentiator", label: "Diferenciador", type: "textarea", placeholder: "¿Qué lo hace único frente a la competencia?" },
  { key: "client_sources", label: "Fuentes de clientes", type: "textarea", placeholder: "¿De dónde vienen sus clientes actuales?" },
  { key: "years_in_operation", label: "Años de operación" },
  { key: "monthly_new_clients", label: "Clientes nuevos / mes" },
  { key: "runs_paid_ads", label: "Hace anuncios pagos" },
  { key: "ad_platforms", label: "Plataformas de ads" },
  { key: "monthly_budget", label: "Presupuesto mensual" },
  { key: "has_email_list", label: "Tiene lista de email" },
  { key: "email_list_size", label: "Tamaño de la lista" },
  { key: "has_website", label: "Tiene web" },
  { key: "website_url", label: "URL del sitio" },
  { key: "uses_crm", label: "Usa CRM" },
  { key: "crm_name", label: "Sistema CRM" },
  { key: "additional_info", label: "Información adicional", type: "textarea" },
];

function formatValue(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}

type Props = {
  clientId: string;
  kickoffId: string | null;
  initial: Record<string, any>;
};

export default function KickoffStructuredInfo({ clientId, kickoffId, initial }: Props) {
  const [data, setData] = useState<Record<string, any>>(initial || {});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setData(initial || {}); }, [initial]);

  const startEdit = (f: Field) => {
    setEditValue(data[f.key] == null ? "" : String(data[f.key]));
    setEditingKey(f.key);
  };

  const cancelEdit = () => { setEditingKey(null); setEditValue(""); };

  const saveEdit = async (f: Field) => {
    setSaving(true);
    try {
      const next = { ...data, [f.key]: editValue };

      if (kickoffId) {
        const { error } = await supabase
          .from("kickoff_briefs")
          .update({ structured_info: next as any })
          .eq("id", kickoffId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("kickoff_briefs")
          .insert({ client_id: clientId, structured_info: next as any });
        if (error) throw error;
      }

      setData(next);
      toast.success(`${f.label} actualizado`);
      setEditingKey(null);
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="p-5 border-b border-border">
        <h3 className="font-semibold text-foreground">Información del kickoff</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Datos recogidos durante la kickoff call. Documenta aquí todo lo que descubras hablando con el cliente.
        </p>
      </div>
      <div className="divide-y divide-border">
        {FIELDS.map((f) => {
          const isEditing = editingKey === f.key;
          return (
            <div key={f.key} className="px-5 py-3 hover:bg-secondary/20 transition-colors">
              {isEditing ? (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">{f.label}</label>
                  {f.type === "textarea" ? (
                    <Textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={f.placeholder}
                      className="min-h-[80px]"
                      autoFocus
                    />
                  ) : (
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={f.placeholder}
                      autoFocus
                    />
                  )}
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                      <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                    </Button>
                    <Button size="sm" onClick={() => saveEdit(f)} disabled={saving}>
                      <Check className="w-3.5 h-3.5 mr-1" /> Guardar
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => startEdit(f)}
                  className="w-full flex justify-between items-start gap-4 text-left group"
                >
                  <span className="text-sm text-muted-foreground shrink-0">{f.label}</span>
                  <span className="text-sm font-medium text-right text-foreground flex items-center gap-2 max-w-[60%]">
                    <span className="break-words">{formatValue(data[f.key])}</span>
                    <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
