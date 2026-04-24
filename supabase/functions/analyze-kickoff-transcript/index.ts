import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai.ts";

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

    const data = await callAI({
      prompt,
      max_tokens: 2000,
      model: "google/gemini-2.5-pro",
    });
    const textBlock = data.content?.find((b) => b.type === "text");
    const text = (textBlock && textBlock.type === "text" ? textBlock.text : "") || "{}";
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
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
