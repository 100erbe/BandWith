import React from 'react';
import { EventMark, type EventKind } from '@/app/components/bw';
import { ChevronRight, Plus } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { money } from '@/lib/currency';
import { haptic } from '@/lib/haptics';
import type { EventItem } from '@/app/data/events';
import { FoldSplit } from '../FoldSplit';
import { DeckButton, DeckHeading, ModeEmpty, dayLabel, daysFromToday, hhmm, relativeDays } from './shared';

/**
 * Band desk (Home in Laptop pose). Display: the next gig as a poster (the
 * next rehearsal, in its own colour, when no gig is confirmed).
 * Deck: what needs doing, the create buttons and a compact tab bar.
 */

export interface DeskGig {
  id?: string;
  /** The poster shows the next gig; with none confirmed, the next rehearsal. */
  kind?: 'gig' | 'rehearsal';
  title: string;
  /** YYYY-MM-DD */
  date: string;
  venue?: string | null;
  city?: string | null;
  loadIn?: string | null;
  soundcheck?: string | null;
  start?: string | null;
  /** Names of the musicians on the gig. */
  lineup?: string[];
  /** Shown to admins only. */
  fee?: number | string | null;
}

/** Maps the app's EventItem (AuthenticatedApp `eventToEventItem`) to a poster. */
export function deskGigFromEvent(e: EventItem): DeskGig {
  const fee = e.price !== undefined && e.price !== null && e.price !== '' ? Number(e.price) : null;
  return {
    id: e.eventId ?? String(e.id),
    title: e.title,
    date: e.date,
    venue: e.venueName || e.location || null,
    city: e.venueName ? e.venueCity ?? null : null,
    loadIn: e.loadInTime ?? null,
    soundcheck: e.soundcheckTime ?? null,
    start: e.time || null,
    lineup: e.members ?? [],
    fee: fee !== null && Number.isFinite(fee) && fee > 0 ? fee : null,
  };
}

export interface DeskActionItem {
  id: string;
  title: string;
  detail?: string;
  kind?: EventKind;
  /** Listed first and marked (overdue, waiting on you). */
  urgent?: boolean;
  onSelect?: () => void;
}

export interface BandDeskModeProps {
  nextGig: DeskGig | null;
  isAdmin: boolean;
  actionItems: DeskActionItem[];
  /** Data still loading: the poster says so instead of "no gigs". */
  loading?: boolean;
  /** Opens the event on the poster (the same as tapping it on Home). */
  onOpenGig?: () => void;
  onCreateGig?: () => void;
  onCreateRehearsal?: () => void;
  onCreateQuote?: () => void;
  onCreateTask?: () => void;
  /** Compact tab bar for the Deck's bottom edge. */
  children?: React.ReactNode;
  /** See FoldSplit. Default 70 (page level). */
  zIndex?: number;
}

