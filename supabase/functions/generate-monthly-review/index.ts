import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString();

    const [assetsRes, feedbackRes, clientsRes] = await Promise.all([
      supabase.from("assets").select("asset_type, asset_title, status, strategic_note, client_id").gte("created_at", since),
      supabase.from("asset_section_comments").select("comment_text, asset_id, created_at").gte("created_at", since),
      supabase.from("clients").select("name, vertical, sub_niche, pipeline_status, status").eq("status", "active"),
    ]);

    const assets = assetsRes.data || [];
    const feedback = feedbackRes.data || [];
    const clients = clientsRes.data || [];

    const approvedAssets = assets.filter((a: any) => a.status === "approved");
    const changedAssets = assets.filter((a: any) => a.status === "change_requested");

    const assetsByType = assets.reduce((acc: any, a: any) => {
      acc[a.asset_type] = (acc[a.asset_type] || 0) + 1;
      return acc;
    }, {});

    const prompt = `You are PRAGMA's internal analytics engine. Analyze the last 30 days of work and generate a concise monthly review for the team.

DATA:
Active clients: ${clients.length}
Assets produced: ${assets.length}
Assets approved on first review: ${approvedAssets.length}
Assets that needed changes: ${changedAssets.length}
Total client feedback received: ${feedback.length}

Client breakdown by vertical:
${clients.map((c: any) => `- ${c.name}: ${c.vertical} / ${c.sub_niche} (pipeline: ${c.pipeline_status})`).join("\n")}

Sample feedback from clients (last 30 days):
${feedback.slice(0, 10).map((f: any) => `- "${f.comment_text}"`).join("\n")}

Asset types produced:
${Object.entries(assetsByType).map(([type, count]) => `- ${type}: ${count}`).join("\n")}

Generate a monthly review in Italian with these sections:

## Riepilogo del mese
2-3 sentences on overall progress and key numbers.

## Cosa ha funzionato
3 specific observations about what worked well — based on approval rates and positive feedback patterns.

## Cosa migliorare
3 specific suggestions based on feedback patterns and change requests. Be specific — not generic advice.

## Pattern nei feedback clienti
What do clients keep asking to change? Any recurring themes?

## Suggerimenti per i prompts
Based on what worked and what didn't, suggest 2-3 specific adjustments to make in the prompts for next month.

## Prossimi 30 giorni
Priority actions for next month based on current pipeline status of all clients.

Be specific and actionable. Use the actual data provided. Write as if you are a strategic advisor to the PRAGMA team.`;

    let data;
    try {
      data = await callAI({
        prompt,
        max_tokens: 3000,
        model: "google/gemini-2.5-pro",
      });
    } catch (e: any) {
      if (e.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (e.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    const reviewText = data.content?.find((b: any) => b.type === "text")?.text || "";

    await supabase.from("activity_log").insert({
      entity_type: "system",
      entity_id: "00000000-0000-0000-0000-000000000000",
      action: "monthly_review_generated",
      entity_name: "Monthly Review",
    });

    return new Response(JSON.stringify({ ok: true, review: reviewText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-monthly-review error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
