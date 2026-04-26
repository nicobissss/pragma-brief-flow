// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildClientContext } from "../_shared/build-client-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * dispatch-touchpoint
 *
 * Invocata SOLO da click umano dell'admin (mai automaticamente).
 * Risolve il master asset per il touchpoint, costruisce il payload standard
 * per il sub-tool esterno e fa POST al webhook registrato in sub_tool_registry.
 *
 * Body: { touchpoint_id: string }
 *
 * Comportamento attuale (Fase 1, stub):
 *   - Carica touchpoint, master risolto, contesto cliente, sub-tool registry.
 *   - Costruisce il payload standard contrattualizzato.
 *   - Se il sub-tool ha un webhook_url attivo: POSTa.
 *   - Altrimenti (caso normale a inizio: registry vuoto): non fallisce, marca
 *     lo stato a "dispatched" loggando il payload nel result_payload come
 *     "dry_run". Così l'admin può testare il flow end-to-end senza tool reali.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { touchpoint_id } = await req.json();
    if (!touchpoint_id) {
      return json({ error: "touchpoint_id required" }, 400);
    }

    // 1. Carica il touchpoint
    const { data: tp, error: tpErr } = await supabase
      .from("campaign_touchpoints")
      .select("*")
      .eq("id", touchpoint_id)
      .maybeSingle();
    if (tpErr || !tp) return json({ error: "touchpoint not found" }, 404);
    if (tp.status === "dispatched" || tp.status === "completed") {
      return json({ error: `touchpoint already ${tp.status}` }, 409);
    }

    // 2. Risolve master asset (specifico del nodo, oppure primary della campagna)
    let master: any = null;
    if (tp.master_asset_id) {
      const { data } = await supabase
        .from("campaign_master_assets")
        .select("*")
        .eq("id", tp.master_asset_id)
        .maybeSingle();
      master = data;
    }
    if (!master) {
      const { data } = await supabase
        .from("campaign_master_assets")
        .select("*")
        .eq("campaign_id", tp.campaign_id)
        .eq("is_primary", true)
        .maybeSingle();
      master = data;
    }
    if (!master || master.status !== "approved") {
      return json(
        { error: "no approved master asset available for this touchpoint" },
        412,
      );
    }

    // 3. Lista master disponibili (per consentire ai sub-tool di scegliere alternative)
    const { data: availableMasters } = await supabase
      .from("campaign_master_assets")
      .select("id, label, is_primary, visual_preview_url, status")
      .eq("campaign_id", tp.campaign_id)
      .eq("status", "approved");

    // 4. Sub-tool registrato per questa key (può non esistere ancora)
    let subTool: any = null;
    if (tp.sub_tool_key) {
      const { data } = await supabase
        .from("sub_tool_registry")
        .select("*")
        .eq("key", tp.sub_tool_key)
        .eq("is_active", true)
        .maybeSingle();
      subTool = data;
    }

    // 5. Contesto completo cliente
    const context = await buildClientContext(supabase, {
      client_id: tp.client_id,
      campaign_id: tp.campaign_id,
    });

    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-receiver`;

    const payload = {
      action: "execute_touchpoint",
      touchpoint_id: tp.id,
      campaign_id: tp.campaign_id,
      client_id: tp.client_id,
      callback_url: callbackUrl,
      master_asset: {
        id: master.id,
        label: master.label,
        version: master.version,
        brand_kit: master.brand_kit,
        visual_layout: master.visual_layout,
        visual_preview_url: master.visual_preview_url,
        source_image_url: master.source_image_url,
      },
      available_masters: availableMasters || [],
      touchpoint_brief: {
        flow_node_id: tp.flow_node_id,
        channel: tp.channel,
        sub_tool_key: tp.sub_tool_key,
        week: tp.week,
        brief: tp.brief,
      },
      campaign_context: {
        name: context.target_campaign?.name,
        objective: context.target_campaign?.objective,
        audience: context.target_campaign?.target_audience,
        key_message: context.target_campaign?.key_message,
        timeline: context.target_campaign?.timeline,
        offering: context.target_offering
          ? {
              code: context.target_offering.offering_template?.code,
              name: context.target_offering.offering_template?.name,
              deliverables: context.target_offering.offering_template?.deliverables,
            }
          : null,
      },
      client_full_context: {
        client: context.client,
        kickoff: context.kickoff_brief,
        voice_reference: context.voice_reference,
        preferred_tone: context.preferred_tone,
        client_rules: context.client_rules,
        client_materials: context.client_materials,
        winning_patterns: context.winning_patterns,
        client_offerings: context.client_offerings,
        client_platforms: context.client_platforms,
        pragma_rules: context.pragma_rules,
        knowledge_base: context.knowledge_base,
      },
    };

    // 6. Dispatch effettivo o dry-run
    let dispatchResult: any = { mode: "dry_run", note: "no active sub-tool registered" };
    if (subTool?.webhook_url) {
      const secret = subTool.secret_name ? Deno.env.get(subTool.secret_name) : null;
      try {
        const res = await fetch(subTool.webhook_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(secret ? { "x-pragma-secret": secret } : {}),
          },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        dispatchResult = {
          mode: "live",
          status: res.status,
          ok: res.ok,
          response: text.slice(0, 1000),
        };
        if (!res.ok) {
          await supabase
            .from("campaign_touchpoints")
            .update({
              status: "failed",
              error: `Sub-tool ${subTool.key} returned ${res.status}: ${text.slice(0, 300)}`,
              result_payload: { dispatch: dispatchResult },
            })
            .eq("id", tp.id);
          return json({ ok: false, dispatch: dispatchResult }, 502);
        }
      } catch (e: any) {
        await supabase
          .from("campaign_touchpoints")
          .update({
            status: "failed",
            error: `Sub-tool ${subTool.key} unreachable: ${e.message}`,
          })
          .eq("id", tp.id);
        return json({ ok: false, error: e.message }, 502);
      }
    }

    // 7. Marca dispatched
    await supabase
      .from("campaign_touchpoints")
      .update({
        status: "dispatched",
        dispatched_at: new Date().toISOString(),
        result_payload: { dispatch: dispatchResult, payload_sent: payload },
      })
      .eq("id", tp.id);

    return json({ ok: true, touchpoint_id: tp.id, dispatch: dispatchResult });
  } catch (err: any) {
    console.error("dispatch-touchpoint error:", err);
    return json({ error: String(err.message || err) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
