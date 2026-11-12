// Shared auth helpers for BandWith edge functions.
//
// Every function is deployed with verify_jwt = false: the platform's JWT check
// only understands the legacy anon/service_role keys, while the app now uses
// the publishable key and functions use the secret key (neither is a JWT).
// So each function must authorise the caller in code: a signed-in user's JWT
// on `Authorization`, a secret key on `apikey`, or a database-generated
// dispatch secret (pg_net triggers).
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Secret keys (sb_secret_…) from the platform env. SUPABASE_SECRET_KEYS is a
 * JSON object keyed by name; the CLI's local stack exposes a single
 * SUPABASE_SECRET_KEY instead.
 */
function secretKeys(): Record<string, string> {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as Record<string, string>;
    } catch {
      // fall through to the single-key form
    }
  }
  const single = Deno.env.get("SUPABASE_SECRET_KEY");
  return single ? { default: single } : {};
}

export function secretKey(name = "default"): string {
  const key = secretKeys()[name];
  if (!key) throw new HttpError(500, "Server is missing its secret key");
  return key;
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Constant-time string comparison for secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

export type Caller =
  | { kind: "service" }
  | { kind: "user"; id: string; email: string | null };

/**
 * Resolve who is calling. Server-to-server calls that present a secret key on
 * the `apikey` header are trusted; everyone else must be a signed-in
 * (non-anonymous) user with their session JWT on `Authorization`.
 */
export async function requireCaller(req: Request, admin: SupabaseClient): Promise<Caller> {
  const apikey = req.headers.get("apikey") ?? "";
  if (apikey.startsWith("sb_secret_")) {
    const ok = Object.values(secretKeys()).some((k) => typeof k === "string" && safeEqual(apikey, k));
    if (!ok) throw new HttpError(401, "Invalid secret key");
    return { kind: "service" };
  }

  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "Missing authorization");
  // Publishable/secret keys are not user sessions.
  if (token.startsWith("sb_")) throw new HttpError(401, "Not signed in");

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "Not signed in");
  if ((data.user as { is_anonymous?: boolean }).is_anonymous) {
    throw new HttpError(401, "Not signed in");
  }
  return { kind: "user", id: data.user.id, email: data.user.email ?? null };
}

/** Throws 403 unless `userId` is an active admin of `bandId`. */
export async function requireBandAdmin(admin: SupabaseClient, userId: string, bandId: string) {
  const { data, error } = await admin
    .from("band_members")
    .select("id")
    .eq("band_id", bandId)
    .eq("user_id", userId)
    .eq("role", "admin")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(403, "Only band admins can do this");
}

/** Band ids where `userId` is an active member. */
export async function activeBandIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await admin
    .from("band_members")
    .select("band_id")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []).map((r: { band_id: string }) => r.band_id);
}

/**
 * Filter `targetIds` down to users the caller may notify: themselves, active
 * members of a band they share, or participants of a chat they are in.
 */
export async function allowedRecipients(
  admin: SupabaseClient,
  callerId: string,
  targetIds: string[],
): Promise<string[]> {
  const unique = [...new Set(targetIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (unique.length === 0) return [];
  const allowed = new Set<string>(unique.includes(callerId) ? [callerId] : []);

  const bandIds = await activeBandIds(admin, callerId);
  if (bandIds.length > 0) {
    const { data } = await admin
      .from("band_members")
      .select("user_id")
      .in("band_id", bandIds)
      .in("user_id", unique)
      .eq("is_active", true);
    (data ?? []).forEach((r: { user_id: string }) => allowed.add(r.user_id));
  }

  const remaining = unique.filter((id) => !allowed.has(id));
  if (remaining.length > 0) {
    const { data: myChats } = await admin
      .from("chat_participants")
      .select("chat_id")
      .eq("user_id", callerId);
    const chatIds = (myChats ?? []).map((r: { chat_id: string }) => r.chat_id);
    if (chatIds.length > 0) {
      const { data } = await admin
        .from("chat_participants")
        .select("user_id")
        .in("chat_id", chatIds)
        .in("user_id", remaining);
      (data ?? []).forEach((r: { user_id: string }) => allowed.add(r.user_id));
    }
  }

  return unique.filter((id) => allowed.has(id));
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ success: false, error: error.message }, error.status);
  console.error("Unhandled error:", error);
  return json({ success: false, error: "Internal error" }, 500);
}
