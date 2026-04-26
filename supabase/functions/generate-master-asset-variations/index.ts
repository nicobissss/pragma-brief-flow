// generate-master-asset-variations
// Genera N varianti (per formato/canale) a partire da un Master Asset approvato.
// Le varianti sono salvate come nuovi record campaign_master_assets con
// is_primary=false e label="<MasterLabel> — <format>".
//
// Input: { master_asset_id, formats: string[] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithTool } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  name: "deliver_variation",
  description: "Returns a single derived variation of a master asset for a target format.",
  input_schema: {
    type: "object",
    properties: {
      hero_message: { type: "string" },
      supporting_message: { type: "string" },
      cta_label: { type: "string" },
      composition: { type: "string", description: "Composition adapted to target format." },
      imagery_direction: { type: "string" },
      format_specific_notes: { type: "string", description: "How this variation respects format constraints." },
    },
    required: ["hero_message", "cta_label", "composition", "imagery_direction", "format_specific_notes"],
    additionalProperties: false,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { master_asset_id, formats } = await req.json();
    if (!master_asset_id || !Array.isArray(formats) || formats.length === 0) {
      return new Response(JSON.stringify({ error: "master_asset_id and formats[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: master } = await supabase
      .from("campaign_master_assets")
      .select("*")
      .eq("id", master_asset_id)
      .maybeSingle();
    if (!master) {
      return new Response(JSON.stringify({ error: "master not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: enabled } = await supabase.rpc("is_ai_agent_enabled_for_client", {
      _agent_key: "master_asset_variations",
      _client_id: master.client_id,
    });
    if (enabled === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Agent master_asset_variations disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const created: any[] = [];
    for (const fmt of formats) {
      const systemPrompt = `Eres Art Director. Adapta el Master Asset al formato "${fmt}" sin perder coherencia.
Reglas:
- Mantén paleta y voz del master.
- Ajusta composición, longitud y CTA al canal.
- Devuelve vía function call.`;
      const vl = master.visual_layout || {};
      const userPrompt = `# MASTER
Hero: ${vl.hero_message || ""}
Supporting: ${vl.supporting_message || ""}
CTA: ${vl.cta_label || ""}
Composition: ${vl.composition || ""}
Imagery: ${vl.imagery_direction || ""}

# FORMATO TARGET
${fmt}

Adapta este master al formato.`;

      try {
        const ai = await callAIWithTool({
          system: systemPrompt,
          prompt: userPrompt,
          tool: TOOL,
          max_tokens: 1500,
          model: "google/gemini-2.5-flash",
        });
        const block = ai.content.find((b: any) => b.type === "tool_use");
        if (!block || block.type !== "tool_use") continue;
        const v = block.input as any;

        const { data: inserted } = await supabase
          .from("campaign_master_assets")
          .insert({
            campaign_id: master.campaign_id,
            client_id: master.client_id,
            label: `${master.label} — ${fmt}`,
            brand_kit: master.brand_kit,
            visual_layout: {
              ...master.visual_layout,
              hero_message: v.hero_message,
              supporting_message: v.supporting_message,
              cta_label: v.cta_label,
              composition: v.composition,
              imagery_direction: v.imagery_direction,
              formats: [fmt],
              format_specific_notes: v.format_specific_notes,
            },
            is_primary: false,
            status: "draft",
            version: 1,
            context_used: { derived_from: master.id, format: fmt },
          })
          .select()
          .maybeSingle();
        if (inserted) created.push(inserted);
      } catch (e) {
        console.error("variation failed for", fmt, e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, created_count: created.length, variations: created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("generate-master-asset-variations error:", err);
    const status = err?.status === 402 || err?.status === 429 ? err.status : 500;
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
