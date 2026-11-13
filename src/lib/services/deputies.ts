import { supabase } from '@/lib/supabase';
import { t } from '@/lib/i18n';
import { instrumentKeys } from '@/lib/instruments';

/**
 * Deputies: session musicians the band calls when a member can't play
 * (table band_deputies, migration 069; admins only). They don't need a
 * BandWith account: the request goes out by WhatsApp, SMS or email with
 * a reply link (/deputy.html, migration 084).
 */
export interface Deputy {
  id: string;
  band_id: string;
  name: string;
  instrument: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  default_fee: number | null;
  /** Their BandWith account, once they opened the app from a reply link (086). */
  user_id?: string | null;
  created_at?: string;
}

export type DeputyInput = Pick<Deputy, 'name' | 'instrument' | 'phone' | 'email' | 'notes' | 'default_fee'>;

/** True when the table isn't there yet (migration 069 not applied). */
export const deputiesUnavailable = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || (/band_deputies/.test(e.message || '') && /exist|schema cache/i.test(e.message || '')));

const clean = (v: DeputyInput): DeputyInput => ({
  name: v.name.trim().slice(0, 120),
  instrument: v.instrument?.trim().slice(0, 60) || null,
  phone: v.phone?.trim().slice(0, 40) || null,
  email: v.email?.trim().slice(0, 200) || null,
  notes: v.notes?.trim().slice(0, 1000) || null,
  default_fee: v.default_fee != null && Number.isFinite(v.default_fee) && v.default_fee >= 0 ? v.default_fee : null,
});

export async function listDeputies(bandId: string) {
  const { data, error } = await supabase
    .from('band_deputies')
    .select('id, band_id, name, instrument, phone, email, notes, default_fee, user_id, created_at')
    .eq('band_id', bandId)
    .order('instrument', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });
  return { data: (data || []) as Deputy[], error };
}

export async function saveDeputy(bandId: string, input: DeputyInput, id?: string) {
  const row = clean(input);
  const q = id
    ? supabase.from('band_deputies').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)
    : supabase.from('band_deputies').insert({ ...row, band_id: bandId });
  const { error } = await q;
  return { error };
}

export async function deleteDeputy(id: string) {
  const { error } = await supabase.from('band_deputies').delete().eq('id', id);
  return { error };
}

/** Same instrument first ("Bass" matches "Bass · Backing vocals"). */
export function rankDeputies(deputies: Deputy[], role: string | null | undefined): Deputy[] {
  const want = instrumentKeys(role);
  if (want.length === 0) return deputies;
  // 0 plays it as main instrument · 1 plays it too · 2 plays another instrument
  // the member covers · 3 something else · 4 no instrument set.
  const score = (d: Deputy) => {
    const has = instrumentKeys(d.instrument);
    if (has.length === 0) return 4;
    if (has[0] === want[0]) return 0;
    if (has.includes(want[0])) return 1;
    if (has.some((k) => want.includes(k))) return 2;
    return 3;
  };
  return [...deputies].sort((a, b) => score(a) - score(b));
}

// ------------------------------------------------------------------
// Requests with a reply link (migration 084). The deputy answers on
// /deputy.html without an account; the admins get a push.
// ------------------------------------------------------------------

export const DEPUTY_PAGE_URL = 'https://bandwith.pages.dev/deputy.html';
export const deputyReplyUrl = (token: string) => `${DEPUTY_PAGE_URL}?t=${token}`;

export type DeputyRequestStatus = 'pending' | 'available' | 'maybe' | 'unavailable' | 'cancelled';

export interface DeputyRequest {
  id: string;
  event_id: string;
  deputy_id: string | null;
  deputy_name: string;
  replaces_user_id: string | null;
  role: string | null;
  fee_offered: number | null;
  token: string;
  status: DeputyRequestStatus;
  reply_note: string | null;
  responded_at: string | null;
  created_at: string;
  /** What changed in the gig since the deputy answered (from the reply page's view). */
  changes?: string[];
}

