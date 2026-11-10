import React, { useMemo, useState } from 'react';
import { EventMark, type EventKind } from '@/app/components/bw';
import { ChevronLeft, ChevronRight, Plus } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { money } from '@/lib/currency';
import { toLocalDateString, parseLocalDate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { FoldSplit } from '../FoldSplit';
import { DeckButton, DeckHeading, ModeEmpty, dayLabel, hhmm } from './shared';

/**
 * Planner (Calendar in Laptop pose). Display: the month, with a dot per kind
 * of event on each day and the month's counts. Deck: the selected day's
 * agenda and "+ Gig" / "+ Rehearsal".
 */

export interface PlannerEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  kind: EventKind;
  time?: string | null;
  venue?: string | null;
  /** Gig fee, counted in the month total for admins. */
  fee?: number | null;
}

export interface PlannerModeProps {
  events: PlannerEvent[];
  isAdmin: boolean;
  /** Controlled selected day (YYYY-MM-DD); defaults to today, kept internally. */
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  onOpenEvent?: (id: string) => void;
  onAddGig?: (date: string) => void;
  onAddRehearsal?: (date: string) => void;
  /** See FoldSplit. Default 70 (page level). */
  zIndex?: number;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const KIND_ORDER: EventKind[] = ['gig', 'rehearsal', 'quote', 'personal', 'past'];

export interface MonthStats {
  gigs: number;
  rehearsals: number;
  fees: number;
  freeWeekends: number;
}

/** Counts for the month containing `month` (pure; exported for tests). */
export function monthStats(events: PlannerEvent[], month: Date): MonthStats {
  const y = month.getFullYear();
  const m = month.getMonth();
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}-`;
  const inMonth = events.filter((e) => e.date.startsWith(prefix));
  const busy = new Set(events.map((e) => e.date.slice(0, 10)));
  let freeWeekends = 0;
  const last = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const day = new Date(y, m, d);
    if (day.getDay() !== 6) continue; // each Saturday starts a weekend
    const sun = new Date(y, m, d + 1);
    if (!busy.has(toLocalDateString(day)) && !busy.has(toLocalDateString(sun))) freeWeekends++;
  }
  return {
    gigs: inMonth.filter((e) => e.kind === 'gig').length,
    rehearsals: inMonth.filter((e) => e.kind === 'rehearsal').length,
    fees: inMonth.reduce((sum, e) => sum + (e.kind === 'gig' && typeof e.fee === 'number' && Number.isFinite(e.fee) ? e.fee : 0), 0),
    freeWeekends,
  };
}

/** Monday-first weeks covering the month, as YYYY-MM-DD or null for padding. */
function monthCells(month: Date): (string | null)[] {
  const y = month.getFullYear();
  const m = month.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(toLocalDateString(new Date(y, m, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const PlannerMode: React.FC<PlannerModeProps> = ({
  events,
  isAdmin,
  selectedDate,
  onSelectDate,
  onOpenEvent,
  onAddGig,
  onAddRehearsal,
  zIndex,
}) => {
  const today = toLocalDateString();
  const [internal, setInternal] = useState(selectedDate ?? today);
  const selected = selectedDate ?? internal;
  const select = (d: string) => {
    haptic.tap();
    setInternal(d);
    onSelectDate?.(d);
  };
  const selDate = parseLocalDate(selected);
  const month = useMemo(() => new Date(selDate.getFullYear(), selDate.getMonth(), 1), [selDate.getFullYear(), selDate.getMonth()]);

  const byDay = useMemo(() => {
    const map = new Map<string, PlannerEvent[]>();
    for (const e of events) {
      const key = e.date.slice(0, 10);
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    for (const list of map.values()) list.sort((a, b) => (hhmm(a.time) ?? '99').localeCompare(hhmm(b.time) ?? '99'));
    return map;
  }, [events]);

  const stats = useMemo(() => monthStats(events, month), [events, month]);
  const cells = useMemo(() => monthCells(month), [month]);
  const agenda = byDay.get(selected) ?? [];

  const shiftMonth = (delta: number) => {
    const target = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    const day = Math.min(selDate.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate());
    select(toLocalDateString(new Date(target.getFullYear(), target.getMonth(), day)));
  };
  const shiftDay = (delta: number) => {
    select(toLocalDateString(new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate() + delta)));
  };

  const counts: { label: string; value: string }[] = [
    { label: 'Gigs', value: String(stats.gigs) },
    { label: 'Rehearsals', value: String(stats.rehearsals) },
    ...(isAdmin ? [{ label: 'Fees', value: money(stats.fees) }] : []),
    { label: 'Free weekends', value: String(stats.freeWeekends) },
  ];

  const display = (
    <div className="bw-fold-pad flex flex-col gap-3 pt-3 pb-4">
      <div className="flex items-end justify-between gap-4">
        <h1 className="bw-h1">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h1>
      </div>
      <dl className="grid gap-3" style={{ gridTemplateColumns: `repeat(${counts.length}, minmax(0, 1fr))` }}>
        {counts.map((c) => (
          <div key={c.label} className="flex flex-col gap-0.5 min-w-0">
            <dt className="bw-label-sm uppercase text-muted-foreground truncate">{c.label}</dt>
            <dd className="bw-value-md truncate">{c.value}</dd>
          </div>
        ))}
      </dl>
      <div role="grid" aria-label="Month" className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <span key={w} role="columnheader" className="bw-label-xs uppercase text-muted-foreground text-center">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`pad-${i}`} aria-hidden />;
          const list = byDay.get(d) ?? [];
          const kinds = KIND_ORDER.filter((k) => list.some((e) => e.kind === k)).slice(0, 3);
          const isSel = d === selected;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              aria-selected={isSel}
              aria-label={`${dayLabel(d, { weekday: 'long', month: 'long', day: 'numeric' })}${list.length ? `, ${list.length} ${list.length === 1 ? 'event' : 'events'}` : ''}`}
              onClick={() => select(d)}
              className={cn(
                'h-11 rounded-[12px] flex flex-col items-center justify-center gap-1 cursor-pointer',
                isSel ? 'bg-surface-inverse text-surface-inverse-foreground' : isToday ? 'ring-[1.5px] ring-foreground' : '',
              )}
            >
              <span className="bw-label-md leading-none">{Number(d.slice(8, 10))}</span>
              <span className="flex gap-0.5 h-1.5" aria-hidden>
                {kinds.map((k) => (
                  <span key={k} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `var(--accent-${k})` }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const deck = (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-3 min-h-full">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className="w-11 h-11 rounded-full bg-muted flex items-center justify-center cursor-pointer">
          <ChevronLeft className="w-5 h-5" />
          <ChevronLeft className="w-5 h-5 -ml-3.5" />
        </button>
        <button type="button" aria-label="Previous day" onClick={() => shiftDay(-1)} className="w-11 h-11 rounded-full bg-muted flex items-center justify-center cursor-pointer">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="flex-1 min-w-0 text-center bw-h3 truncate" aria-live="polite">
          {selected === today ? 'Today' : dayLabel(selected, { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
        <button type="button" aria-label="Next day" onClick={() => shiftDay(1)} className="w-11 h-11 rounded-full bg-muted flex items-center justify-center cursor-pointer">
          <ChevronRight className="w-5 h-5" />
        </button>
        <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className="w-11 h-11 rounded-full bg-muted flex items-center justify-center cursor-pointer">
          <ChevronRight className="w-5 h-5" />
          <ChevronRight className="w-5 h-5 -ml-3.5" />
        </button>
      </div>
      <section aria-label="Agenda" className="flex-1 flex flex-col gap-2">
        <DeckHeading>Agenda</DeckHeading>
        {agenda.length === 0 ? (
          <ModeEmpty title="Free" detail="Nothing on this day." className="py-2" />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {agenda.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={!onOpenEvent}
                  onClick={() => {
                    haptic.tap();
                    onOpenEvent?.(e.id);
                  }}
                  className="w-full min-h-14 flex items-center gap-3 rounded-[16px] bg-muted px-3 py-2 text-left cursor-pointer disabled:cursor-default"
                >
                  <EventMark kind={e.kind} size={24} />
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="bw-body-md font-semibold truncate">{e.title}</span>
                    {(e.venue || e.time) && (
                      <span className="bw-body-sm text-muted-foreground truncate">
                        {[hhmm(e.time), e.venue].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  {isAdmin && e.kind === 'gig' && typeof e.fee === 'number' && e.fee > 0 && (
                    <span className="bw-label-md shrink-0">{money(e.fee)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {(onAddGig || onAddRehearsal) && (
        <div className="grid grid-cols-2 gap-2">
          {onAddGig && (
            <DeckButton tone="accent" onClick={() => { haptic.tap(); onAddGig(selected); }}>
              <Plus className="w-5 h-5" /> Gig
            </DeckButton>
          )}
          {onAddRehearsal && (
            <DeckButton tone="inverse" onClick={() => { haptic.tap(); onAddRehearsal(selected); }}>
              <Plus className="w-5 h-5" /> Rehearsal
            </DeckButton>
          )}
        </div>
      )}
    </div>
  );

  return <FoldSplit zIndex={zIndex} displayLabel="Month" deckLabel="Day planner" display={display} deck={deck} />;
};

export default PlannerMode;
