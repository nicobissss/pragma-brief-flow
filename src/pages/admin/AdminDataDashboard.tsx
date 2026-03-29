import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, RefreshCw } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const eventBadgeClass: Record<string, string> = {
  "prospect.created": "bg-blue-100 text-blue-800 border-blue-200",
  "prospect.accepted": "bg-green-100 text-green-800 border-green-200",
  "asset.uploaded": "bg-orange-100 text-orange-800 border-orange-200",
  "asset.approved": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "asset.feedback": "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const statusBadgeClass: Record<string, string> = {
  prompt_ready: "bg-blue-100 text-blue-800 border-blue-200",
  sent: "bg-green-100 text-green-800 border-green-200",
  content_ready: "bg-purple-100 text-purple-800 border-purple-200",
};

export default function AdminDataDashboard() {
  const [prospects, setProspects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [generations, setGenerations] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [emailLog, setEmailLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [prospectFilter, setProspectFilter] = useState("all");

  const loadAll = async () => {
    setLoading(true);
    const [p, c, g, e, em] = await Promise.all([
      supabase.from("prospects").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("tool_generations").select("*, clients(name)").order("created_at", { ascending: false }),
      supabase.from("events").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("email_log").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setProspects(p.data || []);
    setClients(c.data || []);
    setGenerations(g.data || []);
    setEvents(e.data || []);
    setEmailLog(em.data || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(r =>
      Object.values(r).map(v =>
        typeof v === "object" ? `"${JSON.stringify(v).replace(/"/g, '""')}"` : `"${String(v ?? "")}"`
      ).join(",")
    ).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const filteredProspects = prospectFilter === "all"
    ? prospects
    : prospects.filter(p => p.status === prospectFilter);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Data Dashboard</h1>
            <p className="text-sm text-muted-foreground">Vista completa di tutti i dati del sistema</p>
          </div>
        </div>
        <Button variant="outline" onClick={loadAll} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Aggiorna
        </Button>
      </div>

      <Tabs defaultValue="prospects">
        <TabsList>
          <TabsTrigger value="prospects">Prospects ({prospects.length})</TabsTrigger>
          <TabsTrigger value="clients">Clienti ({clients.length})</TabsTrigger>
          <TabsTrigger value="prompts">Prompts ({generations.length})</TabsTrigger>
          <TabsTrigger value="events">Events ({events.length})</TabsTrigger>
          <TabsTrigger value="email">Email log ({emailLog.length})</TabsTrigger>
        </TabsList>

        {/* TAB PROSPECTS */}
        <TabsContent value="prospects">
          <div className="flex items-center gap-2 mb-4">
            {["all", "new", "accepted", "archived"].map(f => (
              <Button
                key={f}
                size="sm"
                variant={prospectFilter === f ? "default" : "outline"}
                onClick={() => setProspectFilter(f)}
              >
                {f === "all" ? "Tutti" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => exportCSV(filteredProspects, "prospects.csv")}>
              Esporta CSV
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Vertical</TableHead>
                  <TableHead>Mercato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Call</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Creato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProspects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.email}</TableCell>
                    <TableCell>{p.vertical}</TableCell>
                    <TableCell>{p.market}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{p.call_status || "not_booked"}</Badge></TableCell>
                    <TableCell>{(p.briefing_answers as any)?.average_ticket || "—"} {(p.briefing_answers as any)?.ticket_currency || ""}</TableCell>
                    <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {filteredProspects.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nessun prospect</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB CLIENTI */}
        <TabsContent value="clients">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Vertical</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Piano</TableHead>
                  <TableHead>Creato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => window.location.href = `/admin/client/${c.id}`}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{c.vertical}</TableCell>
                    <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{c.pipeline_status || "kickoff"}</Badge></TableCell>
                    <TableCell>{c.project_plan_shared ? "✅ Condiviso" : "—"}</TableCell>
                    <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {clients.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nessun cliente</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB PROMPTS */}
        <TabsContent value="prompts">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tool</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Creato</TableHead>
                  <TableHead>Inviato</TableHead>
                  <TableHead>Prompt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generations.map((g) => (
                  <>
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{(g.clients as any)?.name || g.client_id}</TableCell>
                      <TableCell>{g.tool_name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass[g.status] || "bg-muted text-muted-foreground border-border"}`}>
                          {g.status}
                        </span>
                      </TableCell>
                      <TableCell>{new Date(g.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{g.sent_at ? new Date(g.sent_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setExpandedRow(expandedRow === g.id ? null : g.id)}>
                          {expandedRow === g.id ? "Nascondi" : "Vedi prompt"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRow === g.id && (
                      <TableRow key={`${g.id}-expanded`}>
                        <TableCell colSpan={6}>
                          <pre className="bg-secondary/50 p-4 rounded-lg text-xs overflow-auto max-h-80">
                            {JSON.stringify(g.prompt, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
                {generations.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nessun prompt</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB EVENTS */}
        <TabsContent value="events">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <>
                    <TableRow key={e.id}>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${eventBadgeClass[e.event_type] || "bg-muted text-muted-foreground border-border"}`}>
                          {e.event_type}
                        </span>
                      </TableCell>
                      <TableCell>{e.entity_type}</TableCell>
                      <TableCell>{new Date(e.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setExpandedRow(expandedRow === e.id ? null : e.id)}>
                          {expandedRow === e.id ? "Nascondi" : "Vedi"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRow === e.id && (
                      <TableRow key={`${e.id}-expanded`}>
                        <TableCell colSpan={4}>
                          <pre className="bg-secondary/50 p-4 rounded-lg text-xs overflow-auto max-h-80">
                            {JSON.stringify(e.payload, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
                {events.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nessun evento</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB EMAIL LOG */}
        <TabsContent value="email">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>A</TableHead>
                  <TableHead>Oggetto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailLog.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.type}</TableCell>
                    <TableCell>{e.to_email}</TableCell>
                    <TableCell>{e.subject}</TableCell>
                    <TableCell>
                      <Badge className={e.status === "sent" ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"}>
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(e.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {emailLog.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nessuna email</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}