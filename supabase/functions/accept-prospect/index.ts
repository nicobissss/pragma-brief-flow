import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prospect_id } = await req.json();
    if (!prospect_id) throw new Error("prospect_id is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch prospect
    const { data: prospect, error: pErr } = await supabaseAdmin
      .from("prospects")
      .select("*")
      .eq("id", prospect_id)
      .single();

    if (pErr || !prospect) throw new Error("Prospect not found");
    if (prospect.status === "accepted") throw new Error("Prospect already accepted");

    // 2. Check if client already exists for this prospect
    const { data: existingClient } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("prospect_id", prospect_id)
      .maybeSingle();

    if (existingClient) throw new Error("Client already exists for this prospect");

    // 3. Create auth user via invite (sends email with magic link)
    const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      prospect.email,
      { data: { full_name: prospect.name, company: prospect.company_name } }
    );

    if (inviteErr) {
      // If user already exists, try to get them
      if (inviteErr.message?.includes("already been registered") || inviteErr.message?.includes("already exists")) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.find((u: any) => u.email === prospect.email);
        if (!existingUser) throw new Error("User exists but could not be found");
        
        // Use existing user
        const userId = existingUser.id;

        // Ensure role exists
        await supabaseAdmin.from("user_roles").upsert(
          { user_id: userId, role: "client" },
          { onConflict: "user_id,role" }
        );

        // Create client record
        const { data: client, error: clientErr } = await supabaseAdmin.from("clients").insert({
          name: prospect.name,
          company_name: prospect.company_name,
          email: prospect.email,
          market: prospect.market,
          vertical: prospect.vertical,
          sub_niche: prospect.sub_niche,
          prospect_id: prospect.id,
          user_id: userId,
          status: "active",
        }).select("id").single();

        if (clientErr) throw clientErr;

        // Update prospect status
        await supabaseAdmin.from("prospects").update({ status: "accepted" }).eq("id", prospect_id);

        return new Response(JSON.stringify({ success: true, client_id: client.id, user_id: userId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw inviteErr;
    }

    const userId = inviteData.user.id;

    // 4. Assign client role
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "client",
    });

    if (roleErr) console.error("Role assignment error:", roleErr);

    // 5. Create client record
    const { data: client, error: clientErr } = await supabaseAdmin.from("clients").insert({
      name: prospect.name,
      company_name: prospect.company_name,
      email: prospect.email,
      market: prospect.market,
      vertical: prospect.vertical,
      sub_niche: prospect.sub_niche,
      prospect_id: prospect.id,
      user_id: userId,
      status: "active",
    }).select("id").single();

    if (clientErr) throw clientErr;

    // 6. Update prospect status
    await supabaseAdmin.from("prospects").update({ status: "accepted" }).eq("id", prospect_id);

    return new Response(JSON.stringify({ success: true, client_id: client.id, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("accept-prospect error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
