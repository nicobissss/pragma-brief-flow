import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Field = {
  key: string;
  label: string;
  source: "prospect" | "answers";
  type?: "text" | "textarea";
  format?: (v: any, all: any) => string;
};

const FIELDS: Field[] = [
  { key: "name", label: "Nombre completo", source: "prospect" },
  { key: "company_name", label: "Empresa", source: "prospect" },
  { key: "email", label: "Email", source: "prospect" },
  { key: "phone", label: "Teléfono", source: "prospect" },
  { key: "vertical", label: "Vertical", source: "prospect" },
  { key: "sub_niche", label: "Sub-nicho", source: "prospect" },
  { key: "years_in_operation", label: "Años de operación", source: "answers" },
  { key: "monthly_new_clients", label: "Clientes nuevos/mes", source: "answers" },
  {
    key: "average_ticket", label: "Ticket medio", source: "answers",
    format: (v, all) => v ? `${v} ${all.ticket_currency || "EUR"}` : "",
  },
  { key: "main_goal", label: "Objetivo principal", source: "answers", type: "textarea" },
  { key: "biggest_challenge", label: "Mayor desafío", source: "answers", type: "textarea" },
  { key: "differentiator", label: "Diferenciador", source: "answers", type: "textarea" },
  { key: "client_sources", label: "Fuentes de clientes", source: "answers" },
  { key: "runs_paid_ads", label: "Hace anuncios pagos", source: "answers" },
  { key: "ad_platforms", label: "Plataformas de ads", source: "answers" },
  { key: "monthly_budget", label: "Presupuesto mensual", source: "answers" },
  { key: "has_email_list", label: "Tiene lista de email", source: "answers" },
  { key: "email_list_size", label: "Tamaño de la lista", source: "answers" },
  { key: "has_website", label: "Tiene web", source: "answers" },
  { key: "website_url", label: "URL del sitio", source: "answers" },
  { key: "uses_crm", label: "Usa CRM", source: "answers" },
  { key: "crm_name", label: "Sistema CRM", source: "answers" },
  { key: "additional_info", label: "Información adicional", source: "answers", type: "textarea" },
];

function formatValue(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}

type Props = {
  prospect: any;
  marketLabel: string;
  onUpdated?: (p: any) => void;
  readOnly?: boolean;
  title?: string;
  description?: string;
};

export default function ProspectInfoTable({
  prospect, marketLabel, onUpdated,
  readOnly = false,
  title = "Información del prospect",
  description = "Resumen completo del briefing inicial. Haz clic en cualquier fila para editar.",
}: Props) {
  const [local, setLocal] = useState<any>(prospect);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocal(prospect); }, [prospect]);

  const answers = local?.briefing_answers || {};

  const getValue = (f: Field) => {
    const raw = f.source === "answers" ? answers[f.key] : local[f.key];
    return f.format ? f.format(raw, answers) : raw;
  };

  const startEdit = (f: Field) => {
    const raw = f.source === "answers" ? answers[f.key] : local[f.key];
    setEditValue(raw == null ? "" : String(raw));
    setEditingKey(f.key);
  };

  const cancelEdit = () => { setEditingKey(null); setEditValue(""); };

  const saveEdit = async (f: Field) => {
    setSaving(true);
    try {
      const payload: any = f.source === "answers"
        ? { briefing_answers: { ...answers, [f.key]: editValue } }
        : { [f.key]: editValue };
      const { error } = await supabase.from("prospects").update(payload).eq("id", local.id);
      if (error) throw error;
      const updated = {
        ...local,
        ...(f.source === "answers"
          ? { briefing_answers: { ...answers, [f.key]: editValue } }
          : { [f.key]: editValue }),
      };
      setLocal(updated);
      onUpdated?.(updated);
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
        <h3 className="font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="divide-y divide-border">
        <div className="px-5 py-3 flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Mercado</span>
          <span className="text-sm font-medium text-foreground">{marketLabel}</span>
        </div>
        {FIELDS.map((f) => {
          const isEditing = !readOnly && editingKey === f.key;
          return (
            <div key={f.key} className="px-5 py-3 hover:bg-secondary/20 transition-colors">
              {isEditing ? (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">{f.label}</label>
                  {f.type === "textarea" ? (
                    <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className="min-h-[80px]" autoFocus />
                  ) : (
                    <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
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
              ) : readOnly ? (
                <div className="w-full flex justify-between items-start gap-4 text-left">
                  <span className="text-sm text-muted-foreground shrink-0">{f.label}</span>
                  <span className="text-sm font-medium text-right text-foreground max-w-[60%] break-words">
                    {formatValue(getValue(f))}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => startEdit(f)}
                  className="w-full flex justify-between items-start gap-4 text-left group"
                >
                  <span className="text-sm text-muted-foreground shrink-0">{f.label}</span>
                  <span className="text-sm font-medium text-right text-foreground flex items-center gap-2 max-w-[60%]">
                    <span className="break-words">{formatValue(getValue(f))}</span>
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
