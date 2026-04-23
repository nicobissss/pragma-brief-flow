import { useState, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";
import { ProposalView, type ProposalData } from "@/components/proposal/ProposalView";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Field = {
  key: string;
  label: string;
  source: "prospect" | "client" | "answers";
  type?: "text" | "textarea";
  format?: (v: any, all: any) => string;
};

const FIELDS: Field[] = [
  // Datos básicos
  { key: "name", label: "Nombre completo", source: "prospect" },
  { key: "company_name", label: "Empresa", source: "prospect" },
  { key: "email", label: "Email", source: "prospect" },
  { key: "phone", label: "Teléfono", source: "prospect" },
  { key: "vertical", label: "Vertical", source: "prospect" },
  { key: "sub_niche", label: "Sub-nicho", source: "prospect" },
  // Situación + objetivos (todo junto)
  { key: "years_in_operation", label: "Años de operación", source: "answers" },
  { key: "monthly_new_clients", label: "Clientes nuevos/mes", source: "answers" },
  { key: "average_ticket", label: "Ticket medio", source: "answers",
    format: (v, all) => v ? `${v} ${all.ticket_currency || "EUR"}` : "" },
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
  client: any;
  prospect: any | null;
  proposal: ProposalData | null;
  marketLabel: string;
  notes: any[];
  newNote: string;
  setNewNote: (v: string) => void;
  noteAuthor: string;
  setNoteAuthor: (v: string) => void;
  onSaveNote: () => void;
  /** @deprecated */ onCallUpdate?: (fields: Record<string, any>) => void;
  /** @deprecated */ onSharePlan?: () => void;
};

export default function ProspectInfoTab({
  client, prospect, proposal, marketLabel,
  notes, newNote, setNewNote, noteAuthor, setNoteAuthor, onSaveNote,
}: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [localProspect, setLocalProspect] = useState<any>(prospect);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocalProspect(prospect); }, [prospect]);

  const answers = localProspect?.briefing_answers || {};

  const getValue = (f: Field) => {
    if (!localProspect) return "";
    const raw = f.source === "answers" ? answers[f.key] : localProspect[f.key];
    return f.format ? f.format(raw, answers) : raw;
  };

  const startEdit = (f: Field) => {
    if (!localProspect) return;
    const raw = f.source === "answers" ? answers[f.key] : localProspect[f.key];
    setEditValue(raw == null ? "" : String(raw));
    setEditingKey(f.key);
  };

  const cancelEdit = () => { setEditingKey(null); setEditValue(""); };

  const saveEdit = async (f: Field) => {
    if (!localProspect) return;
    setSaving(true);
    try {
      let payload: any = {};
      if (f.source === "answers") {
        payload = { briefing_answers: { ...answers, [f.key]: editValue } };
      } else {
        payload = { [f.key]: editValue };
      }
      const { error } = await supabase.from("prospects").update(payload).eq("id", localProspect.id);
      if (error) throw error;
      setLocalProspect({
        ...localProspect,
        ...(f.source === "answers"
          ? { briefing_answers: { ...answers, [f.key]: editValue } }
          : { [f.key]: editValue }),
      });
      toast({ title: "Guardado", description: f.label });
      setEditingKey(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {localProspect ? (
        <>
          <Collapsible>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <CollapsibleTrigger className="w-full flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pre-cualificación</h3>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-5 pb-5 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">País</span>
                    <span className="font-medium">{marketLabel}</span>
                  </div>
                  {answers.description && (
                    <div className="pt-2 border-t border-border text-sm space-y-1">
                      <span className="text-muted-foreground text-xs uppercase tracking-wide">Descripción</span>
                      <p>{answers.description}</p>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-5 border-b border-border">
              <h3 className="font-semibold text-foreground">Información del prospect</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Resumen completo del briefing inicial. Haz clic en cualquier fila para editar.
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

          {proposal && (
            <Collapsible>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <CollapsibleTrigger className="w-full flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Propuesta generada</h3>
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-5 pb-5">
                    <ProposalView data={proposal} editable={false} />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}
        </>
      ) : (
        <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
          No hay datos de prospect vinculados a este cliente.
        </div>
      )}

      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-foreground">Notas internas</h3>
          <p className="text-xs text-muted-foreground">Solo visibles para el equipo PRAGMA — nunca para el cliente.</p>
        </div>
        <div className="flex gap-2">
          <Textarea placeholder="Escribe una nota..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="min-h-[60px] flex-1" />
          <div className="flex flex-col gap-2">
            <Select value={noteAuthor} onValueChange={setNoteAuthor}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Nicolò">Nicolò</SelectItem>
                <SelectItem value="Karla">Karla</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={onSaveNote} disabled={!newNote.trim()}>Guardar</Button>
          </div>
        </div>
        {notes.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notes.map((n) => (
              <div key={n.id} className="p-3 rounded-md bg-secondary/30 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground">{n.author || "—"}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(n.created_at!), "dd MMM yyyy HH:mm")}</span>
                </div>
                <p className="text-muted-foreground whitespace-pre-wrap">{n.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
