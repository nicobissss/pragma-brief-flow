import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { STRICT_RULES, getFlowForSubNiche } from "../_shared/strict-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id, campaign_name } = await req.json();
    if (!client_id || !campaign_name) throw new Error("client_id and campaign_name required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch client with prospect
    const { data: client } = await supabase
      .from("clients")
      .select("*, prospects(*)")
      .eq("id", client_id)
      .single();
    if (!client) throw new Error("Client not found");

    const prospect = client.prospects;
    const briefingAnswers = prospect?.briefing_answers || {};

    // Fetch proposal
    let recommendedFlow = "";
    let recommendedTools: string[] = [];
    if (prospect?.id) {
      const { data: proposal } = await supabase
        .from("proposals")
        .select("recommended_flow, recommended_tools, full_proposal_content")
        .eq("prospect_id", prospect.id)
        .maybeSingle();
      if (proposal) {
        recommendedFlow = proposal.recommended_flow || "";
        recommendedTools = (proposal.recommended_tools as string[]) || [];
      }
    }

    // Fetch transcript
    let transcriptSummary = "";
    const { data: kickoff } = await supabase
      .from("kickoff_briefs")
      .select("transcript_text")
      .eq("client_id", client_id)
      .maybeSingle();
    if (kickoff?.transcript_text) {
      transcriptSummary = kickoff.transcript_text.substring(0, 500);
    }

    const briefingSummary = Object.entries(briefingAnswers)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("\n")
      .substring(0, 800);

    const assignedFlow = getFlowForSubNiche(client.vertical, client.sub_niche);

    const userPrompt = `You are a marketing strategist for PRAGMA.

${STRICT_RULES}

The assigned flow for this client based on their vertical "${client.vertical}" and sub-niche "${client.sub_niche}" is: "${assignedFlow}". Generate a campaign brief ONLY aligned with this flow. Never suggest strategies from other flows (e.g. never suggest a webinar for a Salud client, never suggest local ads for an E-Learning client).

Based on this client's context, generate a campaign brief for the campaign named "${campaign_name}".

CLIENT CONTEXT:
Vertical: ${client.vertical}
Sub-niche: ${client.sub_niche}
Market: ${client.market}
Assigned Flow: ${assignedFlow}
${recommendedFlow ? `Recommended flow from proposal: ${recommendedFlow}` : ""}
${recommendedTools.length > 0 ? `Activated tools: ${recommendedTools.join(", ")}` : ""}
${briefingSummary ? `Briefing summary:\n${briefingSummary}` : ""}
${transcriptSummary ? `Kickoff transcript summary:\n${transcriptSummary}` : ""}

Generate:
- objective: one clear sentence aligned with the assigned flow
- target_audience: specific description based on their vertical and sub-niche
- key_message: the core value proposition for this specific campaign
- timeline: suggested duration based on the assigned flow type

Return ONLY a JSON object:
{
  "objective": "",
  "target_audience": "",
  "key_message": "",
  "timeline": ""
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");

    const brief = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(brief), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-campaign-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
