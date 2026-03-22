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

    const [clientRes, kickoffRes] = await Promise.all([
      supabase.from("clients").select("name, company_name, vertical, sub_niche").eq("id", client_id).single(),
      supabase.from("kickoff_briefs").select("*").eq("client_id", client_id).maybeSingle(),
    ]);

    const client = clientRes.data;
    const kickoff = kickoffRes.data;
    if (!kickoff?.transcript_text) {
      return new Response(JSON.stringify({ error: "No transcript found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const prompt = `Analyze this kickoff call transcript for a PRAGMA marketing client.
Client: ${client?.name} (${client?.company_name}) — ${client?.vertical} / ${client?.sub_niche}

TRANSCRIPT:
${kickoff.transcript_text.slice(0, 10000)}

Return ONLY valid JSON:
{
  "voice_reference": "Paragraph describing how this client speaks — vocabulary, tone, phrases they repeat, formal/informal. Use direct quotes.",
  "preferred_tone": "One sentence: the tone for all their communications",
  "suggested_client_rules": [
    "Specific rule for Claude (e.g. 'Always use tuteo, never usted')",
    "Another rule"
  ],
  "key_insights": ["Business insight 1", "Business insight 2"]
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
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text = data.content?.find((b: any) => b.type === "text")?.text || "{}";
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const result = JSON.parse(cleaned);

    await supabase.from("kickoff_briefs").update({
      voice_reference: result.voice_reference || null,
      preferred_tone: result.preferred_tone || null,
    }).eq("id", kickoff.id);

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-kickoff-transcript error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
