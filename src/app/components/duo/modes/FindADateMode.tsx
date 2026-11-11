import React, { useMemo } from 'react';
import { StepPad } from '@/app/components/bw';
import { Check, Lock } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { haptic } from '@/lib/haptics';
import type { RehearsalPoll, RehearsalPollOption } from '@/lib/services/rehearsalPolls';
import { FoldSplit } from '../FoldSplit';
import { DeckButton, DeckHeading, ModeEmpty, dayLabel, hhmm, initialsOf } from './shared';
import { personName } from '@/lib/personName';

/**
 * Find a date (an open rehearsal poll in Laptop pose). Display: members ×
 * candidate days, the best day lit, "N of M voted". Deck: your own day pads
 * to toggle, then Lock (admin) or Done (member).
 *
 * Data is the poll from `getRehearsalPoll` (src/lib/services/rehearsalPolls)
 * with its options' `votes`; the caller performs the writes
 * (`togglePollVote`, `finalizePollIntoRehearsal`) exactly as
 * RehearsalPollVoteSheet does.
 */

export interface PollMember {
  id: string;
  name: string;
}

export interface FindADateModeProps {
  poll: RehearsalPoll | null;
  /** Band members (rows). Without it, the rows are the people who voted plus you. */
  members?: PollMember[];
  currentUserId: string;
  isAdmin: boolean;
  loading?: boolean;
  /** Option whose vote is being saved: its pad is disabled meanwhile. */
  votingOptionId?: string | null;
  onToggleVote: (optionId: string) => void;
  /** Admin: confirm the best option as the rehearsal. */
  onLock?: (optionId: string) => void;
  locking?: boolean;
  /** Member: finished voting. */
  onDone?: () => void;
  /** See FoldSplit. Default 186: over the poll modal (120) and vote sheet (184/185), under the rail. */
  zIndex?: number;
}

const sortOptions = (options: RehearsalPollOption[]) =>
  [...options].sort((a, b) => a.proposed_date.localeCompare(b.proposed_date) || a.start_time.localeCompare(b.start_time));

/** The option with most votes (earliest wins ties); null when nobody voted. Exported for tests. */
export function bestOption(options: RehearsalPollOption[]): RehearsalPollOption | null {
  let best: RehearsalPollOption | null = null;
  for (const o of sortOptions(options)) {
    const n = o.vote_count ?? o.votes?.length ?? 0;
    if (n > 0 && (!best || n > (best.vote_count ?? best.votes?.length ?? 0))) best = o;
  }
  return best;
}

const timeRange = (o: RehearsalPollOption) => {
  const s = hhmm(o.start_time);
  const e = hhmm(o.end_time ?? null);
  return s && e ? `${s}–${e}` : s ?? undefined;
};

