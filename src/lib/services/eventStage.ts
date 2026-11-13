/**
 * Rider & stage of a gig (migrations 092 and 093).
 *
 * - event_stage: plot, inputs, who brings what. Every band member reads it,
 *   whoever manages the event writes it.
 * - bw_event_rider: the rider linked to the gig with its version and sent /
 *   seen dates, readable by members (contracts themselves are admin-only).
 * - bw_rider_share_link: the venue's read-only web link; opening it marks
 *   the rider as seen.
 */
import { supabase } from '@/lib/supabase';
import { APP_URL } from '@/lib/appUrl';
import { t } from '@/lib/i18n';
import { asStageData, toStageRow, type StageData } from '@/lib/stagePlot';

type Result<T> = { data: T; error: Error | null };

/** Database before 092/093: the feature stays hidden instead of failing. */
const isMissing = (err: { code?: string; message?: string } | null): boolean =>
  !!err &&
  (err.code === 'PGRST202' ||
    err.code === 'PGRST205' ||
    err.code === '42883' ||
    err.code === '42P01' ||
    /could not find the (function|table)|does not exist/i.test(err.message || ''));

export interface EventStage {
  data: StageData;
  /** A row exists (false: nothing saved yet). */
  saved: boolean;
  updatedAt: string | null;
}

export async function getEventStage(eventId: string): Promise<Result<EventStage | null>> {
  const { data, error } = await supabase
    .from('event_stage')
    .select('plots, inputs, mixer, band_brings, venue_provides, venue_agreed, updated_at')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) {
    if (isMissing(error)) return { data: null, error: null };
    return { data: null, error: new Error(error.message) };
  }
  if (!data) return { data: { data: asStageData(null), saved: false, updatedAt: null }, error: null };
  return { data: { data: asStageData(data as any), saved: true, updatedAt: (data as any).updated_at ?? null }, error: null };
}

/** Saves the whole stage of a gig (admins). */
export async function saveEventStage(eventId: string, bandId: string, stage: StageData): Promise<{ error: Error | null }> {
  const row = { event_id: eventId, band_id: bandId, ...toStageRow(stage) };
  const { data, error } = await supabase.from('event_stage').upsert(row, { onConflict: 'event_id' }).select('event_id');
  if (error) return { error: new Error(error.message) };
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return { error: new Error(t("This change wasn't saved: only band admins can edit the rider & stage.")) };
  }
  return { error: null };
}

export interface EventRider {
  id: string;
  title: string;
  version: number;
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'expired';
  sentAt: string | null;
  viewedAt: string | null;
}

/** The rider linked to the gig (latest version), or null. */
export async function getEventRider(eventId: string): Promise<Result<EventRider | null>> {
  const { data, error } = await supabase.rpc('bw_event_rider', { p_event_id: eventId });
  if (error) {
    if (isMissing(error)) return { data: null, error: null };
    return { data: null, error: new Error(error.message) };
  }
  const row = (Array.isArray(data) ? data[0] : data) as any;
  if (!row) return { data: null, error: null };
  return {
    data: {
      id: row.id,
      title: row.title,
      version: Number(row.version) || 1,
      status: row.status,
      sentAt: row.sent_at ?? null,
      viewedAt: row.viewed_at ?? null,
    },
    error: null,
  };
}

/** The venue's web link for a rider (admins). */
export async function riderShareLink(contractId: string): Promise<Result<string | null>> {
  const { data, error } = await supabase.rpc('bw_rider_share_link', { p_contract_id: contractId });
  if (error) return { data: null, error: new Error(error.message) };
  const token = typeof data === 'string' ? data : null;
  return { data: token ? riderPageUrl(token) : null, error: null };
}

export const riderPageUrl = (token: string, lang?: string) =>
  `${APP_URL}/rider.html?t=${token}${lang && lang !== 'en' ? `&l=${lang}` : ''}`;

/** Admins: mark one musician paid or not paid (093). */
export async function setMemberPaid(
  eventId: string,
  userId: string,
  paid: boolean,
): Promise<{ data: { user_id: string; paid_at: string | null } | null; error: Error | null }> {
  const { data, error } = await supabase.rpc('bw_set_member_paid', { p_event_id: eventId, p_user_id: userId, p_paid: paid });
  if (error) return { data: null, error: new Error(error.message) };
  const row = (Array.isArray(data) ? data[0] : data) as any;
  return { data: row ? { user_id: row.user_id, paid_at: row.paid_at ?? null } : null, error: null };
}
