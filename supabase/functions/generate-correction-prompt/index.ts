import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { asset_id } = await req.json();
    if (!asset_id) throw new Error("asset_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { callAI } = await import("../_shared/ai.ts");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch asset with client info
    const { data: asset, error: assetErr } = await supabase
      .from("assets")
      .select("*, clients(name, company_name, vertical, sub_niche, market, prospect_id)")
      .eq("id", asset_id)
      .single();
    if (assetErr || !asset) throw new Error("Asset not found");

    const client = asset.clients;

    // Fetch section comments
    const { data: sectionComments } = await supabase
      .from("asset_section_comments")
      .select("section_name, comment_text")
      .eq("asset_id", asset_id)
      .order("created_at");

    // Fetch original kickoff prompt if available
    let originalPrompt = "";
    const { data: kickoff } = await supabase
      .from("kickoff_briefs")
      .select("generated_prompts")
      .eq("client_id", asset.client_id)
      .maybeSingle();
    if (kickoff?.generated_prompts?.raw_text) {
      originalPrompt = kickoff.generated_prompts.raw_text;
    }

    // Fetch recommended flow from proposal if prospect linked
    let recommendedFlow = "";
    if (client?.prospect_id) {
      const { data: proposal } = await supabase
        .from("proposals")
        .select("recommended_flow")
        .eq("prospect_id", client.prospect_id)
        .maybeSingle();
      if (proposal?.recommended_flow) recommendedFlow = proposal.recommended_flow;
    }

    // Build the prompt
    const assetTypeLabel: Record<string, string> = {
      landing_page: "Landing Page",
      email_flow: "Email Flow",
      social_post: "Social Post",
      blog_article: "Blog Article",
    };

    const sectionFeedback = (sectionComments || [])
      .map((c: any) => `Section "${c.section_name}": "${c.comment_text}"`)
      .join("\n");

    const generalFeedback = asset.client_comment ? `General feedback: "${asset.client_comment}"` : "";

    const assetContent = asset.content ? JSON.stringify(asset.content, null, 2) : "No structured content available";

    const userPrompt = `You are a marketing asset correction specialist for PRAGMA, a marketing automation agency.

A client has reviewed their ${assetTypeLabel[asset.asset_type] || asset.asset_type} and requested specific changes. Generate a precise correction prompt that a content creator can use to fix the asset correctly.

ORIGINAL ASSET CONTEXT:
Vertical: ${client?.vertical || "Unknown"}
Sub-niche: ${client?.sub_niche || "Unknown"}
Market: ${client?.market || "Unknown"}
${recommendedFlow ? `Flow: ${recommendedFlow}` : ""}

${originalPrompt ? `ORIGINAL PROMPT USED TO CREATE THIS ASSET:\n${originalPrompt.substring(0, 3000)}\n` : ""}

CURRENT ASSET CONTENT:
${assetContent.substring(0, 4000)}

CLIENT FEEDBACK:
${sectionFeedback}
${generalFeedback}

Generate a correction prompt that:
1. Keeps everything the client approved (sections with no comments = approved)
2. Fixes ONLY what the client flagged
3. Is specific enough that the content creator knows exactly what to change
4. References the original brand context (colors, tone, vertical) so the corrected version stays consistent

Return a single correction prompt ready to paste into the asset generation tool.
Do not include explanations — just the prompt.`;

    const result = await callAI({ prompt: userPrompt, max_tokens: 2000, model: "google/gemini-2.5-flash" });
    const correctionPrompt = result.content?.[0]?.type === "text" ? (result.content[0] as any).text : "";

    // Save to asset
    await supabase
      .from("assets")
      .update({ correction_prompt: correctionPrompt })
      .eq("id", asset_id);

    // Log activity
    await supabase.from("activity_log").insert({
      entity_type: "asset",
      entity_id: asset_id,
      entity_name: client?.name || "Unknown",
      action: `correction prompt ready for ${asset.asset_name}`,
    });

    return new Response(JSON.stringify({ correction_prompt: correctionPrompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-correction-prompt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
