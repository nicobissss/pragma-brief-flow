import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

type AssetType = "landing_page" | "email_flow" | "social_post" | "blog_article";
const ALL_TYPES: AssetType[] = ["landing_page", "email_flow", "social_post", "blog_article"];

// ---------- Prompt builders ----------

function languageFor(market: string | null | undefined): { lang: string; instruction: string } {
  if (market === "IT") return { lang: "italiano", instruction: "Scrivi TUTTO in italiano naturale, professionale, mai tradotto letteralmente." };
  return { lang: "español", instruction: "Escribe TODO en español natural y profesional, nunca traducido literalmente." };
}

function buildContextBlock(ctx: any): string {
  const c = ctx.client || {};
  const k = ctx.kickoff_brief || {};
  const rules: any[] = ctx.client_rules || k.client_rules || [];
  const offerings: any[] = ctx.client_offerings || [];
  const patterns: any[] = ctx.winning_patterns || [];
  const camp = ctx.target_campaign;

  const lines: string[] = [];
  lines.push(`# CLIENTE`);
  lines.push(`Nombre/Marca: ${c.company_name || c.name}`);
  lines.push(`Vertical: ${c.vertical} · Sub-niche: ${c.sub_niche}`);
  if (c.city) lines.push(`Ciudad: ${c.city}`);
  if (c.website_url) lines.push(`Web: ${c.website_url}`);
  lines.push(`Mercado: ${c.market}`);

  if (k.voice_reference) {
    lines.push(`\n# VOZ DE MARCA (replicar este tono)`);
    lines.push(k.voice_reference.slice(0, 2000));
  }
  if (k.preferred_tone) lines.push(`Tono preferido: ${k.preferred_tone}`);

  if (rules.length) {
    lines.push(`\n# REGLAS DEL CLIENTE (obligatorias)`);
    rules.forEach((r: any, i: number) => {
      const txt = typeof r === "string" ? r : (r.rule || r.text || JSON.stringify(r));
      lines.push(`${i + 1}. ${txt}`);
    });
  }

  if (offerings.length) {
    lines.push(`\n# OFERTA / SERVICIOS DEL CLIENTE`);
    offerings.slice(0, 6).forEach((o: any) => {
      const t = o.offering_template || {};
      lines.push(`- ${o.custom_name || t.name || t.short_name} — ${t.value_proposition || t.description || ""}`);
    });
  }

  if (patterns.length) {
    lines.push(`\n# PATRONES GANADORES (lo que ya funcionó)`);
    patterns.slice(0, 5).forEach((p: any, i: number) => {
      lines.push(`${i + 1}. [${p.asset_type || "general"}] ${p.source_label || ""} — ${(p.source_content || "").slice(0, 300)}`);
    });
  }

  if (camp) {
    lines.push(`\n# CAMPAÑA OBJETIVO`);
    lines.push(`Nombre: ${camp.name}`);
    if (camp.objective) lines.push(`Objetivo: ${camp.objective}`);
    if (camp.target_audience) lines.push(`Audiencia: ${camp.target_audience}`);
    if (camp.key_message) lines.push(`Mensaje clave: ${camp.key_message}`);
    if (camp.timeline) lines.push(`Timeline: ${camp.timeline}`);
  }

  const mats: any[] = ctx.selected_materials || [];
  if (mats.length) {
    lines.push(`\n# MATERIALES DEL CLIENTE A USAR EN ESTA CAMPAÑA`);
    mats.forEach((m: any, i: number) => {
      const parts = [`${i + 1}. [${m.material_type}] ${m.material_label}`];
      if (m.material_url) parts.push(`URL: ${m.material_url}`);
      if (m.usage_hint) parts.push(`→ Uso: ${m.usage_hint}`);
      lines.push(parts.join(" | "));
    });
    lines.push(`Referencia estos materiales explícitamente cuando sea relevante (ej: "usar foto X en el hero", "aplicar color primario en CTAs").`);
  }

  return lines.join("\n");
}

