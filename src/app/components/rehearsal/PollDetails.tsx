/**
 * Place, cost share and focus songs of a rehearsal poll (097), as members see
 * them while they vote. The room's total cost stays with the admin: members
 * get only their share ("€12 each").
 */
import React, { useEffect, useState } from 'react';
import { MapPin, Music2 } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { supabase } from '@/lib/supabase';
import { getActiveSymbol as sym } from '@/lib/currency';
import { useT } from '@/lib/i18n';
import type { RehearsalPoll } from '@/lib/services/rehearsalPolls';

/** "€12 each" share of the room cost, or null without a cost. */
export function pollShareLabel(cost: number | string | null | undefined, members: number | undefined): string | null {
  const total = Number(cost);
  if (!total || total <= 0) return null;
  const each = total / Math.max(1, members || 1);
  const rounded = Math.round(each * 100) / 100;
  return `${sym().trim()}${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

/** Titles of the poll's focus songs, in the poll's order. */
export function usePollSongTitles(ids: string[] | null | undefined): string[] {
  const key = (ids || []).join(',');
  const [titles, setTitles] = useState<string[]>([]);
  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (list.length === 0) {
      setTitles([]);
      return;
    }
    let alive = true;
    supabase
      .from('songs')
      .select('id, title')
      .in('id', list)
      .then(({ data }) => {
        if (!alive) return;
        const byId = new Map(((data as { id: string; title: string }[] | null) || []).map(s => [s.id, s.title]));
        setTitles(list.map(id => byId.get(id)).filter((x): x is string => !!x));
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return titles;
}

export const PollDetails: React.FC<{
  poll: Pick<RehearsalPoll, 'location' | 'room_cost' | 'focus_song_ids' | 'total_members_count'>;
  className?: string;
}> = ({ poll, className }) => {
  const t = useT();
  const songs = usePollSongTitles(poll.focus_song_ids);
  const share = pollShareLabel(poll.room_cost, poll.total_members_count);
  const place = poll.location?.trim();
  if (!place && !share && songs.length === 0) return null;
  return (
    <div className={cn('flex flex-col gap-2', className)} data-bw-poll-details="">
      {(place || share) && (
        <p className="bw-body-sm flex items-center gap-2 min-w-0">
          {place && <MapPin aria-hidden className="w-4 h-4 shrink-0" />}
          <span className="min-w-0 truncate">
            {[place, share ? t('{amount} each', { amount: share }) : null].filter(Boolean).join(' · ')}
          </span>
        </p>
      )}
      {songs.length > 0 && (
        <div className="flex items-start gap-2 min-w-0">
          <Music2 aria-hidden className="w-4 h-4 shrink-0 mt-[2px]" />
          <p className="bw-body-sm min-w-0 [overflow-wrap:anywhere]">
            <span className="sr-only">{t('Focus songs')}: </span>
            {songs.join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
};
