// generate-master-asset
// Genera (o rigenera) un Master Asset di campagna: brand_kit + visual_layout
// strutturati a partire dal contesto cliente completo.
// Input: { campaign_id, master_asset_id?, source_image_url?, instructions? }
// Output: salva in campaign_master_assets (status="draft") e ritorna il record.

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
  name: "deliver_master_asset",
  description: "Returns a structured master asset (brand_kit + visual_layout).",
  input_schema: {
    type: "object",
    properties: {
      label: { type: "string", description: "Short human label, e.g. 'Master Hero IG'." },
      brand_kit: {
        type: "object",
        properties: {
          colors: {
            type: "array",
            description: "Hex colors used (primary, secondary, accent, neutrals).",
            items: {
              type: "object",
              properties: {
                role: { type: "string" },
                hex: { type: "string" },
              },
              required: ["role", "hex"],
              additionalProperties: false,
            },
          },
          typography: {
            type: "object",
            properties: {
              heading_font: { type: "string" },
              body_font: { type: "string" },
              voice: { type: "string", description: "Tone/voice rules." },
            },
            required: ["heading_font", "body_font", "voice"],
            additionalProperties: false,
          },
          logo_usage: { type: "string" },
          do_and_dont: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["colors", "typography", "logo_usage", "do_and_dont"],
        additionalProperties: false,
      },
      visual_layout: {
        type: "object",
        description: "Visual blueprint that all touchpoints will derive from.",
        properties: {
          composition: { type: "string", description: "How elements are arranged." },
          hero_message: { type: "string", description: "Main headline / value prop." },
          supporting_message: { type: "string" },
          cta_label: { type: "string" },
          imagery_direction: { type: "string", description: "Style of imagery / photography." },
          formats: {
            type: "array",
            description: "Touchpoint formats this master is designed to derive into.",
            items: { type: "string" },
          },
        },
        required: ["composition", "hero_message", "cta_label", "imagery_direction", "formats"],
        additionalProperties: false,
      },
      rationale: { type: "string", description: "Why this master fits the client + offering." },
    },
    required: ["label", "brand_kit", "visual_layout", "rationale"],
    additionalProperties: false,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id, master_asset_id, source_image_url, instructions } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, client_id, name, objective, target_audience, key_message, client_offering_id")
      .eq("id", campaign_id)
      .maybeSingle();

    if (!campaign) {
      return new Response(JSON.stringify({ error: "campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Agent gating
    const { data: enabled } = await supabase.rpc("is_ai_agent_enabled_for_client", {
      _agent_key: "master_asset_generator",
      _client_id: campaign.client_id,
    });
    if (enabled === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Agent master_asset_generator disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ctx = await buildClientContext(supabase, {
      client_id: campaign.client_id,
      campaign_id: campaign.id,
      client_offering_id: campaign.client_offering_id,
    });

    const langInstr =
      ctx.client?.market === "IT"
        ? "Rispondi sempre in italiano professionale."
        : "Responde siempre en español profesional.";

    const offering = ctx.target_offering?.offering_template;
    const offeringBlock = offering
      ? `Oferta: ${ctx.target_offering?.custom_name || offering.name} — ${offering.description || ""}`
      : "Oferta: (no vinculada)";

    const materials = ctx.client_materials || {};
    const materialsBlock = Object.keys(materials).length
      ? Object.entries(materials)
          .slice(0, 10)
          .map(([k, v]: any) => `- ${k}: ${typeof v === "string" ? v.slice(0, 200) : JSON.stringify(v).slice(0, 200)}`)
          .join("\n")
      : "(no materials uploaded)";

    const patterns = (ctx.winning_patterns || [])
      .slice(0, 5)
      .map((p: any) => `- ${p.source_label}: ${JSON.stringify(p.extracted_patterns).slice(0, 200)}`)
      .join("\n") || "(no winning patterns yet)";

    const sourceImageBlock = source_image_url
      ? `\n\nIMAGEN MASTER PROPORCIONADA POR EL CLIENTE: ${source_image_url}\n(Considera esta imagen como brújula visual: extrae paleta, tipografía implícita, composición.)`
      : "";

    const instructionsBlock = instructions ? `\n\nINSTRUCCIONES ESPECÍFICAS DEL ADMIN:\n${instructions}` : "";

    const systemPrompt = `Eres un Art Director senior. Diseñas el "Master Asset" de una campaña: la pieza madre de la que se derivarán todos los touchpoints (email, social, LP, ads...).
${langInstr}
Reglas:
- El Master debe ser COHERENTE con la marca del cliente (paleta, voz, materiales).
- Debe encajar con la oferta vinculada y su objetivo.
- visual_layout.formats debe listar los canales/formatos para los que este master sirve de base.
- Devuelve SIEMPRE vía la function call.`;

    const userPrompt = `# CLIENTE
${ctx.client?.company_name || ctx.client?.name} · ${ctx.client?.vertical}/${ctx.client?.sub_niche} · ${ctx.client?.market}
Tono: ${ctx.preferred_tone || "(no definido)"}
Voz: ${(ctx.voice_reference || "").slice(0, 500) || "(no definida)"}

# OFERTA / CAMPAÑA
${offeringBlock}
Campaña: ${campaign.name}
Objetivo: ${campaign.objective || "(vacío)"}
Audiencia: ${campaign.target_audience || "(vacío)"}
Mensaje clave: ${campaign.key_message || "(vacío)"}

# MATERIALES DEL CLIENTE
${materialsBlock}

# PATRONES GANADORES
${patterns}
${sourceImageBlock}${instructionsBlock}

Diseña el Master Asset.`;

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
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const out = block.input as any;
    const contextUsed = {
      client_id: ctx.client?.id,
      offering_id: ctx.target_offering?.id || null,
      generated_at: new Date().toISOString(),
      model: "google/gemini-2.5-pro",
    };

    let saved;
    if (master_asset_id) {
      const { data: existing } = await supabase
        .from("campaign_master_assets")
        .select("version")
        .eq("id", master_asset_id)
        .maybeSingle();
      const newVersion = (existing?.version || 1) + 1;
      const { data, error } = await supabase
        .from("campaign_master_assets")
        .update({
          label: out.label,
          brand_kit: out.brand_kit,
          visual_layout: out.visual_layout,
          source_image_url: source_image_url || null,
          status: "draft",
          version: newVersion,
          context_used: contextUsed,
        })
        .eq("id", master_asset_id)
        .select()
        .maybeSingle();
      if (error) throw error;
      saved = data;
    } else {
      const { data: existingPrimary } = await supabase
        .from("campaign_master_assets")
        .select("id")
        .eq("campaign_id", campaign.id)
        .eq("is_primary", true)
        .maybeSingle();
      const { data, error } = await supabase
        .from("campaign_master_assets")
        .insert({
          campaign_id: campaign.id,
          client_id: campaign.client_id,
          label: out.label,
          brand_kit: out.brand_kit,
          visual_layout: out.visual_layout,
          source_image_url: source_image_url || null,
          is_primary: !existingPrimary,
          status: "draft",
          version: 1,
          context_used: contextUsed,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      saved = data;
    }

    await recordAgentRun(supabase, "master_asset_generator", "success", 0);
    return new Response(
      JSON.stringify({ ok: true, master_asset: saved, rationale: out.rationale }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("generate-master-asset error:", err);
    const status = err?.status === 402 || err?.status === 429 ? err.status : 500;
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await recordAgentRun(sb, "master_asset_generator", "error", 0);
    } catch {}
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
