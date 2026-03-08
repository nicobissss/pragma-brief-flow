import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildMaterialsContext(materials: any): string {
  if (!materials || typeof materials !== "object") return "";

  const blocks: string[] = [];

  // Brand colors & personality
  if (materials.primary_color || materials.secondary_color || materials.brand_tags?.length) {
    let brandBlock = "BRAND IDENTITY:\n";
    if (materials.primary_color) brandBlock += `Use these exact brand colors throughout: Primary: ${materials.primary_color}.`;
    if (materials.secondary_color) brandBlock += ` Secondary: ${materials.secondary_color}.`;
    if (materials.brand_tags?.length) brandBlock += `\nBrand personality: ${materials.brand_tags.join(", ")}. Apply this visual identity consistently.`;
    blocks.push(brandBlock);
  }

  // Website context
  if (materials.website_context) {
    blocks.push(`CURRENT WEBSITE TONE AND STYLE:\nTheir current website tone and style:\n${materials.website_context}\nMatch this tone of voice in all copy.`);
  }

  // Pricing PDF
  if (materials.pricing_pdf_text) {
    blocks.push(`ACTUAL SERVICES AND PRICING:\nTheir actual services and pricing:\n${materials.pricing_pdf_text}\nUse these exact services and prices in the copy — do not invent or approximate.`);
  }

  // Existing emails
  const emailContent: string[] = [];
  if (materials.email_text?.trim()) emailContent.push(materials.email_text);
  if (emailContent.length > 0) {
    blocks.push(`CURRENT EMAIL COMMUNICATION STYLE:\nExamples of their current email communication style:\n${emailContent.join("\n---\n")}\nAnalyze the tone, length, and style. Mirror this in the generated email prompts.`);
  }

  // Social posts
  if (materials.social_posts?.length) {
    const captions = materials.social_posts
      .map((p: any, i: number) => `${i + 1}. ${p.caption || "(no caption)"}`)
      .join("\n");
    blocks.push(`CURRENT SOCIAL MEDIA STYLE:\nTheir current social media style (based on post captions):\n${captions}\nMirror this tone and content style in social prompts.`);
  }

  // Photos
  if (materials.photos?.length) {
    const descs = materials.photos
      .map((p: any, i: number) => `${i + 1}. ${p.description || "(no description)"}`)
      .join("\n");
    blocks.push(`AVAILABLE PHOTOS/VIDEOS:\nThey have ${materials.photos.length} photos/videos available:\n${descs}\nReference these specific assets in the social and LP prompts with placeholders like [PHOTO: description of which photo to use here].`);
  }

  if (blocks.length === 0) return "";

  return `

--- CLIENT MATERIALS (use for maximum specificity) ---
${blocks.join("\n\n")}
--- END CLIENT MATERIALS ---

`;
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

    // Fetch client, kickoff brief, and prospect data in parallel
    const [clientRes, kickoffRes] = await Promise.all([
      supabaseAdmin.from("clients").select("*").eq("id", client_id).single(),
      supabaseAdmin.from("kickoff_briefs").select("*").eq("client_id", client_id).maybeSingle(),
    ]);

    const client = clientRes.data;
    if (!client) throw new Error("Client not found");

    const kickoff = kickoffRes.data;

    // Fetch prospect briefing answers if available
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

    // Build materials context
    const materialsContext = buildMaterialsContext(kickoff?.client_materials);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // Fetch knowledge base
    const { data: kbRows } = await supabaseAdmin.from("knowledge_base").select("category, content").order("category");
    let kbText = "";
    if (kbRows) {
      for (const row of kbRows) {
        if (row.content?.trim()) kbText += `
### ${row.category}
${row.content}
`;
      }
    }

    const systemPrompt = `You are PRAGMA's internal prompt generation engine. Your job is to create highly specific, ready-to-use prompts for each marketing tool that PRAGMA will deploy for this client.

${kbText ? `--- PRAGMA KNOWLEDGE BASE ---\n${kbText}\n--- END ---` : ""}${materialsContext}

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

    const userPrompt = `Generate tool-specific prompts for this client:

Client: ${client.name} — ${client.company_name}
Vertical: ${client.vertical} / ${client.sub_niche}
Market: ${client.market}

${Object.keys(briefingAnswers).length > 0 ? `Original Briefing Answers:\n${JSON.stringify(briefingAnswers, null, 2)}` : ""}

${proposal ? `Proposal Decisions:
- Recommended Flow: ${proposal.recommended_flow || "N/A"}
- Tools: ${JSON.stringify(proposal.recommended_tools || [])}
- Pricing: ${JSON.stringify(proposal.pricing || {})}
- Timeline: ${proposal.timeline || "N/A"}` : ""}

${kickoff?.transcript_text ? `Kickoff Call Transcript:\n${kickoff.transcript_text.slice(0, 5000)}` : ""}`;

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
    if (kickoff) {
      await supabaseAdmin.from("kickoff_briefs").update({
        generated_prompts: { raw_text: textContent, generated_at: new Date().toISOString() },
      }).eq("id", kickoff.id);
    } else {
      await supabaseAdmin.from("kickoff_briefs").insert({
        client_id,
        generated_prompts: { raw_text: textContent, generated_at: new Date().toISOString() },
      });
    }

    return new Response(
      JSON.stringify({ success: true, prompts: textContent }),
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
