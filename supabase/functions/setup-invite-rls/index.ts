// Edge Function: public invitation lookup for the onboarding "joiner" flow.
//
// SECURITY: this function runs with the secret key and is public (deployed with
// verify_jwt = false; the user is not signed in yet). It therefore exposes a
// single, read-only, minimal action. All former debug/admin actions
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

    // Only the fields the joiner UI needs. Never return the invite token.
    const { data: invites, error } = await supabaseAdmin
      .from("band_invitations")
      .select("id, band_id, role, created_at, expires_at, invited_by, bands:band_id(id, name, logo_url, description)")
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());

    if (error) throw error;

    const result = await Promise.all(
      (invites || []).map(async (invite: any) => {
        const yearStart = `${new Date().getFullYear()}-01-01`;
        const [{ count }, { count: gigs }, inviter] = await Promise.all([
          supabaseAdmin
            .from("band_members")
            .select("id", { count: "exact", head: true })
            .eq("band_id", invite.band_id)
            .eq("is_active", true),
          supabaseAdmin
            .from("events")
            .select("id", { count: "exact", head: true })
            .eq("band_id", invite.band_id)
            .neq("event_type", "rehearsal")
            .in("status", ["confirmed", "completed"])
            .gte("event_date", yearStart),
          invite.invited_by
            ? supabaseAdmin.from("profiles").select("full_name").eq("id", invite.invited_by).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        // First name only: this endpoint answers anyone who knows the email.
        const inviterFirst = (inviter?.data?.full_name || "").trim().split(/\s+/)[0] || null;
        return {
          id: invite.id,
          band_id: invite.band_id,
          role: invite.role,
          created_at: invite.created_at,
          expires_at: invite.expires_at,
          band: invite.bands,
          member_count: count || 0,
          gigs_this_year: gigs || 0,
          inviter: inviterFirst ? { full_name: inviterFirst } : null,
        };
      }),
    );

    return json({ success: true, invites: result });
  } catch (error) {
    console.error("lookup_invites error:", error);
    return json({ success: false, error: "Could not check invitations" }, 500);
  }
});
