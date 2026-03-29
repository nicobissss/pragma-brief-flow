import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, Pencil, Save, FileText } from "lucide-react";

import { IntegrationsTab } from "@/components/admin/IntegrationsTab";
import { FlowsRulesTab } from "@/components/admin/FlowsRulesTab";

const CATEGORIES = [
  { key: "flows_processes", title: "Flows & Procesos" },
  { key: "pricing", title: "Precios" },
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
    toast.success(`${title} guardado`);
    setEditing(false);
    onSaved();
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Actualizado {new Date(row.updated_at).toLocaleDateString()}
          </span>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
            </Button>
          ) : (
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Guardar
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
        placeholder={`Escribe el contenido de ${title.toLowerCase()} aquí...`}
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
      toast.error("Solo se aceptan archivos PDF, TXT y MD.");
      return;
    }
    setUploading(true);
    const path = `${crypto.randomUUID()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("kb-documents").upload(path, file);
    if (uploadErr) { toast.error(uploadErr.message); setUploading(false); return; }

    let extractedText: string | null = null;
    if (ext === "txt" || ext === "md") extractedText = await file.text();

    const { error: insertErr } = await supabase.from("documents").insert({
      filename: file.name,
      file_url: path,
      is_active: true,
      extracted_text: extractedText,
    });
    if (insertErr) { toast.error(insertErr.message); setUploading(false); return; }
    toast.success("Documento subido");
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
    toast.success("Documento eliminado");
  };

  if (loading) return <div className="p-8 text-muted-foreground">Cargando...</div>;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground mb-2">Configuración</h1>
      <p className="text-muted-foreground mb-6">
        Gestiona la base de conocimiento, flows, reglas e integraciones.
      </p>

      <Tabs defaultValue="knowledge">
        <TabsList>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="flows">Flows & Reglas</TabsTrigger>
          <TabsTrigger value="integrations">Integraciones</TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge" className="mt-6 space-y-8">
          {/* Text blocks */}
          <div className="space-y-4">
            {kbRows.map((row) => (
              <KBBlock key={row.id} row={row} onSaved={fetchAll} />
            ))}
          </div>

          {/* Document upload */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Documentos</h2>
            <div className="bg-card rounded-2xl border border-border p-6 mb-4">
              <div className="flex items-center gap-4">
                <input ref={fileRef} type="file" accept=".pdf,.txt,.md" onChange={handleUpload} className="hidden" />
                <Button onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline">
                  {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Subir documento
                </Button>
                <span className="text-xs text-muted-foreground">PDF, TXT, MD aceptados</span>
              </div>
            </div>
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay documentos subidos.</p>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{doc.filename}</p>
                        <p className="text-xs text-muted-foreground">Subido {new Date(doc.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{doc.is_active ? "Activo" : "Inactivo"}</span>
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
        </TabsContent>

        <TabsContent value="flows" className="mt-6">
          <FlowsRulesTab />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
