import { supabase, getSafeUser } from '@/lib/supabase';
import { shareFile, type FileShareResult } from '@/lib/nativeFiles';
import { todayLocal } from '@/lib/dates';
import { EVENT_MEMBER_COLUMNS, withMoney } from '@/lib/services/eventMemberMoney';
import { t } from '@/lib/i18n';

/**
 * "Export my data": a JSON copy of what the signed-in user owns.
 * - profile: their own profiles row (incl. notification / privacy prefs)
 * - memberships: their band_members rows with the band name and role
 * - personalGigs: events with band_id NULL created by them
 * - eventMemberships: their own event_members rows (RSVP, fee) with the
 *   event title/date when they can still read it
 * Any Supabase error aborts the export (no partial or made-up data).
 */

export const DATA_EXPORT_FORMAT_VERSION = 1;

export interface MyDataExport {
  format: 'bandwith-user-export';
  version: number;
  exportedAt: string;
  account: { id: string; email: string | null };
  profile: Record<string, unknown> | null;
  memberships: Array<{
    band_id: string;
    band_name: string | null;
    role: string | null;
    instrument: string | null;
    stage_name: string | null;
    is_active: boolean | null;
    joined_at: string | null;
    left_at: string | null;
  }>;
  personalGigs: Record<string, unknown>[];
  eventMemberships: Record<string, unknown>[];
}

const fail = (what: string, error: { message?: string } | null | undefined): never => {
  throw new Error(`Couldn’t export ${what}: ${error?.message || 'unknown error'}`);
};

export const buildMyDataExport = async (): Promise<MyDataExport> => {
  const { data: { user }, error: authError } = await getSafeUser();
  if (authError) fail('your account', authError);
  if (!user) throw new Error('You need to be signed in to export your data.');

  const [profileRes, membershipsRes, gigsRes, eventMembersRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('band_members')
      .select('band_id, role, instrument, stage_name, is_active, joined_at, left_at, bands(name)')
      .eq('user_id', user.id),
    supabase
      .from('events')
      .select('*')
      .is('band_id', null)
      .eq('created_by', user.id)
      .order('event_date', { ascending: true }),
    supabase
      .from('event_members')
      .select(`${EVENT_MEMBER_COLUMNS}, events(title, event_date, band_id)`)
      .eq('user_id', user.id),
  ]);

  if (profileRes.error) fail('your profile', profileRes.error);
  if (membershipsRes.error) fail('your band memberships', membershipsRes.error);
  if (gigsRes.error) fail('your personal gigs', gigsRes.error);
  if (eventMembersRes.error) fail('your gig responses', eventMembersRes.error);

  const memberships = ((membershipsRes.data || []) as any[]).map((m) => {
    const band = Array.isArray(m.bands) ? m.bands[0] : m.bands;
    return {
      band_id: m.band_id,
      band_name: band?.name ?? null,
      role: m.role ?? null,
      instrument: m.instrument ?? null,
      stage_name: m.stage_name ?? null,
      is_active: m.is_active ?? null,
      joined_at: m.joined_at ?? null,
      left_at: m.left_at ?? null,
    };
  });

  return {
    format: 'bandwith-user-export',
    version: DATA_EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email ?? null },
    profile: (profileRes.data as Record<string, unknown> | null) ?? null,
    memberships,
    personalGigs: (gigsRes.data || []) as Record<string, unknown>[],
    eventMemberships: (await withMoney((eventMembersRes.data || []) as any[])) as Record<string, unknown>[],
  };
};

export const dataExportFileName = () => `bandwith-export-${todayLocal()}.json`;

/** Builds the export and hands it to the share sheet / download. */
export const exportMyData = async (): Promise<FileShareResult> => {
  const data = await buildMyDataExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  return shareFile(blob, dataExportFileName(), { title: t('BandWith data export') });
};
