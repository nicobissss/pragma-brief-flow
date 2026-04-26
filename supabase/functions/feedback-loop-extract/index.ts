// Feedback Loop Agent — when an asset is approved or change_requested,
// extracts replicable patterns from the asset content + client comment
// and upserts them into client_winning_patterns.
// Triggered by DB trigger on assets table OR manual call from admin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithTool } from "../_shared/ai.ts";
import { recordAgentRun } from "../_shared/telemetry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PATTERN_TOOL = {
  name: "deliver_feedback_patterns",
  description: "Extracts what works/doesn't work from a client feedback event on a marketing asset.",
  input_schema: {
    type: "object",
    properties: {
      verdict: {
        type: "string",
        enum: ["positive", "negative", "mixed"],
        description: "Positive=approved without major friction; negative=changes requested; mixed=approved with caveats.",
      },
      hook_pattern: { type: "string", description: "Opening / hook structure that worked or failed." },
      tone: { type: "string", description: "Tone description (cercano, autoritario, etc)." },
      structure: {
        type: "array",
        items: { type: "string" },
        description: "Step-by-step structure observed.",
      },
      winning_phrases: {
        type: "array",
        items: { type: "string" },
        description: "Specific phrases that worked (only for positive/mixed).",
      },
      losing_phrases: {
        type: "array",
        items: { type: "string" },
        description: "Specific phrases that triggered correction (only for negative/mixed).",
      },
      cta_style: { type: "string", description: "How CTAs are constructed." },
      replicable_formula: {
        type: "string",
        description: "1-2 line formula to replicate (or avoid) in future assets.",
      },
      avoid: {
        type: "array",
        items: { type: "string" },
        description: "What NOT to do based on this feedback.",
      },
      confidence: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "How confident the extraction is given the available signals.",
      },
    },
    required: ["verdict", "replicable_formula", "confidence"],
    additionalProperties: false,
  },
};

function assetContentToText(content: any, assetType: string): string {
  if (!content || typeof content !== "object") return String(content || "");
  // crude flatten — keep first 4000 chars worth
  try {
    return JSON.stringify(content).slice(0, 4000);
  } catch {
    return String(content).slice(0, 4000);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { asset_id, force = false } = body || {};
    if (!asset_id) {
      return new Response(JSON.stringify({ error: "asset_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: asset } = await supabase
      .from("assets")
      .select("id, client_id, asset_type, asset_name, status, content, client_comment, version")
      .eq("id", asset_id)
      .maybeSingle();
    if (!asset) {
      return new Response(JSON.stringify({ error: "asset not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["approved", "change_requested"].includes(asset.status)) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `status=${asset.status} not eligible` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!force) {
      const { data: enabled } = await supabase.rpc("is_ai_agent_enabled_for_client", {
        _agent_key: "feedback_loop_weekly",
        _client_id: asset.client_id,
      });
      if (enabled === false) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "Agent feedback_loop disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { data: client } = await supabase
      .from("clients")
      .select("name, vertical, sub_niche, market")
      .eq("id", asset.client_id)
      .maybeSingle();

    const langInstr =
      client?.market === "IT"
        ? "Rispondi sempre in italiano professionale."
        : "Responde siempre en español profesional.";

    const verdictHint = asset.status === "approved"
      ? "El cliente APROBÓ este asset. Extrae lo que funcionó."
      : "El cliente PIDIÓ CAMBIOS en este asset. Extrae qué falló y qué evitar.";

    const systemPrompt = `Eres un analista de copywriting de Pragma Marketers.
${langInstr}
Tu trabajo: a partir de un asset y el feedback del cliente, extraer patrones replicables (o anti-patrones a evitar) para futuros assets de este cliente.
${verdictHint}
Sé específico: cita frases textuales cuando sea posible. Evita generalidades vacías.
Devuelve siempre via la function call.`;

    const userPrompt = `# CLIENTE
Nombre: ${client?.name || "N/A"}
Vertical: ${client?.vertical} · Sub-niche: ${client?.sub_niche}

# ASSET (${asset.asset_type}, v${asset.version})
Nombre: ${asset.asset_name}
Estado final: ${asset.status}

## Contenido
${assetContentToText(asset.content, asset.asset_type)}

## Comentario del cliente
${asset.client_comment || "(sin comentario explícito)"}

Analiza y extrae los patrones.`;

    const ai = await callAIWithTool({
      system: systemPrompt,
      prompt: userPrompt,
      tool: PATTERN_TOOL,
      max_tokens: 2000,
      model: "google/gemini-2.5-pro",
    });

    const block = ai.content.find((b: any) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      return new Response(JSON.stringify({ error: "AI did not return structured output" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patterns = block.input;
    const performance = asset.status === "approved" ? "approved" : "change_requested";

    const { data: row, error: insErr } = await supabase
      .from("client_winning_patterns")
      .insert({
        client_id: asset.client_id,
        asset_type: asset.asset_type,
        source_label: `${asset.asset_name} v${asset.version} (${asset.status})`,
        source_content: assetContentToText(asset.content, asset.asset_type).slice(0, 4000),
        performance_metric: performance,
        extracted_patterns: { ...patterns, source_asset_id: asset.id, source_comment: asset.client_comment || null },
      })
      .select("id")
      .maybeSingle();

    if (insErr) throw insErr;

    try {
      await supabase.from("activity_log").insert({
        entity_type: "client",
        entity_id: asset.client_id,
        entity_name: client?.name || "Unknown",
        action: `feedback loop: patrones ${patterns.verdict} extraídos de "${asset.asset_name}"`,
      });
    } catch (_) { /* non-blocking */ }

    await recordAgentRun(supabase, "feedback_loop_weekly", "success", 0);
    return new Response(
      JSON.stringify({ ok: true, pattern_id: row?.id, patterns }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("feedback-loop-extract error:", err);
    const status = err?.status === 402 || err?.status === 429 ? err.status : 500;
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await recordAgentRun(sb, "feedback_loop_weekly", "error", 0);
    } catch {}
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
