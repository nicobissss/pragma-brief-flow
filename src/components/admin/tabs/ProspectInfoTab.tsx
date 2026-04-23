import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ProposalView, type ProposalData } from "@/components/proposal/ProposalView";

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
  prospect, proposal,
  notes, newNote, setNewNote, noteAuthor, setNoteAuthor, onSaveNote,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border border-border p-5">
        <h3 className="font-semibold text-foreground">Información del briefing inicial</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Los datos proporcionados por el cliente al inscribirse están en la pestaña <strong>Overview</strong>,
          en la sección "Briefing inicial del prospect". Aquí abajo solo gestionas las <strong>notas internas</strong>
          y puedes consultar la propuesta original.
        </p>
      </div>

      {prospect && proposal && (
        <Collapsible>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <CollapsibleTrigger className="w-full flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors group">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Propuesta generada</h3>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-5 pb-5">
                <ProposalView data={proposal} editable={false} />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
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
