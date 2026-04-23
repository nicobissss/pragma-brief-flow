import { callAI } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, system, max_tokens } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt is required" }), { status: 400, headers: corsHeaders });
    }

    const data = await callAI({ system, prompt, max_tokens: max_tokens || 1000, model: "google/gemini-2.5-flash" });
    const text = data.content?.find((b: any) => b.type === "text")?.text || "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("claude-proxy error:", e);
    const status = e?.status === 402 || e?.status === 429 ? e.status : 500;
    const message =
      e?.status === 402
        ? "Sin créditos de IA. Recarga en Settings → Workspace → Usage."
        : e?.status === 429
        ? "Demasiadas solicitudes a la IA. Espera unos segundos e inténtalo de nuevo."
        : e?.message || "Error desconocido";
    return new Response(JSON.stringify({ error: message, code: e?.status }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
