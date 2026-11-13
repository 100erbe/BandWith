import React from 'react';
import { motion } from 'motion/react';
import { springs } from '@/styles/motion';
import { ArrowUpRight } from '@/app/components/icons';
import { EventMark, type EventKind } from '@/app/components/bw/EventMark';
import { parseLocalDate } from '@/lib/dates';
import { getActiveSymbol as sym, useCurrency } from '@/lib/currency';
import { useT, dateName } from '@/lib/i18n';

export interface EventData {
  id: number;
  band_id?: string;
  band_name?: string;
  eventId?: string;
  title: string;
  status: string;
  date: string;
  time: string;
  location: string;
  price: string;
  members: string[];
  color: string;
  notes?: string;
  createdBy?: string;
  setlistId?: string;
  clientName?: string;
  venueAddress?: string;
  venueCity?: string;
  guests?: number;
  eventType?: string;
  loadInTime?: string;
  soundcheckTime?: string;
  endTime?: string;
  indoorOutdoor?: 'indoor' | 'outdoor' | 'hybrid';
  quoteId?: string;
  quoteStatus?: string;
  is_recurring?: boolean;
  recurrence_rule?: { freq?: string; frequency?: string; interval?: number; until?: string; count?: number };
  memberUserIds?: string[];
  memberFeeMap?: Record<string, string>;
  /** DB financial/contact fields (events table) */
  paymentStatus?: 'pending' | 'partial' | 'paid' | 'tbd';
  depositAmount?: number;
  depositPaid?: boolean;
  dressCode?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  venueName?: string;
  venueCoordinates?: { lat: number; lng: number };
  _isPendingSync?: boolean;
  /** A saved draft shown in the calendar (only its author sees it). */
  draftOf?: 'gig' | 'rehearsal' | 'quote';
  /** lib/wizardDrafts id, for gig and rehearsal drafts. */
  draftId?: string;
}

interface EventCardProps {
  event: EventData;
  onClick: () => void;
}

/** Figma "Event Card": the whole card is the event colour (see EventsView). */
export const EventCard: React.FC<EventCardProps> = ({ event, onClick }) => {
  const t = useT();
  useCurrency(); // re-render money labels when the band currency changes
  const status = (event.status || '').toUpperCase();
  const kind: EventKind =
    status === 'REHEARSAL' ? 'rehearsal'
    : status === 'QUOTE' || status === 'QUOTED' ? 'quote'
    : !event.band_id ? 'personal'
    : 'gig';
  const typeLabel = kind === 'personal' ? t('Personal') : kind === 'rehearsal' ? t('Rehearsal') : kind === 'quote' ? t('Quote') : t('Gig');
  const d = event.date ? parseLocalDate(event.date) : null;
  const valid = !!d && !isNaN(d.getTime());
  const chipBg = `color-mix(in srgb, var(--accent-${kind}-fg) 12%, transparent)`;
  const statusChip = ['REHEARSAL', 'QUOTE', 'QUOTED'].includes(status) ? '' : status;
  const meta = [event.time, event.location].filter(Boolean).join(' · ');

  return (
    <motion.div
      layoutId={`card-${event.id}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="relative flex flex-col gap-4 rounded-[24px] p-5 cursor-pointer active:scale-[0.99] transition-transform"
      transition={springs.smooth}
      style={{ backgroundColor: `var(--accent-${kind})`, color: `var(--accent-${kind}-fg)`, borderRadius: 24 }}
    >
      {/* Top: chips + title, open affordance */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <motion.div layoutId={`status-${event.id}`} className="flex items-center gap-1.5 flex-wrap">
            <EventMark kind={kind} size={20} bare />
            <span className="bw-label-xs">{typeLabel}</span>
            {statusChip && (
              <span className="bw-label-xs h-4 px-1.5 rounded-full inline-flex items-center" style={{ backgroundColor: chipBg }}>
                {statusChip === 'CONFIRMED' ? t('CONFIRMED')
                  : statusChip === 'COMPLETED' ? t('COMPLETED')
                  : statusChip === 'PENDING' ? t('PENDING')
                  : statusChip === 'DRAFT' ? t('DRAFT')
                  : statusChip === 'CANCELLED' ? t('CANCELLED')
                  : statusChip === 'TENTATIVE' ? t('TENTATIVE')
                  : statusChip}
              </span>
            )}
          </motion.div>
          <motion.h4 layoutId={`title-${event.id}`} className="bw-h1 [overflow-wrap:anywhere]">
            {event.title}
          </motion.h4>
        </div>
        <span className="w-8 h-8 rounded-full bg-surface-inverse text-surface-inverse-foreground flex items-center justify-center shrink-0" aria-hidden="true">
          <ArrowUpRight className="w-[18px] h-[18px]" />
        </span>
      </div>

      {/* Meta: date tile + time · venue */}
      <motion.div layoutId={`meta-${event.id}`} className="flex items-end justify-between gap-3">
        <motion.span layoutId={`date-block-${event.id}`} className="flex items-baseline gap-1.5 shrink-0">
          <span className="bw-num">{valid ? String(d!.getDate()).padStart(2, '0') : '--'}</span>
          <span className="bw-label-xs">{valid ? dateName(d!, { month: 'short' }) : t('TBD')}</span>
        </motion.span>
        {meta && <span className="bw-label-md truncate min-w-0 text-right">{meta}</span>}
      </motion.div>

      {/* Footer: team + fee */}
      <motion.div
        layoutId={`footer-${event.id}`}
        className="flex items-center justify-between gap-3 pt-3"
        style={{ borderTop: `1px solid ${chipBg}` }}
      >
        {event.members.length > 0 ? (
          <span className="flex -space-x-2">
            {event.members.map((m, i) => (
              <span key={i} className="w-8 h-8 rounded-full bg-white text-black border-[1.5px] border-black/15 flex items-center justify-center bw-label-sm">
                {m}
              </span>
            ))}
          </span>
        ) : (
          <span className="bw-label-xs opacity-70">{t('No team')}</span>
        )}
        {event.price && <span className="bw-num whitespace-nowrap">{sym()}{event.price}</span>}
      </motion.div>
    </motion.div>
  );
};
