import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Send } from "lucide-react";

type WebhookLogEntry = {
  id: string;
  direction: string;
  event_type: string | null;
  status: string | null;
  created_at: string;
  error: string | null;
};

type SlottyRequest = {
  id: string;
  client_name: string;
  status: string | null;
  workspace_id: string | null;
  created_at: string;
};

export function IntegrationsTab() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const [webhookLogs, setWebhookLogs] = useState<WebhookLogEntry[]>([]);
  const [slottyRequests, setSlottyRequests] = useState<SlottyRequest[]>([]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [settingsRes, logsRes, slottyRes] = await Promise.all([
      supabase.from("app_settings").select("key, value").in("key", ["webhook_url", "webhook_secret"]),
      supabase.from("webhook_log").select("id, direction, event_type, status, created_at, error").order("created_at", { ascending: false }).limit(20),
      supabase.from("slotty_workspace_requests").select("id, client_name, status, workspace_id, created_at").order("created_at", { ascending: false }).limit(10),
    ]);

    if (settingsRes.data) {
      for (const s of settingsRes.data) {
        if (s.key === "webhook_url") setWebhookUrl(s.value);
        if (s.key === "webhook_secret") setWebhookSecret(s.value);
      }
    }
    if (logsRes.data) setWebhookLogs(logsRes.data as unknown as WebhookLogEntry[]);
    if (slottyRes.data) setSlottyRequests(slottyRes.data as unknown as SlottyRequest[]);
  };

  const saveWebhookConfig = async () => {
    setSavingWebhook(true);
    for (const [key, value] of [["webhook_url", webhookUrl], ["webhook_secret", webhookSecret]]) {
      const { data: existing } = await supabase.from("app_settings").select("id").eq("key", key).maybeSingle();
      if (existing) {
        await supabase.from("app_settings").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
      } else {
        await supabase.from("app_settings").insert({ key, value });
      }
    }
    setSavingWebhook(false);
    toast.success("Configuración guardada");
  };

  const sendTestEvent = async () => {
    if (!webhookUrl) { toast.error("Configura la URL primero"); return; }
    setSendingTest(true);
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "test", timestamp: new Date().toISOString(), source: "pragma" }),
      });
      await supabase.from("webhook_log").insert({
        direction: "out",
        event_type: "test",
        payload: { url: webhookUrl },
        status: res.ok ? "sent" : "error",
        error: res.ok ? null : `HTTP ${res.status}`,
      });
      if (res.ok) toast.success("Evento de prueba enviado");
      else toast.error(`Error: HTTP ${res.status}`);
      fetchAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="bg-secondary/30 rounded-xl p-4">
        <p className="text-sm text-foreground mb-1"><strong>Integraciones externas</strong></p>
        <p className="text-sm text-muted-foreground">
          Conexiones con servicios fuera de PRAGMA. Si no usas Make ni Slotty puedes ignorar esta sección — el Webhook Log seguirá registrando los eventos del sistema Forge para debug.
        </p>
      </div>

      {/* Make.com Webhook */}
      <section>
        <h3 className="text-lg font-semibold text-foreground mb-1">Make.com Webhook</h3>
        <p className="text-xs text-muted-foreground mb-4">Envía eventos de PRAGMA (cliente creado, asset aprobado…) a un escenario de Make para automatizaciones externas.</p>
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">URL del webhook de Make</label>
            <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://hook.make.com/..." />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Clave secreta</label>
            <Input type="password" value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="flex gap-3">
            <Button onClick={saveWebhookConfig} disabled={savingWebhook}>
              {savingWebhook ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar configuración
            </Button>
            <Button variant="outline" onClick={sendTestEvent} disabled={sendingTest}>
              {sendingTest ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar evento de prueba
            </Button>
          </div>
        </div>
      </section>

      {/* Webhook Log */}
      <section>
        <h3 className="text-lg font-semibold text-foreground mb-4">Webhook Log</h3>
        {webhookLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay registros.</p>
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50">
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dir</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {webhookLogs.map(log => (
                  <tr key={log.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-2">
                      <Badge variant={log.direction === "in" ? "default" : "secondary"} className="text-[10px]">
                        {log.direction === "in" ? "IN" : "OUT"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{log.event_type || "—"}</td>
                    <td className="px-4 py-2">
                      <Badge variant={log.status === "error" ? "destructive" : "outline"} className="text-[10px]">
                        {log.status || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Slotty Integration Status */}
      <section>
        <h3 className="text-lg font-semibold text-foreground mb-4">Slotty Integration</h3>
        {slottyRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay solicitudes de workspace.</p>
        ) : (
          <div className="space-y-2">
            {slottyRequests.map(req => (
              <div key={req.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{req.client_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={req.status === "completed" ? "default" : req.status === "failed" ? "destructive" : "secondary"}>
                    {req.status || "pending"}
                  </Badge>
                  {req.workspace_id && (
                    <span className="text-xs font-mono text-muted-foreground">{req.workspace_id}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

