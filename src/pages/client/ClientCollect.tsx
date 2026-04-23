import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadClientAsset } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, CheckCircle2, Loader2, FileText } from "lucide-react";

type RequestItem = {
  label: string;
  type_hint: string;
  description: string;
  status: "pending" | "uploaded";
  file_url?: string;
  text_response?: string;
};

type AssetRequest = {
  id: string;
  client_id: string;
  requested_items: RequestItem[];
  status: string;
  created_at: string;
};

const ACCEPT_MAP: Record<string, string> = {
  Images: ".png,.jpg,.jpeg,.webp,.svg,.gif",
  PDF: ".pdf",
  Text: ".txt,.md,.pdf",
  "Any file": "*",
};

export default function ClientCollect() {
  const [request, setRequest] = useState<AssetRequest | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const [textInputs, setTextInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (!client) { setLoading(false); return; }
      setClientId(client.id);

      const { data } = await (supabase.from("client_asset_requests" as any) as any)
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setRequest(data[0] as AssetRequest);
        const texts: Record<number, string> = {};
        (data[0] as AssetRequest).requested_items.forEach((item: RequestItem, i: number) => {
          if (item.text_response) texts[i] = item.text_response;
        });
        setTextInputs(texts);
      }
      setLoading(false);
    };
    load();
  }, []);

  const updateRequestItems = async (newItems: RequestItem[]) => {
    if (!request) return;
    const uploadedCount = newItems.filter((i) => i.status === "uploaded").length;
    const newStatus = uploadedCount === 0 ? "pending" : uploadedCount === newItems.length ? "complete" : "partial";

    await (supabase.from("client_asset_requests" as any) as any)
      .update({
        requested_items: newItems,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    setRequest({ ...request, requested_items: newItems, status: newStatus });

    // Sync uploaded files into kickoff materials so the AI / admin can use them.
    if (clientId) {
      supabase.functions.invoke("sync-client-uploads-to-materials", {
        body: { client_id: clientId },
      }).catch((e) => console.error("sync-client-uploads-to-materials failed:", e));
    }
  };

  const handleFileUpload = async (index: number, file: File) => {
    if (!request || !clientId) return;
    setUploading((prev) => ({ ...prev, [index]: true }));
    try {
      const filePath = `${clientId}/collected/${Date.now()}_${file.name}`;
      const signedUrl = await uploadClientAsset(filePath, file);

      const newItems = [...request.requested_items];
      newItems[index] = {
        ...newItems[index],
        status: "uploaded",
        file_url: signedUrl,
      };
      await updateRequestItems(newItems);
      toast.success(`"${newItems[index].label}" cargado correctamente.`);
    } catch (e: any) {
      toast.error(e.message || "Error al subir el archivo");
    } finally {
      setUploading((prev) => ({ ...prev, [index]: false }));
    }
  };

  const handleTextSubmit = async (index: number) => {
    if (!request) return;
    const text = textInputs[index]?.trim();
    if (!text) return;

    const newItems = [...request.requested_items];
    newItems[index] = {
      ...newItems[index],
      status: "uploaded",
      text_response: text,
    };
    await updateRequestItems(newItems);
    toast.success(`"${newItems[index].label}" enviado.`);
  };

  if (loading) return <div className="text-muted-foreground p-8">Cargando…</div>;

  if (!request || request.requested_items.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 text-center space-y-2">
        <p className="text-muted-foreground">Aún no se han solicitado archivos.</p>
        <p className="text-sm text-muted-foreground">PRAGMA te avisará cuando necesite materiales de tu parte.</p>
      </div>
    );
  }

  const pendingCount = request.requested_items.filter((i) => i.status === "pending").length;
  const allDone = pendingCount === 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Archivos solicitados por PRAGMA</h1>
        <p className="text-muted-foreground mt-1">
          Sube los siguientes elementos para que podamos avanzar con tus campañas.
        </p>
      </div>

      {allDone && (
        <div className="mb-6 rounded-lg p-5 bg-gradient-to-r from-[hsl(142,71%,35%)] to-[hsl(152,60%,42%)] text-white">
          <p className="text-lg font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> ¡Todo cargado!
          </p>
          <p className="text-sm mt-1 text-white/90">Gracias. Vamos a empezar a trabajar en tus campañas.</p>
        </div>
      )}

      <div className="space-y-4">
        {request.requested_items.map((item, index) => {
          const isUploaded = item.status === "uploaded";
          const isUploading = uploading[index];
          const isTextItem = item.type_hint === "Text";
          const accept = ACCEPT_MAP[item.type_hint] || "*";

          return (
            <div
              key={index}
              className={`rounded-lg border overflow-hidden ${
                isUploaded
                  ? "border-[hsl(142,71%,35%)]/30 bg-[hsl(142,71%,35%)]/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="p-5 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">{item.label}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">{item.type_hint}</Badge>
                      {isUploaded && (
                        <Badge className="bg-[hsl(142,71%,35%)]/15 text-[hsl(142,71%,35%)] text-[10px]">
                          <CheckCircle2 className="w-3 h-3 mr-0.5" /> Enviado
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isUploaded && <CheckCircle2 className="w-5 h-5 text-[hsl(142,71%,35%)] shrink-0" />}
                </div>

                {/* Description */}
                {item.description && (
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                )}

                {/* Uploaded state or input */}
                {isUploaded ? (
                  <div className="text-sm text-muted-foreground space-y-1">
                    {item.file_url && (
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-primary hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" /> Ver archivo enviado
                      </a>
                    )}
                    {item.text_response && (
                      <div className="bg-secondary/30 rounded p-3 text-xs text-foreground whitespace-pre-wrap">
                        {item.text_response}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        const newItems = [...request.requested_items];
                        newItems[index] = { ...newItems[index], status: "pending", file_url: undefined, text_response: undefined };
                        updateRequestItems(newItems);
                      }}
                    >
                      {isTextItem ? "Editar respuesta" : "Reemplazar archivo"}
                    </Button>
                  </div>
                ) : isTextItem ? (
                  /* Text-only response */
                  <div>
                    <Textarea
                      placeholder="Escribe tu respuesta aquí…"
                      value={textInputs[index] || ""}
                      onChange={(e) => setTextInputs((prev) => ({ ...prev, [index]: e.target.value }))}
                      className="min-h-[100px] text-sm"
                    />
                    {(textInputs[index] || "").trim() && (
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => handleTextSubmit(index)}
                      >
                        Enviar respuesta
                      </Button>
                    )}
                  </div>
                ) : (
                  /* File upload only */
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center transition-colors"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-primary');
                      const file = e.dataTransfer.files[0];
                      if (file) handleFileUpload(index, file);
                    }}
                  >
                    <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">Arrastra y suelta o haz clic para subir</p>
                    <Input
                      type="file"
                      accept={accept}
                      className="max-w-xs mx-auto"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(index, file);
                      }}
                      disabled={isUploading}
                    />
                    {isUploading && (
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Subiendo…</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
