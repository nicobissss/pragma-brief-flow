import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { STRICT_RULES, fetchActiveOfferings, formatOfferingsForPrompt, getRecommendedOfferings } from "../_shared/strict-rules.ts";

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
        const rawFlow = proposal.recommended_flow;
        recommendedFlow = typeof rawFlow === "string" ? rawFlow : JSON.stringify(rawFlow || "");
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

    const offerings = await fetchActiveOfferings(supabase);
    const catalogBlock = formatOfferingsForPrompt(offerings);
    const recommendedCodes = getRecommendedOfferings(client.sub_niche);
    const outputLanguage = client.market === "it" ? "italiano" : "español";

    const userPrompt = `Eres estratega de marketing en PRAGMA.

${STRICT_RULES}

${catalogBlock}

Las ofertas mejor adaptadas a la sub-niche "${client.sub_niche}" son: ${recommendedCodes.join(", ") || "TIER1_RECUPERACION"}.
Genera el brief de campaña SOLO alineado con una de estas ofertas. Nunca propongas estrategias fuera del catálogo (no webinars para Salud, no ads locales para E-Learning, etc.).

IDIOMA DE OUTPUT: ${outputLanguage} (mercado ${client.market.toUpperCase()}).

Contexto del cliente:
Vertical: ${client.vertical}
Sub-niche: ${client.sub_niche}
Mercado: ${client.market}
${recommendedFlow ? `Oferta recomendada en propuesta: ${recommendedFlow}` : ""}
${recommendedTools.length > 0 ? `Tools activados: ${recommendedTools.join(", ")}` : ""}
${briefingSummary ? `Resumen briefing:\n${briefingSummary}` : ""}
${transcriptSummary ? `Resumen kickoff:\n${transcriptSummary}` : ""}

Genera para la campaña "${campaign_name}":
- objective: una frase clara alineada con la oferta
- target_audience: descripción específica para vertical y sub-niche
- key_message: propuesta de valor central
- timeline: duración sugerida según el tipo de oferta

Devuelve SOLO un objeto JSON:
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
