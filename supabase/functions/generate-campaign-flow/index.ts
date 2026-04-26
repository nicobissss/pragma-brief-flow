// generate-campaign-flow
// Espande i deliverables dell'offerta vincolata in nodi base, poi chiede all'AI
// di arricchire il flow (sequenza, dipendenze, eventuali nodi standard mancanti
// come retargeting / thank-you).
//
// Input: { campaign_id, regenerate?: boolean }
// Output: salva (upsert) in campaign_flows e lo ritorna.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithTool } from "../_shared/ai.ts";
import { buildClientContext } from "../_shared/build-client-context.ts";
import { recordAgentRun } from "../_shared/telemetry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  name: "deliver_campaign_flow",
  description: "Returns enriched flow nodes + edges for a campaign.",
  input_schema: {
    type: "object",
    properties: {
      nodes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            channel: {
              type: "string",
              description: "e.g. email, landing_page, paid_meta, paid_ig, social_post, sms, whatsapp, ads_google, retargeting, thank_you",
            },
            week: { type: "integer", minimum: 1 },
            description: { type: "string", description: "What this touchpoint does in 1-2 sentences." },
            objective: { type: "string" },
            sub_tool_hint: { type: "string", description: "Suggested external sub-tool key, if any." },
          },
          required: ["id", "label", "channel", "week", "description", "objective"],
          additionalProperties: false,
        },
      },
      edges: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            source: { type: "string" },
            target: { type: "string" },
            label: { type: "string" },
          },
          required: ["id", "source", "target"],
          additionalProperties: false,
        },
      },
      rationale: { type: "string" },
    },
    required: ["nodes", "edges", "rationale"],
    additionalProperties: false,
  },
};

function expandDeliverablesToBaseNodes(deliverables: any[]): any[] {
  if (!Array.isArray(deliverables) || deliverables.length === 0) return [];
  return deliverables.map((d: any, idx: number) => {
    const hint = d?.flow_node_hint || {};
    const channel =
      hint.channel ||
      (d?.type === "email" ? "email" :
       d?.type === "landing_page" ? "landing_page" :
       d?.type === "social_post" ? "social_post" :
       d?.type === "ad" ? "paid_meta" : "social_post");
    const week = hint.week || Math.floor(idx / 2) + 1;
    return {
      id: `n_${idx + 1}`,
      label: d?.name || d?.title || `Touchpoint ${idx + 1}`,
      channel,
      week,
      description: d?.description || "",
      objective: d?.objective || "",
      depends_on: hint.depends_on || [],
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, client_id, name, objective, target_audience, key_message, timeline, client_offering_id")
      .eq("id", campaign_id)
      .maybeSingle();
    if (!campaign) {
      return new Response(JSON.stringify({ error: "campaign not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: enabled } = await supabase.rpc("is_ai_agent_enabled_for_client", {
      _agent_key: "campaign_flow_generator",
      _client_id: campaign.client_id,
    });
    if (enabled === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Agent campaign_flow_generator disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ctx = await buildClientContext(supabase, {
      client_id: campaign.client_id,
      campaign_id: campaign.id,
      client_offering_id: campaign.client_offering_id,
    });

    const offering = ctx.target_offering?.offering_template;
    const deliverables = ctx.target_offering?.custom_deliverables || offering?.deliverables || [];
    const baseNodes = expandDeliverablesToBaseNodes(deliverables);

    const langInstr =
      ctx.client?.market === "IT"
        ? "Rispondi sempre in italiano professionale."
        : "Responde siempre en español profesional.";

    const baseNodesBlock = baseNodes.length
      ? baseNodes.map((n) => `- [${n.id}] ${n.label} (channel=${n.channel}, week=${n.week})`).join("\n")
      : "(no deliverables — start from scratch)";

    const systemPrompt = `Eres un Marketing Strategist senior. Diseñas el flujo de touchpoints de una campaña.
${langInstr}
Tu trabajo:
1) Toma los nodos base (derivados de los deliverables de la oferta).
2) Arríchelos: ajusta semanas, añade dependencias realistas (edges), añade nodos estándar faltantes (ej. retargeting, thank-you page) si tienen sentido.
3) NO elimines los nodos base salvo que sean redundantes.
4) Cada nodo debe tener objective claro.
5) Devuelve siempre vía la function call.`;

    const userPrompt = `# CAMPAÑA
${campaign.name}
Objetivo: ${campaign.objective || "(vacío)"}
Audiencia: ${campaign.target_audience || "(vacío)"}
Mensaje clave: ${campaign.key_message || "(vacío)"}
Timeline: ${campaign.timeline || "(vacío)"}

# OFERTA VINCULADA
${offering ? `${offering.name} — ${offering.description || ""}` : "(no oferta vinculada)"}

# NODOS BASE DERIVADOS DE DELIVERABLES
${baseNodesBlock}

Diseña el flow enriquecido (nodos + edges).`;

    const ai = await callAIWithTool({
      system: systemPrompt,
      prompt: userPrompt,
      tool: TOOL,
      max_tokens: 4096,
      model: "google/gemini-2.5-pro",
    });

    const block = ai.content.find((b: any) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      return new Response(JSON.stringify({ error: "AI did not return structured output" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const out = block.input as any;

    // Upsert campaign_flow (one per campaign)
    const { data: existing } = await supabase
      .from("campaign_flows")
      .select("id, version")
      .eq("campaign_id", campaign.id)
      .maybeSingle();

    let saved;
    if (existing) {
      const { data, error } = await supabase
        .from("campaign_flows")
        .update({
          nodes: out.nodes,
          edges: out.edges,
          version: (existing.version || 1) + 1,
          generated_from_offering: !!offering,
          status: "draft",
        })
        .eq("id", existing.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase
        .from("campaign_flows")
        .insert({
          campaign_id: campaign.id,
          client_id: campaign.client_id,
          nodes: out.nodes,
          edges: out.edges,
          generated_from_offering: !!offering,
          status: "draft",
          version: 1,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      saved = data;
    }

    await recordAgentRun(supabase, "campaign_flow_generator", "success", 0);
    return new Response(
      JSON.stringify({ ok: true, flow: saved, rationale: out.rationale }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("generate-campaign-flow error:", err);
    const status = err?.status === 402 || err?.status === 429 ? err.status : 500;
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await recordAgentRun(sb, "campaign_flow_generator", "error", 0);
    } catch {}
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
