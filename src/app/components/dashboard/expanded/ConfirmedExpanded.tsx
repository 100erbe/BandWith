import React, { useState, useMemo } from 'react';
import { uuidToNumericId } from '@/lib/numericId';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Loader2 } from '@/app/components/icons';
import { Card, IconButton } from '@/app/components/bw/Screen';
import { DateTile, EventMark, Metric } from '@/app/components/bw';
import { cn } from '@/app/components/ui/utils';
import { ExpandedCardWrapper, ExpandedTopBar } from './ExpandedCardWrapper';
import type { Event } from '@/lib/services/events';
import { parseLocalDate } from '@/lib/dates';
import { getActiveSymbol as sym, useCurrency } from '@/lib/currency';
import { useT } from '@/lib/i18n';

interface ConfirmedExpandedProps {
  bandId: string;
  onClose: () => void;
  events?: Event[];
  loading?: boolean;
}

/** "17:00:00" → "17:00"; empty → "--". */
const hhmm = (t?: string | null) => (t ? String(t).slice(0, 5) : '--');

const shortEuro = (v: number) => (v >= 1000 ? `${sym()}${(v / 1000).toFixed(1).replace('.0', '')}k` : `${sym()}${v}`);

/** Event-detail "Time Tile" (Figma 22:674): label XS + numeric value on a 16-radius tile. */
const TimeTile: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className }) => (
  <div className={cn('rounded-[16px] p-4 flex flex-col gap-1 min-w-0', className)}>
    <span className="bw-label-xs opacity-70 truncate">{label}</span>
    <span className="bw-num truncate">{value}</span>
  </div>
);