function getToolSchema(assetType: AssetType): any {
  switch (assetType) {
    case "landing_page":
      return {
        name: "deliver_landing_page",
        description: "Entrega una landing page de alta conversión",
        parameters: {
          type: "object",
          properties: {
            meta: {
              type: "object",
              properties: {
                seo_title: { type: "string", description: "Max 60 caracteres" },
                seo_description: { type: "string", description: "Max 160 caracteres" },
              },
              required: ["seo_title", "seo_description"],
            },
            hero: {
              type: "object",
              properties: {
                headline: { type: "string", description: "Promesa clara, máximo 12 palabras" },
                subheadline: { type: "string", description: "1-2 frases que amplían el valor" },
                cta_primary: { type: "string", description: "Texto del botón, máximo 4 palabras" },
                trust_badges: { type: "array", items: { type: "string" }, description: "3-5 elementos de prueba (años exp, pacientes, etc)" },
              },
              required: ["headline", "subheadline", "cta_primary"],
            },
            problem_section: {
              type: "object",
              properties: {
                title: { type: "string" },
                pain_points: { type: "array", items: { type: "string" }, description: "3-4 dolores específicos del avatar" },
              },
              required: ["title", "pain_points"],
            },
            solution_section: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                benefits: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      icon_hint: { type: "string", description: "Lucide icon name (ej: 'Heart', 'Clock', 'Shield')" },
                      title: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["icon_hint", "title", "description"],
                  },
                  description: "Exactamente 3 beneficios",
                },
              },
              required: ["title", "description", "benefits"],
            },
            social_proof: {
              type: "object",
              properties: {
                title: { type: "string" },
                testimonials: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      quote: { type: "string" },
                      author: { type: "string" },
                      detail: { type: "string", description: "Edad/profesión/contexto" },
                    },
                    required: ["quote", "author", "detail"],
                  },
                  description: "2-3 testimonios realistas (marcados como [PLACEHOLDER] si inventados)",
                },
              },
              required: ["title", "testimonials"],
            },
            offer_section: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                bullets: { type: "array", items: { type: "string" } },
                cta: { type: "string" },
                urgency: { type: "string", description: "Escasez/urgencia genuina" },
              },
              required: ["title", "description", "bullets", "cta"],
            },
            faq: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  q: { type: "string" },
                  a: { type: "string" },
                },
                required: ["q", "a"],
              },
              description: "4-6 FAQs reales",
            },
            final_cta: {
              type: "object",
              properties: {
                headline: { type: "string" },
                button: { type: "string" },
                reassurance: { type: "string", description: "Línea bajo el botón (ej: 'Sin compromiso · Respuesta en 24h')" },
              },
              required: ["headline", "button", "reassurance"],
            },
          },
          required: ["meta", "hero", "problem_section", "solution_section", "social_proof", "offer_section", "faq", "final_cta"],
        },
      };

    case "email_flow":
      return {
        name: "deliver_email_flow",
        description: "Entrega una secuencia de 3 emails",
        parameters: {
          type: "object",
          properties: {
            flow_name: { type: "string" },
            flow_objective: { type: "string" },
            target_segment: { type: "string", description: "A quién va (ej: pacientes que no vuelven hace 6+ meses)" },
            emails: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day_offset: { type: "integer", description: "Día desde el inicio del flow (0, 3, 7…)" },
                  subject: { type: "string", description: "Max 50 caracteres, sin clickbait" },
                  preview_text: { type: "string", description: "Max 90 caracteres, complementa el subject" },
                  body_markdown: { type: "string", description: "Email completo en markdown, 120-220 palabras, conversacional, con un único CTA claro" },
                  cta_text: { type: "string" },
                  cta_purpose: { type: "string", description: "Qué acción debe disparar (reservar, llamar, responder…)" },
                },
                required: ["day_offset", "subject", "preview_text", "body_markdown", "cta_text", "cta_purpose"],
              },
              description: "Exactamente 3 emails progresivos",
            },
            success_metric: { type: "string", description: "Cómo medir si el flow funciona" },
          },
          required: ["flow_name", "flow_objective", "target_segment", "emails", "success_metric"],
        },
      };

    case "social_post":
      return {
        name: "deliver_social_post",
        description: "Entrega un post para Instagram/Facebook",
        parameters: {
          type: "object",
          properties: {
            platform: { type: "string", enum: ["instagram", "facebook", "both"] },
            format: { type: "string", enum: ["single_image", "carousel", "reel_script"] },
            hook: { type: "string", description: "Primera línea / scroll-stopper, max 12 palabras" },
            caption: { type: "string", description: "Caption completo, 80-180 palabras, con saltos de línea" },
            hashtags: { type: "array", items: { type: "string" }, description: "8-12 hashtags relevantes (sin #)" },
            cta: { type: "string" },
            visual_brief: { type: "string", description: "Descripción detallada de la imagen/video que el diseñador debe crear" },
            carousel_slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slide_number: { type: "integer" },
                  headline: { type: "string" },
                  body: { type: "string" },
                },
                required: ["slide_number", "headline", "body"],
              },
              description: "Solo si format=carousel: 5-8 slides",
            },
          },
          required: ["platform", "format", "hook", "caption", "hashtags", "cta", "visual_brief"],
        },
      };

    case "blog_article":
      return {
        name: "deliver_blog_article",
        description: "Entrega un artículo de blog SEO",
        parameters: {
          type: "object",
          properties: {
            seo_title: { type: "string", description: "Max 60 caracteres con palabra clave" },
            seo_description: { type: "string", description: "Max 160 caracteres" },
            slug: { type: "string", description: "URL slug en kebab-case" },
            target_keyword: { type: "string" },
            secondary_keywords: { type: "array", items: { type: "string" } },
            h1: { type: "string" },
            intro: { type: "string", description: "Párrafo de apertura que enganche, 80-120 palabras" },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  h2: { type: "string" },
                  body_markdown: { type: "string", description: "Cuerpo de la sección en markdown, 150-300 palabras" },
                },
                required: ["h2", "body_markdown"],
              },
              description: "4-6 secciones",
            },
            conclusion: { type: "string", description: "Cierre + CTA al servicio del cliente, 80-120 palabras" },
            internal_link_suggestions: { type: "array", items: { type: "string" } },
          },
          required: ["seo_title", "seo_description", "slug", "target_keyword", "h1", "intro", "sections", "conclusion"],
        },
      };
  }
}

