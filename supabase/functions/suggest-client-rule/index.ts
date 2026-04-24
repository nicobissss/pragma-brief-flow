import { callAI } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { feedback_text } = await req.json();
    if (!feedback_text) throw new Error("feedback_text is required");

    const data = await callAI({
      max_tokens: 80,
      model: "google/gemini-2.5-flash",
      prompt: `Based on this client feedback: "${feedback_text}"\n\nSuggest ONE specific rule for the AI (max 15 words). Just the rule, nothing else.`,
    });

    const textBlock = data.content?.find((b) => b.type === "text");
    const suggestedRule = (textBlock && textBlock.type === "text" ? textBlock.text : "")?.trim() || "";

    return new Response(JSON.stringify({ suggested_rule: suggestedRule }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-client-rule error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
