import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id, reviews_text } = await req.json();
    if (!client_id) throw new Error("client_id is required");
    if (!reviews_text || typeof reviews_text !== "string" || reviews_text.trim().length < 50) {
      throw new Error("reviews_text required (min 50 chars). Pega 5-10 reseñas reales del cliente.");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const { data: client } = await supabase
      .from("clients")
      .select("name, vertical, sub_niche, city")
      .eq("id", client_id)
      .single();
    if (!client) throw new Error("Client not found");

    const systemPrompt = `Eres un analista de Voice of Customer (VoC) para PRAGMA. Analizas reseñas reales de clientes de "${client.name}" (${client.vertical}/${client.sub_niche}${client.city ? `, ${client.city}` : ""}).

Extrae insights accionables para copywriting y posicionamiento. Devuelve SOLO JSON válido:

{
  "jtbd": ["Job to be done #1 (qué intenta lograr el cliente)", "JTBD #2"],
  "objections": ["Objeción real #1 con frase del cliente", "Objeción #2"],
  "real_phrases": ["frase textual usable en copy 1", "frase 2", "frase 3"],
  "trigger_events": ["evento que dispara la búsqueda 1", "evento 2"],
  "emotional_drivers": ["miedo/deseo/aspiración 1", "2"],
  "praise_themes": ["lo que más alaban (con frecuencia)"],
  "summary": "1 párrafo en español: cómo habla el cliente real, qué busca, qué teme"
}

REGLAS:
- Usa frases EXACTAS de las reseñas cuando puedas
- En español, salvo si las reseñas están en otro idioma
- Sé concreto, no genérico`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: `Reseñas reales:\n\n${reviews_text.slice(0, 12000)}` }],
      }),
    });

    if (!aiRes.ok) {
      const errTxt = await aiRes.text();
      throw new Error(`Claude error ${aiRes.status}: ${errTxt}`);
    }
    const aiData = await aiRes.json();
    const text = aiData.content?.find((b: any) => b.type === "text")?.text || "";
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { summary: text };
    }

    const tokens = (aiData.usage?.input_tokens || 0) + (aiData.usage?.output_tokens || 0);

    const { data: snapshot, error: snapErr } = await supabase
      .from("client_context_snapshots")
      .insert({
        client_id,
        snapshot_type: "voc",
        context_data: {
          ...parsed,
          source: "manual_paste",
          reviews_length: reviews_text.length,
          extracted_at: new Date().toISOString(),
        },
        tokens_used: tokens,
      })
      .select()
      .single();

    if (snapErr) throw snapErr;

    return new Response(
      JSON.stringify({ success: true, snapshot_id: snapshot.id, voc: parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("extract-voice-of-customer error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
