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

    // 2. Check if client already exists for this prospect
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

    // 3. Check if email already has an auth user
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

    // 4. Assign client role
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: "client" },
      { onConflict: "user_id,role" }
    );

    // 5. Create client record
    const { data: client, error: clientErr } = await supabaseAdmin.from("clients").insert({
      name: prospect.name,
      company_name: prospect.company_name,
      email: prospect.email,
      market: prospect.market,
      vertical: prospect.vertical,
      sub_niche: prospect.sub_niche,
      prospect_id: prospect.id,
      user_id: userId,
      status: "active",
    }).select("id").single();

    if (clientErr) throw new Error(`Failed to create client: ${clientErr.message}`);

    // 6. Update prospect status
    await supabaseAdmin.from("prospects").update({ status: "accepted" }).eq("id", prospect_id);

    // 7. Log activity
    await supabaseAdmin.from("activity_log").insert({
      entity_type: "prospect",
      entity_id: prospect.id,
      entity_name: prospect.name,
      action: "accepted — client account created",
    });

    // 8. Send webhook to Briefer (non-blocking)
    let briefer_sent = false;
    let briefer_error: string | null = null;
    try {
      // Read briefer settings from app_settings
      const { data: settings } = await supabaseAdmin
        .from("app_settings")
        .select("key, value")
        .in("key", ["briefer_url", "briefer_webhook_secret"]);

      const settingsMap: Record<string, string> = {};
      if (settings) {
        for (const s of settings) settingsMap[s.key] = s.value;
      }

      const brieferUrl = settingsMap["briefer_url"];
      const brieferSecret = settingsMap["briefer_webhook_secret"];

      if (brieferUrl) {
        // Fetch proposal data
        const { data: proposalData } = await supabaseAdmin
          .from("proposals")
          .select("full_proposal_content")
          .eq("prospect_id", prospect_id)
          .maybeSingle();

        const proposal = proposalData?.full_proposal_content as any;

        const webhookBody = {
          client_id: client.id,
          name: prospect.name,
          company_name: prospect.company_name,
          email: prospect.email,
          vertical: prospect.vertical,
          sub_niche: prospect.sub_niche,
          market: prospect.market,
          contract_type: proposal?.pricing?.contract_type || "",
          activated_tools: proposal?.recommended_tools || [],
          briefing_answers: prospect.briefing_answers || {},
          recommended_flow: proposal?.recommended_flow || "",
          retainer: proposal?.pricing?.retainer || "",
          commission: proposal?.pricing?.commission || "",
        };

        const webhookRes = await fetch(`${brieferUrl}/functions/v1/receive-client`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(brieferSecret ? { "Authorization": `Bearer ${brieferSecret}` } : {}),
          },
          body: JSON.stringify(webhookBody),
        });

        if (webhookRes.ok) {
          briefer_sent = true;
          await supabaseAdmin.from("activity_log").insert({
            entity_type: "client",
            entity_id: client.id,
            entity_name: prospect.name,
            action: "Client sent to Briefer ✅",
          });
        } else {
          const errText = await webhookRes.text();
          briefer_error = `${webhookRes.status}: ${errText.slice(0, 200)}`;
          await supabaseAdmin.from("activity_log").insert({
            entity_type: "client",
            entity_id: client.id,
            entity_name: prospect.name,
            action: `Briefer webhook failed: ${briefer_error}`,
          });
        }
      }
    } catch (webhookErr: any) {
      briefer_error = webhookErr.message;
      // Log but don't block
      await supabaseAdmin.from("activity_log").insert({
        entity_type: "client",
        entity_id: client.id,
        entity_name: prospect.name,
        action: `Briefer webhook error: ${webhookErr.message}`,
      }).catch(() => {});
    }

    return new Response(JSON.stringify({
      success: true,
      client_id: client.id,
      user_id: userId,
      briefer_sent,
      briefer_error,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("accept-prospect error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