/** True when the table isn't there yet (migration 084 not applied). */
export const deputyRequestsUnavailable = (e: { code?: string; message?: string } | null | undefined) =>
  !!e &&
  (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' ||
    (/deputy_request/.test(e.message || '') && /exist|schema cache|function/i.test(e.message || '')));

/** Creates the request (or reuses the open one for this deputy and gig). */
export async function openDeputyRequest(o: {
  eventId: string;
  deputyId: string;
  replacesUserId?: string | null;
  role?: string | null;
  fee?: number | null;
}) {
  const { data, error } = await supabase.rpc('bw_deputy_request_open', {
    p_event_id: o.eventId,
    p_deputy_id: o.deputyId,
    p_replaces_user_id: o.replacesUserId ?? null,
    p_role: o.role ?? null,
    p_fee: o.fee ?? null,
  });
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; token: string; status: DeputyRequestStatus } | null;
  return { data: row, error };
}

/** The gig's requests, newest first, with what changed since each answer. */
export async function listDeputyRequests(eventId: string) {
  const { data, error } = await supabase
    .from('deputy_requests')
    .select('id, event_id, deputy_id, deputy_name, replaces_user_id, role, fee_offered, token, status, reply_note, responded_at, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  const rows = (data || []) as DeputyRequest[];
  await Promise.all(
    rows
      .filter((r) => r.status === 'available' || r.status === 'maybe')
      .map(async (r) => {
        const { data: view } = await supabase.rpc('bw_deputy_request_view', { p_token: r.token });
        const changes = (view as { changes?: unknown } | null)?.changes;
        r.changes = Array.isArray(changes) ? changes.map(String) : [];
      }),
  );
  return { data: rows, error };
}

export async function cancelDeputyRequest(id: string) {
  const { error } = await supabase
    .from('deputy_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error };
}

/** The latest request per deputy (cancelled ones only when nothing newer). */
export function latestRequestByDeputy(requests: DeputyRequest[]): Record<string, DeputyRequest> {
  const out: Record<string, DeputyRequest> = {};
  for (const r of requests) {
    if (!r.deputy_id) continue;
    const prev = out[r.deputy_id];
    if (!prev || (prev.status === 'cancelled' && r.status !== 'cancelled')) out[r.deputy_id] = r;
  }
  return out;
}

export interface DeputyGigText {
  deputyName: string;
  bandName: string;
  eventTitle: string;
  dateLabel: string;
  timeLabel?: string | null;
  loadInLabel?: string | null;
  venue?: string | null;
  role?: string | null;
  fee?: string | null;
  /** The reply page. */
  link?: string | null;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** The request text sent to a deputy. */
export function deputyRequestText(o: DeputyGigText): string {
  return [
    t("Hi {name}, it's {band}.", { name: firstName(o.deputyName), band: o.bandName }),
    o.role
      ? t('Are you available to play {role} with us at "{event}"?', { role: o.role.toLowerCase(), event: o.eventTitle })
      : t('Are you available to play with us at "{event}"?', { event: o.eventTitle }),
    `📅 ${o.dateLabel}${o.timeLabel ? ` · ${o.timeLabel}` : ''}`,
    o.venue ? `📍 ${o.venue}` : null,
    o.fee ? `💶 ${o.fee}` : null,
    o.link ? t('Answer here in one tap: {link}', { link: o.link }) : t('Let us know as soon as you can. Thanks!'),
  ]
    .filter(Boolean)
    .join('\n');
}

const gigLines = (o: DeputyGigText) => [
  `📅 ${o.dateLabel}${o.timeLabel ? ` · ${o.timeLabel}` : ''}`,
  o.loadInLabel ? `🚚 ${t('Load-in {time}', { time: o.loadInLabel })}` : null,
  o.venue ? `📍 ${o.venue}` : null,
  o.role ? `🎸 ${o.role}` : null,
  o.fee ? `💶 ${o.fee}` : null,
];

/** After the deputy said yes: the gig in short, with the page (address, calendar). */
export function deputyRecapText(o: DeputyGigText): string {
  return [
    t('Hi {name}, it\'s {band}: you\'re confirmed for "{event}". Thanks!', { name: firstName(o.deputyName), band: o.bandName, event: o.eventTitle }),
    ...gigLines(o),
    o.link ? t('Details, address and calendar: {link}', { link: o.link }) : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/** The gig changed after the deputy answered. */
export function deputyUpdateText(o: DeputyGigText): string {
  return [
    t('Hi {name}, it\'s {band}: "{event}" has changed. The new details:', { name: firstName(o.deputyName), band: o.bandName, event: o.eventTitle }),
    ...gigLines(o),
    o.link ? t('Can you still make it? Answer here: {link}', { link: o.link }) : t('Can you still make it?'),
  ]
    .filter(Boolean)
    .join('\n');
}

// ------------------------------------------------------------------
// Deputies in the app (migration 086). A deputy who opens the app from
// the reply link gets their account linked to the band's entry; the band
// then asks them in the app, and they answer from "Deputy gigs".
// ------------------------------------------------------------------

/** "Ask in the app" again on an existing request: sent | not_linked | closed | throttled. */
export async function pingDeputyRequest(requestId: string) {
  const { data, error } = await supabase.rpc('bw_deputy_request_ping', { p_request_id: requestId });
  return { data: (data as string | null) ?? null, error };
}

export type DeputyClaimStatus = 'linked' | 'already' | 'taken' | 'member' | 'not_found';
export interface DeputyClaimResult {
  status: DeputyClaimStatus;
  band_name?: string | null;
  deputy_name?: string | null;
}

/** Links the signed-in account to the deputy of that reply link. */
export async function claimDeputy(token: string) {
  const { data, error } = await supabase.rpc('bw_deputy_claim', { p_token: token });
  return { data: (data as DeputyClaimResult | null) ?? null, error };
}

export type DeputyAnswer = 'available' | 'maybe' | 'unavailable';
export type DeputyChangeKey = 'date' | 'load_in' | 'soundcheck' | 'start' | 'end' | 'venue' | 'city' | 'address';

/** One request as the deputy sees it (bw_deputy_request_view + id and token). */
export interface DeputyGig {
  id: string;
  token: string;
  status: DeputyRequestStatus;
  deputy_name: string;
  role: string | null;
  fee: number | null;
  currency: string | null;
  reply_note: string | null;
  responded_at: string | null;
  band_name: string;
  event_title: string | null;
  event_type: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  load_in_time: string | null;
  soundcheck_time: string | null;
  venue_name: string | null;
  venue_city: string | null;
  /** Only after a yes. */
  venue_address: string | null;
  event_cancelled: boolean;
  changes: DeputyChangeKey[];
  before: Partial<Record<DeputyChangeKey, string | null>>;
  closed: boolean;
}

export interface MyDeputyGigs {
  /** The bands that have this account as a deputy. */
  bands: { band_name: string; deputy_name: string }[];
  gigs: DeputyGig[];
}

const EMPTY_DEPUTY_GIGS: MyDeputyGigs = { bands: [], gigs: [] };

/** The caller's deputy gigs across bands (from 30 days ago on). */
export async function listMyDeputyGigs() {
  const { data, error } = await supabase.rpc('bw_my_deputy_gigs');
  const d = (data || null) as Partial<MyDeputyGigs> | null;
  return {
    data: d ? { bands: Array.isArray(d.bands) ? d.bands : [], gigs: Array.isArray(d.gigs) ? d.gigs : [] } : EMPTY_DEPUTY_GIGS,
    error,
  };
}

/** The deputy answers in the app (same RPC as the reply page). */
export async function answerDeputyGig(token: string, answer: DeputyAnswer, note?: string | null) {
  const { data, error } = await supabase.rpc('bw_deputy_request_reply', {
    p_token: token,
    p_answer: answer,
    p_note: note?.trim() ? note.trim().slice(0, 500) : null,
  });
  return { data: (data as Omit<DeputyGig, 'id' | 'token'> | null) ?? null, error };
}

export const whatsappUrl = (phone: string, text: string) => {
  const digits = phone.replace(/[^\d+]/g, '').replace(/^00/, '+').replace(/^\+/, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
};
export const smsUrl = (phone: string, text: string) =>
  `sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(text)}`;
export const emailUrl = (email: string, subject: string, text: string) =>
  `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
