// enrich-master-asset-brief
// Suggerisce miglioramenti al brief del master asset (label, hero_message, cta,
// imagery_direction, voice). NON muta nulla: l'admin decide cosa applicare.
// Input: { master_asset_id }
// Output: { suggestions: [...], completeness_score, missing_questions }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithTool } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  name: "deliver_master_enrichment",
  description: "Returns improvement suggestions for a master asset brief.",
  input_schema: {
    type: "object",
    properties: {
      completeness_score: { type: "integer", minimum: 0, maximum: 100 },
      overall_assessment: { type: "string" },
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: {
              type: "string",
              enum: [
                "label",
                "hero_message",
                "supporting_message",
                "cta_label",
                "imagery_direction",
                "composition",
                "voice",
              ],
            },
            current_value: { type: "string" },
            issue: { type: "string" },
            suggested_value: { type: "string" },
            rationale: { type: "string" },
          },
          required: ["field", "current_value", "issue", "suggested_value", "rationale"],
          additionalProperties: false,
        },
      },
      missing_questions: {
        type: "array",
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
    const { master_asset_id } = await req.json();
    if (!master_asset_id) {
      return new Response(JSON.stringify({ error: "master_asset_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ma } = await supabase
      .from("campaign_master_assets")
      .select("*, campaign:campaigns(name, objective, target_audience, key_message)")
      .eq("id", master_asset_id)
      .maybeSingle();
    if (!ma) {
      return new Response(JSON.stringify({ error: "master_asset not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: enabled } = await supabase.rpc("is_ai_agent_enabled_for_client", {
      _agent_key: "master_asset_brief_enrichment",
      _client_id: ma.client_id,
    });
    if (enabled === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Agent master_asset_brief_enrichment disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: client } = await supabase
      .from("clients")
      .select("name, company_name, vertical, sub_niche, market")
      .eq("id", ma.client_id)
      .maybeSingle();

    const langInstr =
      client?.market === "IT"
        ? "Rispondi sempre in italiano professionale."
        : "Responde siempre en español profesional.";

    const bk = ma.brand_kit || {};
    const vl = ma.visual_layout || {};
    const block = `
Master Asset actual:
- Label: ${ma.label || "(vacío)"}
- Hero message: ${vl.hero_message || "(vacío)"}
- Supporting message: ${vl.supporting_message || "(vacío)"}
- CTA: ${vl.cta_label || "(vacío)"}
- Composition: ${vl.composition || "(vacío)"}
- Imagery: ${vl.imagery_direction || "(vacío)"}
- Voice/Tone: ${bk?.typography?.voice || "(vacío)"}
- Formats: ${(vl.formats || []).join(", ") || "(vacío)"}

Campaña: ${ma.campaign?.name || ""}
Objetivo: ${ma.campaign?.objective || ""}
Audiencia: ${ma.campaign?.target_audience || ""}
Mensaje clave: ${ma.campaign?.key_message || ""}
`.trim();

    const systemPrompt = `Eres un Art Director senior que revisa Master Assets antes de derivarlos en touchpoints.
${langInstr}
Detecta campos vagos o incoherentes con la campaña y propone reemplazos CONCRETOS y específicos.
Reglas:
- Si un campo ya está sólido, no lo incluyas.
- completeness_score: 0-30 si faltan claves, 30-60 genéricos, 60-85 decentes, 85-100 excelentes.
- Devuelve siempre vía la function call.`;

    const userPrompt = `# CLIENTE
${client?.company_name || client?.name} · ${client?.vertical}/${client?.sub_niche}

# MASTER ASSET
${block}

Analiza y propone mejoras.`;

    const ai = await callAIWithTool({
      system: systemPrompt,
      prompt: userPrompt,
      tool: TOOL,
      max_tokens: 3000,
      model: "google/gemini-2.5-pro",
    });

    const out = ai.content.find((b: any) => b.type === "tool_use");
    if (!out || out.type !== "tool_use") {
      return new Response(JSON.stringify({ error: "AI did not return structured output" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, ...out.input, master_asset_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("enrich-master-asset-brief error:", err);
    const status = err?.status === 402 || err?.status === 429 ? err.status : 500;
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
