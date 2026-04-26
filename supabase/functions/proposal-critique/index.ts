import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAIWithTool } from "../_shared/ai.ts";
import { recordAgentRun } from "../_shared/telemetry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Scope = "prospect" | "post_kickoff";

function compactJson(value: unknown, maxChars: number) {
  try {
    return JSON.stringify(value).slice(0, maxChars);
  } catch {
    return String(value ?? "").slice(0, maxChars);
  }
}

function compactText(value: unknown, maxChars: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      prospect_id,
      proposal_id,
      client_offering_id,
      scope: scopeRaw,
      force,
      triggered_by,
      triggered_by_user_id,
    } = body;
    const scope: Scope = scopeRaw === "post_kickoff" ? "post_kickoff" : "prospect";

    if (!prospect_id && !client_offering_id) {
      return new Response(
        JSON.stringify({ error: "prospect_id or client_offering_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve prospect_id from offering if not provided
    let resolvedProspectId: string | null = prospect_id || null;
    let clientId: string | null = null;
    let offeringRow: any = null;

    if (scope === "post_kickoff") {
      if (!client_offering_id) {
        return new Response(
          JSON.stringify({ error: "client_offering_id required for post_kickoff" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const { data: off } = await supabase
        .from("client_offerings")
        .select(
          "id, client_id, status, custom_name, custom_price_eur, custom_deliverables, notes, offering_template_id, offering_templates(name, description, deliverables, monthly_fee_eur, one_shot_fee_eur, value_proposition)"
        )
        .eq("id", client_offering_id)
        .maybeSingle();
      if (!off) {
        return new Response(JSON.stringify({ error: "offering not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      offeringRow = off;
      clientId = off.client_id;
      // Resolve prospect via clients table
      const { data: clientRow } = await supabase
        .from("clients")
        .select("prospect_id")
        .eq("id", off.client_id)
        .maybeSingle();
      resolvedProspectId = clientRow?.prospect_id || null;
    }

    // Agent toggle (allow per-client override when we know the client)
    if (!force) {
      let enabled: boolean | null = null;
      if (clientId) {
        const { data } = await supabase.rpc("is_ai_agent_enabled_for_client", {
          _agent_key: "proposal_critique",
          _client_id: clientId,
        });
        enabled = data;
      } else {
        const { data } = await supabase.rpc("is_ai_agent_enabled", {
          _agent_key: "proposal_critique",
        });
        enabled = data;
      }
      if (!enabled) {
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
    const model: string = config.model || "google/gemini-3-flash-preview";

    // Load prospect (optional in post_kickoff if missing)
    let prospect: any = null;
    if (resolvedProspectId) {
      const { data } = await supabase
        .from("prospects")
        .select(
          "id, name, company_name, vertical, sub_niche, market, briefing_answers"
        )
        .eq("id", resolvedProspectId)
        .maybeSingle();
      prospect = data;
    }

    // Load proposal (only required for prospect scope)
    let proposalRow: any = null;
    if (proposal_id) {
      const { data } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", proposal_id)
        .maybeSingle();
      proposalRow = data;
    } else if (resolvedProspectId) {
      const { data } = await supabase
        .from("proposals")
        .select("*")
        .eq("prospect_id", resolvedProspectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      proposalRow = data;
    }

    if (scope === "prospect" && !proposalRow) {
      return new Response(JSON.stringify({ error: "proposal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load post-kickoff context
    let kickoff: any = null;
    let actionPlanTasks: any[] = [];
    if (scope === "post_kickoff" && clientId) {
      const [{ data: kb }, { data: tasks }] = await Promise.all([
        supabase
          .from("kickoff_briefs")
          .select(
            "transcript_text, structured_info, client_rules, voice_reference, preferred_tone, suggested_services, context_completeness_score"
          )
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("action_plan_tasks")
          .select(
            "title, description, category, assignee, estimated_hours, due_date, order_index, status"
          )
          .eq("client_offering_id", client_offering_id)
          .order("order_index", { ascending: true }),
      ]);
      kickoff = kb;
      actionPlanTasks = tasks || [];
    }

    // Compute next version (scoped)
    const versionQuery = supabase
      .from("proposal_critique_reports")
      .select("version")
      .eq("scope", scope)
      .order("version", { ascending: false })
      .limit(1);
    if (scope === "prospect") {
      versionQuery.eq("prospect_id", resolvedProspectId).eq("proposal_id", proposalRow.id);
    } else {
      versionQuery.eq("client_offering_id", client_offering_id);
    }
    const { data: lastReport } = await versionQuery.maybeSingle();
    const nextVersion = (lastReport?.version ?? 0) + 1;

    // Build prompts based on scope
    const briefingFmt = Object.entries(prospect?.briefing_answers || {})
      .map(([k, v]) => `- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("\n")
      .slice(0, 2500);

    let systemPrompt = "";
    let userPrompt = "";

    if (scope === "prospect") {
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

      systemPrompt = `Eres un Sales Strategist Senior especializado en agencias de marketing digital.
Tu trabajo es CRITICAR (no aprobar) la propuesta generada por IA antes de que llegue al cliente.
Sé exigente: una propuesta que va al cliente sin objeciones anticipadas pierde la venta.

Reglas de salida:
- Identifica 2-5 puntos fuertes reales (no genéricos).
- Identifica 3-7 debilidades concretas (claridad, persuasión, gaps, riesgo de objeción).
- Lista los elementos faltantes que deberían estar (caso de éxito, garantía, urgencia, social proof, ROI estimado, etc.).
- Recomendaciones EJECUTABLES: cada una con section, change, how (instrucción concreta con ejemplo), priority y target_field cuando aplique.
- target_field: el campo concreto a modificar si la recomendación se puede aplicar automáticamente. Valores válidos: "proposal.timeline", "proposal.pragma_notes", "proposal.recommended_flow", "proposal.recommended_tools", "proposal.pricing", "proposal.full_proposal_content.<section>". Si no aplica, omite el campo.
- new_value: cuando target_field está presente, propone el VALOR NUEVO concreto (string o número), listo para reemplazar el actual.
- Scores 0-100 honestos.
- summary: 1-2 frases con el veredicto.`;

      userPrompt = `# Prospect
${prospect?.name} — ${prospect?.company_name}
Vertical: ${prospect?.vertical} / ${prospect?.sub_niche}
Market: ${prospect?.market}

# Briefing del cliente
${briefingFmt || "(sin briefing)"}

# Propuesta a criticar
        ${compactJson(proposalContent, 4500)}

# Tarea
Critica esta propuesta como si fueras el responsable de cerrar la venta. ¿Convence? ¿Anticipa objeciones? ¿El pricing está bien justificado? ¿Falta algo crítico?`;
    } else {
      // post_kickoff
      const tplName =
        offeringRow?.offering_templates?.name || offeringRow?.custom_name || "(sin nombre)";
      const tplDesc = offeringRow?.offering_templates?.description || "";
      const tplDeliv = offeringRow?.custom_deliverables || offeringRow?.offering_templates?.deliverables;
      const price =
        offeringRow?.custom_price_eur ??
        offeringRow?.offering_templates?.monthly_fee_eur ??
        offeringRow?.offering_templates?.one_shot_fee_eur;

      const tasksFmt = actionPlanTasks
        .slice(0, 30)
        .map(
          (t, i) =>
            `${i + 1}. [${t.category || "?"}/${t.assignee || "?"}] ${t.title}${t.estimated_hours ? ` (${t.estimated_hours}h)` : ""}${t.due_date ? ` — due ${t.due_date}` : ""}`
        )
        .join("\n");

      const proposalSummary = proposalRow
        ? `Propuesta inicial: ${JSON.stringify(
            proposalRow.full_proposal_content || {
              flow: proposalRow.recommended_flow,
              pricing: proposalRow.pricing,
              timeline: proposalRow.timeline,
            },
          ).slice(0, 2200)}`
        : "(no hay propuesta original guardada)";

      const kickoffSummary = kickoff
        ? `Transcript (resumen): ${compactText(kickoff.transcript_text, 1400)}
 Reglas del cliente: ${compactJson(kickoff.client_rules || [], 700)}
Tono preferido: ${kickoff.preferred_tone || "(no definido)"}
 Voice reference: ${compactText(kickoff.voice_reference, 280)}
Context completeness: ${kickoff.context_completeness_score ?? "?"}/100
 Servicios sugeridos en kickoff: ${compactJson(kickoff.suggested_services || [], 500)}`
        : "(no hay kickoff registrado)";

      systemPrompt = `Eres un Account Strategist Senior. Después del kickoff con el cliente, tu trabajo es CRITICAR el offering activado y el plan de acción comparándolo con TODO el contexto real (propuesta inicial + kickoff + materiales + reglas).

Pregúntate:
1. ¿El offering activado coincide con lo que el cliente realmente pidió en kickoff? ¿O hay drift?
2. ¿El precio sigue justificado tras conocer el alcance real?
3. ¿Faltan deliverables que se prometieron en propuesta o kickoff?
4. ¿Sobran deliverables que no aportan valor según las reglas del cliente?
5. ¿El action plan es realista en horas y plazos?
6. ¿Los assignees son correctos?
7. ¿Hay riesgos de ejecución (dependencias, materiales faltantes, expectativas no alineadas)?

Reglas de salida:
- 2-5 puntos fuertes concretos.
- 3-7 debilidades específicas (no genéricas).
- Elementos faltantes (deliverable prometido y no incluido, regla del cliente ignorada, etc.).
- Recomendaciones EJECUTABLES con section, change, how, priority, y target_field cuando se pueda aplicar automáticamente. Valores válidos para target_field en post_kickoff:
  * "offering.custom_name"
  * "offering.custom_price_eur"
  * "offering.notes"
  * "offering.custom_deliverables"
  * "task.add" (con new_value = objeto {title, description, category, assignee, estimated_hours})
  * "task.update.<task_index>" (con new_value = campos a cambiar)
- new_value: valor concreto listo para aplicar.
- Scores 0-100 calibrados al contexto post-kickoff.
- summary: 1-2 frases con el veredicto (¿activarías este offering tal cual?).`;

      userPrompt = `# Cliente / Prospect
${prospect?.name || "?"} — ${prospect?.company_name || "?"}
Vertical: ${prospect?.vertical || "?"} / ${prospect?.sub_niche || "?"}
Market: ${prospect?.market || "?"}

# Briefing inicial
${briefingFmt || "(sin briefing)"}

# Propuesta original (pre-kickoff)
${proposalSummary}

# Offering ACTIVADO (a criticar)
Nombre: ${tplName}
Descripción template: ${tplDesc}
Precio: ${price ? `${price} EUR` : "(no definido)"}
 Deliverables: ${compactJson(tplDeliv, 1200)}
Notas custom: ${offeringRow?.notes || "(ninguna)"}
Status: ${offeringRow?.status}

# Kickoff (verdad de campo)
${kickoffSummary}

# Action Plan generado (${actionPlanTasks.length} tareas)
${tasksFmt || "(sin tareas)"}

# Tarea
Compara offering + action plan con propuesta original y kickoff. Detecta drift, gaps, sobre-promesas, riesgos de ejecución. Devuelve críticas ejecutables.`;
    }

    const aiResp = await callAIWithTool({
      system: systemPrompt,
      prompt: userPrompt,
      model,
      max_tokens: 4096,
      tool: {
        name: "submit_proposal_critique",
        description: "Submit the critique.",
        input_schema: {
          type: "object",
          properties: {
            overall_score: { type: "integer", minimum: 0, maximum: 100 },
            clarity_score: { type: "integer", minimum: 0, maximum: 100 },
            persuasion_score: { type: "integer", minimum: 0, maximum: 100 },
            pricing_score: { type: "integer", minimum: 0, maximum: 100 },
            objection_handling_score: { type: "integer", minimum: 0, maximum: 100 },
            brief_alignment_score: { type: "integer", minimum: 0, maximum: 100 },
            strengths: { type: "array", items: { type: "string" } },
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
            missing_elements: { type: "array", items: { type: "string" } },
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
        prospect_id: resolvedProspectId,
        proposal_id: proposalRow?.id || null,
        client_offering_id: scope === "post_kickoff" ? client_offering_id : null,
        scope,
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

    await recordAgentRun(supabase, "proposal_critique", "success", costEstimate);

    return new Response(JSON.stringify({ ok: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const isStructuredOutputFailure = e?.code === "NO_TOOL_CALL" || msg.includes("structured output");
    const isPayment = msg.includes("402") || msg.toLowerCase().includes("payment");
    const isRate = msg.includes("429") || msg.toLowerCase().includes("rate");
    try {
      const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
      await recordAgentRun(sb, "proposal_critique", "error", 0);
    } catch {}
    return new Response(JSON.stringify({ error: msg }), {
      status: isPayment ? 402 : isRate ? 429 : isStructuredOutputFailure ? 503 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
