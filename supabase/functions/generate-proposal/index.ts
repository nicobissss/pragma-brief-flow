import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { STRICT_RULES, getFlowForSubNiche } from "../_shared/strict-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchKnowledgeBase(supabaseAdmin: any): Promise<string> {
  const { data: kbRows } = await supabaseAdmin
    .from("knowledge_base")
    .select("category, content")
    .order("category");

  const categoryTitles: Record<string, string> = {
    flows_processes: "Flows & Processes",
    pitch_guidelines: "Pitch Guidelines",
    pricing: "Pricing",
    suite_tools: "Suite Tools",
  };

  let kbText = "";
  if (kbRows) {
    for (const row of kbRows) {
      if (row.content?.trim()) {
        kbText += `\n### ${categoryTitles[row.category] || row.category}\n${row.content}\n`;
      }
    }
  }

  const { data: docs } = await supabaseAdmin
    .from("kb_documents")
    .select("filename, extracted_text")
    .eq("is_active", true);

  let docsText = "";
  if (docs) {
    for (const doc of docs) {
      if (doc.extracted_text?.trim()) {
        docsText += `\n### Document: ${doc.filename}\n${doc.extracted_text}\n`;
      }
    }
  }

  if (!kbText && !docsText) return "";

  return `\n\n--- PRAGMA KNOWLEDGE BASE (use this as primary reference) ---\n${kbText}${docsText}\n--- END KNOWLEDGE BASE ---\n\n`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prospect_id } = await req.json();
    if (!prospect_id) throw new Error("prospect_id is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [prospectRes, knowledgeBase] = await Promise.all([
      supabaseAdmin.from("prospects").select("*").eq("id", prospect_id).single(),
      fetchKnowledgeBase(supabaseAdmin),
    ]);

    const { data: prospect, error: pErr } = prospectRes;
    if (pErr || !prospect) throw new Error("Prospect not found");

    const answers = prospect.briefing_answers || {};
    const market = prospect.market;
    const currency = market === "ar" ? "USD" : "EUR";

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const assignedFlow = getFlowForSubNiche(prospect.vertical, prospect.sub_niche);

    const systemPrompt = `${knowledgeBase}You are PRAGMA's internal AI proposal engine. PRAGMA is a marketing automation agency serving three verticals: Salud & Estética, E-Learning, and Deporte Offline, in Spain, Italy, and Argentina.

${STRICT_RULES}

The assigned flow for this prospect based on their vertical "${prospect.vertical}" and sub-niche "${prospect.sub_niche}" is: "${assignedFlow}". You MUST use this flow in your recommendation. Do NOT suggest a different flow.

You will receive a prospect's briefing answers and must generate a complete, structured proposal.

Contract types:
- Tipo A: client has a trackable conversion event (e.g. appointment booking, purchase). Commission-based pricing applies.
- Tipo B: no clear trackable conversion (e.g. brand awareness). Fixed retainer only.

Pricing guidelines (monthly retainer ranges) — use ONLY prices from the knowledge base above. If none found, use these defaults:
- Salud & Estética: ${currency === "EUR" ? "€800–€2,000" : "$600–$1,500"}
- E-Learning: ${currency === "EUR" ? "€1,000–€2,500" : "$800–$2,000"}
- Deporte Offline: ${currency === "EUR" ? "€600–€1,500" : "$500–$1,200"}

Ad management fee: 15% of declared monthly ad budget.
Commission (Tipo A only): 8-12% on first conversion, 60-day attribution window.
Setup fee: ${currency === "EUR" ? "€500–€1,500" : "$400–$1,200"} (applies from month 3 for Tipo A, month 1 for Tipo B).

You MUST respond using the tool provided.

## CALL PREPARATION SECTION
This entire section is INTERNAL ONLY — never share with client.
Add all of this content inside the pitch_suggestions field.

### 1. Opening Line for the Call
Write ONE highly specific opening line based on what the prospect wrote in their description.
Must reference something concrete they said. NOT generic.
Example: if they wrote "I make great courses but they're too long", open with that exact pain point.

### 2. Customer Journey Narrative
Narrate the COMPLETE journey of the prospect's END CLIENT — the person who will eventually buy from them.
Tell it as a story, step by step, with specific and concrete examples at each touchpoint.
Use this format for each step:

STEP N — [Channel/Touchpoint name]
What happens: [Describe exactly what the end client sees, reads, or receives]
Example: [Give a real, specific example — an actual headline, subject line, WhatsApp message, or CTA]
Goal: [What we want the end client to feel or do at this step]

Include ALL touchpoints for the activated tools:
- Landing Pragma active → describe landing page structure, headline angle, main CTA, trust elements
- Pragma Visual Email active → describe each email in the sequence with subject line example and purpose
- Slotty active → describe booking flow, confirmation message, reminder messages (24h and 2h before)
- Social Engine active → describe content type and how it feeds into the funnel
- Blog System active → describe content strategy and how it drives organic traffic to the funnel
- Voice Bot active → describe when it triggers and what it says

Be very specific. Use their vertical, sub-niche, ticket price, and market to make examples realistic and sector-appropriate.
Write examples in the same language as the prospect's description (Italian or Spanish as appropriate).

### 3. Conversation Guide
Write 5-7 specific questions to ask during the sales call, based on their vertical, sub-niche, ticket, and description.
Each question must:
- Be directly relevant to their specific situation (not generic)
- Help qualify if they are a good fit for PRAGMA
- Help gather info needed for the kickoff if they accept
Avoid generic questions like "what are your goals?".

### 4. How to Present the Price
Write a 3-4 sentence conversational script for presenting the proposed pricing during the call.
Must reference their specific average ticket and the concrete ROI they can expect.
Must address the most likely pricing objection for their vertical.
Be conversational, not salesy.

### 5. Red Flags to Watch For
List 3-4 specific warning signs during the call that suggest this prospect is NOT a good fit for PRAGMA.
Make them specific to their vertical and situation.

### 6. Copy Spunti (Quick Reference for the Call)
3 headline examples for their landing page — specific to their sector and ticket level
3 email subject line examples: one curiosity-based, one benefit-based, one urgency-based
1 WhatsApp message for new leads — max 3 lines, natural and human tone`;

    const userPrompt = `Generate a proposal for this prospect:

Name: ${prospect.name}
Company: ${prospect.company_name}
Market: ${market} (currency: ${currency})
Vertical: ${prospect.vertical}
Sub-niche: ${prospect.sub_niche}

Briefing answers:
${JSON.stringify(answers, null, 2)}`;

    const toolDef = {
      name: "create_proposal",
      description: "Create a structured proposal for the prospect",
      input_schema: {
        type: "object",
        properties: {
          recommended_flow: {
            type: "object",
            properties: {
              title: { type: "string" },
              steps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    number: { type: "number" },
                    name: { type: "string" },
                    description: { type: "string" },
                    critical: { type: "boolean" },
                  },
                  required: ["number", "name", "description", "critical"],
                },
              },
            },
            required: ["title", "steps"],
          },
          recommended_tools: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                recommended: { type: "boolean" },
                reason: { type: "string" },
              },
              required: ["name", "recommended", "reason"],
            },
          },
          pricing: {
            type: "object",
            properties: {
              contract_type: { type: "string", enum: ["Tipo A", "Tipo B"] },
              contract_type_reason: { type: "string" },
              currency: { type: "string" },
              retainer_min: { type: "number" },
              retainer_max: { type: "number" },
              has_ad_fee: { type: "boolean" },
              declared_ad_budget: { type: "number" },
              ad_fee: { type: "number" },
              commission_percentage: { type: "number" },
              commission_window_days: { type: "number" },
              commission_description: { type: "string" },
              setup_fee_min: { type: "number" },
              setup_fee_max: { type: "number" },
              setup_fee_note: { type: "string" },
              total_month_1_min: { type: "number" },
              total_month_1_max: { type: "number" },
              total_month_3_note: { type: "string" },
            },
            required: ["contract_type", "contract_type_reason", "currency", "retainer_min", "retainer_max"],
          },
          timeline: {
            type: "array",
            items: {
              type: "object",
              properties: {
                period: { type: "string" },
                title: { type: "string" },
                description: { type: "string" },
              },
              required: ["period", "title", "description"],
            },
          },
          pitch_suggestions: {
            type: "object",
            properties: {
              key_arguments: { type: "array", items: { type: "string" } },
              objections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    objection: { type: "string" },
                    response: { type: "string" },
                  },
                  required: ["objection", "response"],
                },
              },
              opening_line: { type: "string" },
            },
            required: ["key_arguments", "objections", "opening_line"],
          },
        },
        required: ["recommended_flow", "recommended_tools", "pricing", "timeline", "pitch_suggestions"],
      },
    };

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [toolDef],
        tool_choice: { type: "tool", name: "create_proposal" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Claude API error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Claude error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolUseBlock = aiData.content?.find((b: any) => b.type === "tool_use");
    if (!toolUseBlock) throw new Error("No tool_use block in Claude response");

    const proposal = toolUseBlock.input;

    // Save to proposals table (upsert on unique prospect_id)
    const { error: saveErr } = await supabaseAdmin.from("proposals").upsert({
      prospect_id,
      recommended_flow: JSON.stringify(proposal.recommended_flow),
      recommended_tools: proposal.recommended_tools,
      pricing: proposal.pricing,
      timeline: JSON.stringify(proposal.timeline),
      pitch_suggestions: JSON.stringify(proposal.pitch_suggestions),
      full_proposal_content: proposal,
    }, { onConflict: "prospect_id" });

    if (saveErr) throw saveErr;

    return new Response(JSON.stringify({ success: true, proposal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-proposal error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
