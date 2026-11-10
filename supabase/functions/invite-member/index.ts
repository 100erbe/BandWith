// Supabase Edge Function for inviting members.
// Creates (or refreshes) a pending row in band_invitations. Existing users
// accept it in-app; new users get a link with the invitation token.
//
// SECURITY: the caller must be a signed-in, active ADMIN of `bandId`.
// Admin role can only be granted by an admin; invitees default to 'member'.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  adminClient,
  corsHeaders,
  errorResponse,
  HttpError,
  json,
  requireBandAdmin,
  requireCaller,
} from "../_shared/auth.ts";

interface InviteRequest {
  email?: string;
  /** Existing user picked from member search (the client only sees a masked email). */
  userId?: string;
  bandId: string;
  bandName?: string;
  role?: string;
  inviterName?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = adminClient();
    const caller = await requireCaller(req, supabaseAdmin);

    const { email, userId, bandId, role } = (await req.json()) as InviteRequest;
    let normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail && typeof userId === "string" && userId) {
      const { data: target, error: targetError } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();
      if (targetError) throw targetError;
      normalizedEmail = (target?.email ?? "").trim().toLowerCase();
    }
    if (!EMAIL_RE.test(normalizedEmail) || !bandId) {
      throw new HttpError(400, "Missing or invalid email or bandId");
    }

    if (caller.kind === "user") {
      await requireBandAdmin(supabaseAdmin, caller.id, bandId);
    }

    const memberRole = role === "admin" ? "admin" : "member";

    // Use the band's real name from the DB, never the client-supplied one.
    const { data: band, error: bandError } = await supabaseAdmin
      .from("bands")
      .select("id, name")
      .eq("id", bandId)
      .maybeSingle();
    if (bandError) throw bandError;
    if (!band) throw new HttpError(404, "Band not found");

    // Look the user up by email in profiles (auth.admin.listUsers() only returns
    // the first page of 50 users, so existing users were missed beyond that).
    const { data: existingProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", normalizedEmail)
      .maybeSingle();
    if (profileError) throw profileError;

    const invitedBy = caller.kind === "user" ? caller.id : null;
    const upsertInvitation = async () => {
      const { data, error } = await supabaseAdmin
        .from("band_invitations")
        .upsert({
          band_id: bandId,
          email: normalizedEmail,
          role: memberRole,
          status: "pending",
          invited_by: invitedBy,
          accepted_at: null,
          accepted_by: null,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: "band_id,email" })
        .select("token")
        .single();
      if (error) throw error;
      return data.token as string;
    };

    if (existingProfile) {
      // Existing account: record a pending invitation; the user accepts it
      // in-app (banner on launch). Previously they were added without consent.
      await upsertInvitation();
      return json({ success: true, userExists: true, userId: existingProfile.id });
    }

    // New user: create the invitation and hand back its link. The app sends
    // the email (send-email "onboarding_invite") and the admin can also share
    // the link or code directly. The invitee signs up normally, then accepts
    // with bw_accept_invitation(token). (auth.admin.inviteUserByEmail is no
    // longer used: it pre-created the account and returned the session in the
    // URL fragment, which the PKCE-only app rejects.)
    const token = await upsertInvitation();
    const appUrl = (Deno.env.get("APP_URL") ?? Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");
    const inviteUrl = appUrl ? `${appUrl}/?invite=${token}` : null;

    return json({ success: true, invited: true, token, inviteUrl, bandName: band.name });
  } catch (error) {
    return errorResponse(error);
  }
});
