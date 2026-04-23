import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Syncs files uploaded by the client in /client/collect into the kickoff_briefs.client_materials
 * structure so the AI can pick them up. Each synced item is stored in `client_uploads[]` with
 * `source: "client_upload"` and `use_for_ai: true` by default. The admin can later toggle
 * `use_for_ai` from ClientMaterials.tsx — items with `use_for_ai === false` are filtered out
 * by the asset generation functions.
 *
 * Body: { client_id: string }
 * Idempotent: items are de-duplicated by file_url.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id } = await req.json();
    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch all asset requests for this client
    const { data: requests, error: reqErr } = await supabase
      .from("client_asset_requests")
      .select("id, requested_items")
      .eq("client_id", client_id);
    if (reqErr) throw reqErr;

    // Collect uploaded items
    const uploaded: Array<{ url: string; label: string; type_hint: string; text_response?: string }> = [];
    for (const r of requests || []) {
      const items = (r.requested_items || []) as any[];
      for (const it of items) {
        if (it.status === "uploaded") {
          if (it.file_url) {
            uploaded.push({
              url: it.file_url,
              label: it.label || "Archivo del cliente",
              type_hint: it.type_hint || "Any file",
            });
          } else if (it.text_response) {
            uploaded.push({
              url: "",
              label: it.label || "Respuesta del cliente",
              type_hint: "Text",
              text_response: it.text_response,
            });
          }
        }
      }
    }

    // Fetch (or create) the kickoff_briefs row
    const { data: kickoff } = await supabase
      .from("kickoff_briefs")
      .select("id, client_materials")
      .eq("client_id", client_id)
      .maybeSingle();

    const cm: any = (kickoff?.client_materials as any) || {};
    const existing: any[] = Array.isArray(cm.client_uploads) ? cm.client_uploads : [];

    // Merge: preserve admin choices for items already present (matched by url or label+text)
    const merged: any[] = [];
    for (const u of uploaded) {
      const key = u.url || `text:${u.label}`;
      const prev = existing.find((e) =>
        (u.url && e.url === u.url) ||
        (!u.url && e.text_response === u.text_response && e.label === u.label),
      );
      merged.push({
        url: u.url,
        label: u.label,
        type_hint: u.type_hint,
        text_response: u.text_response,
        source: "client_upload",
        use_for_ai: prev ? prev.use_for_ai !== false : true,
        synced_at: prev?.synced_at || new Date().toISOString(),
        _key: key,
      });
    }
    // Drop the helper key
    merged.forEach((m) => delete m._key);

    const newCM = { ...cm, client_uploads: merged };

    if (kickoff) {
      await supabase.from("kickoff_briefs")
        .update({ client_materials: newCM })
        .eq("id", kickoff.id);
    } else {
      await supabase.from("kickoff_briefs")
        .insert({ client_id, client_materials: newCM });
    }

    return new Response(JSON.stringify({ ok: true, synced: merged.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-client-uploads-to-materials error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
