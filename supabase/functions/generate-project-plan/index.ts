import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id } = await req.json();
    if (!client_id) throw new Error("client_id is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch client and its active offering (single source of truth — no more pragma_flows)
    const { data: client } = await supabase.from("clients").select("*").eq("id", client_id).single();
    if (!client) throw new Error("Client not found");

    const { data: offering } = await supabase
      .from("client_offerings")
      .select("*, offering_templates(name, short_name, description, deliverables)")
      .eq("client_id", client_id)
      .in("status", ["proposed", "accepted", "active"])
      .order("proposed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { callAI } = await import("../_shared/ai.ts");

    const offeringName = offering?.custom_name || offering?.offering_templates?.name || "Pack estándar";
    const deliverables = offering?.offering_templates?.deliverables || [];

    const prompt = `Generate a simple project plan for PRAGMA client ${client.name}.
Vertical: ${client.vertical} / ${client.sub_niche}
Oferta activa: ${offeringName}
Deliverables previstos: ${JSON.stringify(deliverables).slice(0, 500)}

Return ONLY valid JSON:
{
  "assets": [{"name": "...", "type": "landing|email_sequence|social_post|blog_article", "description": "One sentence in Spanish", "estimated_days": 5, "order": 1}],
  "summary": "One paragraph in Spanish for the client explaining the plan simply"
}`;

    const data = await callAI({ prompt, max_tokens: 1500 });
    const textBlock = data.content?.find((b) => b.type === "text");
    const text = (textBlock && textBlock.type === "text" ? textBlock.text : "") || "{}";
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const plan = JSON.parse(cleaned);

    await supabase.from("clients").update({ project_plan: plan }).eq("id", client_id);

    return new Response(JSON.stringify({ ok: true, plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-project-plan error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
