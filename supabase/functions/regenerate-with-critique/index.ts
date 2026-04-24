import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Regenerates proposal (scope=prospect) or appends critique-driven instructions
 * into client_offerings.notes (scope=post_kickoff) so admins can iterate.
 *
 * Body: { report_id }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { report_id } = await req.json();
    if (!report_id) {
      return new Response(JSON.stringify({ error: "report_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: report } = await supabase
      .from("proposal_critique_reports")
      .select("*")
      .eq("id", report_id)
      .maybeSingle();
    if (!report) {
      return new Response(JSON.stringify({ error: "report not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build instruction block from high+medium recommendations
    const recs = ((report.recommendations as any[]) || []).filter(
      (r) => r.priority === "high" || r.priority === "medium"
    );
    const missing = (report.missing_elements as string[]) || [];
    const weaknesses = ((report.weaknesses as any[]) || []).filter(
      (w) => w.severity === "high" || w.severity === "medium"
    );

    const instructions = `# CRÍTICAS A INCORPORAR (${report.scope})
## Debilidades a resolver
${weaknesses.map((w) => `- [${w.severity}] ${w.area}: ${w.issue}`).join("\n") || "(ninguna)"}

## Elementos faltantes a añadir
${missing.map((m) => `- ${m}`).join("\n") || "(ninguno)"}

## Recomendaciones ejecutables (high/medium)
${recs.map((r, i) => `${i + 1}. [${r.priority}] ${r.section} → ${r.change}\n   Cómo: ${r.how}`).join("\n") || "(ninguna)"}

# REGLA
Aplica ESTAS críticas en la nueva versión. No vuelvas a cometer los mismos errores.`;

    if (report.scope === "prospect") {
      if (!report.prospect_id) {
        return new Response(JSON.stringify({ error: "report has no prospect_id" }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Trigger generate-proposal with critique instructions
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-proposal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
        body: JSON.stringify({
          prospect_id: report.prospect_id,
          extra_instructions: instructions,
          regenerated_from_critique: report_id,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return new Response(
          JSON.stringify({ error: data?.error || "generate-proposal failed", status: resp.status }),
          {
            status: resp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(JSON.stringify({ ok: true, regenerated: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // post_kickoff: append instructions to offering notes so admin sees what to revise.
    if (!report.client_offering_id) {
      return new Response(JSON.stringify({ error: "report has no client_offering_id" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: off } = await supabase
      .from("client_offerings")
      .select("notes")
      .eq("id", report.client_offering_id)
      .maybeSingle();

    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const newNotes = `${off?.notes ? off.notes + "\n\n" : ""}--- IA Critique ${stamp} ---\n${instructions}`;

    const { error: upErr } = await supabase
      .from("client_offerings")
      .update({ notes: newNotes })
      .eq("id", report.client_offering_id);
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Critique instructions appended to offering notes. Review & apply manually or re-run the agent after changes.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
