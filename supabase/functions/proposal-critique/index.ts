import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAIWithTool } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { prospect_id, proposal_id, force, triggered_by, triggered_by_user_id } = body;
    if (!prospect_id) {
      return new Response(JSON.stringify({ error: "prospect_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Check master + agent toggle (no per-client override here — proposal phase is pre-client).
    if (!force) {
      const { data: enabledData } = await supabase.rpc("is_ai_agent_enabled", {
        _agent_key: "proposal_critique",
      });
      if (!enabledData) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "agent_disabled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Load agent config
    const { data: agentSettings } = await supabase
      .from("ai_agent_settings")
      .select("config")
      .eq("agent_key", "proposal_critique")
      .maybeSingle();
    const config = (agentSettings?.config as any) || {};
    const model: string = config.model || "google/gemini-2.5-pro";

    // Load prospect
    const { data: prospect, error: pErr } = await supabase
      .from("prospects")
      .select(
        "id, name, company_name, vertical, sub_niche, market, briefing_answers"
      )
      .eq("id", prospect_id)
      .maybeSingle();
    if (pErr || !prospect) {
      return new Response(JSON.stringify({ error: "prospect not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load proposal: explicit ID or latest for prospect
    let proposalRow: any = null;
    if (proposal_id) {
      const { data } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", proposal_id)
        .maybeSingle();
      proposalRow = data;
    } else {
      const { data } = await supabase
        .from("proposals")
        .select("*")
        .eq("prospect_id", prospect_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      proposalRow = data;
    }
    if (!proposalRow) {
      return new Response(JSON.stringify({ error: "proposal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute next version
    const { data: lastReport } = await supabase
      .from("proposal_critique_reports")
      .select("version")
      .eq("prospect_id", prospect_id)
      .eq("proposal_id", proposalRow.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (lastReport?.version ?? 0) + 1;

    const proposalContent =
      proposalRow.full_proposal_content ||
      {
        recommended_offering_code: proposalRow.recommended_offering_code,
        recommended_flow: proposalRow.recommended_flow,
        recommended_tools: proposalRow.recommended_tools,
        pricing: proposalRow.pricing,
        timeline: proposalRow.timeline,
        pragma_notes: proposalRow.pragma_notes,
      };

    const briefingFmt = Object.entries(prospect.briefing_answers || {})
      .map(([k, v]) => `- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("\n")
      .slice(0, 4000);

    const systemPrompt = `Eres un Sales Strategist Senior especializado en agencias de marketing digital.
Tu trabajo es CRITICAR (no aprobar) la propuesta generada por IA antes de que llegue al cliente.
Sé exigente: una propuesta que va al cliente sin objeciones anticipadas pierde la venta.

Reglas de salida:
- Identifica 2-5 puntos fuertes reales (no genéricos).
- Identifica 3-7 debilidades concretas (claridad, persuasión, gaps, riesgo de objeción).
- Lista los elementos faltantes que deberían estar (caso de éxito, garantía, urgencia, social proof, ROI estimado, etc.).
- Recomendaciones EJECUTABLES: cada una con section (qué parte de la propuesta), change (qué cambiar), how (instrucción concreta con ejemplo de copy o número), priority.
- Scores 0-100 honestos y justificados por el contenido del summary.
- summary: 1-2 frases con el veredicto (¿enviarías esta propuesta como está?).`;

    const userPrompt = `# Prospect
${prospect.name} — ${prospect.company_name}
Vertical: ${prospect.vertical} / ${prospect.sub_niche}
Market: ${prospect.market}

# Briefing del cliente
${briefingFmt || "(sin briefing)"}

# Propuesta a criticar
${JSON.stringify(proposalContent, null, 2).slice(0, 8000)}

# Tarea
Critica esta propuesta como si fueras el responsable de cerrar la venta. ¿Convence? ¿Anticipa objeciones? ¿El pricing está bien justificado? ¿Falta algo crítico? Devuelve scores + brief de mejoras ejecutables.`;

    const aiResp = await callAIWithTool({
      system: systemPrompt,
      prompt: userPrompt,
      model,
      max_tokens: 2500,
      tool: {
        name: "submit_proposal_critique",
        description: "Submit the critique of the proposal.",
        input_schema: {
          type: "object",
          properties: {
            overall_score: { type: "integer", minimum: 0, maximum: 100 },
            clarity_score: { type: "integer", minimum: 0, maximum: 100 },
            persuasion_score: { type: "integer", minimum: 0, maximum: 100 },
            pricing_score: { type: "integer", minimum: 0, maximum: 100 },
            objection_handling_score: { type: "integer", minimum: 0, maximum: 100 },
            brief_alignment_score: { type: "integer", minimum: 0, maximum: 100 },
            strengths: {
              type: "array",
              items: { type: "string" },
              description: "Puntos fuertes concretos.",
            },
            weaknesses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  area: { type: "string" },
                  issue: { type: "string" },
                  severity: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["area", "issue", "severity"],
              },
            },
            missing_elements: {
              type: "array",
              items: { type: "string" },
              description: "Elementos críticos que faltan en la propuesta.",
            },
            recommendations: {
              type: "array",
              description: "Mejoras ejecutables priorizadas.",
              items: {
                type: "object",
                properties: {
                  section: { type: "string" },
                  change: { type: "string" },
                  how: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["section", "change", "how", "priority"],
              },
            },
            summary: { type: "string" },
          },
          required: [
            "overall_score",
            "clarity_score",
            "persuasion_score",
            "pricing_score",
            "objection_handling_score",
            "brief_alignment_score",
            "strengths",
            "weaknesses",
            "missing_elements",
            "recommendations",
            "summary",
          ],
        },
      },
    });

    const block = aiResp.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      throw new Error("No tool_use block in AI response");
    }
    const result = block.input;

    const costEstimate = model.includes("pro") ? 0.008 : 0.0012;

    const { data: report, error: insertErr } = await supabase
      .from("proposal_critique_reports")
      .insert({
        prospect_id,
        proposal_id: proposalRow.id,
        version: nextVersion,
        overall_score: result.overall_score,
        clarity_score: result.clarity_score,
        persuasion_score: result.persuasion_score,
        pricing_score: result.pricing_score,
        objection_handling_score: result.objection_handling_score,
        brief_alignment_score: result.brief_alignment_score,
        strengths: result.strengths || [],
        weaknesses: result.weaknesses || [],
        missing_elements: result.missing_elements || [],
        recommendations: result.recommendations || [],
        summary: result.summary || "",
        model_used: model,
        cost_estimate_eur: costEstimate,
        triggered_by: triggered_by || (force ? "manual" : "auto"),
        triggered_by_user_id: triggered_by_user_id || null,
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    // Update agent run stats
    await supabase
      .from("ai_agent_settings")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: "success",
        last_cost_estimate_eur: costEstimate,
        total_runs: (agentSettings as any)?.total_runs
          ? undefined
          : undefined, // increment via SQL if needed
      })
      .eq("agent_key", "proposal_critique");

    return new Response(JSON.stringify({ ok: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const isPayment = msg.includes("402") || msg.toLowerCase().includes("payment");
    const isRate = msg.includes("429") || msg.toLowerCase().includes("rate");
    return new Response(JSON.stringify({ error: msg }), {
      status: isPayment ? 402 : isRate ? 429 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
