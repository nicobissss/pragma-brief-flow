// Briefer Enrichment Agent — analyzes a (possibly incomplete) campaign brief
// and returns concrete improvement suggestions per field. Does NOT mutate the
// brief: client decides which suggestions to apply.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithTool } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENRICH_TOOL = {
  name: "deliver_brief_enrichment",
  description: "Returns improvement suggestions for an incomplete campaign brief.",
  input_schema: {
    type: "object",
    properties: {
      completeness_score: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "How complete the current brief is (0=empty, 100=ready for prompt generation).",
      },
      overall_assessment: {
        type: "string",
        description: "One short paragraph (max 300 chars) summarizing what's strong and what's missing.",
      },
      suggestions: {
        type: "array",
        description: "One suggestion per brief field that needs improvement.",
        items: {
          type: "object",
          properties: {
            field: {
              type: "string",
              enum: ["objective", "target_audience", "key_message", "timeline", "description"],
            },
            current_value: { type: "string", description: "Current value (or empty)." },
            issue: { type: "string", description: "Why current value is weak / vague / missing." },
            suggested_value: {
              type: "string",
              description: "A concrete, ready-to-paste replacement. Keep it specific and actionable.",
            },
            rationale: {
              type: "string",
              description: "Brief reason why this improves the brief.",
            },
          },
          required: ["field", "current_value", "issue", "suggested_value", "rationale"],
          additionalProperties: false,
        },
      },
      missing_questions: {
        type: "array",
        description: "Important questions the brief still leaves unanswered (max 5).",
        items: { type: "string" },
      },
    },
    required: ["completeness_score", "overall_assessment", "suggestions", "missing_questions"],
    additionalProperties: false,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { client_id, campaign_id, brief } = body || {};
    if (!client_id || !brief) {
      return new Response(JSON.stringify({ error: "client_id and brief required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Agent gating
    const { data: enabled } = await supabase.rpc("is_ai_agent_enabled_for_client", {
      _agent_key: "briefer_enrichment",
      _client_id: client_id,
    });
    if (enabled === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Agent briefer_enrichment is disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load light client context
    const { data: client } = await supabase
      .from("clients")
      .select("name, company_name, vertical, sub_niche, market")
      .eq("id", client_id)
      .maybeSingle();
    const { data: kb } = await supabase
      .from("kickoff_briefs")
      .select("voice_reference, structured_info, preferred_tone")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const langInstr =
      client?.market === "IT"
        ? "Rispondi sempre in italiano professionale."
        : "Responde siempre en español profesional.";

    const ctxLines: string[] = [];
    ctxLines.push(`Cliente: ${client?.company_name || client?.name || "N/A"}`);
    ctxLines.push(`Vertical: ${client?.vertical} · Sub-niche: ${client?.sub_niche}`);
    ctxLines.push(`Mercado: ${client?.market}`);
    if (kb?.preferred_tone) ctxLines.push(`Tono preferido: ${kb.preferred_tone}`);
    if (kb?.voice_reference) ctxLines.push(`Voz de marca (extracto): ${String(kb.voice_reference).slice(0, 600)}`);

    const briefBlock = `
Campaign brief actual:
- Nombre: ${brief.name || "(sin nombre)"}
- Objetivo: ${brief.objective || "(vacío)"}
- Audiencia: ${brief.target_audience || "(vacío)"}
- Mensaje clave: ${brief.key_message || "(vacío)"}
- Timeline: ${brief.timeline || "(vacío)"}
- Descripción: ${brief.description || "(vacío)"}
`.trim();

    const systemPrompt = `Eres un strategist senior de Pragma Marketers que revisa briefs de campaña ANTES de pasarlos a copywriters.
${langInstr}
Tu trabajo: detectar campos vagos/genéricos/vacíos y proponer reemplazos CONCRETOS y específicos.
Reglas:
- Cada suggested_value debe ser específico (números, segmentos, timeframes), no genérico.
- Si un campo ya está sólido, NO lo incluyas en suggestions.
- completeness_score: 0-30 si faltan 2+ campos clave; 30-60 si están pero genéricos; 60-85 si decentes; 85-100 si excelentes.
- Devuelve siempre via la function call.`;

    const userPrompt = `# CONTEXTO CLIENTE\n${ctxLines.join("\n")}\n\n# BRIEF A REVISAR\n${briefBlock}\n\nAnaliza y propone mejoras concretas.`;

    const ai = await callAIWithTool({
      system: systemPrompt,
      prompt: userPrompt,
      tool: ENRICH_TOOL,
      max_tokens: 3000,
      model: "google/gemini-2.5-pro",
    });

    const block = ai.content.find((b: any) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      return new Response(JSON.stringify({ error: "AI did not return structured output" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, ...block.input, campaign_id: campaign_id || null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("enrich-campaign-brief error:", err);
    const status = err?.status === 402 || err?.status === 429 ? err.status : 500;
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
