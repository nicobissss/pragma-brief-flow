import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateRandomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
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
    const APP_URL = Deno.env.get("APP_URL") || "https://pragma-brief-flow.lovable.app";

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

    // 3. Auth user (random password — user uses recovery link)
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users?.find((u: any) => u.email === prospect.email);

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const randomPassword = generateRandomPassword();
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: prospect.email,
        password: randomPassword,
        email_confirm: true,
        user_metadata: { full_name: prospect.name, company: prospect.company_name, role: "client" },
        app_metadata: { role: "client" },
      });

      if (createErr) throw new Error(`Failed to create user: ${createErr.message}`);
      userId = newUser.user.id;
      isNewUser = true;
    }

    // 4. Role
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: "client" },
      { onConflict: "user_id,role" }
    );

    // 5. Client record
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

    // 5b. Clone kickoff questions
    try {
      const { error: cloneErr } = await supabaseAdmin.rpc("clone_kickoff_questions_for_client", {
        p_client_id: client.id,
        p_vertical: prospect.vertical,
        p_sub_niche: prospect.sub_niche,
        p_replace: false,
      });
      if (cloneErr) console.error("clone_kickoff_questions error:", cloneErr);
    } catch (cloneErr) {
      console.error("clone_kickoff_questions exception:", cloneErr);
    }

    // 6. Briefing answers
    const { error: bsErr } = await supabaseAdmin
      .from("briefing_submissions")
      .upsert({ client_id: client.id, answers: prospect.briefing_answers || {} }, { onConflict: "client_id" });
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
          const { error: taskErr } = await supabaseAdmin.rpc("generate_tasks_for_offering", {
            p_client_offering_id: newOffering.id,
          });
          if (taskErr) console.error("generate_tasks_for_offering error:", taskErr);
        }
      }
    }

    // 8. Update prospect status
    await supabaseAdmin.from("prospects").update({ status: "accepted" }).eq("id", prospect_id);

    // 9. Activity log
    await supabaseAdmin.from("activity_log").insert({
      entity_type: "prospect",
      entity_id: prospect.id,
      entity_name: prospect.name,
      action: `accepted — client account created${offeringId ? " + offering auto-created" : ""}`,
    });

    // 10. Welcome email — generate password recovery link, send via send-transactional-email
    try {
      let setPasswordUrl = `${APP_URL}/login`;
      if (isNewUser) {
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: prospect.email,
          options: { redirectTo: `${APP_URL}/update-password` },
        });
        if (linkErr) {
          console.error("generateLink error:", linkErr);
        } else if (linkData?.properties?.action_link) {
          setPasswordUrl = linkData.properties.action_link;
        }
      }

      await supabaseAdmin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "client-welcome",
          recipientEmail: prospect.email,
          idempotencyKey: `client-welcome-${client.id}`,
          templateData: { name: prospect.name, setPasswordUrl, appUrl: APP_URL },
        },
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
