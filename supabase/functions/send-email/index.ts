// Supabase Edge Function for sending app emails through Resend.
//
// The HTML comes from ../_shared/email-templates.ts, which is GENERATED from
// supabase/email-templates/_source/build.py (the approved designs). Edit the
// designs there, never the HTML here.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  activeBandIds,
  adminClient,
  Caller,
  corsHeaders,
  HttpError,
  requireBandAdmin,
  requireCaller,
} from "../_shared/auth.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
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

// ── Database-triggered emails ───────────────────────────────────────────────
// Triggers only send ids; everything shown in the email is looked up here.
interface DispatchData {
  userId?: string;
  bandId?: string;
  recipientId?: string;
  memberUserId?: string;
}

async function authUser(admin: SupabaseClient, id: string | undefined) {
  if (!id) return null;
  const { data, error } = await admin.auth.admin.getUserById(id);
  return error ? null : data.user;
}

async function profileOf(admin: SupabaseClient, id: string) {
  const { data } = await admin
    .from("profiles")
    .select("full_name, notification_preferences")
    .eq("id", id)
    .maybeSingle();
  return data as { full_name: string | null; notification_preferences: Record<string, unknown> | null } | null;
}

const metaName = (meta: Record<string, unknown> | undefined) =>
  String(meta?.full_name ?? meta?.name ?? "").trim();

/**
 * The person's real name, or "" when there is none. Sign-up stores the part of
 * the address before the @ as full_name when no name was given (002
 * handle_new_user), so a "name" equal to that is not a name.
 * Rule for every email: show the name; only without one, show the address.
 */
const realName = (candidates: (string | null | undefined)[], email: string | null | undefined): string => {
  const local = (email ?? "").split("@")[0].trim().toLowerCase();
  for (const c of candidates) {
    const n = (c ?? "").trim();
    if (n && n.toLowerCase() !== local && n.toLowerCase() !== (email ?? "").toLowerCase()) return n;
  }
  return "";
};

async function nameOf(admin: SupabaseClient, id: string, email: string | null | undefined, meta?: Record<string, unknown>) {
  const profile = await profileOf(admin, id);
  return { name: realName([profile?.full_name, metaName(meta)], email), profile };
}

async function resolveDispatch(
  admin: SupabaseClient,
  type: EmailType,
  data: DispatchData,
): Promise<EmailRequest["data"] | { skip: string }> {
  if (type === "welcome") {
    const user = await authUser(admin, data?.userId);
    if (!user?.email) return { skip: "user has no email" };
    const { name } = await nameOf(admin, user.id, user.email, user.user_metadata);
    return { to: user.email, firstName: name.split(/\s+/)[0] };
  }

  if (type === "member_joined") {
    const { bandId, recipientId, memberUserId } = data ?? {};
    if (!bandId || !recipientId || !memberUserId) return { skip: "missing ids" };
    try {
      await requireBandAdmin(admin, recipientId, bandId); // admins only
    } catch {
      return { skip: "recipient is not an admin" };
    }
    const recipient = await authUser(admin, recipientId);
    if (!recipient?.email) return { skip: "recipient has no email" };
    const recipientProfile = await profileOf(admin, recipientId);
    if (String(recipientProfile?.notification_preferences?.email) === "false") {
      return { skip: "recipient turned email off" };
    }
    const member = await authUser(admin, memberUserId);
    const { name: memberName } = await nameOf(admin, memberUserId, member?.email, member?.user_metadata);
    return { to: recipient.email, bandId, newMemberName: memberName, newMemberEmail: member?.email ?? "" };
  }

  return { skip: "type cannot be sent by the database" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = adminClient();

    // Database triggers (migration 063) call with a DB-generated secret instead
    // of a user token; the function asks the database whether it matches.
    const dispatchSecret = req.headers.get("x-bw-dispatch-secret");
    let caller: Caller;
    if (dispatchSecret) {
      const { data: ok, error } = await admin.rpc("bw_verify_email_dispatch_secret", { p_secret: dispatchSecret });
      if (error || ok !== true) throw new HttpError(401, "Invalid dispatch secret");
      caller = { kind: "service" };
    } else {
      caller = await requireCaller(req, admin);
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      // Say so: the app then tells the admin to share the link instead.
      return new Response(
        JSON.stringify({ success: false, code: "email_not_configured", error: "Email sending is not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { type, data: requestData } = (await req.json()) as EmailRequest;
    const template = TEMPLATE_FOR[type];
    if (!template) throw new HttpError(400, "Unsupported email type");

    let rawData = requestData;
    if (dispatchSecret) {
      const resolved = await resolveDispatch(admin, type, requestData as unknown as DispatchData);
      if ("skip" in resolved) {
        console.log(`Skipped ${type} email: ${resolved.skip}`);
        return new Response(
          JSON.stringify({ success: true, skipped: resolved.skip }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      rawData = resolved;
    }

    const to = typeof rawData?.to === "string" ? rawData.to.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(to)) throw new HttpError(400, "Missing or invalid recipient email");

    const vars: Record<string, string> = { To: to, AppURL: appUrl() };

    if (type === "welcome") {
      // Only to yourself (or from the server).
      if (caller.kind === "user" && (caller.email ?? "").toLowerCase() !== to) {
        throw new HttpError(403, "Welcome emails can only be sent to your own address");
      }
      // Name first; without one, the address.
      const firstName = clean(realName([rawData?.firstName], to)) || to;
      vars.NameSuffix = `, ${firstName}`;
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
        // A signed-in admin is the inviter: read their name here rather than
        // trusting the app, with the same name-or-address rule.
        let inviter = clean(rawData.inviterName);
        if (caller.kind === "user") {
          const me = await authUser(admin, caller.id);
          inviter = clean((await nameOf(admin, caller.id, me?.email, me?.user_metadata)).name) || clean(me?.email);
        }
        vars.InviterName = inviter || "Your bandmate";
        vars.InviteURL = safeLink(rawData.inviteUrl);
      }
      if (type === "onboarding_reminder") {
        const days = Math.max(0, Math.min(30, Math.floor(Number(rawData.daysRemaining) || 0)));
        vars.ExpiresIn = expiresIn(days);
        vars.ExpiresInLabel = capitalise(expiresIn(days));
      }
      if (type === "member_joined") {
        // Name first; without one, the address. The big headline can't fit an
        // address, so there it falls back to "A new member".
        const name = clean(realName([rawData.newMemberName], rawData.newMemberEmail));
        const email = clean(rawData.newMemberEmail);
        vars.NewMemberName = name || email || "A new member";
        vars.HeroName = name || "A new member";
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
