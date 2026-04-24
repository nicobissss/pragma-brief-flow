import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  STRICT_RULES,
  fetchActiveOfferings,
  formatOfferingsForPrompt,
  getRecommendedOfferings,
} from "../_shared/strict-rules.ts";
import { callAIWithTool } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchKnowledgeBase(supabaseAdmin: any): Promise<string> {
  const { data: kbRows } = await supabaseAdmin
    .from("knowledge_base")
    .select("category, content")
    .order("category");

  const titles: Record<string, string> = {
    flows_processes: "Procesos y catálogo",
    pitch_guidelines: "Guía de pitch",
    pricing: "Pricing interno",
    suite_tools: "Suite tools",
  };

  let kbText = "";
  if (kbRows) {
    for (const row of kbRows) {
      if (row.content?.trim()) {
        kbText += `\n### ${titles[row.category] || row.category}\n${row.content}\n`;
      }
    }
  }
  if (!kbText) return "";
  return `\n--- BASE DE CONOCIMIENTO PRAGMA ---\n${kbText}\n--- FIN BASE DE CONOCIMIENTO ---\n`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prospect_id, extra_instructions } = await req.json();
    if (!prospect_id) throw new Error("prospect_id is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [prospectRes, knowledgeBase, offerings] = await Promise.all([
      supabaseAdmin.from("prospects").select("*").eq("id", prospect_id).single(),
      fetchKnowledgeBase(supabaseAdmin),
      fetchActiveOfferings(supabaseAdmin),
    ]);

    const { data: prospect, error: pErr } = prospectRes;
    if (pErr || !prospect) throw new Error("Prospect not found");

    const market = prospect.market;
    const outputLanguage = market === "it" ? "italiano" : "español";
    const recommendedCodes = getRecommendedOfferings(prospect.sub_niche);
    const catalogBlock = formatOfferingsForPrompt(offerings);

    const systemPrompt = `${knowledgeBase}${catalogBlock}

Eres el motor interno de propuestas de PRAGMA, agencia de marketing automation para tres verticales: Salud & Estética, E-Learning y Deporte Offline en España, Italia y Argentina.

${STRICT_RULES}

CATÁLOGO ACTIVO:
Solo puedes recomendar ofertas presentes en la sección "CATÁLOGO ACTIVO" arriba. Cada oferta tiene un código (TIER1_*, TIER2_*, TIER3_*).
Para esta sub-niche "${prospect.sub_niche}" las ofertas mejor encajadas son: ${recommendedCodes.join(", ") || "TIER1_RECUPERACION"}.

IDIOMA DE OUTPUT: TODO el contenido textual va en ${outputLanguage} (mercado ${market.toUpperCase()}).

ESTRUCTURA DE OUTPUT:
Genera DOS bloques en el mismo objeto:

1. **summary** (versión snella para la UI del admin)
   - recommended_offering_code: el código exacto del catálogo
   - recommended_offering_name: nombre comercial (no el código)
   - top_reasons: array de 3 razones cortas, una frase cada una
   - price_pitch_script: 3-4 frases conversacionales para presentar el precio en la call (referencia ticket medio del prospect, sin desglose de horas)
   - qualifying_questions: array de 3 preguntas concretas para la call
   - red_flags: array de 2-3 señales de mala fit específicas para este prospect

2. **full** (versión extendida descargable para preparar la call)
   - opening_line: 1 frase de apertura referenciando algo CONCRETO del briefing
   - customer_journey: array de pasos del journey del cliente final del prospect.
       Cada paso: {step_number, channel, what_happens, example, goal}
       Cubre todos los touchpoints incluidos en los deliverables de la oferta recomendada.
   - conversation_guide: 5-7 preguntas para la call, específicas a vertical/sub-niche/ticket
   - objections: array de {objection, response} con las 3 objeciones más probables
   - copy_sparks: { headlines: [3 ejemplos para landing], email_subjects: [3 asuntos: curiosidad/beneficio/urgencia], whatsapp: "1 mensaje breve" }

NUNCA incluyas en el output:
- Horas de setup o mensuales
- Margen ni desglose por concepto
- Códigos internos en partes visibles al cliente (usa nombre comercial)

Debes responder usando la herramienta provista.`;

    const userPrompt = `Genera la propuesta para este prospect:

Nombre: ${prospect.name}
Empresa: ${prospect.company_name}
Mercado: ${market}
Vertical: ${prospect.vertical}
Sub-niche: ${prospect.sub_niche}

Respuestas del briefing:
${JSON.stringify(prospect.briefing_answers || {}, null, 2)}

${extra_instructions ? `\n\n# INSTRUCCIONES ADICIONALES (CRÍTICAS DE IA A INCORPORAR)\n${extra_instructions}\n` : ""}`;

    const toolDef = {
      name: "create_proposal",
      description: "Crea propuesta Tier-based con bloque snello (summary) y completo (full)",
      input_schema: {
        type: "object",
        properties: {
          summary: {
            type: "object",
            properties: {
              recommended_offering_code: { type: "string" },
              recommended_offering_name: { type: "string" },
              top_reasons: { type: "array", items: { type: "string" } },
              price_pitch_script: { type: "string" },
              qualifying_questions: { type: "array", items: { type: "string" } },
              red_flags: { type: "array", items: { type: "string" } },
            },
            required: ["recommended_offering_code", "recommended_offering_name", "top_reasons", "price_pitch_script", "qualifying_questions", "red_flags"],
          },
          full: {
            type: "object",
            properties: {
              opening_line: { type: "string" },
              customer_journey: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    step_number: { type: "number" },
                    channel: { type: "string" },
                    what_happens: { type: "string" },
                    example: { type: "string" },
                    goal: { type: "string" },
                  },
                  required: ["step_number", "channel", "what_happens", "example", "goal"],
                },
              },
              conversation_guide: { type: "array", items: { type: "string" } },
              objections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    objection: { type: "string" },
                    response: { type: "string" },
                  },
                  required: ["objection", "response"],
                },
              },
              copy_sparks: {
                type: "object",
                properties: {
                  headlines: { type: "array", items: { type: "string" } },
                  email_subjects: { type: "array", items: { type: "string" } },
                  whatsapp: { type: "string" },
                },
                required: ["headlines", "email_subjects", "whatsapp"],
              },
            },
            required: ["opening_line", "customer_journey", "conversation_guide", "objections", "copy_sparks"],
          },
        },
        required: ["summary", "full"],
      },
    };

    const callWithRetry = (model: string) => callAIWithTool({
      system: systemPrompt,
      prompt: userPrompt,
      tool: toolDef,
      max_tokens: 4096,
      model,
    });

    let aiData;
    try {
      try {
        aiData = await callWithRetry("google/gemini-2.5-pro");
      } catch (e: any) {
        if (e.code === "NO_TOOL_CALL") {
          console.warn("Retrying with gemini-2.5-flash after NO_TOOL_CALL");
          aiData = await callWithRetry("google/gemini-2.5-flash");
        } else {
          throw e;
        }
      }
    } catch (e: any) {
      if (e.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (e.status === 402) {
        return new Response(JSON.stringify({ error: "Sin créditos en Lovable AI. Recarga el workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (e.code === "NO_TOOL_CALL") {
        return new Response(JSON.stringify({
          error: "El modelo no devolvió una propuesta estructurada (posible sobrecarga). Reintenta en unos segundos.",
          code: "NO_TOOL_CALL",
          finish_reason: e.finishReason,
        }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw e;
    }

    const toolUseBlock = aiData.content?.find((b) => b.type === "tool_use");
    if (!toolUseBlock || toolUseBlock.type !== "tool_use") throw new Error("No tool_use block in AI response");

    const proposal = toolUseBlock.input;
    const summary = proposal.summary || {};
    const full = proposal.full || {};

    // Save to proposals table — store both blocks
    // recommended_flow = nombre comercial (retro-compat con UI legacy)
    // recommended_offering_code = código técnico (TIER1_*)
    const { error: saveErr } = await supabaseAdmin.from("proposals").upsert({
      prospect_id,
      recommended_flow: summary.recommended_offering_name || null,
      recommended_offering_code: summary.recommended_offering_code || null,
      recommended_tools: [],
      pricing: { offering_code: summary.recommended_offering_code, language: outputLanguage },
      full_proposal_content: { summary, full },
    } as any, { onConflict: "prospect_id" });

    if (saveErr) throw saveErr;

    // Auto-trigger Proposal Critique agent (fire-and-forget; respects toggle).
    try {
      const SUPABASE_URL_INTERNAL = Deno.env.get("SUPABASE_URL")!;
      fetch(`${SUPABASE_URL_INTERNAL}/functions/v1/proposal-critique`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ prospect_id, triggered_by: "auto" }),
      }).catch((err) => console.error("proposal-critique trigger failed:", err));
    } catch (err) {
      console.error("proposal-critique invoke error:", err);
    }

    return new Response(JSON.stringify({ success: true, proposal: { summary, full } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-proposal error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
