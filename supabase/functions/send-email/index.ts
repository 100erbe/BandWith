// Supabase Edge Function for sending app emails through Resend.
//
// The HTML comes from ../_shared/email-templates.ts, which is GENERATED from
// supabase/email-templates/_source/build.py (the approved designs). Edit the
// designs there, never the HTML here.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  activeBandIds,
  adminClient,
  corsHeaders,
  HttpError,
  requireBandAdmin,
  requireCaller,
} from "../_shared/auth.ts";
import { EmailTemplateName, renderEmail } from "../_shared/email-templates.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Set EMAIL_FROM (e.g. "BandWith <noreply@your-domain>") once a sender domain
// is verified in Resend; the resend.dev test sender only delivers to the Resend
// account owner.
const FROM_EMAIL = Deno.env.get("EMAIL_FROM") || "BandWith <onboarding@resend.dev>";
// The deployed web app (= Supabase Auth site_url). Note: bandwith.app belongs
// to an unrelated product; never link to it.
const DEFAULT_APP_URL = "https://bandwith.pages.dev";

type EmailType =
  | "onboarding_invite"
  | "onboarding_reminder"
  | "member_joined"
  | "invite_expired"
  | "welcome";

const TEMPLATE_FOR: Record<EmailType, EmailTemplateName> = {
  onboarding_invite: "band-invite",
  onboarding_reminder: "invite-reminder",
  member_joined: "member-joined",
  invite_expired: "invite-expired",
  welcome: "welcome",
};

interface EmailRequest {
  type: EmailType;
  data: {
    to: string;
    bandId?: string;
    inviterName?: string;
    inviteUrl?: string;
    role?: string;
    newMemberName?: string;
    newMemberEmail?: string;
    inviteeName?: string;
    firstName?: string;
    daysRemaining?: number;
  };
}

// ── Security helpers ────────────────────────────────────────────────────────
// Values are HTML-escaped by renderEmail; here they are only trimmed and
// length-capped. Links may only point at the app's own host, otherwise this
// function is a free phishing relay sending from the BandWith address.
const clean = (value: unknown, fallback = ""): string =>
  String(value ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, 120) || fallback;

const appUrl = (): string =>
  (Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || DEFAULT_APP_URL).replace(/\/+$/, "");

const allowedLinkHosts = (): string[] => {
  const hosts = new Set<string>([new URL(DEFAULT_APP_URL).host, "band-with.vercel.app"]);
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
    return url.toString();
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "Invalid link");
  }
};

/** "today" / "tomorrow" / "in N days" for the reminder copy. */
const expiresIn = (days: number): string =>
  days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = adminClient();
    const caller = await requireCaller(req, admin);

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      // Say so: the app then tells the admin to share the link instead.
      return new Response(
        JSON.stringify({ success: false, code: "email_not_configured", error: "Email sending is not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { type, data: rawData } = (await req.json()) as EmailRequest;
    const template = TEMPLATE_FOR[type];
    if (!template) throw new HttpError(400, "Unsupported email type");

    const to = typeof rawData?.to === "string" ? rawData.to.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(to)) throw new HttpError(400, "Missing or invalid recipient email");

    const vars: Record<string, string> = { To: to, AppURL: appUrl() };

    if (type === "welcome") {
      // Only to yourself (or from the server).
      if (caller.kind === "user" && (caller.email ?? "").toLowerCase() !== to) {
        throw new HttpError(403, "Welcome emails can only be sent to your own address");
      }
      vars.FirstName = clean(rawData?.firstName, "there");
    } else {
      // Every band email: authorise against the band and use its real name.
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
      vars.BandName = clean(band.name, "your band");
      vars.Role = clean(rawData.role, "Musician");

      if (type === "onboarding_invite" || type === "onboarding_reminder") {
        vars.InviterName = clean(rawData.inviterName, "Your bandmate");
        vars.InviteURL = safeLink(rawData.inviteUrl);
      }
      if (type === "onboarding_reminder") {
        const days = Math.max(0, Math.min(30, Math.floor(Number(rawData.daysRemaining) || 0)));
        vars.ExpiresIn = expiresIn(days);
        vars.ExpiresInLabel = capitalise(expiresIn(days));
      }
      if (type === "member_joined") {
        vars.NewMemberName = clean(rawData.newMemberName, "A new member");
        vars.NewMemberEmail = clean(rawData.newMemberEmail);
      }
      if (type === "invite_expired") {
        vars.InviteeName = clean(rawData.inviteeName, "your invitee");
      }
    }

    const { subject, html } = renderEmail(template, vars);

    console.log(`Sending ${type} email`);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });

    if (!res.ok) {
      console.error("Resend error:", await res.text());
      throw new Error("Failed to send email");
    }

    const result = await res.json();
    console.log("Email sent:", result.id);

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    const status = error instanceof HttpError ? error.status : 500;
    return new Response(
      JSON.stringify({ success: false, error: error instanceof HttpError ? error.message : "Could not send email" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