function getInstructions(assetType: AssetType, lang: string): string {
  const base = `${lang === "italiano" ? "Scrivi" : "Escribe"} con voz humana, específica del cliente, evitando clichés genéricos de marketing. Usa la voz de marca y respeta TODAS las reglas del cliente.`;
  switch (assetType) {
    case "landing_page":
      return `${base} Construye una landing de alta conversión orientada a la acción concreta del cliente. Cada sección debe tener un propósito persuasivo claro. Si inventas datos sociales (números, testimonios), márcalos con [PLACEHOLDER] para que el equipo los reemplace.`;
    case "email_flow":
      return `${base} Diseña un flow de 3 emails progresivo: el primero abre con valor (no venta), el segundo profundiza en el problema/solución, el tercero hace la oferta clara con urgencia genuina. Subjects cortos, sin clickbait. Cada email debe tener UN solo CTA.`;
    case "social_post":
      return `${base} Hook potente en la primera línea (regla del scroll). Caption conversacional, no corporativo. Visual brief lo más concreto posible para que el diseñador no tenga dudas.`;
    case "blog_article":
      return `${base} Artículo SEO útil de verdad (no relleno). Estructura escaneable, ejemplos concretos, datos cuando aporten. Cierre con CTA natural al servicio del cliente.`;
  }
}

// ---------- Context loader ----------

