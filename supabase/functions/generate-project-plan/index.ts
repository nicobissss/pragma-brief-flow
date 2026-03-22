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

    const [clientRes, flowsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", client_id).single(),
      supabase.from("pragma_flows").select("*").eq("is_active", true),
    ]);

    const client = clientRes.data;
    if (!client) throw new Error("Client not found");

    const flows = flowsRes.data || [];
    const assignedFlow = flows.find((f: any) => {
      const niches = Array.isArray(f.applicable_sub_niches) ? f.applicable_sub_niches : [];
      return niches.includes(client.sub_niche);
    }) || flows[0];

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const activatedTools = Array.isArray(client.activated_tools) ? client.activated_tools : [];

    const prompt = `Generate a simple project plan for PRAGMA client ${client.name}.
Vertical: ${client.vertical} / ${client.sub_niche}
Activated tools: ${activatedTools.join(", ") || "Not yet defined"}
Flow: ${assignedFlow?.name || "Standard"} (~${assignedFlow?.estimated_total_days || 30} days)

Return ONLY valid JSON:
{
  "assets": [{"name": "...", "type": "landing|email_sequence|social_post|blog_article", "description": "One sentence in Spanish", "estimated_days": 5, "order": 1}],
  "summary": "One paragraph in Spanish for the client explaining the plan simply"
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.find((b: any) => b.type === "text")?.text || "{}";
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const plan = JSON.parse(cleaned);

    await supabase.from("clients").update({ project_plan: plan }).eq("id", client_id);

    return new Response(JSON.stringify({ ok: true, plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-project-plan error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
