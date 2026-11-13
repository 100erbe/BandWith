import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useOptionalBand } from '@/lib/BandContext';
import { personName } from '@/lib/personName';
import { useT } from '@/lib/i18n';
import { lineupSoFar, type LineupRow, type LineupRosterEntry, type LineupSummary } from '@/lib/lineupSoFar';

/**
 * Who is on a gig and whether they answered (see lineupSoFar). Reads only
 * event_members' user_id / status / role and the band roster: no fee ever
 * leaves the server for this. Null while loading or when it can't be read.
 */
export function useLineupSoFar(
  eventId: string | null | undefined,
  bandId: string | null | undefined,
  viewerId: string | null | undefined,
): LineupSummary | null {
  const t = useT();
  const bandCtx = useOptionalBand();
  const bands = bandCtx?.bands;
  const selectedBand = bandCtx?.selectedBand ?? null;
  const [rows, setRows] = useState<LineupRow[] | null>(null);
  const [extraNames, setExtraNames] = useState<Map<string, string>>(new Map());

  const band = useMemo(
    () => (bandId ? bands?.find((b) => b.id === bandId) : null) ?? (selectedBand?.id === bandId ? selectedBand : null),
    [bands, selectedBand, bandId],
  );
  const roster = useMemo(() => {
    const map = new Map<string, LineupRosterEntry>();
    for (const m of band?.members || []) {
      if (!m.user_id) continue;
      map.set(m.user_id, { name: personName(m.profile, ''), instrument: m.instrument || null });
    }
    return map;
  }, [band]);

  useEffect(() => {
    setRows(null);
    setExtraNames(new Map());
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('event_members').select('user_id, status, role').eq('event_id', eventId);
      if (cancelled || error) return;
      setRows((data || []) as LineupRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // People no longer on the roster: look up their name once.
  const missingKey = (rows || [])
    .map((r) => r.user_id)
    .filter((id) => id && !roster.get(id)?.name)
    .sort()
    .join(',');
  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', missingKey.split(','));
      if (cancelled) return;
      const map = new Map<string, string>();
      for (const p of (data || []) as { id: string; full_name?: string | null; email?: string | null }[]) {
        const n = personName(p, '');
        if (n) map.set(p.id, n);
      }
      setExtraNames(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [missingKey]);

  return useMemo(
    () => (rows ? lineupSoFar({ rows, roster, extraNames, viewerId, unknownName: t('Unknown musician') }) : null),
    [rows, roster, extraNames, viewerId, t],
  );
}