export const FindADateMode: React.FC<FindADateModeProps> = ({
  poll,
  members,
  currentUserId,
  isAdmin,
  loading,
  votingOptionId,
  onToggleVote,
  onLock,
  locking,
  onDone,
  zIndex = 186,
}) => {
  const options = useMemo(() => sortOptions(poll?.options ?? []), [poll?.options]);

  const rows: PollMember[] = useMemo(() => {
    if (members && members.length > 0) return members;
    const seen = new Map<string, PollMember>();
    for (const o of options) {
      for (const v of o.votes ?? []) {
        if (!seen.has(v.user_id)) {
          seen.set(v.user_id, { id: v.user_id, name: personName(v.profile) });
        }
      }
    }
    if (!seen.has(currentUserId)) seen.set(currentUserId, { id: currentUserId, name: 'You' });
    return [...seen.values()];
  }, [members, options, currentUserId]);

  const votedBy = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const o of options) {
      const set = new Set((o.votes ?? []).map((v) => v.user_id));
      // The optimistic toggle updates has_voted before votes reload.
      if (o.has_voted) set.add(currentUserId);
      else set.delete(currentUserId);
      map.set(o.id, set);
    }
    return map;
  }, [options, currentUserId]);

  const voters = useMemo(() => {
    const all = new Set<string>();
    votedBy.forEach((s) => s.forEach((id) => all.add(id)));
    return all.size;
  }, [votedBy]);
  const total = poll?.total_members_count || rows.length;
  const best = bestOption(options);
  const canVote = !!poll && !['proposed', 'confirmed', 'cancelled', 'expired'].includes(poll.status);

  const display = !poll ? (
    <div className="bw-fold-pad min-h-full flex items-center">
      <ModeEmpty title={loading ? 'Loading the poll…' : 'No open poll'} />
    </div>
  ) : (
    <div className="bw-fold-pad flex flex-col gap-3 pt-3 pb-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="bw-label-sm uppercase text-muted-foreground">Find a date</p>
          <h1 className="bw-h2 truncate">{poll.title || 'Rehearsal'}</h1>
        </div>
        <p className="bw-label-md shrink-0" aria-live="polite">
          {voters} of {total} voted
        </p>
      </div>
      {options.length === 0 ? (
        <ModeEmpty title="No dates proposed yet" />
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full border-separate border-spacing-1">
            <thead>
              <tr>
                <th scope="col" className="sr-only">Member</th>
                {options.map((o) => {
                  const isBest = best?.id === o.id;
                  return (
                    <th
                      key={o.id}
                      scope="col"
                      className={cn('rounded-[12px] px-1 py-1.5 text-center align-bottom', isBest && 'bg-accent text-accent-foreground')}
                    >
                      <span className="block bw-label-xs uppercase">{dayLabel(o.proposed_date, { weekday: 'short' })}</span>
                      <span className="block bw-num">{dayLabel(o.proposed_date, { day: 'numeric' })}</span>
                      <span className="block bw-label-xs opacity-70">{hhmm(o.start_time)}</span>
                      {isBest && <span className="sr-only">Best day</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <th scope="row" className="text-left pr-2 font-normal">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center bw-label-xs shrink-0" aria-hidden>
                        {initialsOf(m.name)}
                      </span>
                      <span className="bw-body-sm truncate max-w-[9rem]">{m.id === currentUserId ? 'You' : m.name}</span>
                    </span>
                  </th>
                  {options.map((o) => {
                    const yes = votedBy.get(o.id)?.has(m.id) ?? false;
                    const isBest = best?.id === o.id;
                    return (
                      <td key={o.id} className="p-0">
                        <span
                          className={cn('block h-7 rounded-[8px]', yes ? (isBest ? 'bg-accent' : 'bg-foreground') : 'bg-muted')}
                          aria-label={yes ? 'Available' : 'No vote'}
                          role="img"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const deck = (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-3 min-h-full">
      <DeckHeading trailing={best ? <span className="bw-label-md">Best: {dayLabel(best.proposed_date)}</span> : undefined}>
        Your vote
      </DeckHeading>
      {!poll || options.length === 0 ? (
        <ModeEmpty title={loading ? 'Loading…' : 'Nothing to vote on'} className="py-2" />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {options.map((o) => (
            <StepPad
              key={o.id}
              day={dayLabel(o.proposed_date, { weekday: 'short' }).toUpperCase()}
              date={dayLabel(o.proposed_date, { day: 'numeric' })}
              time={timeRange(o)}
              votes={rows.map((m) => votedBy.get(o.id)?.has(m.id) ?? false)}
              selected={!!o.has_voted}
              disabled={!canVote || votingOptionId === o.id}
              onClick={() => {
                haptic.tap();
                onToggleVote(o.id);
              }}
            />
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-col gap-2">
        {isAdmin && onLock ? (
          <DeckButton
            tone="accent"
            disabled={!best || !canVote || locking}
            onClick={() => {
              if (!best) return;
              haptic.medium();
              onLock(best.id);
            }}
          >
            <Lock className="w-5 h-5" />
            {best ? `Lock ${dayLabel(best.proposed_date)}` : 'Lock a date'}
          </DeckButton>
        ) : onDone ? (
          <DeckButton tone="inverse" onClick={() => { haptic.tap(); onDone(); }}>
            <Check className="w-5 h-5" /> Done
          </DeckButton>
        ) : null}
      </div>
    </div>
  );

  return <FoldSplit zIndex={zIndex} displayLabel="Availability" deckLabel="Your vote" display={display} deck={deck} />;
};

export default FindADateMode;
