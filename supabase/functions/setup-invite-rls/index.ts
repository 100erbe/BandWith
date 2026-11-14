// Edge Function: public invitation lookup for the onboarding "joiner" flow.
//
// SECURITY: this function runs with the secret key and is public (deployed with
// verify_jwt = false; the user is not signed in yet). It therefore exposes a
// single, read-only, minimal action, and answers only with a count (no band
// names, member or gig counts, inviter: anyone can type someone else's email). All former debug/admin actions
// (accept_invite_for_user, list_invites, list_all_notifications,
// delete_notification, update_notification_data, cancel_invite, create_invite,
// resend_invite, list_bands, list_pending_invites, get_invite_details) were
// removed: they let anyone with the anon key join any band as admin or read
// everyone's invitations and notifications.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Best-effort per-instance throttle (edge instances are short-lived; pair with
// Supabase's own rate limits). Limits email enumeration from a single IP.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, { count: number; reset: number }>();
function throttled(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (throttled(ip)) {
      return json({ success: false, error: "Too many requests, try again in a minute" }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const { action, email } = body ?? {};

    if (action !== "lookup_invites") {
      return json({ success: false, error: "Unsupported action" }, 400);
    }

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(normalizedEmail) || normalizedEmail.length > 254) {
      return json({ success: false, error: "Invalid email" }, 400);
    }

    const supabaseAdmin = adminClient();

    // Anyone can type any address here (no sign-in, no proof of the email),
    // so the answer is only how many invites are waiting: never the band,
    // its members, its gigs or who sent it. The invitee sees those once
    // signed in with that address (bw_my_pending_invitations), or from the
    // link in the invite email (bw_preview_invitation, token).
    const { count, error } = await supabaseAdmin
      .from("band_invitations")
      .select("id", { count: "exact", head: true })
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());

    if (error) throw error;

    return json({ success: true, count: count || 0 });
  } catch (error) {
    console.error("lookup_invites error:", error);
    return json({ success: false, error: "Could not check invitations" }, 500);
  }
});
