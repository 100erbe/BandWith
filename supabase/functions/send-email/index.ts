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
import {
  pickQuoteEmailLang,
  quoteEmailDate,
  quoteEmailVars,
  type QuoteEmailKind,
} from "../_shared/quote-email-strings.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Set EMAIL_FROM (e.g. "BandWith <noreply@your-domain>") once a sender domain
// is verified in Resend; the resend.dev test sender only delivers to the Resend
// account owner.
const FROM_EMAIL = Deno.env.get("EMAIL_FROM") || "BandWith <onboarding@resend.dev>";
// The deployed web app (= Supabase Auth site_url, the APP_URL secret). Note: bandwith.app belongs
// to an unrelated product; never link to it.
const DEFAULT_APP_URL = "https://bandwith-beryl.vercel.app"; // = src/lib/appUrl.ts
// The previous address (Cloudflare Pages): links to it stay allowed.
const LEGACY_APP_HOSTS = ["bandwith.pages.dev", "band-with.vercel.app"];

type EmailType =
  | "onboarding_invite"
  | "onboarding_reminder"
  | "member_joined"
  | "invite_expired"
  | "welcome"
  | "product_update";

const TEMPLATE_FOR: Record<EmailType, EmailTemplateName> = {
  onboarding_invite: "band-invite",
  onboarding_reminder: "invite-reminder",
  member_joined: "member-joined",
  invite_expired: "invite-expired",
  welcome: "welcome",
  product_update: "product-update",
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
    /** Invitation token: app callers name the invitation, the server reads the rest. */
    token?: string;
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
  const hosts = new Set<string>([new URL(DEFAULT_APP_URL).host, ...LEGACY_APP_HOSTS]);
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
  invitationId?: string;
  issueId?: string;
  userIds?: string[];
}

/** POST to Resend, waiting and retrying when rate limited (429). */
async function resend(path: string, body: unknown) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.resend.com${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify(body),
    });
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      console.error("Resend error:", await res.text());
      throw new Error("Failed to send email");
    }
    return await res.json();
  }
}

// ── Product updates (065) ──────────────────────────────────────────────────
// Server only: bw_send_product_update() sends {issueId, userIds} in batches.
const text = (value: unknown, max: number): string =>
  String(value ?? "").replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").trim().slice(0, max);
const oneLine = (value: unknown, max: number): string => text(value, max).replace(/\s*\n\s*/g, " ");

interface ProductUpdateRow {
  issue_label: string;
  preheader: string;
  headline: string;
  intro: string;
  cta_label: string | null;
  cta_url: string | null;
  items: { title?: string; text?: string; url?: string }[] | null;
}

