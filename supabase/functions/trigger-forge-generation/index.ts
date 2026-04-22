import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Triggers asset generation in Forge by sending a webhook with the FULL client
 * context bundled in the payload. Forge no longer needs DB access — it consumes
 * the payload and POSTs results back to `webhook-receiver` (action: "asset_generated").
 *
 * Body:
 *   - client_id (required)
 *   - campaign_id (optional)
 *   - asset_type (optional) — landing_page | email_flow | social_post | blog_article
 *   - asset_id (optional) — regenerate a specific existing asset
 *   - notes (optional)
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

    // ---------------------------------------------------------------------
    // 1. Fetch FULL client context bundle (parallel reads)
    // ---------------------------------------------------------------------
    const [
      clientRes,
      kickoffRes,
      campaignsRes,
      offeringsRes,
      platformsRes,
      patternsRes,
      pragmaRulesRes,
      knowledgeRes,
      existingAssetRes,
      campaignRes,
    ] = await Promise.all([
      supabase.from("clients").select("*").eq("id", client_id).maybeSingle(),
      supabase.from("kickoff_briefs").select("*").eq("client_id", client_id).maybeSingle(),
      supabase.from("campaigns").select("*").eq("client_id", client_id),
      supabase
        .from("client_offerings")
        .select("*, offering_template:offering_templates(*)")
        .eq("client_id", client_id),
      supabase
        .from("client_platforms")
        .select("*, platform:supported_platforms(*)")
        .eq("client_id", client_id),
      supabase.from("client_winning_patterns").select("*").eq("client_id", client_id),
      supabase.from("pragma_rules").select("*").eq("is_active", true),
      supabase.from("knowledge_base").select("*"),
      asset_id
        ? supabase
            .from("assets")
            .select("asset_name, asset_type, version, campaign_id, content")
            .eq("id", asset_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      campaign_id
        ? supabase.from("campaigns").select("*").eq("id", campaign_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const client = clientRes.data;
    if (!client) {
      return new Response(JSON.stringify({ error: `client_id ${client_id} not found` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const kickoff = kickoffRes.data;
    const existingAsset = existingAssetRes.data;
    const targetCampaign = campaignRes.data;
    const campaignName = targetCampaign?.name ?? null;

    // Filter pragma_rules by client vertical
    const pragmaRules = (pragmaRulesRes.data || []).filter(
      (r: any) => !r.applies_to_vertical || r.applies_to_vertical === client.vertical,
    );

    const contextBundle = {
      client,
      kickoff_brief: kickoff || null,
      voice_reference: kickoff?.voice_reference || null,
      preferred_tone: kickoff?.preferred_tone || null,
      client_rules: kickoff?.client_rules || [],
      client_materials: kickoff?.client_materials || {},
      transcript_text: kickoff?.transcript_text || null,
      campaigns: campaignsRes.data || [],
      target_campaign: targetCampaign,
      client_offerings: offeringsRes.data || [],
      client_platforms: platformsRes.data || [],
      winning_patterns: patternsRes.data || [],
      pragma_rules: pragmaRules,
      knowledge_base: knowledgeRes.data || [],
    };

    // ---------------------------------------------------------------------
    // 2. Build payloads (single asset, regeneration, or campaign fan-out)
    // ---------------------------------------------------------------------
    const ASSET_TYPES = ["landing_page", "email_flow", "social_post", "blog_article"] as const;

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
      previous_content?: any;
      notes: string | null;
      callback_url: string;
      requested_at: string;
      context: typeof contextBundle;
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
        previous_content: existingAsset.content,
        notes: notes || null,
        callback_url: callbackUrl,
        requested_at: requestedAt,
        context: contextBundle,
      });
    } else if (campaign_id && !asset_type) {
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
          context: contextBundle,
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
        context: contextBundle,
      });
    }

    // ---------------------------------------------------------------------
    // 3. Send to Forge (with logging — payload trimmed in log to avoid bloat)
    // ---------------------------------------------------------------------
    const results: Array<{ asset_type: string; ok: boolean; status?: number; error?: string }> = [];

    for (const payload of payloads) {
      const logPayload = {
        ...payload,
        context: {
          _summary: "full context bundle sent to Forge",
          client_id: payload.client_id,
          client_name: client.name,
          campaigns_count: contextBundle.campaigns.length,
          offerings_count: contextBundle.client_offerings.length,
          rules_count: contextBundle.client_rules.length,
          has_voice_reference: !!contextBundle.voice_reference,
          has_kickoff: !!contextBundle.kickoff_brief,
        },
      };

      const { data: logRow } = await supabase
        .from("webhook_log")
        .insert({
          direction: "out",
          event_type: payload.action,
          payload: logPayload,
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
        results.push({
          asset_type: payload.asset_type,
          ok: false,
          error: `Failed to reach Forge: ${fetchErr.message || fetchErr}`,
        });
        continue;
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

      results.push({
        asset_type: payload.asset_type,
        ok,
        status: forgeResponse.status,
        error: ok ? undefined : responseText.slice(0, 500),
      });
    }

    const anyOk = results.some((r) => r.ok);
    const allOk = results.every((r) => r.ok);

    return new Response(
      JSON.stringify({
        ok: anyOk,
        triggered: results.filter((r) => r.ok).length,
        total: results.length,
        results,
        message: allOk
          ? "Generation triggered with full context bundle. Forge will deliver assets via webhook."
          : "Some asset types failed to trigger.",
      }),
      {
        status: anyOk ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("trigger-forge-generation error:", err);
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
