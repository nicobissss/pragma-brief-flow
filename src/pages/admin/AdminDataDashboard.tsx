import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, RefreshCw, Loader2, Sparkles, ChevronDown, AlertCircle, CheckCircle2, Ban, Bug } from "lucide-react";
import { toast } from "sonner";

type EmailRow = {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

type GenRow = { id: string; tool_name: string; status: string; created_at: string; prompt: any; clients: { name: string } | null };

const PAGE_SIZE = 50;
const RANGES = [
  { key: "24h", label: "Últimas 24h", hours: 24 },
  { key: "7d", label: "Últimos 7 días", hours: 24 * 7 },
  { key: "30d", label: "Últimos 30 días", hours: 24 * 30 },
];

function statusBadge(status: string) {
  const map: Record<string, { className: string; label: string; icon: any }> = {
    sent: { className: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Enviada", icon: CheckCircle2 },
    pending: { className: "bg-blue-100 text-blue-800 border-blue-200", label: "Pendiente", icon: Loader2 },
    failed: { className: "bg-red-100 text-red-800 border-red-200", label: "Fallida", icon: AlertCircle },
    dlq: { className: "bg-red-100 text-red-800 border-red-200", label: "Fallida (DLQ)", icon: AlertCircle },
    bounced: { className: "bg-red-100 text-red-800 border-red-200", label: "Rebotada", icon: AlertCircle },
    complained: { className: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "Quejada", icon: AlertCircle },
    suppressed: { className: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "Suprimida", icon: Ban },
  };
  const v = map[status] || { className: "bg-muted text-muted-foreground border-border", label: status, icon: AlertCircle };
  const Icon = v.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${v.className}`}>
      <Icon className="w-3 h-3" />
      {v.label}
    </span>
  );
}

export default function AdminDataDashboard() {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeKey, setRangeKey] = useState("7d");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  // Diagnostics
  const [debugMode, setDebugMode] = useState(false);
  const [generatingReview, setGeneratingReview] = useState(false);
  const [reviewContent, setReviewContent] = useState<string | null>(null);
  const [generations, setGenerations] = useState<GenRow[]>([]);
  const [expandedGen, setExpandedGen] = useState<string | null>(null);

  const loadEmails = async () => {
    setLoading(true);
    const range = RANGES.find((r) => r.key === rangeKey)!;
    const since = new Date(Date.now() - range.hours * 3600 * 1000).toISOString();

    // Fetch a generous window — dedup happens client-side by message_id (latest per id)
    const { data, error } = await supabase
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) {
      toast.error(`Error al cargar: ${error.message}`);
      setRows([]);
    } else {
      // Deduplicate by message_id, keeping latest (rows already DESC by created_at)
      const seen = new Set<string>();
      const dedup: EmailRow[] = [];
      for (const r of (data || []) as EmailRow[]) {
        const key = r.message_id || r.id;
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push(r);
      }
      setRows(dedup);
    }
    setLoading(false);
  };

  const loadGenerations = async () => {
    const { data } = await supabase
      .from("tool_generations")
      .select("id, tool_name, status, created_at, prompt, clients(name)")
      .order("created_at", { ascending: false })
      .limit(50);
    setGenerations((data || []) as any);
  };

  useEffect(() => {
    loadEmails();
    setPage(0);
  }, [rangeKey]);

  useEffect(() => {
    if (debugMode && generations.length === 0) loadGenerations();
  }, [debugMode]);

  const templates = useMemo(() => Array.from(new Set(rows.map((r) => r.template_name))).sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (templateFilter !== "all" && r.template_name !== templateFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "failed" && !["failed", "dlq", "bounced"].includes(r.status)) return false;
        if (statusFilter === "sent" && r.status !== "sent") return false;
        if (statusFilter === "suppressed" && r.status !== "suppressed") return false;
      }
      return true;
    });
  }, [rows, templateFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const sent = filtered.filter((r) => r.status === "sent").length;
    const failed = filtered.filter((r) => ["failed", "dlq", "bounced"].includes(r.status)).length;
    const suppressed = filtered.filter((r) => r.status === "suppressed").length;
    return { total, sent, failed, suppressed };
  }, [filtered]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const generateReview = async () => {
    setGeneratingReview(true);
    setReviewContent(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-monthly-review");
      if (error) throw error;
      if (data?.review) {
        setReviewContent(data.review);
        toast.success("Review mensual generada");
      } else {
        toast.error("La función no devolvió contenido");
      }
    } catch (e: any) {
      toast.error(`Error: ${e.message || "fallo desconocido"}`);
      console.error("generate-monthly-review error", e);
    } finally {
      setGeneratingReview(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Monitorización de emails</h1>
            <p className="text-sm text-muted-foreground">Estado de envío, errores y diagnóstico del sistema.</p>
          </div>
        </div>
        <Button variant="outline" onClick={loadEmails} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{stats.total}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-emerald-700 uppercase tracking-wide">Enviadas</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{stats.sent}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-red-700 uppercase tracking-wide">Fallidas</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{stats.failed}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-yellow-700 uppercase tracking-wide">Suprimidas</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{stats.suppressed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={rangeKey} onValueChange={setRangeKey}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={templateFilter} onValueChange={(v) => { setTemplateFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Plantilla" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las plantillas</SelectItem>
            {templates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="sent">Enviadas</SelectItem>
            <SelectItem value="failed">Fallidas</SelectItem>
            <SelectItem value="suppressed">Suprimidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-2xl bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plantilla</TableHead>
              <TableHead>Destinatario</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Cargando...</TableCell></TableRow>
            ) : paged.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay emails en este rango.</TableCell></TableRow>
            ) : (
              paged.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.template_name}</TableCell>
                  <TableCell className="text-sm">{r.recipient_email}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("es-ES")}</TableCell>
                  <TableCell className="text-xs text-red-700 max-w-xs truncate" title={r.error_message || ""}>
                    {r.error_message || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Página {page + 1} de {totalPages} · {filtered.length} resultados</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Anterior</Button>
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Siguiente</Button>
          </div>
        </div>
      )}

      {/* Diagnostics */}
      <Collapsible className="border border-border rounded-2xl bg-card">
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-foreground">Diagnóstico y herramientas</span>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent className="p-6 pt-2 space-y-6 border-t border-border">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Review mensual</h3>
            <p className="text-xs text-muted-foreground">Genera un análisis estratégico del último mes.</p>
            <Button variant="outline" size="sm" onClick={generateReview} disabled={generatingReview}>
              {generatingReview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Generar review mensual
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Modo debug</h3>
                <p className="text-xs text-muted-foreground">Muestra los últimos prompts generados por la IA.</p>
              </div>
              <Switch checked={debugMode} onCheckedChange={setDebugMode} />
            </div>

            {debugMode && (
              <div className="border border-border rounded-lg overflow-hidden mt-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tool</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generations.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Sin prompts generados.</TableCell></TableRow>
                    ) : generations.map((g) => (
                      <>
                        <TableRow key={g.id}>
                          <TableCell className="text-sm">{g.clients?.name || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{g.tool_name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{g.status}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(g.created_at).toLocaleDateString("es-ES")}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => setExpandedGen(expandedGen === g.id ? null : g.id)}>
                              {expandedGen === g.id ? "Ocultar" : "Ver"}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedGen === g.id && (
                          <TableRow key={`${g.id}-x`}>
                            <TableCell colSpan={5}>
                              <pre className="bg-secondary/40 p-3 rounded text-xs overflow-auto max-h-80 whitespace-pre-wrap">
                                {JSON.stringify(g.prompt, null, 2)}
                              </pre>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Review dialog */}
      <Dialog open={!!reviewContent} onOpenChange={(o) => !o && setReviewContent(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review mensual — {new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
            {reviewContent}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
