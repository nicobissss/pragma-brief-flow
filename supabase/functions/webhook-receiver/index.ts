import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-pragma-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Authenticate via shared secret
  const secret = req.headers.get("x-pragma-secret");
  const { data: settings } = await supabase
    .from("app_settings").select("value").eq("key", "webhook_secret").single();
  if (settings?.value && secret !== settings.value) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { action, ...params } = body;

  // Log incoming webhook
  await supabase.from("webhook_log").insert({
    direction: "in",
    event_type: action,
    payload: params,
    status: "received",
  });

  try {
    switch (action) {
      case "update_prospect_call": {
        const { prospect_id, call_date, call_platform, call_status, briefing_answers } = params;
        if (!prospect_id) throw new Error("prospect_id required");

        const updateData: Record<string, any> = {
          call_date,
          call_platform: call_platform || "Google Meet",
          call_status: call_status || "scheduled",
        };

        if (briefing_answers && Object.keys(briefing_answers).length > 0) {
          const { data: current } = await supabase
            .from("prospects").select("briefing_answers").eq("id", prospect_id).single();
          updateData.briefing_answers = { ...(current?.briefing_answers || {}), ...briefing_answers };
        }

        await supabase.from("prospects").update(updateData).eq("id", prospect_id);
        break;
      }

      case "update_client_status": {
        const { client_id, status } = params;
        if (!client_id || !status) throw new Error("client_id and status required");
        await supabase.from("clients").update({ status }).eq("id", client_id);
        break;
      }

      case "update_generation_status": {
        const { generation_id, status } = params;
        if (!generation_id || !status) throw new Error("generation_id and status required");
        await supabase.from("tool_generations").update({
          status,
          content_ready_at: status === "content_ready" ? new Date().toISOString() : null,
        }).eq("id", generation_id);
        break;
      }

      case "asset_generated": {
        const {
          client_id,
          campaign_id,
          asset_name,
          asset_title,
          asset_type,
          content,
          preview_url,
          file_url,
          context_used,
          strategic_note,
        } = params;
        if (!client_id) throw new Error("client_id required");
        if (!asset_name) throw new Error("asset_name required");
        if (!asset_type) throw new Error("asset_type required");

        const allowedTypes = ["landing_page", "email_flow", "social_post", "blog_article"];
        if (!allowedTypes.includes(asset_type)) {
          throw new Error(`asset_type must be one of: ${allowedTypes.join(", ")}`);
        }

        // Verify client exists
        const { data: client, error: clientErr } = await supabase
          .from("clients").select("id").eq("id", client_id).maybeSingle();
        if (clientErr || !client) throw new Error(`client_id ${client_id} not found`);

        // Determine next version for this client+asset_name
        const { data: existing } = await supabase
          .from("assets").select("version")
          .eq("client_id", client_id).eq("asset_name", asset_name)
          .order("version", { ascending: false }).limit(1);
        const nextVersion = (existing?.[0]?.version || 0) + 1;

        const { data: inserted, error: insErr } = await supabase.from("assets").insert({
          client_id,
          campaign_id: campaign_id || null,
          asset_name,
          asset_title: asset_title || null,
          asset_type,
          content: content || null,
          preview_url: preview_url || null,
          file_url: file_url || null,
          context_used: context_used || {},
          strategic_note: strategic_note || null,
          status: "pending_review",
          version: nextVersion,
          production_status: "ready",
        }).select("id").single();

        if (insErr) throw new Error(`Insert failed: ${insErr.message}`);

        return new Response(JSON.stringify({ ok: true, asset_id: inserted.id, version: nextVersion }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "slotty_workspace_created": {
        const { request_id, workspace_id } = params;
        if (!request_id) throw new Error("request_id required");
        await supabase.from("slotty_workspace_requests").update({
          status: "completed",
          workspace_id,
          processed_at: new Date().toISOString(),
        }).eq("id", request_id);
        break;
      }

      default:
        await supabase.from("webhook_log").update({ status: "error", error: `Unknown action: ${action}` })
          .eq("event_type", action).order("created_at", { ascending: false }).limit(1);
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("webhook-receiver error:", err);
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
