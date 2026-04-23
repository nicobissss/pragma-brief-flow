import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";

type Note = { id: string; note: string; author: string; created_at: string };

export default function ProspectInternalNotes({
  prospectId,
  briefingAnswers,
  onUpdated,
}: {
  prospectId: string;
  briefingAnswers: Record<string, any>;
  onUpdated: (newAnswers: Record<string, any>) => void;
}) {
  const notes: Note[] = Array.isArray(briefingAnswers?._internal_notes)
    ? briefingAnswers._internal_notes
    : [];
  const [newNote, setNewNote] = useState("");
  const [author, setAuthor] = useState("Nicolò");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    const note: Note = {
      id: crypto.randomUUID(),
      note: newNote.trim(),
      author,
      created_at: new Date().toISOString(),
    };
    const updated = { ...briefingAnswers, _internal_notes: [note, ...notes] };
    const { error } = await supabase
      .from("prospects")
      .update({ briefing_answers: updated })
      .eq("id", prospectId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onUpdated(updated);
    setNewNote("");
    toast.success("Nota guardada");
  };

  const remove = async (id: string) => {
    const updated = { ...briefingAnswers, _internal_notes: notes.filter((n) => n.id !== id) };
    const { error } = await supabase
      .from("prospects")
      .update({ briefing_answers: updated })
      .eq("id", prospectId);
    if (error) { toast.error(error.message); return; }
    onUpdated(updated);
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">Notas internas</h3>
        <p className="text-xs text-muted-foreground">Solo visibles para el equipo PRAGMA — nunca para el cliente.</p>
      </div>
      <div className="flex gap-2">
        <Textarea placeholder="Escribe una nota..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="min-h-[60px] flex-1" />
        <div className="flex flex-col gap-2">
          <Select value={author} onValueChange={setAuthor}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Nicolò">Nicolò</SelectItem>
              <SelectItem value="Karla">Karla</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={save} disabled={!newNote.trim() || saving}>Guardar</Button>
        </div>
      </div>
      {notes.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {notes.map((n) => (
            <div key={n.id} className="p-3 rounded-md bg-secondary/30 text-sm group">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-foreground">{n.author || "—"}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(n.created_at), "dd MMM yyyy HH:mm")}</span>
                <button
                  onClick={() => remove(n.id)}
                  className="ml-auto text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                >
                  Eliminar
                </button>
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap">{n.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
