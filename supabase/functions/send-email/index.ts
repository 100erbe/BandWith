// Supabase Edge Function for sending emails
// Uses Resend for email delivery

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  activeBandIds,
  adminClient,
  HttpError,
  requireBandAdmin,
  requireCaller,
} from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Use Resend test domain until bandwith.app is verified
// Change to "BandWith <noreply@bandwith.app>" after domain verification
// Set EMAIL_FROM (e.g. "BandWith <noreply@your-domain>") once a sender
// domain is verified in Resend; the resend.dev test sender only delivers to
// the Resend account owner.
const FROM_EMAIL = Deno.env.get("EMAIL_FROM") || "BandWith <onboarding@resend.dev>";

interface EmailRequest {
  type: string;
  data: {
    to: string;
    bandId?: string;
    bandName?: string;
    inviterName?: string;
    inviteUrl?: string;
    role?: string;
    newMemberName?: string;
    newMemberEmail?: string;
    daysRemaining?: number;
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate email content based on type
function generateEmailContent(type: string, data: EmailRequest["data"]): { subject: string; html: string } {
  const baseStyles = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background-color: #0A0A0B;
    color: #ffffff;
  `;

  const buttonStyle = `
    display: inline-block;
    padding: 18px 48px;
    background-color: #D4FB46;
    color: #000000;
    text-decoration: none;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border-radius: 100px;
  `;

  switch (type) {
    case "onboarding_invite":
      return {
        subject: `You're invited to join "${data.bandName}" on BandWith`,
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="${baseStyles} margin: 0; padding: 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px;">
                    
                    <!-- Logo -->
                    <tr>
                      <td align="center" style="padding: 0 0 40px;">
                        <div style="font-size: 28px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.02em;">
                          Band<span style="color: #D4FB46;">With</span>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Main Card -->
                    <tr>
                      <td style="background-color: #1C1C1E; border-radius: 24px; border: 1px solid #2C2C2E;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                          
                          <!-- Header -->
                          <tr>
                            <td style="padding: 48px 40px 0;">
                              <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #D4FB46;">
                                You're Invited
                              </p>
                              <h1 style="margin: 0; font-size: 28px; font-weight: 800; line-height: 1.2; color: #FFFFFF;">
                                Join ${data.bandName}
                              </h1>
                            </td>
                          </tr>
                          
                          <!-- Body -->
                          <tr>
                            <td style="padding: 24px 40px 0;">
                              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #A1A1AA;">
                                <strong style="color: #FFFFFF;">${data.inviterName}</strong> has invited you to join their band on BandWith as <strong style="color: #D4FB46;">${data.role || 'Musician'}</strong>.
                              </p>
                            </td>
                          </tr>
                          
                          <!-- CTA Button -->
                          <tr>
                            <td style="padding: 32px 40px;">
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                  <td align="center">
                                    <a href="${data.inviteUrl}" style="${buttonStyle}">
                                      Accept Invitation
                                    </a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          
                          <!-- Features -->
                          <tr>
                            <td style="padding: 0 40px 40px;">
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top: 1px solid #2C2C2E;">
                                <tr>
                                  <td style="padding-top: 24px;">
                                    <p style="margin: 0 0 16px; font-size: 12px; font-weight: 600; color: #71717A; text-transform: uppercase; letter-spacing: 0.1em;">
                                      As a member you can
                                    </p>
                                    <p style="margin: 0; font-size: 14px; color: #A1A1AA; line-height: 1.8;">
                                      ✓ View and RSVP to gigs & rehearsals<br>
                                      ✓ Access setlists and song notes<br>
                                      ✓ Chat with the band in real-time
                                    </p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 32px 20px 0;">
                        <p style="margin: 0 0 8px; font-size: 12px; color: #52525B; text-align: center;">
                          If the button doesn't work, copy this link:
                        </p>
                        <p style="margin: 0 0 24px; font-size: 11px; color: #D4FB46; text-align: center; word-break: break-all;">
                          ${data.inviteUrl}
                        </p>
                        <p style="margin: 0; font-size: 11px; color: #3F3F46; text-align: center;">
                          © 2026 BandWith. All rights reserved.
                        </p>
                      </td>
                    </tr>
                    
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      };

    case "member_joined":
      return {
        subject: `${data.newMemberName} joined ${data.bandName}!`,
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="${baseStyles} margin: 0; padding: 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #1C1C1E; border-radius: 24px;">
                    <tr>
                      <td align="center" style="padding: 48px 40px;">
                        <div style="width: 64px; height: 64px; background-color: #D4FB46; border-radius: 16px; text-align: center; line-height: 64px; font-size: 28px; margin-bottom: 24px;">🎉</div>
                        <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #FFFFFF;">New Member!</h1>
                        <p style="margin: 0; font-size: 16px; color: #A1A1AA;">
                          <strong style="color: #FFFFFF;">${data.newMemberName}</strong> just joined <strong style="color: #D4FB46;">${data.bandName}</strong>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      };

    case "onboarding_reminder":
      return {
        subject: `Reminder: ${data.inviterName} is waiting for you to join ${data.bandName}`,
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="${baseStyles} margin: 0; padding: 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #1C1C1E; border-radius: 24px;">
                    <tr>
                      <td align="center" style="padding: 48px 40px;">
                        <div style="width: 64px; height: 64px; background-color: #FF6B35; border-radius: 16px; text-align: center; line-height: 64px; font-size: 28px; margin-bottom: 24px;">⏰</div>
                        <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #FFFFFF;">Don't Miss Out!</h1>
                        <p style="margin: 0 0 24px; font-size: 16px; color: #A1A1AA;">
                          Your invitation to join <strong style="color: #D4FB46;">${data.bandName}</strong> expires in ${data.daysRemaining} days.
                        </p>
                        <a href="${data.inviteUrl}" style="${buttonStyle}">
                          Accept Invitation
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      };

    default:
      return {
        subject: "BandWith Notification",
        html: `<p>You have a new notification from BandWith.</p>`,
      };
  }
}

