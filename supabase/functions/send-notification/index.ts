import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type NotificationType = "assets_ready" | "client_feedback" | "campaign_ready";

interface NotificationPayload {
  type: NotificationType;
  client_id: string;
  asset_type?: string;
  asset_name?: string;
  comment?: string;
  campaign_name?: string;
  asset_ids?: string[];
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  landing_page: "Landing Page",
  email_flow: "Email Flow",
  social_post: "Social Posts",
  blog_article: "Blog Articles",
};

async function sendEmail(to: string, subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PRAGMA <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", res.status, err);
    throw new Error(`Email send failed: ${res.status} - ${err}`);
  }

  return await res.json();
}

const APP_URL = "https://pragma-brief-flow.lovable.app";

function emailWrapper(content: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${content}
      <p style="color: #a0aec0; font-size: 12px; margin-top: 30px;">— PRAGMA Team</p>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload: NotificationPayload = await req.json();
    const { type, client_id, asset_type, asset_name, comment, campaign_name, asset_ids } = payload;

    if (!type || !client_id) throw new Error("type and client_id are required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch client info
    const { data: client, error: clientErr } = await supabaseAdmin
      .from("clients")
      .select("name, company_name, email")
      .eq("id", client_id)
      .single();

    if (clientErr || !client) throw new Error("Client not found");

    const typeLabel = ASSET_TYPE_LABELS[asset_type || ""] || asset_type || "assets";

    // ── assets_ready: notify client about a single asset ready for review ──
    if (type === "assets_ready") {
      const subject = `PRAGMA — New ${typeLabel} ready for your review`;
      const html = emailWrapper(`
        <h2 style="color: #1a365d;">Hi ${client.name},</h2>
        <p style="color: #4a5568; line-height: 1.6;">
          Your <strong>${typeLabel}</strong> ${asset_name ? `(${asset_name})` : ""} is ready for review.
        </p>
        <p style="color: #4a5568; line-height: 1.6;">
          Please log in to your dashboard to review and approve or request changes.
        </p>
        <div style="margin: 30px 0;">
          <a href="${APP_URL}/client/dashboard"
             style="background-color: #1a365d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
            Review Now
          </a>
        </div>
      `);

      await sendEmail(client.email, subject, html);

      // Log activity
      await supabaseAdmin.from("activity_log").insert({
        entity_type: "client",
        entity_id: client_id,
        entity_name: client.name,
        action: `notified about ${typeLabel}${asset_name ? ` (${asset_name})` : ""}`,
      });

      return new Response(JSON.stringify({ success: true, sent_to: client.email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── campaign_ready: notify client about a full campaign ready for review ──
    if (type === "campaign_ready") {
      // Fetch campaign assets for the email body
      let assetListHtml = "";
      if (campaign_name) {
        const { data: campaigns } = await supabaseAdmin
          .from("campaigns")
          .select("id")
          .eq("client_id", client_id)
          .eq("name", campaign_name)
          .limit(1);

        if (campaigns && campaigns.length > 0) {
          const { data: assets } = await supabaseAdmin
            .from("assets")
            .select("asset_name, asset_type")
            .eq("campaign_id", campaigns[0].id)
            .eq("status", "pending_review");

          if (assets && assets.length > 0) {
            assetListHtml = `
              <ul style="color: #4a5568; line-height: 1.8;">
                ${assets.map(a => `<li>${a.asset_name} (${ASSET_TYPE_LABELS[a.asset_type] || a.asset_type})</li>`).join("")}
              </ul>
            `;
          }
        }
      }

      const subject = `PRAGMA — Campaign "${campaign_name || "New campaign"}" is ready for review`;
      const html = emailWrapper(`
        <h2 style="color: #1a365d;">Hi ${client.name},</h2>
        <p style="color: #4a5568; line-height: 1.6;">
          Your campaign <strong>"${campaign_name || "New campaign"}"</strong> has assets ready for your review.
        </p>
        ${assetListHtml ? `<p style="color: #4a5568;">Assets to review:</p>${assetListHtml}` : ""}
        <p style="color: #4a5568; line-height: 1.6;">
          Please log in to your dashboard to review and approve or request changes.
        </p>
        <div style="margin: 30px 0;">
          <a href="${APP_URL}/client/dashboard"
             style="background-color: #1a365d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
            Review Campaign
          </a>
        </div>
      `);

      await sendEmail(client.email, subject, html);

      await supabaseAdmin.from("activity_log").insert({
        entity_type: "client",
        entity_id: client_id,
        entity_name: client.name,
        action: `notified about campaign "${campaign_name}"`,
      });

      return new Response(JSON.stringify({ success: true, sent_to: client.email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── client_feedback: notify admin that client submitted feedback ──
    if (type === "client_feedback") {
      const { data: adminRoles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "pragma_admin");

      if (!adminRoles || adminRoles.length === 0) throw new Error("No admins found");

      const adminEmails: string[] = [];
      for (const role of adminRoles) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(role.user_id);
        if (user?.email) adminEmails.push(user.email);
      }

      if (adminEmails.length === 0) throw new Error("No admin emails found");

      const subject = `Client feedback: ${client.company_name} — ${typeLabel}`;
      const html = emailWrapper(`
        <h2 style="color: #1a365d;">Client Feedback Received</h2>
        <p style="color: #4a5568; line-height: 1.6;">
          <strong>${client.name}</strong> (${client.company_name}) has submitted feedback on their <strong>${typeLabel}</strong>.
        </p>
        ${asset_name ? `<p style="color: #4a5568;"><strong>Asset:</strong> ${asset_name}</p>` : ""}
        ${comment ? `
          <div style="background: #f7fafc; border-left: 4px solid #e53e3e; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
            <p style="color: #2d3748; margin: 0; font-style: italic;">"${comment}"</p>
          </div>
        ` : ""}
        <p style="color: #4a5568; line-height: 1.6;">
          Log in to the admin panel to review and address the feedback.
        </p>
      `);

      for (const email of adminEmails) {
        await sendEmail(email, subject, html);
      }

      return new Response(JSON.stringify({ success: true, sent_to: adminEmails }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown notification type: ${type}`);
  } catch (e) {
    console.error("send-notification error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
