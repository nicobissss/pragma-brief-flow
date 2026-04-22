import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id, asset_type, source_label, source_content, performance_metric } = await req.json();
    if (!client_id) throw new Error("client_id is required");
    if (!source_content || typeof source_content !== "string" || source_content.trim().length < 30) {
      throw new Error("source_content required (min 30 chars)");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: client } = await supabase
      .from("clients")
      .select("name, vertical, sub_niche")
      .eq("id", client_id)
      .single();
    if (!client) throw new Error("Client not found");

    const systemPrompt = `Eres un analista de copywriting para PRAGMA. Analiza un asset que YA FUNCIONÓ para "${client.name}" (${client.vertical}/${client.sub_niche}) y extrae patrones replicables.

${asset_type ? `Tipo de asset: ${asset_type}` : ""}
${performance_metric ? `Métrica de éxito: ${performance_metric}` : ""}

Devuelve SOLO JSON válido:

{
  "hook_pattern": "estructura del hook/apertura que usó",
  "tone": "descripción del tono (ej: cercano, autoritario, urgente)",
  "structure": ["paso 1 de la estructura", "paso 2", "paso 3"],
  "winning_phrases": ["frase clave 1", "frase 2"],
  "cta_style": "cómo cierra y llama a la acción",
  "replicable_formula": "fórmula en 1-2 líneas para replicar este patrón en futuros assets",
  "avoid": ["qué NO hacer al replicar"]
}

Sé específico y accionable. Frases textuales cuando puedas.`;

    const aiData = await callAI({
      system: systemPrompt,
      prompt: `Asset performante:\n\n${source_content.slice(0, 8000)}`,
      max_tokens: 1500,
      model: "google/gemini-2.5-pro",
    });
    const text = aiData.content?.find((b: any) => b.type === "text")?.text || "";
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { replicable_formula: text };
    }

    const { data: row, error: insErr } = await supabase
      .from("client_winning_patterns")
      .insert({
        client_id,
        asset_type: asset_type || null,
        source_label: source_label || null,
        source_content: source_content.slice(0, 4000),
        performance_metric: performance_metric || null,
        extracted_patterns: parsed,
      })
      .select()
      .single();

    if (insErr) throw insErr;

    // Activity log + admin notification (non-blocking)
    try {
      await supabase.from("activity_log").insert({
        entity_type: "client",
        entity_id: client_id,
        entity_name: client.name,
        action: `discovery: patrones ganadores extraídos${asset_type ? ` (${asset_type})` : ""}`,
      });
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "discovery-analysis-ready",
          idempotencyKey: `discovery-patterns-${row.id}`,
          templateData: {
            clientName: client.name,
            analysisType: "winning_patterns",
            summary: parsed?.replicable_formula || "Patrones extraídos",
            adminUrl: `${Deno.env.get("APP_URL") || "https://pragma-brief-flow.lovable.app"}/admin/clients`,
          },
        },
      });
    } catch (e) {
      console.error("activity_log/email error:", e);
    }

    return new Response(
      JSON.stringify({ success: true, pattern_id: row.id, patterns: parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("analyze-winning-patterns error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
