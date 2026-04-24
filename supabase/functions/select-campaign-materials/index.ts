import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Flatten kickoff_briefs.client_materials into a list of { ref, type, label, url }
function flattenMaterials(cm: any): Array<{ ref: string; type: string; label: string; url?: string }> {
  if (!cm || typeof cm !== "object") return [];
  const out: Array<{ ref: string; type: string; label: string; url?: string }> = [];

  if (cm.logo_url) out.push({ ref: "logo", type: "logo", label: "Logo de marca", url: cm.logo_url });
  if (cm.primary_color) out.push({ ref: "primary_color", type: "color", label: `Color primario: ${cm.primary_color}` });
  if (cm.secondary_color) out.push({ ref: "secondary_color", type: "color", label: `Color secundario: ${cm.secondary_color}` });
  if (Array.isArray(cm.brand_tags) && cm.brand_tags.length) out.push({ ref: "brand_tags", type: "brand", label: `Tags de marca: ${cm.brand_tags.join(", ")}` });

  (cm.photos || []).forEach((p: any, i: number) => {
    out.push({ ref: `photo_${i}`, type: "photo", label: p.description || `Foto ${i + 1}`, url: p.url });
  });
  if (cm.website_url) out.push({ ref: "website_url", type: "link", label: "Sitio web cliente", url: cm.website_url });
  if (cm.website_context) out.push({ ref: "website_context", type: "text", label: "Texto del sitio web (extraído)" });
  if (cm.pricing_pdf_url) out.push({ ref: "pricing_pdf", type: "document", label: "PDF de precios", url: cm.pricing_pdf_url });
  if (cm.pricing_pdf_text) out.push({ ref: "pricing_text", type: "text", label: "Precios extraídos" });
  (cm.email_files || []).forEach((e: any, i: number) => {
    out.push({ ref: `email_${i}`, type: "email_example", label: e.name || `Email ejemplo ${i + 1}`, url: e.url });
  });
  if (cm.email_text) out.push({ ref: "email_text", type: "text", label: "Email/copy de ejemplo" });
  (cm.social_posts || []).forEach((s: any, i: number) => {
    out.push({ ref: `social_${i}`, type: "social_post", label: s.caption?.slice(0, 80) || `Post social ${i + 1}`, url: s.url });
  });
  // Files uploaded by the client in /client/collect, synced via sync-client-uploads-to-materials.
  // Only include items the admin marked as use_for_ai !== false.
  (cm.client_uploads || []).forEach((u: any, i: number) => {
    if (u && u.use_for_ai !== false) {
      out.push({
        ref: `client_upload_${i}`,
        type: u.type_hint === "Text" ? "text" : "client_upload",
        label: u.label || `Archivo cliente ${i + 1}`,
        url: u.url || undefined,
      });
    }
  });

  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) throw new Error("campaign_id required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", campaign_id).maybeSingle();
    if (!campaign) throw new Error("Campaign not found");

    const { data: kickoff } = await supabase
      .from("kickoff_briefs")
      .select("client_materials")
      .eq("client_id", campaign.client_id)
      .maybeSingle();

    const materials = flattenMaterials(kickoff?.client_materials || {});
    if (materials.length === 0) {
      return new Response(JSON.stringify({ suggestions: [], message: "No hay materiales del cliente todavía." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Eres director creativo. Tienes esta campaña:

Nombre: ${campaign.name}
Objetivo: ${campaign.objective || "—"}
Audiencia: ${campaign.target_audience || "—"}
Mensaje clave: ${campaign.key_message || "—"}

Materiales disponibles del cliente:
${materials.map((m, i) => `${i + 1}. [${m.type}] ${m.label} (ref: ${m.ref})`).join("\n")}

Para CADA material decide si conviene usarlo en esta campaña y dónde/cómo. Responde SOLO con JSON:
{
  "suggestions": [
    { "ref": "<ref del material>", "selected": true|false, "usage_hint": "Explicación corta de dónde y cómo usarlo (ej: 'Foto del hero de la landing', 'Color primario en CTAs')" }
  ]
}

Sé selectivo: solo marca selected=true los que aporten valor real a esta campaña concreta.`;

    let result;
    try {
      result = await callAI({
        prompt: userPrompt,
        max_tokens: 1500,
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
      });
    } catch (e: any) {
      if (e.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (e.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    const textBlock = result.content?.find((b) => b.type === "text");
    const text = (textBlock && textBlock.type === "text" ? textBlock.text : "") || "";
    let parsed: any = {};
    try {
      const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const start = cleaned.search(/[\{\[]/);
      const end = cleaned.lastIndexOf("}");
      parsed = JSON.parse(cleaned.substring(start, end + 1));
    } catch {
      parsed = { suggestions: [] };
    }

    const suggestions: any[] = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    // Upsert suggestions into campaign_materials
    const rows = suggestions
      .map((s: any) => {
        const mat = materials.find((m) => m.ref === s.ref);
        if (!mat) return null;
        return {
          campaign_id,
          material_ref: mat.ref,
          material_type: mat.type,
          material_label: mat.label,
          material_url: mat.url || null,
          selected: !!s.selected,
          usage_hint: typeof s.usage_hint === "string" ? s.usage_hint : null,
          updated_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (rows.length > 0) {
      await supabase.from("campaign_materials").upsert(rows as any, { onConflict: "campaign_id,material_ref" });
    }

    return new Response(JSON.stringify({ suggestions, applied: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("select-campaign-materials error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
