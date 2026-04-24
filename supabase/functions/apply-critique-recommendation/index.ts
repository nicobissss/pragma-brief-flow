import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Applies a single critique recommendation to its target.
 * Body: { report_id, recommendation_index, override_value? }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { report_id, recommendation_index, override_value } = await req.json();
    if (!report_id || typeof recommendation_index !== "number") {
      return new Response(
        JSON.stringify({ error: "report_id and recommendation_index required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: report, error: rErr } = await supabase
      .from("proposal_critique_reports")
      .select("*")
      .eq("id", report_id)
      .maybeSingle();
    if (rErr || !report) {
      return new Response(JSON.stringify({ error: "report not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recs = (report.recommendations as any[]) || [];
    const rec = recs[recommendation_index];
    if (!rec) {
      return new Response(JSON.stringify({ error: "recommendation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target: string | undefined = rec.target_field;
    if (!target) {
      return new Response(
        JSON.stringify({ error: "recommendation has no target_field; not auto-applicable" }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let newValue: any = override_value !== undefined ? override_value : rec.new_value;
    // AI sometimes returns objects serialized as JSON strings; parse defensively
    if (typeof newValue === "string") {
      const trimmed = newValue.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          newValue = JSON.parse(trimmed);
        } catch {
          // keep as string
        }
      }
    }
    if (newValue === undefined || newValue === null) {
      return new Response(
        JSON.stringify({ error: "no new_value provided in recommendation or override" }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let applied: any = null;
    let beforeValue: any = null;
    let afterValue: any = null;

    // PROPOSAL fields ------------------------------------------------------
    if (target.startsWith("proposal.")) {
      if (!report.proposal_id) {
        return new Response(JSON.stringify({ error: "report has no proposal_id" }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: proposal } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", report.proposal_id)
        .maybeSingle();
      if (!proposal) {
        return new Response(JSON.stringify({ error: "proposal not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const path = target.slice("proposal.".length);
      const update: any = {};

      if (path === "timeline" || path === "pragma_notes" || path === "recommended_flow") {
        beforeValue = (proposal as any)[path];
        update[path] = String(newValue);
        afterValue = update[path];
      } else if (path === "recommended_tools" || path === "pricing") {
        beforeValue = (proposal as any)[path];
        update[path] = newValue;
        afterValue = newValue;
      } else if (path.startsWith("full_proposal_content.")) {
        const sectionKey = path.slice("full_proposal_content.".length);
        const fpc = (proposal.full_proposal_content as any) || {};
        beforeValue = fpc[sectionKey] ?? null;
        fpc[sectionKey] = newValue;
        update.full_proposal_content = fpc;
        afterValue = newValue;
      } else if (path === "full_proposal_content") {
        beforeValue = proposal.full_proposal_content;
        update.full_proposal_content = newValue;
        afterValue = newValue;
      } else {
        return new Response(
          JSON.stringify({ error: `unsupported proposal target: ${path}` }),
          {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error: upErr } = await supabase
        .from("proposals")
        .update(update)
        .eq("id", report.proposal_id);
      if (upErr) throw upErr;
      applied = { entity: "proposal", id: report.proposal_id, fields: Object.keys(update), before: beforeValue, after: afterValue };
    }

    // OFFERING fields ------------------------------------------------------
    else if (target.startsWith("offering.")) {
      if (!report.client_offering_id) {
        return new Response(JSON.stringify({ error: "report has no client_offering_id" }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const path = target.slice("offering.".length);
      const update: any = {};
      if (path === "custom_name" || path === "notes") {
        update[path] = String(newValue);
      } else if (path === "custom_price_eur") {
        const n = typeof newValue === "number" ? newValue : parseInt(String(newValue), 10);
        if (Number.isNaN(n)) throw new Error("custom_price_eur must be a number");
        update.custom_price_eur = n;
      } else if (path === "custom_deliverables") {
        update.custom_deliverables = newValue;
      } else {
        return new Response(
          JSON.stringify({ error: `unsupported offering target: ${path}` }),
          {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const { error: upErr } = await supabase
        .from("client_offerings")
        .update(update)
        .eq("id", report.client_offering_id);
      if (upErr) throw upErr;
      applied = { entity: "offering", id: report.client_offering_id, fields: Object.keys(update) };
    }

    // TASK actions ---------------------------------------------------------
    else if (target === "task.add") {
      if (!report.client_offering_id) {
        return new Response(JSON.stringify({ error: "report has no client_offering_id" }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const v = (newValue && typeof newValue === "object") ? newValue : {};
      const { data: maxOrder } = await supabase
        .from("action_plan_tasks")
        .select("order_index")
        .eq("client_offering_id", report.client_offering_id)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: inserted, error: insErr } = await supabase
        .from("action_plan_tasks")
        .insert({
          client_offering_id: report.client_offering_id,
          title: v.title || "(sin título)",
          description: v.description || null,
          category: v.category || "setup",
          assignee: v.assignee || "admin",
          estimated_hours: v.estimated_hours || null,
          order_index: (maxOrder?.order_index ?? 0) + 1,
        })
        .select()
        .single();
      if (insErr) throw insErr;
      applied = { entity: "task", action: "add", id: inserted.id };
    } else if (target.startsWith("task.update.")) {
      // identify by index in current ordering
      const idxStr = target.slice("task.update.".length);
      const idx = parseInt(idxStr, 10);
      if (Number.isNaN(idx)) throw new Error("invalid task index");
      const { data: tasks } = await supabase
        .from("action_plan_tasks")
        .select("id")
        .eq("client_offering_id", report.client_offering_id)
        .order("order_index", { ascending: true });
      const target_task = (tasks || [])[idx - 1] || (tasks || [])[idx];
      if (!target_task) throw new Error("task not found at index " + idx);
      const v = (newValue && typeof newValue === "object") ? newValue : {};
      const update: any = {};
      ["title", "description", "category", "assignee", "estimated_hours", "due_date", "status"].forEach((k) => {
        if (k in v) update[k] = (v as any)[k];
      });
      const { error: upErr } = await supabase
        .from("action_plan_tasks")
        .update(update)
        .eq("id", target_task.id);
      if (upErr) throw upErr;
      applied = { entity: "task", action: "update", id: target_task.id, fields: Object.keys(update) };
    } else {
      return new Response(
        JSON.stringify({ error: `unsupported target_field: ${target}` }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Mark recommendation as applied in the report
    recs[recommendation_index] = { ...rec, applied: true, applied_at: new Date().toISOString() };
    await supabase
      .from("proposal_critique_reports")
      .update({ recommendations: recs })
      .eq("id", report_id);

    return new Response(JSON.stringify({ ok: true, applied }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
