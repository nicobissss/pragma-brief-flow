import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAIWithTool } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Extend an existing critique:
 * - mode = "more": generate N additional recommendations not already covered.
 * - mode = "deep_dive": rewrite ONE recommendation with concrete examples,
 *   ready-to-paste copy, numbers, sub-steps.
 *
 * Body: { report_id, mode: "more"|"deep_dive", recommendation_index?: number, count?: number }
 * Mutates report.recommendations in place (appends or replaces).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { report_id, mode, recommendation_index, count } = body;
    if (!report_id || (mode !== "more" && mode !== "deep_dive")) {
      return new Response(
        JSON.stringify({ error: "report_id and mode (more|deep_dive) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: report } = await supabase
      .from("proposal_critique_reports")
      .select("*")
      .eq("id", report_id)
      .maybeSingle();
    if (!report) {
      return new Response(JSON.stringify({ error: "report not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recs = (report.recommendations as any[]) || [];
    const existingSummary = recs
      .map((r, i) => `${i + 1}. [${r.priority}] ${r.section} → ${r.change}`)
      .join("\n")
      .slice(0, 3500);

    const validTargets = report.scope === "prospect"
      ? `"proposal.timeline", "proposal.pragma_notes", "proposal.recommended_flow", "proposal.recommended_tools", "proposal.pricing", "proposal.full_proposal_content.<section>"`
      : `"offering.custom_name", "offering.custom_price_eur", "offering.notes", "offering.custom_deliverables", "task.add", "task.update.<task_index>"`;

    let systemPrompt = "";
    let userPrompt = "";
    let toolName = "";
    let toolSchema: any = {};

    if (mode === "more") {
      const n = Math.max(2, Math.min(10, Number(count) || 5));
      systemPrompt = `Eres un Strategist Senior. Genera ${n} recomendaciones ejecutables NUEVAS (que NO repitan ni se solapen con las ya existentes). Cada una concreta, accionable, con target_field cuando se pueda aplicar automáticamente.

Valores válidos para target_field: ${validTargets}.
new_value: valor concreto listo para reemplazar.`;

      userPrompt = `# Contexto de la crítica original (scope=${report.scope})
Resumen: ${report.summary || "(sin resumen)"}
Score global: ${report.overall_score}/100
Debilidades: ${JSON.stringify(report.weaknesses).slice(0, 1500)}
Faltantes: ${JSON.stringify(report.missing_elements).slice(0, 800)}

# Recomendaciones YA dadas (NO repetir)
${existingSummary || "(ninguna)"}

# Tarea
Genera ${n} recomendaciones ADICIONALES distintas a las anteriores. Profundiza en aspectos no cubiertos.`;

      toolName = "submit_more_recommendations";
      toolSchema = {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                section: { type: "string" },
                change: { type: "string" },
                how: { type: "string" },
                priority: { type: "string", enum: ["low", "medium", "high"] },
                target_field: { type: "string" },
                new_value: {},
              },
              required: ["section", "change", "how", "priority"],
            },
          },
        },
        required: ["recommendations"],
      };
    } else {
      const idx = Number(recommendation_index);
      const original = recs[idx];
      if (!original) {
        return new Response(JSON.stringify({ error: "recommendation not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      systemPrompt = `Eres un Strategist Senior. Reescribe UNA recomendación dándole MUCHO más detalle: pasos concretos, copy listo para copiar y pegar, números, ejemplos. Mantén el mismo target_field si era aplicable.

Valores válidos para target_field: ${validTargets}.`;

      userPrompt = `# Recomendación a profundizar
Sección: ${original.section}
Cambio: ${original.change}
Cómo (versión actual): ${original.how}
Prioridad: ${original.priority}
target_field actual: ${original.target_field || "(ninguno)"}
new_value actual: ${JSON.stringify(original.new_value || "").slice(0, 600)}

# Contexto crítica
Resumen: ${report.summary || "(sin resumen)"}
Debilidades relacionadas: ${JSON.stringify(report.weaknesses).slice(0, 1200)}

# Tarea
Devuelve la MISMA recomendación pero con "how" expandido (ejemplos concretos, copy, números, sub-pasos enumerados) y un new_value listo para aplicar si target_field tiene sentido.`;

      toolName = "submit_deep_dive";
      toolSchema = {
        type: "object",
        properties: {
          section: { type: "string" },
          change: { type: "string" },
          how: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          target_field: { type: "string" },
          new_value: {},
        },
        required: ["section", "change", "how", "priority"],
      };
    }

    const aiResp = await callAIWithTool({
      system: systemPrompt,
      prompt: userPrompt,
      model: "google/gemini-3-flash-preview",
      max_tokens: 4096,
      tool: {
        name: toolName,
        description: "Submit result.",
        input_schema: toolSchema,
      },
    });

    const block = aiResp.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      throw new Error("AI did not return tool_use");
    }
    const result = block.input;

    let updatedRecs: any[];
    if (mode === "more") {
      const newOnes = (result.recommendations || []).map((r: any) => ({
        ...r,
        added_by: "extend",
        added_at: new Date().toISOString(),
      }));
      updatedRecs = [...recs, ...newOnes];
    } else {
      const idx = Number(recommendation_index);
      updatedRecs = [...recs];
      updatedRecs[idx] = {
        ...updatedRecs[idx],
        ...result,
        deep_dived_at: new Date().toISOString(),
        // reset applied flag since the value changed
        applied: false,
        applied_at: null,
      };
    }

    const { error: upErr } = await supabase
      .from("proposal_critique_reports")
      .update({ recommendations: updatedRecs })
      .eq("id", report_id);
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({ ok: true, mode, recommendations: updatedRecs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    const msg = e?.message || String(e);
    const isPayment = msg.includes("402") || msg.toLowerCase().includes("payment");
    const isRate = msg.includes("429");
    return new Response(JSON.stringify({ error: msg }), {
      status: isPayment ? 402 : isRate ? 429 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
