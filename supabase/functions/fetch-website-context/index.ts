const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) throw new Error("url is required");

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Fetching website:", formattedUrl);

    const response = await fetch(formattedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PragmaBot/1.0)" },
    });

    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

    const html = await response.text();

    // Extract useful information from HTML
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || "";

    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const mainHeadline = h1Match?.[1]?.replace(/<[^>]+>/g, "").trim() || "";

    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i);
    const metaDesc = metaDescMatch?.[1]?.trim() || "";

    // Extract visible text (strip tags)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let bodyText = bodyMatch?.[1] || html;
    bodyText = bodyText
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    // Try to detect color hex values in CSS
    const colorMatches = html.match(/#[0-9A-Fa-f]{6}/g) || [];
    const uniqueColors = [...new Set(colorMatches)].slice(0, 10);

    // Extract key services by looking for list items and headings
    const h2Matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
    const h3Matches = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)];
    const headings = [...h2Matches, ...h3Matches]
      .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
      .filter((h) => h.length > 2 && h.length < 100)
      .slice(0, 15);

    const extracted_context = [
      `Website: ${formattedUrl}`,
      title ? `Title: ${title}` : "",
      mainHeadline ? `Main Headline: ${mainHeadline}` : "",
      metaDesc ? `Meta Description: ${metaDesc}` : "",
      headings.length > 0 ? `Key Sections/Services:\n${headings.map((h) => `- ${h}`).join("\n")}` : "",
      uniqueColors.length > 0 ? `Detected Colors: ${uniqueColors.join(", ")}` : "",
      bodyText ? `\nPage Content (excerpt):\n${bodyText.slice(0, 2000)}` : "",
    ].filter(Boolean).join("\n\n");

    return new Response(
      JSON.stringify({ extracted_context }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fetch-website-context error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