const GigPoster: React.FC<{ gig: DeskGig | null; isAdmin: boolean; loading?: boolean; onOpen?: () => void }> = ({
  gig,
  isAdmin,
  loading,
  onOpen,
}) => {
  if (!gig) {
    return (
      <div className="bw-fold-pad min-h-full flex items-center">
        <ModeEmpty
          title={loading ? 'Loading your next gig…' : 'Nothing coming up'}
          detail={loading ? undefined : 'Your next gig or rehearsal shows here.'}
        />
      </div>
    );
  }
  const when = relativeDays(daysFromToday(gig.date));
  const times = [
    { label: 'Load-in', value: hhmm(gig.loadIn) },
    { label: 'Soundcheck', value: hhmm(gig.soundcheck) },
    { label: 'Start', value: hhmm(gig.start) },
  ].filter((t) => !!t.value);
  const place = [gig.venue, gig.city].filter(Boolean).join(', ');
  const kind = gig.kind ?? 'gig';
  const fee = kind === 'gig' && isAdmin && gig.fee !== null && gig.fee !== undefined && gig.fee !== '' ? money(gig.fee) : null;

  return (
    // Hero card, edge to edge (Figma: hero cards run to the Display's edges).
    <article
      className="bw-fold-hero relative min-h-full flex flex-col"
      style={{ backgroundColor: `var(--accent-${kind})`, color: `var(--accent-${kind}-fg)` }}
      aria-label={`Next ${kind}: ${gig.title}`}
    >
      <div className="bw-fold-pad flex-1 flex flex-col gap-4 pb-5">
        <p className="flex items-center gap-2 bw-label-sm uppercase">
          <EventMark kind={kind} bare size={20} />
          <span>Next {kind}{when ? ` · ${when}` : ''}</span>
        </p>
        <h1 className="bw-display-lg line-clamp-2 [overflow-wrap:anywhere]">{gig.title}</h1>
        <p className="bw-h3">
          {dayLabel(gig.date)}
          {place && <span className="opacity-70"> · {place}</span>}
        </p>
        {times.length > 0 && (
          <dl className="grid gap-3" style={{ gridTemplateColumns: `repeat(${times.length}, minmax(0, 1fr))` }}>
            {times.map((t) => (
              <div key={t.label} className="flex flex-col gap-1">
                <dt className="bw-label-sm uppercase opacity-70">{t.label}</dt>
                <dd className="bw-value-md">{t.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-auto flex items-end justify-between gap-4">
          <p className="bw-body-sm min-w-0 [overflow-wrap:anywhere]">
            {gig.lineup && gig.lineup.length > 0 ? gig.lineup.join(' · ') : <span className="opacity-60">Line-up not set</span>}
          </p>
          {fee && (
            <p className="flex flex-col items-end shrink-0">
              <span className="bw-label-sm uppercase opacity-70">Fee</span>
              <span className="bw-value-md">{fee}</span>
            </p>
          )}
        </div>
      </div>
      {onOpen && (
        <button
          type="button"
          aria-label={`Open ${gig.title}`}
          onClick={() => {
            haptic.tap();
            onOpen();
          }}
          className="absolute inset-0 cursor-pointer active:bg-black/5 transition-colors"
        />
      )}
    </article>
  );
};

export const BandDeskMode: React.FC<BandDeskModeProps> = ({
  nextGig,
  isAdmin,
  actionItems,
  loading,
  onOpenGig,
  onCreateGig,
  onCreateRehearsal,
  onCreateQuote,
  onCreateTask,
  children,
  zIndex,
}) => {
  const items = [...actionItems].sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent));
  const creates: { label: string; kind: EventKind | null; run?: () => void }[] = [
    { label: 'Gig', kind: 'gig' as const, run: onCreateGig },
    { label: 'Rehearsal', kind: 'rehearsal' as const, run: onCreateRehearsal },
    { label: 'Quote', kind: 'quote' as const, run: onCreateQuote },
    { label: 'Task', kind: null, run: onCreateTask },
  ].filter((c) => !!c.run);

  const deck = (
    <div className="min-h-full flex flex-col">
      <div className="flex-1 flex flex-col gap-4 px-4 pt-3 pb-3">
        <section className="flex flex-col gap-2" aria-label="Action items">
          <DeckHeading>Action items</DeckHeading>
          {items.length === 0 ? (
            <ModeEmpty title="Nothing needs you" detail="New requests and tasks land here." className="py-2" />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {items.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    disabled={!it.onSelect}
                    onClick={() => {
                      haptic.tap();
                      it.onSelect?.();
                    }}
                    className="w-full min-h-14 flex items-center gap-3 rounded-[16px] bg-muted px-3 py-2 text-left cursor-pointer active:scale-[0.99] transition-transform disabled:cursor-default"
                  >
                    {it.kind ? <EventMark kind={it.kind} size={24} /> : <span className="w-6 h-6 rounded-[8px] bg-foreground/10 shrink-0" aria-hidden />}
                    <span className="flex-1 min-w-0 flex flex-col">
                      <span className="bw-body-md font-semibold truncate">{it.title}</span>
                      {it.detail && <span className="bw-body-sm text-muted-foreground truncate">{it.detail}</span>}
                    </span>
                    {it.urgent && <span className="w-2 h-2 rounded-full bg-destructive-solid shrink-0" aria-label="Needs attention" />}
                    {it.onSelect && <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {creates.length > 0 && (
          <section className="flex flex-col gap-2" aria-label="Create">
            <DeckHeading>Create</DeckHeading>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${creates.length}, minmax(0, 1fr))` }}>
              {creates.map((c) => (
                <DeckButton
                  key={c.label}
                  className="flex-col gap-1.5 py-2"
                  onClick={() => {
                    haptic.tap();
                    c.run?.();
                  }}
                  aria-label={`New ${c.label.toLowerCase()}`}
                >
                  {c.kind ? <EventMark kind={c.kind} size={24} /> : <Plus className="w-6 h-6" />}
                  <span>{c.label}</span>
                </DeckButton>
              ))}
            </div>
          </section>
        )}
      </div>
      {children && (
        // Navigation sits on the Deck's bottom edge.
        <nav aria-label="Tabs" className={cn('sticky bottom-0 px-4 pt-2 pb-2 bg-background')}>
          {children}
        </nav>
      )}
    </div>
  );

  return (
    <FoldSplit
      zIndex={zIndex}
      displayLabel="Next gig"
      deckLabel="Band desk"
      display={<GigPoster gig={nextGig} isAdmin={isAdmin} loading={loading} onOpen={onOpenGig} />}
      deck={deck}
    />
  );
};

export default BandDeskMode;
