import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Server-side context score check
function calculateContextScoreServer(data: {
  transcript_text?: string | null;
  transcript_quality?: string | null;
  voice_reference?: string | null;
  briefing_answers?: Record<string, any> | null;
  campaign_objective?: string | null;
  materials?: any;
}): { percentage: number; ready: boolean; missingCritical: string[] } {
  const checks = [
    { key: 'transcript', weight: 25, has: !!data.transcript_text && data.transcript_text.length > 200, critical: true },
    { key: 'voice_reference', weight: 15, has: !!data.voice_reference, critical: true },
    { key: 'briefing_answers', weight: 12, has: !!data.briefing_answers && Object.keys(data.briefing_answers).length >= 3, critical: false },
    { key: 'campaign_brief', weight: 10, has: !!data.campaign_objective, critical: false },
    { key: 'services_pricing', weight: 8, has: !!data.materials?.pricing_pdf_text, critical: false },
    { key: 'brand_colors', weight: 6, has: !!data.materials?.primary_color, critical: false },
    { key: 'logo', weight: 6, has: !!data.materials?.logo_url, critical: false },
  ];

  const maxScore = checks.reduce((sum, c) => sum + c.weight, 0);
  const score = checks.filter(c => c.has).reduce((sum, c) => sum + c.weight, 0);
  const percentage = Math.round((score / maxScore) * 100);
  const missingCritical = checks.filter(c => c.critical && !c.has).map(c => c.key);

  return {
    percentage,
    ready: percentage >= 70 && missingCritical.length === 0,
    missingCritical,
  };
}

