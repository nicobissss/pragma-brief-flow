import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  Calendar,
  Cog,
  CreditCard,
  Loader2,
  PlayCircle,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

type AgentRow = {
  id: string;
  agent_key: string;
  display_name: string;
  description: string | null;
  enabled: boolean;
  category: string;
  trigger_type: string;
  sort_order: number;
  config: Record<string, any>;
  last_run_at: string | null;
  last_run_status: string | null;
  last_cost_estimate_eur: number | null;
  total_runs: number;
  total_cost_estimate_eur: number;
};

const CATEGORY_META: Record<
  string,
  { label: string; icon: any; color: string }
> = {
  master: { label: "Master", icon: Zap, color: "text-amber-600" },
  quality: { label: "Calidad", icon: Sparkles, color: "text-blue-600" },
  sales: { label: "Ventas", icon: TrendingUp, color: "text-emerald-600" },
  learning: { label: "Aprendizaje", icon: Bot, color: "text-purple-600" },
  productivity: { label: "Productividad", icon: Cog, color: "text-slate-600" },
  production: { label: "Producción", icon: PlayCircle, color: "text-pink-600" },
  automation: { label: "Automatización", icon: Bot, color: "text-slate-600" },
};

const TRIGGER_LABELS: Record<string, string> = {
  event: "Evento",
  cron: "Programado",
  manual: "Manual",
};

export default function AIAgentsControlTab() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchAgents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_agent_settings")
      .select("*")
      .order("sort_order");
    if (error) {
      toast.error(error.message);
    } else {
      setAgents((data as unknown as AgentRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const toggleAgent = async (agent: AgentRow, next: boolean) => {
    setSaving(agent.id);
    const { error } = await supabase
      .from("ai_agent_settings")
      .update({ enabled: next })
      .eq("id", agent.id);
    setSaving(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAgents((prev) =>
      prev.map((a) => (a.id === agent.id ? { ...a, enabled: next } : a))
    );
    toast.success(
      `${agent.display_name} ${next ? "activado" : "desactivado"}`
    );
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando agentes...
      </div>
    );
  }

  const master = agents.find((a) => a.agent_key === "master_switch");
  const others = agents.filter((a) => a.agent_key !== "master_switch");
  const totalCost = agents.reduce(
    (sum, a) => sum + Number(a.total_cost_estimate_eur || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <Bot className="w-5 h-5 text-primary mt-1" />
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">Agentes IA</h3>
            <p className="text-sm text-muted-foreground">
              Controla qué agentes IA se ejecutan automáticamente. Por defecto
              todos están <strong>apagados</strong> para evitar gastos
              imprevistos. Activa solo los que necesites cuando tengas clientes
              activos.
            </p>
          </div>
        </div>
      </div>

      {/* AI credits status banner */}
      {(() => {
        const noCreditsAgent = agents.find(
          (a) => a.last_run_status === "no_credits"
        );
        const rateLimitedAgent = agents.find(
          (a) => a.last_run_status === "rate_limited"
        );
        if (noCreditsAgent) {
          return (
            <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      Sin créditos en Lovable AI
                      <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                        Bloqueado
                      </Badge>
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                      El último intento de <strong>{noCreditsAgent.display_name}</strong> falló
                      con un error 402 (créditos insuficientes). Los agentes
                      seguirán pausados hasta que recargues el workspace.
                    </p>
                    {noCreditsAgent.last_run_at && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Detectado: {new Date(noCreditsAgent.last_run_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={fetchAgents}>
                    Reintentar
                  </Button>
                  <Button
                    size="sm"
                    asChild
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    <a
                      href="https://lovable.dev/settings/workspace"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Recargar créditos
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          );
        }
        if (rateLimitedAgent) {
          return (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div className="text-sm">
                <span className="font-semibold text-foreground">Rate limit alcanzado.</span>{" "}
                <span className="text-muted-foreground">
                  Espera unos segundos antes de reintentar la IA.
                </span>
              </div>
            </div>
          );
        }
        return (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <div className="text-sm">
              <span className="font-semibold text-foreground">Créditos OK.</span>{" "}
              <span className="text-muted-foreground">
                No se han detectado errores de pago en las últimas ejecuciones.
              </span>
            </div>
          </div>
        );
      })()}
      {master && (
        <div
          className={`rounded-2xl border-2 p-6 transition-colors ${
            master.enabled
              ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Zap
                className={`w-6 h-6 mt-0.5 ${
                  master.enabled ? "text-amber-600" : "text-muted-foreground"
                }`}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-foreground">
                    {master.display_name}
                  </h4>
                  <Badge variant={master.enabled ? "default" : "outline"}>
                    {master.enabled ? "Activo" : "Pausado"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  {master.description}
                </p>
                {!master.enabled && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Mientras esté apagado, ningún agente IA se ejecutará, sin
                    importar su configuración individual.
                  </div>
                )}
              </div>
            </div>
            <Switch
              checked={master.enabled}
              disabled={saving === master.id}
              onCheckedChange={(v) => toggleAgent(master, v)}
            />
          </div>
        </div>
      )}

      {/* Cost summary */}
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
        <div className="text-sm">
          <span className="text-muted-foreground">Coste estimado total: </span>
          <span className="font-semibold text-foreground">
            €{totalCost.toFixed(4)}
          </span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-muted-foreground">
            {agents.reduce((s, a) => s + a.total_runs, 0)} ejecuciones totales
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={fetchAgents}>
          Refrescar
        </Button>
      </div>

      {/* Individual agents */}
      <div className="space-y-3">
        {others.map((agent) => {
          const meta = CATEGORY_META[agent.category] || CATEGORY_META.automation;
          const Icon = meta.icon;
          const masterOn = master?.enabled ?? false;
          const effectivelyOn = agent.enabled && masterOn;
          return (
            <div
              key={agent.id}
              className={`bg-card rounded-2xl border p-5 transition-colors ${
                effectivelyOn
                  ? "border-primary/40"
                  : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <Icon className={`w-5 h-5 mt-0.5 ${meta.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground">
                        {agent.display_name}
                      </h4>
                      <Badge variant="outline" className="text-[10px]">
                        {meta.label}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        <Calendar className="w-3 h-3 mr-1" />
                        {TRIGGER_LABELS[agent.trigger_type] ||
                          agent.trigger_type}
                      </Badge>
                      {agent.enabled && !masterOn && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-amber-700 border-amber-300"
                        >
                          Pausado por master
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {agent.description}
                    </p>
                    {agent.config?.model && (
                      <p className="text-[11px] font-mono text-muted-foreground mt-2">
                        Modelo: {agent.config.model as string}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>
                        {agent.total_runs} ejec. ·{" "}
                        €{Number(agent.total_cost_estimate_eur || 0).toFixed(4)}
                      </span>
                      {agent.last_run_at && (
                        <span>
                          Última:{" "}
                          {new Date(agent.last_run_at).toLocaleString()}
                          {agent.last_run_status &&
                            ` (${agent.last_run_status})`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Switch
                  checked={agent.enabled}
                  disabled={saving === agent.id}
                  onCheckedChange={(v) => toggleAgent(agent, v)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