async function sendProductUpdate(admin: SupabaseClient, data: DispatchData) {
  const { data: row } = await admin
    .from("bw_product_updates")
    .select("issue_label, preheader, headline, intro, cta_label, cta_url, items")
    .eq("id", data?.issueId ?? "")
    .maybeSingle();
  const issue = row as ProductUpdateRow | null;
  if (!issue) throw new HttpError(404, "Product update not found");

  const linkOr = (url: unknown) => (url ? safeLink(url) : appUrl());
  const items = Array.isArray(issue.items) ? issue.items : [];
  const base: Record<string, string> = {
    AppURL: appUrl(),
    IssueLabel: oneLine(issue.issue_label, 40),
    Preheader: oneLine(issue.preheader, 160),
    Headline: text(issue.headline, 90), // line breaks become <br>
    Intro: oneLine(issue.intro, 500),
    CtaLabel: oneLine(issue.cta_label, 40) || "See what’s new",
    CtaURL: linkOr(issue.cta_url),
  };
  [0, 1, 2].forEach((i) => {
    const item = items[i] ?? {};
    base[`Item${i + 1}Title`] = oneLine(item.title, 60);
    base[`Item${i + 1}Text`] = oneLine(item.text, 300);
    if (i < 2) base[`Item${i + 1}URL`] = linkOr(item.url);
  });

  const emails: unknown[] = [];
  let skipped = 0;
  for (const id of (Array.isArray(data.userIds) ? data.userIds : []).slice(0, 50)) {
    const user = await authUser(admin, id);
    const to = (user?.email ?? "").trim().toLowerCase();
    const prefs = (await profileOf(admin, id))?.notification_preferences;
    // Opt-out: the email switch or the product updates switch turned off.
    if (!EMAIL_RE.test(to) || emailOff(prefs) || String(prefs?.product_updates) === "false") {
      skipped++;
      continue;
    }
    const { data: sig } = await admin.rpc("bw_unsubscribe_sig", { p_user: id });
    if (typeof sig !== "string" || sig.length !== 64) {
      skipped++;
      continue;
    }
    const unsubscribeUrl = `${appUrl()}/unsubscribe.html?u=${encodeURIComponent(id)}&s=${sig}`;
    const { subject, html } = renderEmail("product-update", { ...base, To: to, UnsubscribeURL: unsubscribeUrl });
    emails.push({ from: FROM_EMAIL, to: [to], subject, html, headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` } });
  }

  if (emails.length) await resend("/emails/batch", emails);
  console.log(`Product update: sent ${emails.length}, skipped ${skipped}`);
  return { sent: emails.length, skipped };
}

interface InvitationRow {
  id: string;
  band_id: string;
  email: string;
  role: string | null;
  status: string;
  invited_by: string | null;
  expires_at: string | null;
  token: string;
  email_sent_at?: string | null;
}

/** One invite email per invitation every 10 minutes (PR-11). */
const INVITE_EMAIL_INTERVAL_MS = 10 * 60 * 1000;

async function invitationByToken(admin: SupabaseClient, token: unknown) {
  if (typeof token !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return null;
  const { data } = await admin
    .from("band_invitations")
    .select("id, band_id, email, role, status, invited_by, expires_at, token, email_sent_at")
    .eq("token", token)
    .maybeSingle();
  return data as InvitationRow | null;
}

async function invitationOf(admin: SupabaseClient, id: string | undefined) {
  if (!id) return null;
  const { data } = await admin
    .from("band_invitations")
    .select("id, band_id, email, role, status, invited_by, expires_at, token")
    .eq("id", id)
    .maybeSingle();
  return data as InvitationRow | null;
}

/** The profile behind an address, if that person already has an account. */
async function profileByEmail(admin: SupabaseClient, email: string) {
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, notification_preferences")
    .ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(1);
  return (data?.[0] ?? null) as
    | { id: string; full_name: string | null; notification_preferences: Record<string, unknown> | null }
    | null;
}

const emailOff = (prefs: Record<string, unknown> | null | undefined) => String(prefs?.email) === "false";
const roleLabel = (role: string | null) => (role === "admin" ? "Admin" : "Musician");

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

  if (type === "onboarding_reminder") {
    const inv = await invitationOf(admin, data?.invitationId);
    if (!inv) return { skip: "invitation not found" };
    if (inv.status !== "pending") return { skip: `invitation is ${inv.status}` };
    const msLeft = inv.expires_at ? new Date(inv.expires_at).getTime() - Date.now() : 0;
    if (msLeft <= 0) return { skip: "invitation expired" };
    const invitee = await profileByEmail(admin, inv.email);
    if (emailOff(invitee?.notification_preferences)) return { skip: "invitee turned email off" };
    let inviterName = "";
    if (inv.invited_by) {
      const inviter = await authUser(admin, inv.invited_by);
      inviterName = (await nameOf(admin, inv.invited_by, inviter?.email, inviter?.user_metadata)).name ||
        (inviter?.email ?? "");
    }
    return {
      to: inv.email,
      bandId: inv.band_id,
      inviterName,
      inviteUrl: `${appUrl()}/?invite=${inv.token}`,
      role: roleLabel(inv.role),
      daysRemaining: Math.floor(msLeft / 86_400_000),
    };
  }

  if (type === "invite_expired") {
    const inv = await invitationOf(admin, data?.invitationId);
    if (!inv) return { skip: "invitation not found" };
    if (inv.status !== "pending") return { skip: `invitation is ${inv.status}` };
    if (!inv.expires_at || new Date(inv.expires_at).getTime() > Date.now()) return { skip: "not expired" };
    if (!inv.invited_by) return { skip: "no inviter" };
    try {
      await requireBandAdmin(admin, inv.invited_by, inv.band_id); // still an admin
    } catch {
      return { skip: "inviter is no longer an admin" };
    }
    const inviter = await authUser(admin, inv.invited_by);
    if (!inviter?.email) return { skip: "inviter has no email" };
    if (emailOff((await profileOf(admin, inv.invited_by))?.notification_preferences)) {
      return { skip: "inviter turned email off" };
    }
    const invitee = await profileByEmail(admin, inv.email);
    const inviteeName = realName([invitee?.full_name], inv.email) || inv.email;
    return { to: inviter.email, bandId: inv.band_id, inviteeName, role: roleLabel(inv.role) };
  }

  return { skip: "type cannot be sent by the database" };
}

// ── Client quote emails (migration 099) ────────────────────────────────────
// The app names the quote; recipient, language, link and PDF come from the
// database. Only an admin of the quote's band may send, at most once a minute.
const QUOTE_EMAIL_INTERVAL_MS = 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface QuoteLinkRow {
  id: string;
  band_id: string;
  token: string;
  lang: string;
  version: number;
  pdf_url: string | null;
  pdf_version: number | null;
  snapshot: Record<string, unknown> | null;
  revoked_at: string | null;
  last_emailed_at: string | null;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** The PDF must be this band's file in the public quotes bucket of this project. */
function quotePdfUrl(raw: string | null, bandId: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const project = new URL(Deno.env.get("SUPABASE_URL") ?? "").host;
    const prefix = `/storage/v1/object/public/quotes/quotes/${bandId}/`;
    if (url.protocol !== "https:" || url.host !== project || !url.pathname.startsWith(prefix)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function sendQuoteClientEmail(
  admin: SupabaseClient,
  caller: Caller,
  type: "quote_link" | "quote_reply",
  data: { quoteId?: unknown; kind?: unknown },
) {
  if (caller.kind !== "user") throw new HttpError(403, "Quote emails are sent from the app");
  const quoteId = typeof data?.quoteId === "string" && UUID_RE.test(data.quoteId) ? data.quoteId : null;
  if (!quoteId) throw new HttpError(400, "Missing quote");
  const kind: QuoteEmailKind =
    type === "quote_reply" ? "reply" : data?.kind === "reminder" ? "reminder" : data?.kind === "updated" ? "updated" : "sent";

  const { data: linkRow } = await admin
    .from("quote_links")
    .select("id, band_id, token, lang, version, pdf_url, pdf_version, snapshot, revoked_at, last_emailed_at")
    .eq("quote_id", quoteId)
    .maybeSingle();
  const link = linkRow as QuoteLinkRow | null;
  if (!link) throw new HttpError(404, "This quote has no client link");
  await requireBandAdmin(admin, caller.id, link.band_id);
  if (link.revoked_at) throw new HttpError(410, "The client link is turned off");
  if (link.last_emailed_at && Date.now() - new Date(link.last_emailed_at).getTime() < QUOTE_EMAIL_INTERVAL_MS) {
    return jsonResponse({ success: false, code: "too_soon", error: "An email was just sent" }, 429);
  }

  const { data: quote } = await admin
    .from("quotes")
    .select("client_email, client_name, quote_number, event_name")
    .eq("id", quoteId)
    .eq("band_id", link.band_id)
    .maybeSingle();
  if (!quote) throw new HttpError(404, "Quote not found");
  const to = String(quote.client_email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(to)) return jsonResponse({ success: false, code: "no_client_email", error: "The quote has no client email" }, 400);

  let reply = "";
  if (kind === "reply") {
    const { data: last } = await admin
      .from("quote_activity")
      .select("body")
      .eq("quote_id", quoteId)
      .eq("kind", "band_reply")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    reply = text(last?.body, 2000);
    if (!reply) throw new HttpError(404, "No reply to send");
  }

  if (!RESEND_API_KEY) {
    return jsonResponse({ success: false, code: "email_not_configured", error: "Email sending is not configured" }, 503);
  }

  const { data: band } = await admin.from("bands").select("name").eq("id", link.band_id).maybeSingle();
  const lang = pickQuoteEmailLang(link.lang);
  const snap = link.snapshot ?? {};
  const ref = clean(snap.ref ?? quote.quote_number, "");
  const pdf = kind === "reply" || link.pdf_version !== link.version ? null : quotePdfUrl(link.pdf_url, link.band_id);
  const vars = quoteEmailVars({
    kind,
    lang,
    band: clean(band?.name, "BandWith"),
    ref,
    event: clean(snap.title ?? quote.event_name, ref),
    date: quoteEmailDate(snap.date, lang),
    total: clean(snap.totalLabel, ""),
    clientName: clean(quote.client_name, ""),
    to,
    url: `${appUrl()}/quote.html?t=${encodeURIComponent(link.token)}`,
    pdfAttached: !!pdf,
    reply,
  });
  const { subject, html } = renderEmail(type === "quote_reply" ? "quote-reply" : "quote-link", vars);
  const filename = `${(ref || "quote").replace(/[^A-Za-z0-9._-]+/g, "-")}.pdf`;

  // Claim the slot before sending so two taps don't send twice.
  await admin.from("quote_links").update({ last_emailed_at: new Date().toISOString() }).eq("id", link.id);
  console.log(`Sending ${type} (${kind}) email`);
  try {
    const result = await resend("/emails", {
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
      ...(pdf ? { attachments: [{ path: pdf, filename }] } : {}),
    });
    return jsonResponse({ success: true, id: result.id });
  } catch (e) {
    await admin.from("quote_links").update({ last_emailed_at: link.last_emailed_at }).eq("id", link.id);
    throw e;
  }
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

    const { type, data: requestData } = (await req.json()) as EmailRequest;
    if ((type as string) === "quote_link" || (type as string) === "quote_reply") {
      return await sendQuoteClientEmail(admin, caller, type as unknown as "quote_link" | "quote_reply", requestData as never);
    }
    const template = TEMPLATE_FOR[type];
    if (!template) throw new HttpError(400, "Unsupported email type");

    if (type === "product_update") {
      if (!dispatchSecret) throw new HttpError(403, "Product updates are sent by the server only");
      if (!RESEND_API_KEY) throw new HttpError(503, "Email sending is not configured");
      const result = await sendProductUpdate(admin, requestData as unknown as DispatchData);
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    // From the app, only the invite email for a pending invitation the caller
    // may send: recipient, band, role and link all come from that row.
    let invitation: InvitationRow | null = null;
    if (caller.kind === "user") {
      if (type !== "onboarding_invite") throw new HttpError(403, "This email is sent by the server only");
      invitation = await invitationByToken(admin, rawData?.token);
      if (!invitation || invitation.status !== "pending") throw new HttpError(404, "Invitation not found");
      if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) {
        throw new HttpError(410, "Invitation expired");
      }
      if (invitation.email_sent_at && Date.now() - new Date(invitation.email_sent_at).getTime() < INVITE_EMAIL_INTERVAL_MS) {
        throw new HttpError(429, "The invite email was just sent");
      }
      rawData = {
        ...rawData,
        to: invitation.email,
        bandId: invitation.band_id,
        role: roleLabel(invitation.role),
        inviteUrl: `${appUrl()}/?invite=${invitation.token}`,
      };
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
        // Name first; without one, the address (resolveDispatch already did this).
        vars.InviteeName = clean(rawData.inviteeName, "your invitee");
      }
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      // Say so: the app then tells the admin to share the link instead.
      return new Response(
        JSON.stringify({ success: false, code: "email_not_configured", error: "Email sending is not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { subject, html } = renderEmail(template, vars);

    console.log(`Sending ${type} email`);

    const result = await resend("/emails", { from: FROM_EMAIL, to: [to], subject, html });
    console.log("Email sent:", result.id);
    if (invitation) {
      await admin.from("band_invitations").update({ email_sent_at: new Date().toISOString() }).eq("id", invitation.id);
    }

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