export const ConfirmedExpanded: React.FC<ConfirmedExpandedProps> = ({
  onClose,
  events: realEvents,
  loading
}) => {
  const t = useT();
  useCurrency(); // re-render money labels when the band currency changes
  const [expandedGigId, setExpandedGigId] = useState<number | null>(null);

  // Convert real events to display format - no mock fallback
  const gigs = useMemo(() => {
    if (!realEvents || realEvents.length === 0) {
      return []; // No mock data - show empty state
    }

    return realEvents.map(event => {
      const eventDate = event.date || event.event_date;
      const parsed = eventDate ? parseLocalDate(eventDate) : null;
      const valid = !!parsed && !isNaN(parsed.getTime());
      return {
        id: uuidToNumericId(event.id),
        title: event.title || t('Untitled Event'),
        day: valid ? String(parsed!.getDate()).padStart(2, '0') : '--',
        month: valid ? parsed!.toLocaleDateString('en-US', { month: 'short' }) : t('TBD'),
        venue: event.venue || event.venue_name || t('TBD'),
        address: event.address || event.venue_address || '',
        fee: event.fee ? Number(event.fee) : 0,
        amount: event.fee ? Number(event.fee).toLocaleString() : '0',
        dress: event.dress_code || '',
        contactName: event.client_name || '',
        timeline: {
          loadIn: hhmm(event.load_in_time),
          soundcheck: hhmm(event.soundcheck_time),
          show: hhmm(event.time || event.start_time),
        },
        notes: event.notes || ''
      };
    });
  }, [realEvents, t]);

  const nextGig = gigs[0];
  const totalFee = gigs.reduce((sum, g) => sum + g.fee, 0);

  const copyAddress = (address: string) => {
    try {
      void navigator.clipboard?.writeText(address);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <ExpandedCardWrapper
      backgroundColor="var(--bg)"
      onClose={onClose}
      origin={{ top: '40%', left: '44%', right: '3%', bottom: '42%' }}
    >
      <ExpandedTopBar
        title={t('Confirmed gigs')}
        onBack={onClose}
        meta={<span className="bw-label-sm text-muted-foreground">{gigs.length}</span>}
      />

      <div
        className="flex-1 flex flex-col gap-8 px-4 pt-2 max-w-[700px] w-full mx-auto bg-background text-foreground"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}
        onClick={() => setExpandedGigId(null)}
      >
        {/* Metrics (Figma Metric: one dot per gig / per €500 booked) */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8">
          <Metric label={t('Confirmed')} value={loading ? '-' : gigs.length} fill={gigs.length / 48} />
          <Metric label={t('Booked')} value={loading ? '-' : shortEuro(totalFee)} fill={totalFee / (48 * 500)} />
        </div>

        {/* Next gig (Figma Event Card, event colour) */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          {nextGig ? (
            <div className="rounded-[24px] p-5 flex flex-col gap-4 bg-accent-gig text-accent-gig-foreground">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <span className="flex items-center gap-1.5">
                    <EventMark kind="gig" size={20} bare />
                    <span className="bw-label-xs">{t('Next gig')}</span>
                  </span>
                  <h2 className="bw-h1 [overflow-wrap:anywhere]">{nextGig.title}</h2>
                </div>
                <span className="flex flex-col items-end shrink-0">
                  <span className="bw-num">{nextGig.day}</span>
                  <span className="bw-label-xs">{nextGig.month}</span>
                </span>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="bw-label-md truncate">{nextGig.venue}</span>
                {nextGig.address && <span className="bw-label-xs opacity-70 truncate">{nextGig.address}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <TimeTile label={t('Load in')} value={nextGig.timeline.loadIn} className="bg-card text-card-foreground" />
                <TimeTile label={t('Soundcheck', { context: 'tile' })} value={nextGig.timeline.soundcheck} className="bg-card text-card-foreground" />
                <TimeTile label={t('Show')} value={nextGig.timeline.show} className="bg-surface-inverse text-surface-inverse-foreground" />
              </div>
            </div>
          ) : !loading ? (
            <Card className="items-center text-center py-8">
              <h2 className="bw-h3">{t('No upcoming gigs')}</h2>
              <p className="bw-body-sm text-muted-foreground">{t('Book a gig to see it here.')}</p>
            </Card>
          ) : null}
        </motion.section>

        {/* Gig list */}
        {(loading || gigs.length > 1) && (
          <section className="flex flex-col gap-4">
            <h2 className="bw-label-md text-foreground">{t('Upcoming gigs')}</h2>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              gigs.slice(1).map((gig, i) => {
                const isExpanded = expandedGigId === gig.id;
                const meta = [gig.venue, gig.timeline.show !== '--' ? gig.timeline.show : null].filter(Boolean).join(' · ');
                return (
                  <motion.div
                    key={gig.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.05, type: 'tween', duration: 0.25, ease: 'easeOut' }}
                    className="rounded-[24px] bg-card text-card-foreground overflow-hidden"
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedGigId(isExpanded ? null : gig.id);
                      }}
                      className="w-full flex items-center gap-4 p-3 pr-4 text-left active:scale-[0.99] transition-transform"
                    >
                      <DateTile day={gig.day} month={gig.month} kind="gig" />
                      <span className="flex-1 min-w-0 flex flex-col gap-1">
                        <span className="bw-h3 line-clamp-2 [overflow-wrap:anywhere]">{gig.title}</span>
                        <span className="bw-body-sm text-muted-foreground truncate">{meta}</span>
                      </span>
                      <span className="bw-label-md shrink-0 whitespace-nowrap">{gig.fee > 0 ? `${sym()}${gig.amount}` : '--'}</span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="px-4 pb-4 flex flex-col gap-3">
                            <div className="h-px bg-border" />
                            {gig.address && (
                              <div className="flex items-center gap-3">
                                <span className="flex-1 min-w-0 flex flex-col gap-1">
                                  <span className="bw-label-xs text-muted-foreground">{t('Address')}</span>
                                  <span className="bw-body-sm [overflow-wrap:anywhere]">{gig.address}</span>
                                </span>
                                <IconButton label={t('Copy address')} size="sm" variant="ghost" icon={<Copy />} onClick={() => copyAddress(gig.address)} />
                              </div>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                              <TimeTile label={t('Load in')} value={gig.timeline.loadIn} className="bg-foreground/[0.08]" />
                              <TimeTile label={t('Soundcheck', { context: 'tile' })} value={gig.timeline.soundcheck} className="bg-foreground/[0.08]" />
                              <TimeTile label={t('Show')} value={gig.timeline.show} className="bg-foreground/[0.08]" />
                            </div>
                            {(gig.contactName || gig.dress) && (
                              <div className="flex flex-col gap-2">
                                {gig.contactName && (
                                  <span className="flex items-baseline justify-between gap-3">
                                    <span className="bw-body-md text-muted-foreground">{t('Contact')}</span>
                                    <span className="bw-label-md text-right truncate">{gig.contactName}</span>
                                  </span>
                                )}
                                {gig.dress && (
                                  <span className="flex items-baseline justify-between gap-3">
                                    <span className="bw-body-md text-muted-foreground">{t('Dress code')}</span>
                                    <span className="bw-label-md text-right truncate">{gig.dress}</span>
                                  </span>
                                )}
                              </div>
                            )}
                            {gig.notes && <p className="bw-body-sm text-muted-foreground [overflow-wrap:anywhere]">{gig.notes}</p>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </section>
        )}
      </div>
    </ExpandedCardWrapper>
  );
};
