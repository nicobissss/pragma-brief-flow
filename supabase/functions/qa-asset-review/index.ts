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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { asset_id, force } = await req.json();
    if (!asset_id) {
      return new Response(JSON.stringify({ error: "asset_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve client_id first to allow per-client check
    const { data: assetForCheck } = await supabase
      .from("assets")
      .select("client_id")
      .eq("id", asset_id)
      .maybeSingle();
    const clientIdForCheck = assetForCheck?.client_id ?? null;

    // Check master + agent toggle (with per-client override). Skip when force=true.
    if (!force) {
      const { data: enabledData } = await supabase.rpc(
        "is_ai_agent_enabled_for_client",
        { _agent_key: "qa_asset_review", _client_id: clientIdForCheck }
      );
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
      .eq("agent_key", "qa_asset_review")
      .maybeSingle();
    const config = (agentSettings?.config as any) || {};
    const blockThreshold: number = config.block_threshold ?? 60;
    const model: string = config.model || "google/gemini-2.5-flash";

    // Load asset + client context
    const { data: asset, error: assetErr } = await supabase
      .from("assets")
      .select(
        "id, client_id, asset_type, asset_name, asset_title, content, version, status, campaign_id"
      )
      .eq("id", asset_id)
      .maybeSingle();
    if (assetErr || !asset) {
      return new Response(JSON.stringify({ error: "asset not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if status not in allowed list
    const skipIfNot: string[] = config.skip_if_status_not || ["pending_review"];
    if (skipIfNot.length && !skipIfNot.includes(asset.status as string)) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "status_not_eligible" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [{ data: client }, { data: kickoff }, { data: campaign }] =
      await Promise.all([
        supabase
          .from("clients")
          .select("name, vertical, sub_niche, market")
          .eq("id", asset.client_id)
          .maybeSingle(),
        supabase
          .from("kickoff_briefs")
          .select("voice_reference, preferred_tone, client_rules")
          .eq("client_id", asset.client_id)
          .maybeSingle(),
        asset.campaign_id
          ? supabase
              .from("campaigns")
              .select("objective, target_audience, key_message, name")
              .eq("id", asset.campaign_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    const clientRules = (kickoff?.client_rules as any[]) || [];

    const systemPrompt = `Eres un revisor senior de marketing que prepara instrucciones de re-generación para otro modelo IA.
Tu objetivo NO es solo dar un score: es entregar un brief de correcciones tan claro que un copy/diseñador (o IA) pueda aplicar los cambios sin dudar.

Reglas de salida:
- Para cada problema relevante, añade una entrada en "recommendations" con: section (qué parte del asset), change (qué cambiar) y how (cómo hacerlo, idealmente con texto ejemplo o longitud/CTA concretos).
- Las recomendaciones deben ser ejecutables tal cual: nada de "mejorar el tono" sin decir hacia qué tono ni dando un ejemplo.
- Si una regla del cliente está violada, márcala en rules_violated con evidencia textual.
- "summary" = 1-2 frases con el veredicto. Las indicaciones detalladas viven en "recommendations".
- Sé crítico pero justo: justifica los scores bajos con evidencia.`;

    const userPrompt = `# Cliente
${client?.name} — ${client?.vertical} / ${client?.sub_niche} (${client?.market})

# Voice & Tone esperado
Voice reference: ${kickoff?.voice_reference || "no definido"}
Preferred tone: ${kickoff?.preferred_tone || "no definido"}

# Reglas del cliente (DEBEN cumplirse)
${clientRules.length > 0 ? clientRules.map((r: any, i: number) => `${i + 1}. ${typeof r === "string" ? r : r.rule || r.text || JSON.stringify(r)}`).join("\n") : "Ninguna regla específica registrada."}

# Brief de campaña
${
  campaign
    ? `Campaña: ${campaign.name}
Objetivo: ${campaign.objective}
Audiencia: ${campaign.target_audience}
Key message: ${campaign.key_message}`
    : "Sin brief de campaña asociado."
}

# Asset a revisar
Tipo: ${asset.asset_type}
Nombre: ${asset.asset_name}
Título: ${asset.asset_title || "-"}
Versión: ${asset.version}

Contenido:
${JSON.stringify(asset.content, null, 2).slice(0, 6000)}

# Tu tarea
Evalúa el asset y devuelve, además de los scores, un set de recomendaciones lo bastante precisas para servir como prompt de re-generación. Apunta a 3-7 recomendaciones priorizadas (las más impactantes primero). Si todo está bien, devuelve un array vacío y un summary positivo.`;

    const aiResp = await callAIWithTool({
      system: systemPrompt,
      prompt: userPrompt,
      model,
      max_tokens: 2048,
      tool: {
        name: "submit_qa_report",
        description: "Submit the QA evaluation of the asset.",
        input_schema: {
          type: "object",
          properties: {
            overall_score: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description: "Score global 0-100. <60 bloquea el envío al cliente.",
            },
            brand_score: { type: "integer", minimum: 0, maximum: 100 },
            rules_score: { type: "integer", minimum: 0, maximum: 100 },
            brief_alignment_score: {
              type: "integer",
              minimum: 0,
              maximum: 100,
            },
            predicted_approval_score: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description:
                "Probabilidad estimada (0-100) de que el cliente apruebe sin pedir cambios.",
            },
            warnings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  severity: { type: "string", enum: ["low", "medium", "high"] },
                  category: {
                    type: "string",
                    enum: [
                      "brand",
                      "rules",
                      "brief",
                      "copy",
                      "format",
                      "claim",
                      "other",
                    ],
                  },
                  message: { type: "string" },
                },
                required: ["severity", "category", "message"],
              },
            },
            rules_violated: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  rule: { type: "string" },
                  evidence: { type: "string" },
                },
                required: ["rule", "evidence"],
              },
            },
            recommendations: {
              type: "array",
              description: "Instrucciones precisas de re-generación, priorizadas (las más impactantes primero).",
              items: {
                type: "object",
                properties: {
                  section: { type: "string", description: "Parte concreta del asset (ej: 'Hero', 'CTA', 'Email 2 - subject', 'Bullet 3')." },
                  change: { type: "string", description: "Qué cambiar (1 frase)." },
                  how: { type: "string", description: "Cómo hacerlo: instrucción ejecutable, idealmente con ejemplo de texto, longitud o tono concreto." },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["section", "change", "how", "priority"],
              },
            },
            summary: {
              type: "string",
              description: "1-2 frases con el veredicto general.",
            },
          },
          required: [
            "overall_score",
            "brand_score",
            "rules_score",
            "brief_alignment_score",
            "predicted_approval_score",
            "warnings",
            "rules_violated",
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
    const blocked = result.overall_score < blockThreshold;

    // Rough cost estimate (gemini-2.5-flash ≈ €0.0005 per call)
    const costEstimate = model.includes("pro") ? 0.005 : 0.0008;

    const { data: report, error: reportErr } = await supabase
      .from("asset_qa_reports")
      .insert({
        asset_id: asset.id,
        client_id: asset.client_id,
        version: asset.version,
        overall_score: result.overall_score,
        brand_score: result.brand_score,
        rules_score: result.rules_score,
        brief_alignment_score: result.brief_alignment_score,
        predicted_approval_score: result.predicted_approval_score,
        warnings: result.warnings || [],
        rules_violated: result.rules_violated || [],
        recommendations: result.recommendations || [],
        summary: result.summary || "",
        blocked,
        model_used: model,
        cost_estimate_eur: costEstimate,
      })
      .select()
      .single();

    if (reportErr) {
      console.error("Insert qa report failed:", reportErr);
      throw reportErr;
    }

    // Update agent stats
    await supabase
      .from("ai_agent_settings")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: "success",
        last_cost_estimate_eur: costEstimate,
      })
      .eq("agent_key", "qa_asset_review");

    // Optionally block the asset (move out of pending_review)
    if (blocked) {
      await supabase
        .from("assets")
        .update({ production_status: "qa_blocked" })
        .eq("id", asset.id);
    }

    await recordAgentRun(supabase, "qa_asset_review", "success", 0);
    return new Response(
      JSON.stringify({ success: true, blocked, report }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = (e as Error).message || "Unknown error";
    console.error("qa-asset-review error:", e);
    try {
      const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
      await recordAgentRun(sb, "qa_asset_review", "error", 0);
    } catch {}

    // Detect AI gateway billing/rate-limit errors and return 200 with structured payload
    // so the frontend can display a friendly message instead of crashing on a 500.
    let errorCode: string | null = null;
    if (msg.includes("402") || msg.toLowerCase().includes("credit") || msg.toLowerCase().includes("payment")) {
      errorCode = "PAYMENT_REQUIRED";
    } else if (msg.includes("429") || msg.toLowerCase().includes("rate")) {
      errorCode = "RATE_LIMITED";
    }

    if (errorCode) {
      // Mark agent stats as failed
      try {
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
        await supabase
          .from("ai_agent_settings")
          .update({
            last_run_at: new Date().toISOString(),
            last_run_status: errorCode === "PAYMENT_REQUIRED" ? "no_credits" : "rate_limited",
          })
          .eq("agent_key", "qa_asset_review");
      } catch {}

      return new Response(
        JSON.stringify({ skipped: true, error: errorCode, message: msg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
