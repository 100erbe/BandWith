// Calendar subscription for a deputy (no BandWith account).
//
// GET /functions/v1/deputy-calendar?t=<request token>&l=<language>[&one=1]
// Returns the deputy's confirmed gigs with that band as an .ics feed
// (one=1: only this request's gig, as a file to import once)
// (bw_deputy_feed, migration 084). Calendars poll it, so changes to times
// or venue and cancellations reach the deputy's own calendar by themselves.
// Public by design: the 64-character token is the only key, as on
// /deputy.html. Uses the publishable key; the RPC returns only what the
// deputy may see.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { calendarFile, gigEvent, GIG_LABELS } from "../_shared/deputy-calendar.ts";

const SITE = "https://bandwith.pages.dev";

function publishableKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    if (typeof keys?.default === "string") return keys.default;
  } catch { /* fall through */ }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

interface FeedGig {
  id: string;
  token: string;
  cancelled: boolean;
  role: string | null;
  event_title: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  load_in_time: string | null;
  soundcheck_time: string | null;
  venue_name: string | null;
  venue_city: string | null;
  venue_address: string | null;
  updated_at: string | null;
}

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  const url = new URL(req.url);
  const token = (url.searchParams.get("t") ?? "").toLowerCase();
  const lang = (url.searchParams.get("l") ?? "en").slice(0, 2).toLowerCase();
  const one = url.searchParams.get("one") === "1";
  if (!/^[0-9a-f]{64}$/.test(token)) return new Response("Not found", { status: 404 });

  const key = publishableKey();
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/bw_deputy_feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ p_token: token }),
  });
  if (!res.ok) return new Response("Unavailable", { status: 503 });
  const feed = await res.json() as { band_name?: string; gigs?: FeedGig[] } | null;
  if (!feed) return new Response("Not found", { status: 404 });

  const labels = GIG_LABELS[lang] ?? GIG_LABELS.en;
  const band = feed.band_name || "BandWith";
  const events = (feed.gigs ?? [])
    .filter((g) => g.event_date && (!one || g.token === token))
    .map((g) =>
      gigEvent(
        {
          title: g.event_title || "Gig",
          bandName: band,
          date: g.event_date as string,
          loadIn: g.load_in_time,
          soundcheck: g.soundcheck_time,
          start: g.start_time,
          end: g.end_time,
          venue: g.venue_name,
          city: g.venue_city,
          address: g.venue_address,
          role: g.role,
          url: `${SITE}/deputy.html?t=${g.token}`,
        },
        labels,
        `deputy-${g.id}`,
        { updatedAt: g.updated_at, cancelled: g.cancelled },
      )
    );

  return new Response(req.method === "HEAD" ? null : calendarFile(events, `${band} · BandWith`), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": one ? 'attachment; filename="gig.ics"' : 'inline; filename="bandwith-deputy.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
});
