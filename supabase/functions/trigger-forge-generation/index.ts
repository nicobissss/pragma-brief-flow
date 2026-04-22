import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Triggers asset generation in Forge by sending a webhook with the full client
 * context. Forge will use the provided client_id/campaign_id to read briefer
 * data with its service role key, generate assets, and POST them back to the
 * `webhook-receiver` (action: "asset_generated").
 *
 * Body:
 *   - client_id (required)
 *   - campaign_id (optional) — generate for all asset types in the campaign
 *   - asset_type (optional) — single-asset trigger; one of landing_page | email_flow | social_post | blog_article
 *   - asset_id (optional) — regenerate a specific existing asset (passes its current version)
 *   - notes (optional) — free-form instructions to forward to Forge
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const { client_id, campaign_id, asset_type, asset_id, notes } = body || {};

    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const forgeUrl = Deno.env.get("FORGE_WEBHOOK_URL");
    const forgeSecret =
      Deno.env.get("FORGE_WEBHOOK_SECRET") || Deno.env.get("BRIEFER_WEBHOOK_SECRET");

    if (!forgeUrl) {
      return new Response(
        JSON.stringify({
          error:
            "FORGE_WEBHOOK_URL not configured. Add it as a secret to enable Forge generation.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Forge requires client_id + asset_type + asset_name on every call.
    // Build one or more payloads (fan-out for campaign batches).
    const ASSET_TYPES = ["landing_page", "email_flow", "social_post", "blog_article"] as const;

    let existingAsset: any = null;
    if (asset_id) {
      const { data } = await supabase
        .from("assets")
        .select("asset_name, asset_type, version, campaign_id")
        .eq("id", asset_id)
        .maybeSingle();
      existingAsset = data;
    }

    let campaignName: string | null = null;
    if (campaign_id) {
      const { data } = await supabase
        .from("campaigns")
        .select("name")
        .eq("id", campaign_id)
        .maybeSingle();
      campaignName = data?.name ?? null;
    }

    const buildAssetName = (type: string) => {
      const base = campaignName || "Asset";
      const label = type.replace(/_/g, " ");
      return `${base} - ${label}`;
    };

    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-receiver`;
    const requestedAt = new Date().toISOString();

    type ForgePayload = {
      action: string;
      client_id: string;
      campaign_id: string | null;
      asset_type: string;
      asset_name: string;
      asset_id: string | null;
      version?: number;
      notes: string | null;
      callback_url: string;
      requested_at: string;
    };

    const payloads: ForgePayload[] = [];

    if (asset_id && existingAsset) {
      payloads.push({
        action: "regenerate_asset",
        client_id,
        campaign_id: existingAsset.campaign_id ?? campaign_id ?? null,
        asset_type: existingAsset.asset_type,
        asset_name: existingAsset.asset_name,
        asset_id,
        version: (existingAsset.version ?? 1) + 1,
        notes: notes || null,
        callback_url: callbackUrl,
        requested_at: requestedAt,
      });
    } else if (campaign_id && !asset_type) {
      // Fan out: one call per asset type
      for (const t of ASSET_TYPES) {
        payloads.push({
          action: "generate_single_asset",
          client_id,
          campaign_id,
          asset_type: t,
          asset_name: buildAssetName(t),
          asset_id: null,
          notes: notes || null,
          callback_url: callbackUrl,
          requested_at: requestedAt,
        });
      }
    } else {
      const t = asset_type || "landing_page";
      payloads.push({
        action: "generate_single_asset",
        client_id,
        campaign_id: campaign_id || null,
        asset_type: t,
        asset_name: buildAssetName(t),
        asset_id: null,
        notes: notes || null,
        callback_url: callbackUrl,
        requested_at: requestedAt,
      });
    }

    // Log outbound webhook
    const { data: logRow } = await supabase
      .from("webhook_log")
      .insert({
        direction: "out",
        event_type: payload.action,
        payload,
        status: "sending",
      })
      .select("id")
      .maybeSingle();

    let forgeResponse: Response;
    try {
      forgeResponse = await fetch(forgeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(forgeSecret ? { "x-pragma-secret": forgeSecret } : {}),
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchErr: any) {
      if (logRow?.id) {
        await supabase
          .from("webhook_log")
          .update({ status: "error", error: String(fetchErr.message || fetchErr) })
          .eq("id", logRow.id);
      }
      return new Response(
        JSON.stringify({ error: `Failed to reach Forge: ${fetchErr.message || fetchErr}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const responseText = await forgeResponse.text();
    const ok = forgeResponse.ok;

    if (logRow?.id) {
      await supabase
        .from("webhook_log")
        .update({
          status: ok ? "sent" : "error",
          error: ok ? null : `Forge ${forgeResponse.status}: ${responseText.slice(0, 500)}`,
        })
        .eq("id", logRow.id);
    }

    if (!ok) {
      return new Response(
        JSON.stringify({
          error: `Forge returned ${forgeResponse.status}`,
          detail: responseText.slice(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Generation triggered. Forge will deliver assets via webhook.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("trigger-forge-generation error:", err);
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
