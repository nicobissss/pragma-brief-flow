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

    // 1. Fetch prospect
    const { data: prospect, error: pErr } = await supabaseAdmin
      .from("prospects")
      .select("*")
      .eq("id", prospect_id)
      .single();

    if (pErr || !prospect) throw new Error("Prospect not found");

    // 2. Check if client already exists
    const { data: existingClient } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("prospect_id", prospect_id)
      .maybeSingle();

    if (existingClient) {
      await supabaseAdmin.from("prospects").update({ status: "accepted" }).eq("id", prospect_id);
      return new Response(JSON.stringify({ success: true, client_id: existingClient.id, already_existed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Auth user
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users?.find((u: any) => u.email === prospect.email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: prospect.email,
        password: "Pragma2026!",
        email_confirm: true,
        user_metadata: { full_name: prospect.name, company: prospect.company_name, role: "client" },
        app_metadata: { role: "client" },
      });

      if (createErr) throw new Error(`Failed to create user: ${createErr.message}`);
      userId = newUser.user.id;
    }

    // 4. Role
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: "client" },
      { onConflict: "user_id,role" }
    );

    // 5. Client record (extract city + website_url from briefing answers if present)
    const briefingAnswers = (prospect.briefing_answers || {}) as Record<string, any>;
    const city = briefingAnswers.city || briefingAnswers.ciudad || briefingAnswers.location || null;
    const websiteUrl = briefingAnswers.website_url || briefingAnswers.website || briefingAnswers.url_sitio_web || null;

    const { data: client, error: clientErr } = await supabaseAdmin.from("clients").insert({
      name: prospect.name,
      company_name: prospect.company_name,
      email: prospect.email,
      market: prospect.market,
      vertical: prospect.vertical,
      sub_niche: prospect.sub_niche,
      city,
      website_url: websiteUrl,
      prospect_id: prospect.id,
      user_id: userId,
      status: "active",
    }).select("id").single();

    if (clientErr) throw new Error(`Failed to create client: ${clientErr.message}`);

    // 5b. Clone kickoff questions from vertical/sub_niche templates
    try {
      const { data: cloned, error: cloneErr } = await supabaseAdmin.rpc("clone_kickoff_questions_for_client", {
        p_client_id: client.id,
        p_vertical: prospect.vertical,
        p_sub_niche: prospect.sub_niche,
        p_replace: false,
      });
      if (cloneErr) console.error("clone_kickoff_questions error:", cloneErr);
      else console.log(`Cloned ${cloned} kickoff questions for client ${client.id}`);
    } catch (cloneErr) {
      console.error("clone_kickoff_questions exception:", cloneErr);
    }

    // 6. Briefing answers
    const { error: bsErr } = await supabaseAdmin
      .from("briefing_submissions")
      .upsert({
        client_id: client.id,
        answers: prospect.briefing_answers || {}
      }, { onConflict: "client_id" });
    if (bsErr) console.error("briefing_submissions error:", bsErr);

    // 7. Auto-create client_offering from proposal recommendation
    const { data: proposal } = await supabaseAdmin
      .from("proposals")
      .select("recommended_offering_code, recommended_flow")
      .eq("prospect_id", prospect_id)
      .maybeSingle();

    let offeringId: string | null = null;
    const offeringCode = (proposal as any)?.recommended_offering_code;

    if (offeringCode) {
      const { data: tpl } = await supabaseAdmin
        .from("offering_templates")
        .select("id")
        .eq("code", offeringCode)
        .eq("is_active", true)
        .maybeSingle();

      if (tpl?.id) {
        const { data: newOffering, error: offErr } = await supabaseAdmin
          .from("client_offerings")
          .insert({
            client_id: client.id,
            offering_template_id: tpl.id,
            status: "proposed",
            was_recommended: true,
            recommendation_reasons: { source: "auto-from-proposal", code: offeringCode },
          })
          .select("id")
          .single();

        if (offErr) {
          console.error("client_offerings insert error:", offErr);
        } else if (newOffering) {
          offeringId = newOffering.id;
          // 8. Auto-generate tasks for this offering
          const { error: taskErr } = await supabaseAdmin.rpc("generate_tasks_for_offering", {
            p_client_offering_id: newOffering.id,
          });
          if (taskErr) console.error("generate_tasks_for_offering error:", taskErr);
        }
      } else {
        console.warn("No active offering_template found for code:", offeringCode);
      }
    }

    // 9. Update prospect status
    await supabaseAdmin.from("prospects").update({ status: "accepted" }).eq("id", prospect_id);

    // 10. Log activity
    await supabaseAdmin.from("activity_log").insert({
      entity_type: "prospect",
      entity_id: prospect.id,
      entity_name: prospect.name,
      action: `accepted — client account created${offeringId ? " + offering auto-created" : ""}`,
    });

    // 11. Welcome email (non-blocking)
    try {
      await supabaseAdmin.functions.invoke("send-notification", {
        body: {
          type: "client_welcome",
          data: {
            name: prospect.name,
            email: prospect.email,
            app_url: "https://pragma-brief-flow.lovable.app"
          }
        }
      });
    } catch (emailErr) {
      console.error("Welcome email error:", emailErr);
    }

    return new Response(JSON.stringify({ success: true, client_id: client.id, user_id: userId, offering_id: offeringId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("accept-prospect error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
