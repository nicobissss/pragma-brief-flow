import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AgentEffectiveStatus = {
  enabled: boolean;
  loading: boolean;
  source: "override" | "global" | "unknown";
};

/**
 * Returns the effective on/off state of an AI agent, taking into account
 * the per-client override (when clientId is provided) and the global
 * master + agent toggles.
 */
export function useAIAgentStatus(
  agentKey: string,
  clientId?: string | null
): AgentEffectiveStatus {
  const [state, setState] = useState<AgentEffectiveStatus>({
    enabled: false,
    loading: true,
    source: "unknown",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true }));

      // Determine source: client override or fallback to global
      let source: "override" | "global" = "global";
      if (clientId) {
        const { data: client } = await supabase
          .from("clients")
          .select("ai_agent_overrides")
          .eq("id", clientId)
          .maybeSingle();
        const overrides = (client?.ai_agent_overrides as Record<string, string>) || {};
        if (overrides[agentKey] === "on" || overrides[agentKey] === "off") {
          source = "override";
        }
      }

      const { data, error } = await supabase.rpc(
        "is_ai_agent_enabled_for_client",
        { _agent_key: agentKey, _client_id: clientId ?? null }
      );

      if (cancelled) return;
      setState({
        enabled: !error && Boolean(data),
        loading: false,
        source,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [agentKey, clientId]);

  return state;
}
