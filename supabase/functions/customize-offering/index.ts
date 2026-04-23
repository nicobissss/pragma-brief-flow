// Customize an offering proposal using AI based on admin instructions.
// Returns updated suggestion: { name, deliverables, notes, value_proposition }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { offering_template_id, current_overrides, instructions, client_id } = await req.json();
    if (!offering_template_id || !instructions) {
      return new Response(JSON.stringify({ error: "offering_template_id and instructions are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tpl } = await supabase
      .from("offering_templates")
      .select("*")
      .eq("id", offering_template_id)
      .maybeSingle();

    if (!tpl) {
      return new Response(JSON.stringify({ error: "Offering template not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let clientContext = "";
    if (client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("company_name, vertical, sub_niche, market")
        .eq("id", client_id)
        .maybeSingle();
      if (client) {
        clientContext = `\nCLIENTE: ${client.company_name} — ${client.vertical} / ${client.sub_niche} (${client.market})`;
      }
    }

    const baseDeliverables = current_overrides?.deliverables ?? tpl.deliverables;
    const baseName = current_overrides?.name ?? tpl.name;
    const baseNotes = current_overrides?.notes ?? "";

    const system = `Eres un experto en marketing automation de Pragma. Personalizas ofertas para clientes específicos siguiendo instrucciones del admin.
${clientContext}

OFERTA BASE: ${tpl.name} (Tier ${tpl.tier} — ${tpl.category})
Propuesta de valor: ${tpl.value_proposition || "—"}
Descripción: ${tpl.description || "—"}

ESTADO ACTUAL (a modificar según instrucciones):
- Nombre: ${baseName}
- Notas: ${baseNotes || "—"}
- Deliverables: ${JSON.stringify(baseDeliverables, null, 2)}

REGLAS:
- Mantén el formato JSON de los deliverables (objetos con name/type/count/description o strings)
- Tipos de deliverable válidos: email, landing_page, social_post, blog_article, sms, ads, bundle
- No inventes nuevos tiers o categorías
- Output ONLY in JSON via the customize_offering tool. No prose.`;

    const userPrompt = `Instrucciones del admin:\n"${instructions}"\n\nDevuelve la oferta modificada respetando las reglas.`;

    const ai = await callAI({
      system,
      prompt: userPrompt,
      max_tokens: 2048,
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
    });

    let parsed: any = null;
    const textBlock = ai.content.find((b: any) => b.type === "text") as any;
    if (textBlock?.text) {
      try {
        parsed = JSON.parse(textBlock.text);
      } catch {
        const match = textBlock.text.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      }
    }

    if (!parsed) {
      return new Response(JSON.stringify({ error: "AI did not return valid JSON", raw: textBlock?.text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      suggestion: {
        name: parsed.name || baseName,
        deliverables: parsed.deliverables || baseDeliverables,
        notes: parsed.notes ?? baseNotes,
        value_proposition: parsed.value_proposition || tpl.value_proposition,
        rationale: parsed.rationale || null,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("customize-offering error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
