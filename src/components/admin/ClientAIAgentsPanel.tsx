import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bot, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

type AgentRow = {
  id: string;
  agent_key: string;
  display_name: string;
  description: string | null;
  enabled: boolean; // global
  category: string;
};

type Override = "inherit" | "on" | "off";

type Props = {
  clientId: string;
};

const OVERRIDE_OPTIONS: { value: Override; label: string }[] = [
  { value: "inherit", label: "Hereda global" },
  { value: "on", label: "Forzar ON" },
  { value: "off", label: "Forzar OFF" },
];

export default function ClientAIAgentsPanel({ clientId }: Props) {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: agentsData }, { data: clientData }] = await Promise.all([
      supabase
        .from("ai_agent_settings")
        .select("id, agent_key, display_name, description, enabled, category")
        .order("sort_order"),
      supabase
        .from("clients")
        .select("ai_agent_overrides")
        .eq("id", clientId)
        .maybeSingle(),
    ]);
    setAgents((agentsData as AgentRow[]) || []);
    const raw = (clientData?.ai_agent_overrides as Record<string, string>) || {};
    const normalized: Record<string, Override> = {};
    for (const [k, v] of Object.entries(raw)) {
      normalized[k] = v === "on" ? "on" : v === "off" ? "off" : "inherit";
    }
    setOverrides(normalized);
    setLoading(false);
  };

  useEffect(() => {
    if (clientId) fetchAll();
  }, [clientId]);

  const setOverride = async (agentKey: string, value: Override) => {
    setSavingKey(agentKey);
    const next = { ...overrides };
    if (value === "inherit") delete next[agentKey];
    else next[agentKey] = value;

    const persisted: Record<string, string> = {};
    for (const [k, v] of Object.entries(next)) {
      if (v !== "inherit") persisted[k] = v;
    }

    const { error } = await supabase
      .from("clients")
      .update({ ai_agent_overrides: persisted })
      .eq("id", clientId);

    setSavingKey(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOverrides(next);
    toast.success("Override actualizado");
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
      </div>
    );
  }

  const others = agents.filter((a) => a.agent_key !== "master_switch");

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Bot className="w-5 h-5 text-primary mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">
              Agentes IA para este cliente
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Por defecto cada agente hereda la configuración global. Puedes
              forzar ON / OFF solo para este cliente — útil para activar la QA
              de assets sin habilitar el agente para todos.
            </p>
            <Link
              to="/admin/settings"
              className="text-xs text-primary hover:underline mt-2 inline-block"
            >
              Ver configuración global →
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {others.map((agent) => {
          const override = overrides[agent.agent_key] || "inherit";
          const effective =
            override === "on"
              ? true
              : override === "off"
              ? false
              : agent.enabled; // simple visual hint (doesn't include master, RPC handles that)
          return (
            <div
              key={agent.id}
              className="bg-card rounded-xl border border-border p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground text-sm">
                    {agent.display_name}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      effective
                        ? "border-emerald-300 text-emerald-700"
                        : "text-muted-foreground"
                    }`}
                  >
                    {effective ? "ON efectivo" : "OFF efectivo"}
                  </Badge>
                  {override !== "inherit" && (
                    <Badge variant="outline" className="text-[10px]">
                      override
                    </Badge>
                  )}
                </div>
                {agent.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {agent.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {OVERRIDE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={override === opt.value ? "default" : "outline"}
                    disabled={savingKey === agent.agent_key}
                    onClick={() => setOverride(agent.agent_key, opt.value)}
                    className="text-xs h-8"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
