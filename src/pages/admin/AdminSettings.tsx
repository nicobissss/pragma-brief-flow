import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, Pencil, Save, FileText } from "lucide-react";

const CATEGORIES = [
  { key: "flows_processes", title: "Flows & Processes" },
  { key: "pricing", title: "Pricing" },
  { key: "suite_tools", title: "Suite Tools" },
  { key: "pitch_guidelines", title: "Pitch Guidelines" },
] as const;

type KBRow = { id: string; category: string; content: string; updated_at: string };
type DocRow = { id: string; filename: string; file_url: string; is_active: boolean; extracted_text: string | null; created_at: string };

function KBBlock({ row, onSaved }: { row: KBRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(row.content);
  const [saving, setSaving] = useState(false);
  const title = CATEGORIES.find((c) => c.key === row.category)?.title || row.category;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("knowledge_base")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${title} saved`);
    setEditing(false);
    onSaved();
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Updated {new Date(row.updated_at).toLocaleDateString()}
          </span>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          ) : (
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Save
            </Button>
          )}
        </div>
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={!editing}
        rows={8}
        className="font-mono text-sm"
        placeholder={`Enter ${title.toLowerCase()} content here...`}
      />
    </div>
  );
}

export default function AdminSettings() {
  const [kbRows, setKbRows] = useState<KBRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAll = async () => {
    const [kbRes, docRes] = await Promise.all([
      supabase.from("knowledge_base").select("*").order("category"),
      supabase.from("documents").select("*").order("created_at", { ascending: false }),
    ]);
    if (kbRes.data) setKbRows(kbRes.data as unknown as KBRow[]);
    if (docRes.data) setDocs(docRes.data as unknown as DocRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "txt", "md"].includes(ext || "")) {
      toast.error("Only PDF, TXT, and MD files are accepted.");
      return;
    }

    setUploading(true);
    const path = `${crypto.randomUUID()}_${file.name}`;

    const { error: uploadErr } = await supabase.storage.from("kb-documents").upload(path, file);
    if (uploadErr) { toast.error(uploadErr.message); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("kb-documents").getPublicUrl(path);

    // Extract text for txt/md
    let extractedText: string | null = null;
    if (ext === "txt" || ext === "md") {
      extractedText = await file.text();
    }

    const { error: insertErr } = await supabase.from("documents").insert({
      filename: file.name,
      file_url: path,
      is_active: true,
      extracted_text: extractedText,
    });

    if (insertErr) { toast.error(insertErr.message); setUploading(false); return; }
    toast.success("Document uploaded");
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    fetchAll();
  };

  const toggleActive = async (doc: DocRow) => {
    const { error } = await supabase.from("documents").update({ is_active: !doc.is_active }).eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, is_active: !d.is_active } : d));
  };

  const deleteDoc = async (doc: DocRow) => {
    await supabase.storage.from("kb-documents").remove([doc.file_url]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    toast.success("Document deleted");
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground mb-2">Settings</h1>
      <p className="text-muted-foreground mb-8">
        Manage the knowledge base that powers AI proposal generation.
      </p>

      {/* PART 1: Text blocks */}
      <h2 className="text-lg font-semibold text-foreground mb-4">Knowledge Base</h2>
      <div className="space-y-4 mb-10">
        {kbRows.map((row) => (
          <KBBlock key={row.id} row={row} onSaved={fetchAll} />
        ))}
      </div>

      {/* PART 2: Document upload */}
      <h2 className="text-lg font-semibold text-foreground mb-4">Documents</h2>
      <div className="bg-card rounded-lg border border-border p-6 mb-4">
        <div className="flex items-center gap-4">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md"
            onChange={handleUpload}
            className="hidden"
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline">
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload Document
          </Button>
          <span className="text-xs text-muted-foreground">PDF, TXT, MD accepted</span>
        </div>
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between bg-card rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{doc.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    Uploaded {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{doc.is_active ? "Active" : "Inactive"}</span>
                  <Switch checked={doc.is_active} onCheckedChange={() => toggleActive(doc)} />
                </div>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteDoc(doc)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
