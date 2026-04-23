import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";

type Note = { id: string; note: string; author: string | null; created_at: string | null };

export default function ProspectInternalNotes({ prospectId }: { prospectId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [author, setAuthor] = useState("Nicolò");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("client_notes")
      .select("*")
      .eq("client_id", prospectId)
      .order("created_at", { ascending: false });
    setNotes((data as Note[]) || []);
  };

  useEffect(() => { load(); }, [prospectId]);

  const save = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("client_notes").insert({
      client_id: prospectId,
      note: newNote.trim(),
      author,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setNewNote("");
    toast.success("Nota guardada");
    load();
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
            <div key={n.id} className="p-3 rounded-md bg-secondary/30 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-foreground">{n.author || "—"}</span>
                {n.created_at && (
                  <span className="text-xs text-muted-foreground">{format(new Date(n.created_at), "dd MMM yyyy HH:mm")}</span>
                )}
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap">{n.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
