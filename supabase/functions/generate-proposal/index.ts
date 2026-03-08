import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prospect_id } = await req.json();
    if (!prospect_id) throw new Error("prospect_id is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: prospect, error: pErr } = await supabaseAdmin
      .from("prospects")
      .select("*")
      .eq("id", prospect_id)
      .single();

    if (pErr || !prospect) throw new Error("Prospect not found");

    const answers = prospect.briefing_answers || {};
    const market = prospect.market;
    const currency = market === "ar" ? "USD" : "EUR";

    const systemPrompt = `You are PRAGMA's internal AI proposal engine. PRAGMA is a marketing automation agency serving three verticals: Salud & Estética, E-Learning, and Deporte Offline, in Spain, Italy, and Argentina.

You will receive a prospect's briefing answers and must generate a complete, structured proposal.

PRAGMA's tools:
- Pragma Calendar: appointment scheduling & reminders
- Landing Pragma: landing page builder
- Pragma Visual Email: email flow automation
- Social Engine Pragma: social media content engine
- Pragma SEO & GEO: SEO & local search optimization

Contract types:
- Tipo A: client has a trackable conversion event (e.g. appointment booking, purchase). Commission-based pricing applies.
- Tipo B: no clear trackable conversion (e.g. brand awareness). Fixed retainer only.

Pricing guidelines (monthly retainer ranges):
- Salud & Estética: ${currency === "EUR" ? "€800–€2,000" : "$600–$1,500"}
- E-Learning: ${currency === "EUR" ? "€1,000–€2,500" : "$800–$2,000"}
- Deporte Offline: ${currency === "EUR" ? "€600–€1,500" : "$500–$1,200"}

Ad management fee: 15% of declared monthly ad budget.
Commission (Tipo A only): 8-12% on first conversion, 60-day attribution window.
Setup fee: ${currency === "EUR" ? "€500–€1,500" : "$400–$1,200"} (applies from month 3 for Tipo A, month 1 for Tipo B).

You MUST respond using the tool provided.`;

    const userPrompt = `Generate a proposal for this prospect:

Name: ${prospect.name}
Company: ${prospect.company_name}
Market: ${market} (currency: ${currency})
Vertical: ${prospect.vertical}
Sub-niche: ${prospect.sub_niche}

Briefing answers:
${JSON.stringify(answers, null, 2)}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_proposal",
              description: "Create a structured proposal for the prospect",
              parameters: {
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
                      key_arguments: {
                        type: "array",
                        items: { type: "string" },
                      },
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
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_proposal" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const proposal = JSON.parse(toolCall.function.arguments);

    // Save to proposals table
    const { data: saved, error: saveErr } = await supabaseAdmin.from("proposals").upsert({
      prospect_id,
      recommended_flow: JSON.stringify(proposal.recommended_flow),
      recommended_tools: proposal.recommended_tools,
      pricing: proposal.pricing,
      timeline: JSON.stringify(proposal.timeline),
      pitch_suggestions: JSON.stringify(proposal.pitch_suggestions),
      full_proposal_content: proposal,
    }, { onConflict: "prospect_id" }).select().single();

    if (saveErr) {
      console.error("Save error:", saveErr);
      // Try insert instead if upsert failed
      const { error: insertErr } = await supabaseAdmin.from("proposals").insert({
        prospect_id,
        recommended_flow: JSON.stringify(proposal.recommended_flow),
        recommended_tools: proposal.recommended_tools,
        pricing: proposal.pricing,
        timeline: JSON.stringify(proposal.timeline),
        pitch_suggestions: JSON.stringify(proposal.pitch_suggestions),
        full_proposal_content: proposal,
      });
      if (insertErr) throw insertErr;
    }

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
