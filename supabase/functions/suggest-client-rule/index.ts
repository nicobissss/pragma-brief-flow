import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { feedback_text } = await req.json();
    if (!feedback_text) throw new Error("feedback_text is required");

    const { callAI } = await import("../_shared/ai.ts");

    const data = await callAI({
      max_tokens: 80,
      messages: [{
          role: "user",
          content: `Based on this client feedback: "${feedback_text}"\n\nSuggest ONE specific rule for Claude (max 15 words). Just the rule, nothing else.`,
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude error: ${response.status}`);
    }

    const data = await response.json();
    const suggestedRule = data.content?.find((b: any) => b.type === "text")?.text?.trim() || "";

    return new Response(JSON.stringify({ suggested_rule: suggestedRule }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-client-rule error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
