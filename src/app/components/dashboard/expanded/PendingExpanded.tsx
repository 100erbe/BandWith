import React, { useMemo, useState } from 'react';
import { uuidToNumericId } from '@/lib/numericId';
import { motion } from 'motion/react';
import { AlertCircle, Loader2, MapPin } from '@/app/components/icons';
import { Card, SearchField, Tag, type TagStyle } from '@/app/components/bw/Screen';
import { Selector } from '@/app/components/bw/Form';
import { EventMark, eventKindOf } from '@/app/components/bw';
import { ExpandedCardWrapper, ExpandedTopBar } from './ExpandedCardWrapper';
import { EVENT_FILTERS } from '@/app/data/events';
import type { Event } from '@/lib/services/events';
import { parseLocalDate } from '@/lib/dates';

interface PendingExpandedProps {
  bandId: string;
  onClose: () => void;
  eventFilter: string;
  setEventFilter: (filter: string) => void;
  events?: Event[];
  loading?: boolean;
}

export const PendingExpanded: React.FC<PendingExpandedProps> = ({
  onClose,
  eventFilter,
  setEventFilter,
  events: realEvents,
  loading
}) => {
  // Convert real events to display format and group by date
  const eventsByDate = useMemo(() => {
    if (!realEvents || realEvents.length === 0) {
      return []; // No mock data - show empty state
    }

    // Group events by date
    const groups: { [key: string]: any[] } = {};
    
    realEvents.forEach(event => {
      const dateKey = event.date || event.event_date;
      if (!groups[dateKey]) groups[dateKey] = [];
      
      groups[dateKey].push({
        id: uuidToNumericId(event.id),
        title: event.title,
        status: (event.status || 'draft').toUpperCase(),
        price: event.fee ? Number(event.fee).toLocaleString() : '0',
        time: (event.time || event.start_time || '').slice(0, 5),
        location: event.venue || event.venue_name || 'TBD',
        rawStatus: event.status || '',
        eventType: (event as any).event_type || '',
        contractSigned: event.contract_signed || false
      });
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => ({
        date: parseLocalDate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        label: getDateLabel(date),
        events
      }));
  }, [realEvents]);

  function getDateLabel(dateStr: string): string {
    const date = parseLocalDate(dateStr);
    const today = new Date();
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return 'This Week';
    if (diffDays <= 14) return 'Next Week';
    return 'Upcoming';
  }
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visibleGroups = q
    ? eventsByDate
        .map((g) => ({ ...g, events: g.events.filter((e: any) => `${e.title} ${e.location}`.toLowerCase().includes(q)) }))
        .filter((g) => g.events.length > 0)
    : eventsByDate;

  const tagFor = (status: string): TagStyle => {
    if (status === 'CONFIRMED' || status === 'COMPLETED') return 'gig';
    if (status === 'REHEARSAL') return 'rehearsal';
    if (status === 'CANCELLED') return 'outline';
    return 'quote';
  };

  return (
    <ExpandedCardWrapper
      backgroundColor="var(--bg)"
      onClose={onClose}
      origin={{ top: '12%', left: '61%', right: '3%', bottom: '62%' }}
    >
      <ExpandedTopBar
        title="Pending events"
        onBack={onClose}
        meta={<span className="bw-label-sm text-muted-foreground">{realEvents?.length || 0}</span>}
      />

      <div
        className="flex-1 flex flex-col gap-4 px-4 pt-2 max-w-[700px] w-full mx-auto bg-background text-foreground"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}
      >
        <SearchField value={query} onChange={setQuery} label="Search events" placeholder="Search title or venue…" />

        {/* Filter tabs (Figma Selector MD) */}
        <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 [scrollbar-width:none]">
          {EVENT_FILTERS.map((filter) => (
            <Selector key={filter} size="md" selected={eventFilter === filter} onClick={() => setEventFilter(filter)}>
              {filter}
            </Selector>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : visibleGroups.length === 0 ? (
          <Card className="items-center text-center py-10">
            <h2 className="bw-h3">{q ? 'No matching events' : 'No pending events'}</h2>
            {q && <p className="bw-body-sm text-muted-foreground">Try another title or venue.</p>}
          </Card>
        ) : (
          visibleGroups.map((group, groupIndex) => (
            <motion.section
              key={group.date}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + groupIndex * 0.08 }}
              className="flex flex-col gap-4 pt-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="bw-label-md text-foreground">{group.date}</h2>
                <span className="bw-label-sm text-muted-foreground">{group.label}</span>
              </div>
              {group.events.map((event: any) => {
                const kind = eventKindOf({ event_type: event.eventType, status: event.rawStatus });
                return (
                  <Card key={event.id} className="gap-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-1 min-w-0 flex flex-col gap-2">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <EventMark kind={kind} size={20} />
                          <Tag variant={tagFor(event.status)}>{event.status}</Tag>
                          {!event.contractSigned && (
                            <Tag variant="outline" icon={<AlertCircle />} className="text-destructive border-destructive">
                              No contract
                            </Tag>
                          )}
                        </span>
                        <h3 className="bw-h3 [overflow-wrap:anywhere]">{event.title}</h3>
                      </span>
                      <span className="bw-num shrink-0 whitespace-nowrap">€{event.price}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 min-w-0 bw-label-md">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </span>
                      <span className="bw-label-md shrink-0">{event.time || 'Time TBD'}</span>
                    </div>
                  </Card>
                );
              })}
            </motion.section>
          ))
        )}
      </div>
    </ExpandedCardWrapper>
  );
};
