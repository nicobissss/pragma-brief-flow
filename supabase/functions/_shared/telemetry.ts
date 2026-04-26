/**
 * Telemetry helper for AI agents.
 *
 * Call recordAgentRun() at the end of every AI edge function (success or
 * failure) so ai_agent_settings.total_runs / total_cost_estimate_eur /
 * last_run_status / last_run_at stay current. Never throws — telemetry
 * failures must not break the parent operation.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type AgentRunStatus = "success" | "error" | "skipped";

export async function recordAgentRun(
  supabase: SupabaseClient,
  agentKey: string,
  status: AgentRunStatus,
  costEur: number = 0,
): Promise<void> {
  try {
    const { error } = await supabase.rpc("record_agent_run", {
      _agent_key: agentKey,
      _status: status,
      _cost_eur: costEur || 0,
    });
    if (error) console.error(`[telemetry] ${agentKey}:`, error.message);
  } catch (e) {
    console.error(`[telemetry] recordAgentRun crashed for ${agentKey}:`, e);
  }
}

/**
 * Rough EUR cost estimate for Lovable AI Gateway calls.
 * Update as gateway pricing evolves.
 */
const PRICE_PER_1M_EUR: Record<string, { in: number; out: number }> = {
  "google/gemini-3-flash-preview": { in: 0.075, out: 0.3 },
  "google/gemini-3.1-flash-image-preview": { in: 0.4, out: 1.2 },
  "google/gemini-3-pro-image-preview": { in: 1.25, out: 5 },
  "google/gemini-3.1-pro-preview": { in: 1.25, out: 5 },
  "google/gemini-2.5-flash": { in: 0.075, out: 0.3 },
  "google/gemini-2.5-flash-lite": { in: 0.04, out: 0.15 },
  "google/gemini-2.5-pro": { in: 1.25, out: 5 },
  "openai/gpt-5": { in: 2.5, out: 10 },
  "openai/gpt-5-mini": { in: 0.25, out: 2 },
  "openai/gpt-5-nano": { in: 0.05, out: 0.4 },
};

export function estimateCostEur(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number {
  const rate =
    PRICE_PER_1M_EUR[model] ?? PRICE_PER_1M_EUR["google/gemini-3-flash-preview"];
  return (tokensIn * rate.in + tokensOut * rate.out) / 1_000_000;
}