// ── Security helpers ────────────────────────────────────────────────────────
// Every value interpolated into the HTML templates is user-controlled, so it is
// escaped, and links may only point at the app's own domain (otherwise this
// function is a free phishing relay sending from the BandWith address).
const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .slice(0, 200);

const allowedLinkHosts = (): string[] => {
  const hosts = new Set<string>(["bandwith.app", "www.bandwith.app"]);
  for (const raw of [Deno.env.get("APP_URL"), Deno.env.get("SITE_URL")]) {
    try {
      if (raw) hosts.add(new URL(raw).host);
    } catch { /* ignore malformed env */ }
  }
  (Deno.env.get("EMAIL_ALLOWED_LINK_HOSTS") ?? "")
    .split(",").map((h) => h.trim()).filter(Boolean).forEach((h) => hosts.add(h));
  return [...hosts];
};

const safeLink = (value: unknown): string => {
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:" || !allowedLinkHosts().includes(url.host)) {
      throw new HttpError(400, "Link not allowed");
    }
    return url.toString().replace(/"/g, "%22");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "Invalid link");
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = adminClient();
    const caller = await requireCaller(req, admin);

    // Check for API key
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      // Say so: the app then tells the admin to share the link instead.
      return new Response(
        JSON.stringify({ success: false, code: "email_not_configured", error: "Email sending is not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { type, data: rawData } = (await req.json()) as EmailRequest;

    const to = typeof rawData?.to === "string" ? rawData.to.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(to)) {
      throw new HttpError(400, "Missing or invalid recipient email");
    }
    if (!["onboarding_invite", "onboarding_reminder", "member_joined"].includes(type)) {
      throw new HttpError(400, "Unsupported email type");
    }

    // Authorise against the band and use its real name from the DB.
    const bandId = rawData?.bandId;
    if (!bandId) throw new HttpError(400, "Missing bandId");
    if (caller.kind === "user") {
      if (type === "member_joined") {
        const bands = await activeBandIds(admin, caller.id);
        if (!bands.includes(bandId)) throw new HttpError(403, "Not a member of this band");
      } else {
        await requireBandAdmin(admin, caller.id, bandId);
      }
    }
    const { data: band } = await admin.from("bands").select("name").eq("id", bandId).maybeSingle();
    if (!band) throw new HttpError(404, "Band not found");

    const data: EmailRequest["data"] = {
      to,
      bandName: escapeHtml(band.name),
      inviterName: escapeHtml(rawData.inviterName),
      role: escapeHtml(rawData.role || "Musician"),
      newMemberName: escapeHtml(rawData.newMemberName),
      newMemberEmail: escapeHtml(rawData.newMemberEmail),
      daysRemaining: Math.max(0, Math.min(30, Number(rawData.daysRemaining) || 0)),
      inviteUrl: type === "member_joined" ? undefined : safeLink(rawData.inviteUrl),
    };

    const { subject, html } = generateEmailContent(type, data);
    // Subjects are plain text: undo the HTML escaping there.
    const plainSubject = subject
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&amp;/g, "&");

    console.log(`Sending ${type} email`);

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [data.to],
        subject: plainSubject,
        html,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Resend error:", error);
      throw new Error("Failed to send email");
    }

    const result = await res.json();
    console.log("Email sent:", result);

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const status = error instanceof HttpError ? error.status : 500;
    return new Response(
      JSON.stringify({ success: false, error: error instanceof HttpError ? error.message : "Could not send email" }),
      { 
        status, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
