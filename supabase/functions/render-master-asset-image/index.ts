// render-master-asset-image
// Generates (or edits) a real PNG mockup of a Master Asset using
// Lovable AI Gateway's image model (Nano Banana 2).
// Input: { master_asset_id, edit_instructions?: string, regenerate?: boolean }
// - regenerate=true → ignore current preview, generate from scratch
// - edit_instructions + existing preview → image-edit on the current preview
// - source_image_url present + no preview → image-edit on the source
// - otherwise → text-to-image from the Strategic DNA

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-3.1-flash-image-preview";
const BUCKET = "client-assets";

function buildVisualPrompt(master: any, editInstructions?: string): string {
  const bk = master.brand_kit || {};
  const vl = master.visual_layout || {};
  const colors = Array.isArray(bk.colors)
    ? bk.colors.map((c: any) => `${c.role}: ${c.hex}`).join(", ")
    : "(default palette)";
  const typo = bk.typography || {};
  const formats = Array.isArray(vl.formats) ? vl.formats.join(", ") : "social/email";

  const base = `Design a high-fidelity marketing mockup (1:1, square format) for a master campaign asset.
BRAND PALETTE: ${colors}
TYPOGRAPHY: heading "${typo.heading_font || "modern sans"}", body "${typo.body_font || "clean sans"}".
TONE/VOICE: ${typo.voice || "professional, confident"}.
LOGO USAGE: ${bk.logo_usage || "(no specific rule)"}.

COMPOSITION: ${vl.composition || "balanced, modern, generous whitespace"}.
HERO MESSAGE (render as main headline): "${vl.hero_message || ""}"
SUPPORTING MESSAGE: "${vl.supporting_message || ""}"
CTA BUTTON LABEL: "${vl.cta_label || ""}"
IMAGERY DIRECTION: ${vl.imagery_direction || "clean editorial photography"}.
INTENDED FORMATS DERIVED FROM THIS MASTER: ${formats}.

REQUIREMENTS:
- Photorealistic mockup, looks like a real designed marketing piece, not a wireframe.
- Text must be legible and spelled exactly as provided.
- Respect the brand palette strictly (use exact hex values).
- Polished, agency-grade execution.`;

  if (editInstructions) {
    return `Edit the provided image according to these instructions while preserving brand consistency:\n\n${editInstructions}\n\nReference brief:\n${base}`;
  }
  return base;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { master_asset_id, edit_instructions, regenerate } = await req.json();
    if (!master_asset_id) {
      return new Response(JSON.stringify({ error: "master_asset_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: master, error: mErr } = await supabase
      .from("campaign_master_assets")
      .select("*")
      .eq("id", master_asset_id)
      .maybeSingle();
    if (mErr || !master) {
      return new Response(JSON.stringify({ error: "master not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gating
    const { data: enabled } = await supabase.rpc("is_ai_agent_enabled_for_client", {
      _agent_key: "master_asset_generator",
      _client_id: master.client_id,
    });
    if (enabled === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Agent master_asset_generator disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Decide source image (for edit mode)
    let baseImageUrl: string | null = null;
    if (!regenerate && master.visual_preview_url) baseImageUrl = master.visual_preview_url;
    else if (!regenerate && master.source_image_url) baseImageUrl = master.source_image_url;
    // If regenerate=true → text-to-image from scratch (ignore baseImageUrl)
    if (regenerate) baseImageUrl = null;

    const promptText = buildVisualPrompt(master, edit_instructions);

    const userContent: any = baseImageUrl
      ? [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: baseImageUrl } },
        ]
      : promptText;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: userContent }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      const status = aiResp.status === 402 || aiResp.status === 429 ? aiResp.status : 500;
      return new Response(
        JSON.stringify({
          error:
            aiResp.status === 429
              ? "Rate limit alcanzado, intenta más tarde."
              : aiResp.status === 402
              ? "Sin créditos en Lovable AI workspace."
              : "AI image generation failed",
        }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiResp.json();
    const dataUrl: string | undefined =
      aiJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      console.error("No image in AI response", JSON.stringify(aiJson).slice(0, 500));
      return new Response(JSON.stringify({ error: "AI did not return an image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode base64 → bytes
    const base64 = dataUrl.split(",")[1];
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const path = `master-assets/${master.client_id}/${master.id}/v${master.version}-${Date.now()}.png`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) {
      console.error("storage upload error", upErr);
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Signed URL (7 days) — bucket is private
    const { data: signed, error: sErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (sErr || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: sErr?.message || "signed url failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await supabase
      .from("campaign_master_assets")
      .update({ visual_preview_url: signed.signedUrl })
      .eq("id", master.id);
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, visual_preview_url: signed.signedUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("render-master-asset-image error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
