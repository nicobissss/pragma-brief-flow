import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type NotificationType = "assets_ready" | "client_feedback" | "campaign_ready" | "asset_collection_request" | "client_welcome";

interface NotificationPayload {
  type: NotificationType;
  client_id: string;
  asset_type?: string;
  asset_name?: string;
  comment?: string;
  campaign_name?: string;
  asset_ids?: string[];
  requested_items?: { label: string; description?: string }[];
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

const APP_URL = Deno.env.get("APP_URL") || "https://pragma-brief-flow.lovable.app";

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
    const { type, client_id, asset_type, asset_name, comment, campaign_name, asset_ids, requested_items } = payload;

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
      let assetListHtml = "";
      let assetCount = 0;

      // If asset_ids provided, fetch those specific assets
      if (asset_ids && asset_ids.length > 0) {
        const { data: assets } = await supabaseAdmin
          .from("assets")
          .select("asset_name, asset_type")
          .in("id", asset_ids);

        if (assets && assets.length > 0) {
          assetCount = assets.length;
          assetListHtml = `
            <ul style="color: #4a5568; line-height: 1.8;">
              ${assets.map(a => `<li>${ASSET_TYPE_LABELS[a.asset_type] || a.asset_type}: ${a.asset_name}</li>`).join("")}
            </ul>
          `;
        }
      } else if (campaign_name) {
        // Fallback: fetch by campaign name
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
            assetCount = assets.length;
            assetListHtml = `
              <ul style="color: #4a5568; line-height: 1.8;">
                ${assets.map(a => `<li>${ASSET_TYPE_LABELS[a.asset_type] || a.asset_type}: ${a.asset_name}</li>`).join("")}
              </ul>
            `;
          }
        }
      }

      const subject = `New campaign ready for your review — ${campaign_name || "New campaign"}`;
      const html = emailWrapper(`
        <h2 style="color: #1a365d;">Hi ${client.name},</h2>
        <p style="color: #4a5568; line-height: 1.6;">
          Your <strong>${campaign_name || "New campaign"}</strong> campaign assets are ready for your review.
        </p>
        ${assetListHtml ? `<p style="color: #4a5568;">Please review and approve the following:</p>${assetListHtml}` : ""}
        <div style="margin: 30px 0;">
          <a href="${APP_URL}/client/dashboard"
             style="background-color: #1a365d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
            Review Campaign →
          </a>
        </div>
      `);

      await sendEmail(client.email, subject, html);

      return new Response(JSON.stringify({ success: true, sent_to: client.email, assets_included: assetCount }), {
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

    // ── asset_collection_request: ask client to upload files ──
    if (type === "asset_collection_request") {
      const itemsList = (requested_items || [])
        .map(i => `<li style="margin-bottom: 8px;"><strong>${i.label}</strong>${i.description ? `<br/><span style="color: #a0aec0; font-size: 13px;">${i.description}</span>` : ""}</li>`)
        .join("");

      const subject = `We need a few things from you — ${client.company_name}`;
      const html = emailWrapper(`
        <h2 style="color: #1a365d;">Hi ${client.name},</h2>
        <p style="color: #4a5568; line-height: 1.6;">
          To prepare your campaigns, we need a few things from you.
        </p>
        <p style="color: #4a5568;">Please upload the following in your portal:</p>
        <ul style="color: #4a5568; line-height: 1.8;">
          ${itemsList}
        </ul>
        <p style="color: #4a5568; line-height: 1.6;">
          This will help us create more personalized and effective marketing materials for you.
        </p>
        <div style="margin: 30px 0;">
          <a href="${APP_URL}/client/collect"
             style="background-color: #1a365d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
            Upload my files →
          </a>
        </div>
      `);

      await sendEmail(client.email, subject, html);
      return new Response(JSON.stringify({ success: true, sent_to: client.email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── client_welcome: send welcome email to new client ──
    if (type === "client_welcome") {
      const data = (payload as any).data;
      if (!data?.email || !data?.name) throw new Error("client_welcome requires data.name and data.email");

      const appUrl = data.app_url || APP_URL;
      const subject = "Welcome to PRAGMA — your portal is ready";
      const html = emailWrapper(`
        <h2 style="color: #1a365d;">Welcome to PRAGMA, ${data.name}!</h2>
        <p style="color: #4a5568; line-height: 1.6;">
          Your client portal is ready. You can log in to review campaigns, approve assets, and collaborate with our team.
        </p>
        <p style="color: #4a5568; line-height: 1.6;">
          <strong>Login URL:</strong> <a href="${appUrl}/login" style="color: #2b6cb0;">${appUrl}/login</a><br/>
          <strong>Email:</strong> ${data.email}<br/>
          <strong>Temporary password:</strong> Pragma2026!
        </p>
        <p style="color: #e53e3e; font-size: 13px;">
          Please change your password after your first login.
        </p>
        <div style="margin: 30px 0;">
          <a href="${appUrl}/login"
             style="background-color: #1a365d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
            Log in to your portal →
          </a>
        </div>
      `);

      await sendEmail(data.email, subject, html);

      return new Response(JSON.stringify({ success: true, sent_to: data.email }), {
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
