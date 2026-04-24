// Asset Variations Agent — given an approved asset, generates N alternative
// versions (different hook / CTA / tone) as new draft assets in the same campaign.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithTool } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VARIATION_AXES = [
  { id: "hook", label: "Hook diferente", instruction: "Cambia radicalmente el hook/apertura (ángulo emocional distinto)." },
  { id: "cta", label: "CTA más fuerte", instruction: "Mantén el cuerpo pero refuerza la CTA: más urgencia, más beneficio, más claridad." },
  { id: "tone", label: "Tono alternativo", instruction: "Cambia el tono (si era cercano, hazlo más autoritario; si era informativo, hazlo más narrativo)." },
];

function buildVariationTool(): any {
  return {
    name: "deliver_variation",
    description: "Returns a single variation of the original asset, preserving structure but changing the requested axis.",
    input_schema: {
      type: "object",
      properties: {
        variation_label: { type: "string", description: "Short label describing what changed (e.g. 'Hook curiosidad')." },
        variation_rationale: { type: "string", description: "Why this variation might outperform original (1-2 lines)." },
        content: {
          type: "object",
          description: "The full asset content in the SAME structure as the original. Do not change the schema, only the copy.",
          additionalProperties: true,
        },
      },
      required: ["variation_label", "variation_rationale", "content"],
      additionalProperties: false,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { asset_id, count = 3, force = false } = body || {};
    if (!asset_id) {
      return new Response(JSON.stringify({ error: "asset_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const n = Math.min(Math.max(Number(count) || 3, 1), 3);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: source } = await supabase
      .from("assets")
      .select("id, client_id, campaign_id, asset_type, asset_name, content, version, status")
      .eq("id", asset_id)
      .maybeSingle();
    if (!source) {
      return new Response(JSON.stringify({ error: "asset not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (source.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "Variations can only be generated from approved assets" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!force) {
      const { data: enabled } = await supabase.rpc("is_ai_agent_enabled_for_client", {
        _agent_key: "asset_variations",
        _client_id: source.client_id,
      });
      if (enabled === false) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "Agent asset_variations disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { data: client } = await supabase
      .from("clients")
      .select("name, vertical, sub_niche, market")
      .eq("id", source.client_id)
      .maybeSingle();

    const langInstr =
      client?.market === "IT"
        ? "Scrivi tutto in italiano professionale."
        : "Escribe todo en español profesional.";

    const axes = VARIATION_AXES.slice(0, n);
    const tool = buildVariationTool();
    const created: any[] = [];
    const errors: any[] = [];

    for (const axis of axes) {
      try {
        const systemPrompt = `Eres un copywriter senior de Pragma Marketers.
${langInstr}
Tu trabajo: generar UNA variación A/B del asset aprobado.
Regla clave: DEBES preservar EXACTAMENTE la misma estructura JSON del original. Solo cambia el copy según el eje pedido.
Eje de variación: ${axis.label}. ${axis.instruction}
Devuelve siempre via la function call.`;

        const userPrompt = `# CLIENTE
${client?.name} (${client?.vertical}/${client?.sub_niche})

# ASSET ORIGINAL APROBADO (${source.asset_type})
Nombre: ${source.asset_name}

## Contenido original (preserva esta estructura JSON, solo cambia el copy)
${JSON.stringify(source.content).slice(0, 6000)}

Genera la variación con el eje "${axis.label}".`;

        const ai = await callAIWithTool({
          system: systemPrompt,
          prompt: userPrompt,
          tool,
          max_tokens: 4000,
          model: "google/gemini-2.5-pro",
        });

        const block = ai.content.find((b: any) => b.type === "tool_use");
        if (!block || block.type !== "tool_use") {
          errors.push({ axis: axis.id, error: "no tool_call" });
          continue;
        }

        const variation = block.input;
        const newName = `${source.asset_name} — Variante ${axis.label}`;

        const { data: ins, error: insErr } = await supabase
          .from("assets")
          .insert({
            client_id: source.client_id,
            campaign_id: source.campaign_id,
            asset_type: source.asset_type,
            asset_name: newName,
            content: variation.content,
            version: 1,
            status: "pending_review",
            production_status: "ready",
            context_used: {
              variation_of: source.id,
              variation_axis: axis.id,
              variation_label: variation.variation_label,
              variation_rationale: variation.variation_rationale,
              generated_at: new Date().toISOString(),
            },
          })
          .select("id")
          .maybeSingle();

        if (insErr) {
          errors.push({ axis: axis.id, error: insErr.message });
        } else {
          created.push({
            asset_id: ins?.id,
            axis: axis.id,
            label: variation.variation_label,
            rationale: variation.variation_rationale,
          });
        }
      } catch (e: any) {
        errors.push({ axis: axis.id, error: String(e?.message || e) });
      }
    }

    if (created.length > 0) {
      try {
        await supabase.from("activity_log").insert({
          entity_type: "client",
          entity_id: source.client_id,
          entity_name: client?.name || "Unknown",
          action: `variantes generadas (${created.length}) de "${source.asset_name}"`,
        });
      } catch (_) { /* non-blocking */ }
    }

    return new Response(
      JSON.stringify({ ok: created.length > 0, created, errors, source_asset_id: source.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("generate-asset-variations error:", err);
    const status = err?.status === 402 || err?.status === 429 ? err.status : 500;
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
