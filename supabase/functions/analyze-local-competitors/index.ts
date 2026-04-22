import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

async function firecrawlScrape(url: string, apiKey: string): Promise<{ markdown?: string; metadata?: any } | null> {
  try {
    const res = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    if (!res.ok) {
      console.error(`Firecrawl scrape failed for ${url}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    // v2 may return data on root or under .data
    return {
      markdown: data.markdown ?? data.data?.markdown,
      metadata: data.metadata ?? data.data?.metadata,
    };
  } catch (e) {
    console.error(`Firecrawl error for ${url}:`, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id, competitors } = await req.json();
    if (!client_id) throw new Error("client_id is required");
    if (!Array.isArray(competitors) || competitors.length === 0) {
      throw new Error("competitors array is required (each: { name?, website_url?, ig_handle? })");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // Fetch client for context
    const { data: client } = await supabase.from("clients").select("name, vertical, sub_niche, city, market").eq("id", client_id).single();
    if (!client) throw new Error("Client not found");

    const results: any[] = [];

    for (const c of competitors) {
      const name = c.name || c.website_url || c.ig_handle || "Competitor";
      // Insert pending row
      const { data: row, error: insErr } = await supabase
        .from("client_competitor_analyses")
        .insert({
          client_id,
          competitor_name: c.name || null,
          competitor_url: c.website_url || null,
          competitor_ig_handle: c.ig_handle || null,
          status: "processing",
        })
        .select()
        .single();
      if (insErr || !row) {
        console.error("Insert failed:", insErr);
        continue;
      }

      try {
        let scrapedContent = "";
        const scrapedSources: string[] = [];

        if (c.website_url && FIRECRAWL_API_KEY) {
          const site = await firecrawlScrape(c.website_url, FIRECRAWL_API_KEY);
          if (site?.markdown) {
            scrapedContent += `\n\n=== WEBSITE (${c.website_url}) ===\n${site.markdown.slice(0, 8000)}`;
            scrapedSources.push("website");
          }
        }

        if (c.ig_handle && FIRECRAWL_API_KEY) {
          const igUrl = c.ig_handle.startsWith("http")
            ? c.ig_handle
            : `https://www.instagram.com/${c.ig_handle.replace("@", "")}/`;
          const ig = await firecrawlScrape(igUrl, FIRECRAWL_API_KEY);
          if (ig?.markdown) {
            scrapedContent += `\n\n=== INSTAGRAM (${igUrl}) ===\n${ig.markdown.slice(0, 4000)}`;
            scrapedSources.push("instagram");
          }
        }

        if (!scrapedContent.trim()) {
          await supabase
            .from("client_competitor_analyses")
            .update({
              status: "error",
              error: FIRECRAWL_API_KEY ? "No content scraped" : "FIRECRAWL_API_KEY not configured",
            })
            .eq("id", row.id);
          continue;
        }

        // Claude analysis
        const systemPrompt = `Eres un analista de marketing para PRAGMA. Analiza un competidor local de "${client.name}" (${client.vertical}/${client.sub_niche}${client.city ? `, ${client.city}` : ""}).

Devuelve SOLO JSON válido con esta estructura:
{
  "treatments": [{"name": "...", "description": "..."}],
  "pricing_observed": {"notes": "...", "ranges": [{"item": "...", "price": "..."}]},
  "hooks": ["frase de marketing 1", "frase 2"],
  "positioning_gaps": ["oportunidad 1 para ${client.name}", "oportunidad 2"],
  "summary": "1-2 párrafos en español sobre cómo se posiciona y qué puede hacer ${client.name} para diferenciarse"
}`;

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
            messages: [{ role: "user", content: `Competidor: ${name}\n\nContenido scrapeado:${scrapedContent}` }],
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

        await supabase
          .from("client_competitor_analyses")
          .update({
            status: "completed",
            analyzed_at: new Date().toISOString(),
            treatments: parsed.treatments || [],
            pricing_observed: parsed.pricing_observed || {},
            hooks: parsed.hooks || [],
            positioning_gaps: parsed.positioning_gaps || [],
            ai_summary: parsed.summary || null,
            raw_data: { scraped_sources: scrapedSources, content_length: scrapedContent.length },
          })
          .eq("id", row.id);

        results.push({ id: row.id, name, status: "completed" });
      } catch (e: any) {
        console.error(`Error analyzing ${name}:`, e);
        await supabase
          .from("client_competitor_analyses")
          .update({ status: "error", error: e.message })
          .eq("id", row.id);
        results.push({ id: row.id, name, status: "error", error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("analyze-local-competitors error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
