import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { STRICT_RULES, fetchActiveOfferings, formatOfferingsForPrompt, getRecommendedOfferings } from "../_shared/strict-rules.ts";
import { callAI } from "../_shared/ai.ts";

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

    // Fetch proposal — usa nombre comercial (recommended_flow)
    let recommendedOfferingName = "";
    if (prospect?.id) {
      const { data: proposal } = await supabase
        .from("proposals")
        .select("recommended_flow, full_proposal_content")
        .eq("prospect_id", prospect.id)
        .maybeSingle();
      if (proposal?.recommended_flow) {
        const raw = proposal.recommended_flow;
        recommendedOfferingName = typeof raw === "string" ? raw : "";
      }
    }

    // Tools activados desde client_platforms (single source of truth)
    const { data: platforms } = await supabase
      .from("client_platforms")
      .select("supported_platforms(name)")
      .eq("client_id", client_id)
      .eq("has_access", true);
    const recommendedTools: string[] = (platforms || [])
      .map((p: any) => p.supported_platforms?.name)
      .filter(Boolean);

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
${recommendedOfferingName ? `Oferta recomendada en propuesta: ${recommendedOfferingName}` : ""}
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

    let result;
    try {
      result = await callAI({
        prompt: userPrompt,
        max_tokens: 800,
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
      });
    } catch (e: any) {
      if (e.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (e.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    const text = result.content?.find((b: any) => b.type === "text")?.text || "";

    // Robust JSON extraction
    const extractJson = (raw: string): any => {
      let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const start = cleaned.search(/[\{\[]/);
      const isArr = start !== -1 && cleaned[start] === "[";
      const end = cleaned.lastIndexOf(isArr ? "]" : "}");
      if (start === -1 || end === -1) throw new Error("No JSON found in AI response");
      cleaned = cleaned.substring(start, end + 1);
      try { return JSON.parse(cleaned); } catch {
        cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, "");
        return JSON.parse(cleaned);
      }
    };

    let brief;
    try {
      brief = extractJson(text);
    } catch (parseErr) {
      console.error("generate-campaign-brief parse error. Raw text:", text.slice(0, 500));
      throw new Error("AI response was not valid JSON");
    }

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
