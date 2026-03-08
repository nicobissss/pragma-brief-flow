import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ContextSources {
  transcript: boolean;
  briefing_answers: boolean;
  proposal: boolean;
  brand_colors: boolean;
  brand_tags: boolean;
  website_context: boolean;
  pricing_pdf: boolean;
  photos: { included: boolean; count: number };
  emails: boolean;
  social_posts: { included: boolean; count: number };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id } = await req.json();
    if (!client_id) throw new Error("client_id is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch client, kickoff brief in parallel
    const [clientRes, kickoffRes] = await Promise.all([
      supabaseAdmin.from("clients").select("*").eq("id", client_id).single(),
      supabaseAdmin.from("kickoff_briefs").select("*").eq("client_id", client_id).maybeSingle(),
    ]);

    const client = clientRes.data;
    if (!client) throw new Error("Client not found");

    const kickoff = kickoffRes.data;
    const materials = kickoff?.client_materials || {};

    // Fetch prospect briefing answers and proposal if available
    let briefingAnswers: any = {};
    let proposal: any = null;
    if (client.prospect_id) {
      const [prospectRes, proposalRes] = await Promise.all([
        supabaseAdmin.from("prospects").select("briefing_answers").eq("id", client.prospect_id).single(),
        supabaseAdmin.from("proposals").select("*").eq("prospect_id", client.prospect_id).maybeSingle(),
      ]);
      briefingAnswers = prospectRes.data?.briefing_answers || {};
      proposal = proposalRes.data;
    }

    // Track which sources are available
    const sources: ContextSources = {
      transcript: !!(kickoff?.transcript_text?.trim()),
      briefing_answers: Object.keys(briefingAnswers).length > 0,
      proposal: !!proposal,
      brand_colors: !!(materials.primary_color || materials.secondary_color),
      brand_tags: !!(materials.brand_tags?.length),
      website_context: !!(materials.website_context?.trim()),
      pricing_pdf: !!(materials.pricing_pdf_text?.trim()),
      photos: { included: !!(materials.photos?.length), count: materials.photos?.length || 0 },
      emails: !!(materials.email_text?.trim()),
      social_posts: { included: !!(materials.social_posts?.length), count: materials.social_posts?.length || 0 },
    };

    // Build dynamic context blocks
    const contextBlocks: string[] = [];

    // Client info (always included)
    contextBlocks.push(`CLIENT INFO:\nName: ${client.name}\nCompany: ${client.company_name}\nVertical: ${client.vertical} / ${client.sub_niche}\nMarket: ${client.market}`);

    // Briefing answers
    if (sources.briefing_answers) {
      contextBlocks.push(`CLIENT BRIEFING:\n${JSON.stringify(briefingAnswers, null, 2)}`);
    }

    // Proposal decisions
    if (sources.proposal) {
      contextBlocks.push(`PROPOSAL DECISIONS:\n- Recommended Flow: ${proposal.recommended_flow || "N/A"}\n- Tools: ${JSON.stringify(proposal.recommended_tools || [])}\n- Pricing: ${JSON.stringify(proposal.pricing || {})}\n- Timeline: ${proposal.timeline || "N/A"}`);
    }

    // Transcript
    if (sources.transcript) {
      contextBlocks.push(`KICKOFF TRANSCRIPT:\n${kickoff.transcript_text.slice(0, 8000)}`);
    }

    // Brand identity
    if (sources.brand_colors || sources.brand_tags) {
      let block = "BRAND IDENTITY:";
      if (materials.primary_color) block += `\nPrimary color: ${materials.primary_color}`;
      if (materials.secondary_color) block += `\nSecondary color: ${materials.secondary_color}`;
      if (materials.brand_tags?.length) block += `\nBrand personality: ${materials.brand_tags.join(", ")}`;
      block += "\nApply this visual identity consistently in all prompts.";
      contextBlocks.push(block);
    }

    // Website context
    if (sources.website_context) {
      contextBlocks.push(`WEBSITE ANALYSIS:\n${materials.website_context}\nNote: match this tone of voice in all copy.`);
    }

    // Pricing PDF
    if (sources.pricing_pdf) {
      contextBlocks.push(`ACTUAL SERVICES & PRICING:\n${materials.pricing_pdf_text}\nNote: use these exact services and prices in all copy — do not invent or approximate.`);
    }

    // Photos
    if (sources.photos.included) {
      const descs = materials.photos
        .map((p: any, i: number) => `${i + 1}. ${p.description || "(no description)"}`)
        .join("\n");
      contextBlocks.push(`AVAILABLE VISUAL ASSETS (${sources.photos.count} assets):\n${descs}\nNote: reference these specific assets in prompts with placeholders like [PHOTO: description of which photo to use here].`);
    }

    // Emails
    if (sources.emails) {
      contextBlocks.push(`CURRENT EMAIL STYLE:\n${materials.email_text}\nNote: analyze the tone, length, and style. Mirror this in generated email prompts.`);
    }

    // Social posts
    if (sources.social_posts.included) {
      const captions = materials.social_posts
        .map((p: any, i: number) => `${i + 1}. ${p.caption || "(no caption)"}`)
        .join("\n");
      contextBlocks.push(`CURRENT SOCIAL STYLE (${sources.social_posts.count} posts):\n${captions}\nNote: mirror this tone and content style in social prompts.`);
    }

    // Fetch knowledge base
    const { data: kbRows } = await supabaseAdmin.from("knowledge_base").select("category, content").order("category");
    let kbText = "";
    if (kbRows) {
      for (const row of kbRows) {
        if (row.content?.trim()) kbText += `\n### ${row.category}\n${row.content}\n`;
      }
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const systemPrompt = `You are PRAGMA's internal prompt generation engine. Your job is to create highly specific, ready-to-use prompts for each marketing tool that PRAGMA will deploy for this client.

${kbText ? `--- PRAGMA KNOWLEDGE BASE ---\n${kbText}\n--- END KNOWLEDGE BASE ---\n` : ""}
Each prompt must be detailed enough that another AI (or a human copywriter) can execute it immediately without needing additional context. Include specific brand colors, tone of voice, service names, prices, and photo references when available.

Generate prompts for these tools (only if applicable based on the proposal):
1. Landing Pragma (landing page copy & structure)
2. Pragma Visual Email (email sequence copy)
3. Social Engine Pragma (social media posts)
4. Pragma SEO & GEO (SEO content briefs)
5. Pragma Calendar (appointment flow messaging)

For each tool, provide:
- A detailed system prompt that sets the context
- 3-5 specific task prompts that can be executed immediately
- Any visual/design instructions based on available materials`;

    const userPrompt = `Generate tool-specific prompts for this client using ALL the context below.\n\n${contextBlocks.join("\n\n---\n\n")}`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Claude API error:", aiResponse.status, errText);
      throw new Error(`Claude error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const textContent = aiData.content?.find((b: any) => b.type === "text")?.text || "";

    // Save generated prompts to kickoff_briefs
    const promptData = {
      raw_text: textContent,
      generated_at: new Date().toISOString(),
      context_sources: sources,
    };

    if (kickoff) {
      await supabaseAdmin.from("kickoff_briefs").update({
        generated_prompts: promptData,
      }).eq("id", kickoff.id);
    } else {
      await supabaseAdmin.from("kickoff_briefs").insert({
        client_id,
        generated_prompts: promptData,
      });
    }

    return new Response(
      JSON.stringify({ success: true, prompts: textContent, context_sources: sources }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-kickoff-prompts error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
