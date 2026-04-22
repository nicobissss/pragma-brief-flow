import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, RefreshCw, Loader2, Sparkles } from "lucide-react";
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
  const [kickoffs, setKickoffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [prospectFilter, setProspectFilter] = useState("all");
  const [monthlyReview, setMonthlyReview] = useState<string | null>(null);
  const [generatingReview, setGeneratingReview] = useState(false);

  const generateReview = async () => {
    setGeneratingReview(true);
    try {
      const { data } = await supabase.functions.invoke("generate-monthly-review");
      if (data?.review) setMonthlyReview(data.review);
    } catch (e: any) {
      console.error(e);
    } finally {
      setGeneratingReview(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    const [p, c, g, e, em, k] = await Promise.all([
      supabase.from("prospects").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("tool_generations").select("*, clients(name)").order("created_at", { ascending: false }),
      supabase.from("events").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("email_log").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("kickoff_briefs").select("*, clients(name, email)").order("created_at", { ascending: false }),
    ]);
    setProspects(p.data || []);
    setClients(c.data || []);
    setGenerations(g.data || []);
    setEvents(e.data || []);
    setEmailLog(em.data || []);
    setKickoffs(k.data || []);
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

  const briefingProspects = prospects.filter(p => p.briefing_answers && Object.keys(p.briefing_answers as object).length > 0);

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateReview} disabled={generatingReview}>
            {generatingReview ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando review...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />📊 Review mensile</>
            )}
          </Button>
          <Button variant="outline" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Aggiorna
          </Button>
        </div>
      </div>

      {monthlyReview && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Review mensile — {new Date().toLocaleDateString("it-IT", { month: "long", year: "numeric" })}
          </h2>
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
            {monthlyReview}
          </div>
        </div>
      )}

      <Tabs defaultValue="prompts">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="prompts">Prompts ({generations.length})</TabsTrigger>
          <TabsTrigger value="events">Events ({events.length})</TabsTrigger>
          <TabsTrigger value="email">Email log ({emailLog.length})</TabsTrigger>
          <TabsTrigger value="briefing">Briefing ({briefingProspects.length})</TabsTrigger>
          <TabsTrigger value="kickoff">Kickoff ({kickoffs.length})</TabsTrigger>
        </TabsList>

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
                          <div className="bg-secondary/50 p-4 rounded-lg space-y-4">
                            {(g.prompt as any)?.objective && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Obiettivo</p>
                                <p className="text-sm">{(g.prompt as any).objective}</p>
                              </div>
                            )}
                            {(g.prompt as any)?.workspace_config && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Config Slotty</p>
                                <pre className="text-xs overflow-auto max-h-40 bg-background p-2 rounded">
                                  {JSON.stringify((g.prompt as any).workspace_config, null, 2)}
                                </pre>
                              </div>
                            )}
                            {(g.prompt as any)?.system_prompt && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">System Prompt</p>
                                <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-60 bg-background p-2 rounded">
                                  {(g.prompt as any).system_prompt}
                                </pre>
                              </div>
                            )}
                            {(g.prompt as any)?.landing_task_prompts && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Task Prompts Landing</p>
                                <div className="space-y-1">
                                  {((g.prompt as any).landing_task_prompts as string[]).map((t, i) => (
                                    <p key={i} className="text-xs bg-background p-2 rounded">{t}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(g.prompt as any)?.email_sequence_prompts && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Task Prompts Email</p>
                                <div className="space-y-1">
                                  {((g.prompt as any).email_sequence_prompts as string[]).map((t, i) => (
                                    <p key={i} className="text-xs bg-background p-2 rounded">{t}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(g.prompt as any)?.topics && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Topics Blog</p>
                                <div className="flex flex-wrap gap-1">
                                  {((g.prompt as any).topics as string[]).map((t, i) => (
                                    <Badge key={i} variant="secondary">{t}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(g.prompt as any)?.avoid && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Da evitare</p>
                                <p className="text-sm">{(g.prompt as any).avoid}</p>
                              </div>
                            )}
                            {/* Fallback: raw JSON if no structured fields */}
                            {g.prompt && !(g.prompt as any)?.objective && !(g.prompt as any)?.system_prompt && (
                              <pre className="text-xs overflow-auto max-h-80">
                                {JSON.stringify(g.prompt, null, 2)}
                              </pre>
                            )}
                          </div>
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

        {/* TAB BRIEFING ANSWERS */}
        <TabsContent value="briefing">
          <div className="space-y-4">
            {briefingProspects.map((p) => (
              <div key={p.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">{p.email} · {p.vertical} / {p.sub_niche} · {p.market}</p>
                  </div>
                  <Badge variant="outline">{p.status}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(p.briefing_answers as Record<string, unknown>).map(([key, value]) => (
                    <div key={key} className="bg-secondary/30 rounded p-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase">
                        {key.replace(/_/g, " ")}
                      </span>
                      <p className="text-sm text-foreground mt-0.5">
                        {Array.isArray(value)
                          ? (value as string[]).join(", ") || "—"
                          : String(value || "—")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {briefingProspects.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nessun briefing disponibile.</p>
            )}
          </div>
        </TabsContent>

        {/* TAB KICKOFF BRIEFS */}
        <TabsContent value="kickoff">
          <div className="space-y-4">
            {kickoffs.map((k) => (
              <div key={k.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{(k.clients as any)?.name || k.client_id}</h3>
                    <p className="text-xs text-muted-foreground">{(k.clients as any)?.email}</p>
                  </div>
                  <Badge variant="outline">{k.transcript_status || "no transcript"}</Badge>
                </div>

                {k.transcript_quality && (
                  <div className="bg-secondary/30 rounded p-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Qualità trascrizione</span>
                    <p className="text-sm">{k.transcript_quality}</p>
                  </div>
                )}

                {k.voice_reference && (
                  <div className="bg-secondary/30 rounded p-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Voice Reference</span>
                    <p className="text-sm">{k.voice_reference}</p>
                  </div>
                )}

                {k.preferred_tone && (
                  <div className="bg-secondary/30 rounded p-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Tono preferito</span>
                    <p className="text-sm">{k.preferred_tone}</p>
                  </div>
                )}

                {k.client_rules && (k.client_rules as string[]).length > 0 && (
                  <div className="bg-secondary/30 rounded p-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Client Rules</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(k.client_rules as string[]).map((rule, i) => (
                        <Badge key={i} variant="secondary">{rule}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {k.suggested_services && (k.suggested_services as any[]).length > 0 && (
                  <div className="bg-secondary/30 rounded p-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Servizi suggeriti</span>
                    <div className="space-y-1 mt-1">
                      {(k.suggested_services as any[]).map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="text-xs">{s.approved ? "✅" : "⬜"}</span>
                          <span className="font-medium">{s.tool_name}</span>
                          <span className="text-muted-foreground">— {s.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {k.transcript_text && (
                  <div className="bg-secondary/30 rounded p-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Trascrizione (anteprima)</span>
                    <p className="text-sm mt-1 line-clamp-4">{k.transcript_text}</p>
                  </div>
                )}
              </div>
            ))}
            {kickoffs.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Nessun kickoff brief disponibile.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
