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
    const { asset_id } = await req.json();
    if (!asset_id) {
      return new Response(JSON.stringify({ error: "asset_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Check master + agent toggle
    const { data: enabledData } = await supabase.rpc("is_ai_agent_enabled", {
      _agent_key: "qa_asset_review",
    });
    if (!enabledData) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "agent_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    const systemPrompt = `Eres un revisor de QA de marketing crítico pero constructivo. Evalúas si un asset está listo para enviar al cliente.
Devuelve scores 0-100, warnings concretos y recomendaciones accionables.
Sé estricto pero justo: un score bajo debe estar justificado por evidencia específica.`;

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
Evalúa el asset y devuelve scores + warnings. Si una regla del cliente está violada, márcala explícitamente en rules_violated.`;

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
              items: { type: "string" },
              description: "Acciones concretas para mejorar el asset.",
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

    return new Response(
      JSON.stringify({ success: true, blocked, report }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("qa-asset-review error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
