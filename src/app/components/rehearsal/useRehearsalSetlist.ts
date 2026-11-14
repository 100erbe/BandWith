import { useEffect, useState } from 'react';
import { getSetlist } from '@/lib/services/songs';
import { useT } from '@/lib/i18n';

/** A song of the rehearsal's setlist, as the rehearsal screens show it. */
export type RehearsalSetlistSong = {
  id: string;
  title: string;
  artist?: string;
  key?: string;
  bpm?: number;
  duration?: string;
};

/** The songs of a rehearsal's saved setlist, in set order ([] without one). */
export const useRehearsalSetlist = (setlistId: string | undefined) => {
  const t = useT();
  const [setlist, setSetlist] = useState<RehearsalSetlistSong[]>([]);
  useEffect(() => {
    if (!setlistId) {
      setSetlist([]);
      return;
    }
    let cancelled = false;
    getSetlist(setlistId).then(({ data }) => {
      if (cancelled) return;
      setSetlist(
        (data?.songs || []).map((row: any) => {
          const secs = row.song?.duration_seconds;
          return {
            id: row.id,
            title: row.song?.title || t('Untitled song'),
            artist: row.song?.artist || undefined,
            key: row.song?.key || undefined,
            bpm: row.song?.bpm || undefined,
            duration: typeof secs === 'number' && secs > 0 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : undefined,
          };
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [setlistId, t]);
  return setlist;
};
