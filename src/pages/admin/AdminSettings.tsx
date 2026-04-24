import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Pencil, Save } from "lucide-react";

import { IntegrationsTab } from "@/components/admin/IntegrationsTab";
import { FlowsRulesTab } from "@/components/admin/FlowsRulesTab";
import OfferingsCatalogTab from "@/components/admin/OfferingsCatalogTab";

const CATEGORIES = [
  { key: "flows_processes", title: "Flows & Procesos" },
  { key: "pitch_guidelines", title: "Pitch Guidelines" },
] as const;

type KBRow = { id: string; category: string; content: string; updated_at: string };

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
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const { data } = await supabase
      .from("knowledge_base")
      .select("*")
      .in("category", CATEGORIES.map((c) => c.key))
      .order("category");
    if (data) setKbRows(data as unknown as KBRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  if (loading) return <div className="p-8 text-muted-foreground">Cargando...</div>;

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-foreground mb-2">Configuración</h1>
      <p className="text-muted-foreground mb-6">
        Configura las guías que la IA usa para generar contenidos, los tools disponibles, el catálogo de ofertas y las integraciones externas.
      </p>

      <Tabs defaultValue="knowledge">
        <TabsList>
          <TabsTrigger value="knowledge">Guías para la IA</TabsTrigger>
          <TabsTrigger value="flows">Tools & Reglas</TabsTrigger>
          <TabsTrigger value="offerings">Catálogo de ofertas</TabsTrigger>
          <TabsTrigger value="integrations">Integraciones</TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge" className="mt-6 space-y-4">
          <p className="text-xs text-muted-foreground">
            Texto narrativo que se inyecta como contexto en los prompts de la IA (propuestas, kickoff, generación de assets). No define ofertas ni precios.
          </p>
          {kbRows.map((row) => (
            <KBBlock key={row.id} row={row} onSaved={fetchAll} />
          ))}
        </TabsContent>

        <TabsContent value="flows" className="mt-6">
          <FlowsRulesTab />
        </TabsContent>

        <TabsContent value="offerings" className="mt-6">
          <OfferingsCatalogTab />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