async function buildDynamicRules(supabase: any): Promise<string> {
  const [flowsRes, rulesRes] = await Promise.all([
    supabase.from("pragma_flows").select("*").eq("is_active", true),
    supabase.from("pragma_rules").select("*").eq("is_active", true),
  ]);

  const tools = (rulesRes.data || [])
    .filter((r: any) => r.category === "tools_available")
    .map((r: any) => `- ${r.name}: ${r.content}`)
    .join("\n");

  const globalRules = (rulesRes.data || [])
    .filter((r: any) => r.category === "global_rules")
    .map((r: any) => r.content)
    .join("\n");

  const flows = (flowsRes.data || [])
    .map((f: any) => `- ${f.name} (~${f.estimated_total_days} days): ${f.description}`)
    .join("\n");

  return `TOOLS AVAILABLE:\n${tools || "- Pragma Calendar\n- Landing Pragma\n- Pragma Visual Email\n- Social Engine Pragma\n- Pragma SEO & GEO\n- Pragma Learn\n- Voice Bot"}\n\nFLOWS AVAILABLE:\n${flows || "See knowledge base"}\n\nRULES:\n${globalRules || "Follow PRAGMA methodology"}`;
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

    // Fetch additional context in parallel
    const [kbRes, approvedAssetsRes, questionsRes, campaignRes] = await Promise.all([
      supabaseAdmin.from("knowledge_base").select("category, content").order("category"),
      supabaseAdmin.from("assets").select("asset_type, asset_title, content").eq("client_id", client_id).eq("status", "approved").limit(5),
      supabaseAdmin.from("kickoff_questions").select("category, question_text, is_checked").eq("client_id", client_id).eq("is_checked", true),
      supabaseAdmin.from("campaigns").select("name, objective, target_audience, key_message").eq("client_id", client_id).eq("status", "active").maybeSingle(),
    ]);

    // Build dynamic context blocks
    const contextBlocks: string[] = [];

    // Client info
    contextBlocks.push(`CLIENT INFO:\nName: ${client.name}\nCompany: ${client.company_name}\nVertical: ${client.vertical} / ${client.sub_niche}\nMarket: ${client.market}`);

    // Briefing answers
    if (Object.keys(briefingAnswers).length > 0) {
      contextBlocks.push(`CLIENT BRIEFING:\n${JSON.stringify(briefingAnswers, null, 2)}`);
    }

    // Proposal decisions
    if (proposal) {
      const rawFlow = proposal.recommended_flow;
      const flowDisplay = typeof rawFlow === "string" ? rawFlow : JSON.stringify(rawFlow || "N/A");
      contextBlocks.push(`PROPOSAL DECISIONS:\n- Recommended Flow: ${flowDisplay}\n- Tools: ${JSON.stringify(proposal.recommended_tools || [])}\n- Pricing: ${JSON.stringify(proposal.pricing || {})}`);
    }

    // Transcript
    if (kickoff?.transcript_text?.trim()) {
      contextBlocks.push(`KICKOFF TRANSCRIPT:\n${kickoff.transcript_text.slice(0, 8000)}`);
    }

    // Brand identity
    if (materials.primary_color || materials.secondary_color || materials.brand_tags?.length) {
      let block = "BRAND IDENTITY:";
      if (materials.primary_color) block += `\nPrimary color: ${materials.primary_color}`;
      if (materials.secondary_color) block += `\nSecondary color: ${materials.secondary_color}`;
      if (materials.brand_tags?.length) block += `\nBrand personality: ${materials.brand_tags.join(", ")}`;
      contextBlocks.push(block);
    }

    // Website context
    if (materials.website_context?.trim()) {
      contextBlocks.push(`WEBSITE ANALYSIS:\n${materials.website_context}\nNote: match this tone of voice in all copy.`);
    }

    // Pricing PDF
    if (materials.pricing_pdf_text?.trim()) {
      contextBlocks.push(`ACTUAL SERVICES & PRICING:\n${materials.pricing_pdf_text}\nNote: use these exact services and prices in all copy.`);
    }

    // Photos
    if (materials.photos?.length) {
      const descs = materials.photos
        .map((p: any, i: number) => `${i + 1}. ${p.description || "(no description)"}`)
        .join("\n");
      contextBlocks.push(`AVAILABLE VISUAL ASSETS (${materials.photos.length}):\n${descs}`);
    }

    // Emails
    if (materials.email_text?.trim()) {
      contextBlocks.push(`CURRENT EMAIL STYLE:\n${materials.email_text}\nMirror this tone.`);
    }

    // Social posts
    if (materials.social_posts?.length) {
      const captions = materials.social_posts
        .map((p: any, i: number) => `${i + 1}. ${p.caption || "(no caption)"}`)
        .join("\n");
      contextBlocks.push(`CURRENT SOCIAL STYLE (${materials.social_posts.length} posts):\n${captions}`);
    }

    // Voice reference and client rules
    if (kickoff?.voice_reference) {
      contextBlocks.push(`VOICE REFERENCE (how client speaks):\n${kickoff.voice_reference}`);
    }
    if (kickoff?.client_rules && Array.isArray(kickoff.client_rules) && kickoff.client_rules.length > 0) {
      contextBlocks.push(`CLIENT RULES (always respect):\n${(kickoff.client_rules as string[]).join("\n")}`);
    }

    // Approved assets for consistency
    if (approvedAssetsRes.data?.length) {
      contextBlocks.push(`APPROVED ASSETS (maintain consistency):\n${JSON.stringify(approvedAssetsRes.data)}`);
    }

    // Kickoff questions covered
    if (questionsRes.data?.length) {
      contextBlocks.push(`KICKOFF QUESTIONS COVERED:\n${questionsRes.data.map((q: any) => `[${q.category}] ${q.question_text}`).join("\n")}`);
    }

    // Active campaign
    if (campaignRes.data) {
      const c = campaignRes.data;
      contextBlocks.push(`ACTIVE CAMPAIGN:\nObjective: ${c.objective}\nTarget: ${c.target_audience}\nKey message: ${c.key_message}`);
    }

    // Knowledge base
    let kbText = "";
    if (kbRes.data) {
      for (const row of kbRes.data) {
        if (row.content?.trim()) kbText += `\n### ${row.category}\n${row.content}\n`;
      }
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // Build dynamic rules from DB
    const dynamicRules = await buildDynamicRules(supabaseAdmin);

    const systemPrompt = `You are PRAGMA's internal prompt generation engine. Your job is to create highly specific, ready-to-use prompts for each marketing tool that PRAGMA will deploy for this client.

${dynamicRules}

${kbText ? `--- PRAGMA KNOWLEDGE BASE ---\n${kbText}\n--- END KNOWLEDGE BASE ---\n` : ""}

CRITICAL: Return ONLY valid JSON with this exact structure:

{
  "suggested_services": [
    {
      "tool_name": "Slotty",
      "recommended": true,
      "reason": "Explain WHY this tool fits this client based on what they said in the call — cite specific quotes or details",
      "priority": 1
    }
  ],
  "prompts": {
    "slotty": {
      "tool_name": "Slotty",
      "objective": "What Slotty will achieve for this client",
      "workspace_config": {
        "business_name": "...",
        "services": [{"name": "...", "duration_minutes": 30, "description": "..."}],
        "working_hours": {"mon-fri": "09:00-18:00"},
        "slot_interval_minutes": 30,
        "buffer_minutes": 5,
        "cancellation_policy": "...",
        "confirmation_message": "...",
        "reminder_24h_message": "...",
        "reminder_2h_message": "..."
      },
      "brand_assets_needed": ["logo", "primary_color", "brand_name"]
    },
    "landing_email": {
      "tool_name": "Landing + Email",
      "objective": "...",
      "system_prompt": "Full system prompt for Landing Pragma and email generation",
      "landing_task_prompts": ["Task 1", "Task 2", "Task 3"],
      "email_sequence_prompts": ["Email 1", "Email 2", "Email 3"],
      "avoid": "..."
    },
    "blog": {
      "tool_name": "Blog System",
      "objective": "...",
      "system_prompt": "Full system prompt for blog post generation",
      "topics": ["Topic 1", "Topic 2", "Topic 3"],
      "keyword_focus": ["keyword 1", "keyword 2"],
      "publishing_frequency": "2x per month",
      "article_structure": "...",
      "avoid": "..."
    }
  }
}

Only include tools that are relevant for this client based on their vertical, sub-niche, and what was discussed. Do NOT include tools that aren't applicable.`;

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

    let result;
    try {
      // Try to parse JSON, stripping markdown fences if present
      const cleaned = textContent.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
      result = JSON.parse(cleaned);
    } catch (_e) {
      // Fallback: save as raw text for backward compat
      const promptData = {
        raw_text: textContent,
        generated_at: new Date().toISOString(),
      };
      if (kickoff) {
        await supabaseAdmin.from("kickoff_briefs").update({ generated_prompts: promptData }).eq("id", kickoff.id);
      } else {
        await supabaseAdmin.from("kickoff_briefs").insert({ client_id, generated_prompts: promptData });
      }
      return new Response(
        JSON.stringify({ success: true, prompts: textContent, structured: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save suggested_services + generated_prompts
    const updateData: any = { generated_prompts: result };
    if (result.suggested_services) {
      updateData.suggested_services = result.suggested_services;
    }

    if (kickoff) {
      await supabaseAdmin.from("kickoff_briefs").update(updateData).eq("id", kickoff.id);
    } else {
      await supabaseAdmin.from("kickoff_briefs").insert({ client_id, ...updateData });
    }

    // Save each prompt as separate tool_generation
    if (result.prompts) {
      const insertions = Object.values(result.prompts).map((prompt: any) => ({
        client_id,
        tool_name: prompt.tool_name || "Unknown",
        prompt,
        status: "prompt_ready",
      }));
      if (insertions.length > 0) {
        await supabaseAdmin.from("tool_generations").insert(insertions);
      }
    }

    // Context snapshot
    await supabaseAdmin.from("client_context_snapshots").insert({
      client_id,
      snapshot_type: "kickoff_prompts",
      context_data: result,
      tokens_used: (aiData.usage?.input_tokens || 0) + (aiData.usage?.output_tokens || 0),
    });

    return new Response(
      JSON.stringify({ success: true, prompts: result, structured: true }),
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