async function loadContext(supabase: any, clientId: string, campaignId: string | null) {
  const [clientRes, kickoffRes, offeringsRes, platformsRes, patternsRes, rulesRes, kbRes, campRes, matsRes] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
    supabase.from("kickoff_briefs").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("client_offerings").select("*, offering_template:offering_templates(*)").eq("client_id", clientId),
    supabase.from("client_platforms").select("*, platform:supported_platforms(*)").eq("client_id", clientId),
    supabase.from("client_winning_patterns").select("*").eq("client_id", clientId),
    supabase.from("pragma_rules").select("*").eq("is_active", true),
    supabase.from("knowledge_base").select("*"),
    campaignId ? supabase.from("campaigns").select("*").eq("id", campaignId).maybeSingle() : Promise.resolve({ data: null }),
    campaignId ? supabase.from("campaign_materials").select("*").eq("campaign_id", campaignId).eq("selected", true) : Promise.resolve({ data: [] }),
  ]);

  const client = clientRes.data;
  if (!client) throw new Error(`Client ${clientId} not found`);
  const kickoff = kickoffRes.data;

  const pragma_rules = (rulesRes.data || []).filter(
    (r: any) => !r.applies_to_vertical || r.applies_to_vertical === client.vertical,
  );

  return {
    client,
    kickoff_brief: kickoff,
    voice_reference: kickoff?.voice_reference,
    preferred_tone: kickoff?.preferred_tone,
    client_rules: kickoff?.client_rules || [],
    client_offerings: offeringsRes.data || [],
    client_platforms: platformsRes.data || [],
    winning_patterns: patternsRes.data || [],
    pragma_rules,
    knowledge_base: kbRes.data || [],
    target_campaign: campRes.data,
    selected_materials: matsRes.data || [],
  };
}

// ---------- AI call ----------

function getErrorMessage(status: number, fallback?: string) {
  if (status === 402) return "Crediti Lovable AI esauriti — aggiungi crediti in Settings → Workspace → Usage.";
  if (status === 429) return "Troppe richieste alla IA — aspetta qualche secondo e riprova.";
  return fallback || `Lovable AI error: ${status}`;
}

function errorResponse(payload: { error: string; code?: number; fallback?: boolean; results?: any[]; ok?: boolean; triggered?: number; total?: number; message?: string }) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callAI(systemPrompt: string, userPrompt: string, tool: any): Promise<any> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 8192,
      tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } }],
      tool_choice: { type: "function", function: { name: tool.name } },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    const err: any = new Error(getErrorMessage(res.status, txt.slice(0, 300)));
    err.status = res.status;
    err.raw = txt;
    throw err;
  }

  const data = await res.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("No tool_call returned by AI");
  return JSON.parse(call.function.arguments || "{}");
}

// ---------- Generate one asset ----------

