import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateRandomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, password, role, send_welcome } = await req.json();
    if (!email || !role) throw new Error("email and role required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const APP_URL = Deno.env.get("APP_URL") || "https://pragma-brief-flow.lovable.app";

    const finalPassword = password || generateRandomPassword();
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: finalPassword,
      email_confirm: true,
    });
    if (userError) throw userError;

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userData.user.id,
      role,
    });
    if (roleError) throw roleError;

    // Optional welcome email with set-password link (clients only by default)
    if (send_welcome !== false && role === "client") {
      try {
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: `${APP_URL}/update-password` },
        });
        const setPasswordUrl = linkData?.properties?.action_link || `${APP_URL}/login`;
        await supabaseAdmin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "client-welcome",
            recipientEmail: email,
            idempotencyKey: `client-welcome-${userData.user.id}`,
            templateData: { setPasswordUrl, appUrl: APP_URL },
          },
        });
      } catch (e) {
        console.error("welcome email error:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: userData.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