async function generateOne(opts: {
  supabase: any;
  clientId: string;
  campaignId: string | null;
  assetType: AssetType;
  assetName: string;
  notes: string | null;
  context: any;
  contextBlock: string;
  langInstr: string;
  lang: string;
  existingAssetId?: string | null;
  existingVersion?: number;
  previousContent?: any;
}) {
  const tool = getToolSchema(opts.assetType);
  const instructions = getInstructions(opts.assetType, opts.lang);

  const systemPrompt = `Eres un copywriter senior de Pragma Marketers, especializado en ${opts.context.client.vertical} (sub-niche: ${opts.context.client.sub_niche}).
${opts.langInstr}

${instructions}

Devuelves SIEMPRE el resultado mediante la function call provista. Nunca respondas en texto libre.`;

  const userPrompt = `${opts.contextBlock}

# TIPO DE ASSET A GENERAR
${opts.assetType}

${opts.notes ? `# NOTAS / FEEDBACK A INCORPORAR\n${opts.notes}\n` : ""}
${opts.previousContent ? `# VERSIÓN ANTERIOR (para mejorar, no copiar)\n${JSON.stringify(opts.previousContent).slice(0, 3000)}\n` : ""}

Genera ahora el asset siguiendo el schema de la function call.`;

  const content = await callAI(systemPrompt, userPrompt, tool);

  if (opts.existingAssetId) {
    const { error } = await opts.supabase
      .from("assets")
      .update({
        content,
        version: (opts.existingVersion ?? 1) + 1,
        status: "pending_review",
        production_status: "ready",
        correction_prompt: opts.notes || null,
      })
      .eq("id", opts.existingAssetId);
    if (error) throw error;
    return { asset_id: opts.existingAssetId, version: (opts.existingVersion ?? 1) + 1 };
  } else {
    const { data, error } = await opts.supabase
      .from("assets")
      .insert({
        client_id: opts.clientId,
        campaign_id: opts.campaignId,
        asset_type: opts.assetType,
        asset_name: opts.assetName,
        content,
        version: 1,
        status: "pending_review",
        production_status: "ready",
        context_used: {
          model: MODEL,
          generated_at: new Date().toISOString(),
          has_voice: !!opts.context.voice_reference,
          rules_count: opts.context.client_rules?.length || 0,
        },
      })
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return { asset_id: data?.id, version: 1 };
  }
}

// ---------- HTTP entry ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { client_id, campaign_id, asset_type, asset_id, notes } = body || {};

    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const context = await loadContext(supabase, client_id, campaign_id || null);
    const { lang, instruction: langInstr } = languageFor(context.client.market);
    const contextBlock = buildContextBlock(context);
    const campaignName = context.target_campaign?.name || "Asset";

    if (asset_id) {
      const { data: existing } = await supabase
        .from("assets")
        .select("id, asset_type, asset_name, version, content, campaign_id")
        .eq("id", asset_id)
        .maybeSingle();
      if (!existing) {
        return new Response(JSON.stringify({ error: "asset_id not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const r = await generateOne({
          supabase, clientId: client_id, campaignId: existing.campaign_id, assetType: existing.asset_type as AssetType,
          assetName: existing.asset_name, notes: notes || null, context, contextBlock, langInstr, lang,
          existingAssetId: existing.id, existingVersion: existing.version, previousContent: existing.content,
        });
        return new Response(JSON.stringify({ ok: true, regenerated: true, ...r }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        console.error("generate-asset-internal regeneration error:", err);
        return errorResponse({
          ok: false,
          fallback: true,
          code: err?.status,
          error: err?.status ? getErrorMessage(err.status, String(err.message || err)) : String(err.message || err),
        });
      }
    }

    const types: AssetType[] = asset_type ? [asset_type as AssetType] : ALL_TYPES;

    const results = await Promise.allSettled(
      types.map((t) =>
        generateOne({
          supabase, clientId: client_id, campaignId: campaign_id || null, assetType: t,
          assetName: `${campaignName} - ${t.replace(/_/g, " ")}`,
          notes: notes || null, context, contextBlock, langInstr, lang,
        }),
      ),
    );

    const summary = results.map((r, i) => ({
      asset_type: types[i],
      ok: r.status === "fulfilled",
      code: r.status === "rejected" ? (r as any).reason?.status : undefined,
      ...(r.status === "fulfilled"
        ? r.value
        : { error: String((r as any).reason?.message || (r as any).reason) }),
    }));

    const anyOk = summary.some((s) => s.ok);
    if (!anyOk) {
      const firstCode = summary.find((s) => !s.ok)?.code;
      return errorResponse({
        ok: false,
        fallback: true,
        code: firstCode,
        triggered: 0,
        total: summary.length,
        results: summary,
        error: firstCode ? getErrorMessage(firstCode, "Generazione fallita per tutti gli asset.") : "Generazione fallita per tutti gli asset.",
        message: "Generazione fallita per tutti gli asset.",
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        triggered: summary.filter((s) => s.ok).length,
        total: summary.length,
        results: summary,
        message: `${summary.filter((s) => s.ok).length}/${summary.length} asset generati con Lovable AI (${MODEL}).`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("generate-asset-internal error:", err);
    return errorResponse({
      ok: false,
      fallback: true,
      code: err?.status,
      error: err?.status ? getErrorMessage(err.status, String(err.message || err)) : String(err.message || err),
    });
  }
});
