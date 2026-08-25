import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowUpRight, Plus, MessageCircle } from 'lucide-react';
import { springs } from '@/styles/motion';
import { EventData } from './EventCard';
import { StatusBadge } from '@/app/components/ui/StatusBadge';
import { WeatherWidget } from '@/app/components/ui/WeatherWidget';
import { supabase } from '@/lib/supabase';

interface EventDetailProps {
  event: EventData;
  onClose: () => void;
  userResponse?: 'pending' | 'accepted' | 'declined';
  onAccept?: () => Promise<void>;
  onDecline?: () => Promise<void>;
  onEdit?: () => void;
  onDelete?: () => void;
  onChat?: () => void;
  memberFee?: number;
  isAdmin?: boolean;
}

const formatEventDate = (dateStr: string): string => {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  return `${month} ${day}`;
};

const formatEventTime = (timeStr: string): string => {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return m > 0 ? `${h}:${match[2]} ${ampm}` : `${h}${ampm}`;
  }
  return timeStr;
};

const formatBandTotal = (price: string): string => {
  if (!price) return '$0';
  const num = parseFloat(price.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return price;
  if (num >= 1000) return `$${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}K`;
  return `$${num}`;
};

type EventType = 'rehearsal' | 'gig' | 'quote' | 'draft';

const getEventType = (status?: string): EventType => {
  const s = status?.toUpperCase();
  if (s === 'REHEARSAL') return 'rehearsal';
  if (s === 'CONFIRMED' || s === 'COMPLETED') return 'gig';
  if (s === 'QUOTED' || s === 'QUOTE') return 'quote';
  return 'draft';
};

type AccentStyle = {
  /** CSS variable reference for the event-type accent (for subtle inline tints). */
  accent: string;
  /** Subtle tag-pill utility classes (tinted background + accent text). */
  tagClass: string;
  /** Accent text color for arrows / chevrons. */
  iconClass: string;
  /** Solid accent bar used as a thin underline reference. */
  barClass: string;
};

const EVENT_ACCENT: Record<EventType, AccentStyle> = {
  gig: {
    accent: 'var(--accent-gig)',
    tagClass: 'bg-accent-gig/15 text-accent-gig',
    iconClass: 'text-accent-gig',
    barClass: 'bg-accent-gig',
  },
  rehearsal: {
    accent: 'var(--accent-rehearsal)',
    tagClass: 'bg-accent-rehearsal/15 text-accent-rehearsal',
    iconClass: 'text-accent-rehearsal',
    barClass: 'bg-accent-rehearsal',
  },
  quote: {
    accent: 'var(--accent-quote)',
    tagClass: 'bg-accent-quote/15 text-accent-quote',
    iconClass: 'text-accent-quote',
    barClass: 'bg-accent-quote',
  },
  draft: {
    accent: 'var(--muted-fg)',
    tagClass: 'bg-muted text-muted-foreground',
    iconClass: 'text-muted-foreground',
    barClass: 'bg-muted-foreground',
  },
};

const getRehearsalCadence = (event: EventData): string => {
  if (!event.is_recurring) return 'ONCE';
  const rule = event.recurrence_rule;
  const freq = (rule?.freq || rule?.frequency || '').toLowerCase();
  const interval = rule?.interval || 1;
  if (freq === 'weekly' && interval === 1) return 'WEEKLY';
  if (freq === 'weekly' && interval === 2) return 'BI-WEEKLY';
  if (freq === 'monthly' && interval === 1) return 'MONTHLY';
  if (freq === 'monthly' && interval === 2) return 'BI-MONTHLY';
  if (freq) return freq.toUpperCase();
  return 'ONCE';
};

const getEventTags = (event: EventData, eventType: EventType): string[] => {
  const tags: string[] = [];
  if (eventType === 'gig') {
    tags.push('GIG');
    tags.push(event.indoorOutdoor?.toUpperCase() || 'INDOOR');
  } else if (eventType === 'rehearsal') {
    tags.push('REHEARSAL');
    tags.push(getRehearsalCadence(event));
  } else if (eventType === 'quote') {
    tags.push('QUOTE');
    tags.push((event.quoteStatus || 'pending').toUpperCase());
  } else {
    tags.push('DRAFT');
  }
  return tags;
};

export const EventDetail: React.FC<EventDetailProps> = ({
  event,
  onClose,
  userResponse = 'accepted',
  onAccept,
  onDecline,
  onEdit,
  onDelete,
  onChat,
  memberFee,
  isAdmin = true,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPending = userResponse === 'pending';
  const eventType = getEventType(event.status);
  const accent = EVENT_ACCENT[eventType];
  const deleteLabel = eventType === 'gig' ? 'DELETE THIS GIG' : eventType === 'rehearsal' ? 'DELETE THIS REHEARSAL' : eventType === 'quote' ? 'DELETE THIS QUOTE' : 'DELETE THIS DRAFT';
  const tags = getEventTags(event, eventType);
  const memberCount = event.members?.length || 0;

  const handleAccept = async () => {
  if (onAccept && !isSubmitting) {
    setIsSubmitting(true);
    try { 
      await onAccept(); 
      onClose(); // Only runs if onAccept doesn't throw
    } catch (err) { 
      console.error("Action failed, keeping modal open", err);
    } finally { 
      setIsSubmitting(false); 
    }
  }
};

  const handleDecline = async () => {
    if (onDecline && !isSubmitting) {
      setIsSubmitting(true);
      try { await onDecline(); onClose(); }
      catch { /* handled */ }
      finally { setIsSubmitting(false); }
    }
  };

  const venueName = event.location?.split(',')[0] || 'TBD';
  const venueAddress = event.location?.includes(',')
    ? event.location.split(',').slice(1).join(',').trim()
    : '';
  const dateLabel = event.date ? formatEventDate(event.date) : 'TBD';
  const timeLabel = event.time ? formatEventTime(event.time) : '';

  const eventDate = event.date ? new Date(event.date) : null;
  const eventYear = eventDate ? eventDate.getFullYear() : '';
  const eventMonthDay = eventDate
    ? `${eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()} ${eventDate.getDate()}`
    : 'TBD';

  const miniCalendar = useMemo(() => {
    if (!eventDate) return null;
    const year = eventDate.getFullYear();
    const month = eventDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    return { daysInMonth, firstDay, eventDay: eventDate.getDate() };
  }, [eventDate]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-background"
      />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={springs.smooth}
        className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-background"
      >
        <div className="flex-1 flex flex-col gap-10 px-4 pt-16 pb-52">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <button
                onClick={onClose}
                className="w-12 h-12 rounded-full flex items-center justify-center border border-border bg-card"
              >
                <ArrowLeft className="w-6 h-6 text-foreground" />
              </button>
              <StatusBadge status={event.status} />
            </div>
          </div>

          {/* Subtle accent reference */}
          <div className={`h-1.5 w-12 rounded-full ${accent.barClass}`} />

          {/* Event Info */}
          <div className="flex gap-5 items-start">
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <div className="flex gap-1 items-center flex-wrap">
                {tags.map((tag, i) => (
                  <div key={i} className={`rounded-full px-2.5 py-1 ${accent.tagClass}`}>
                    <span className="text-xs font-bold uppercase whitespace-nowrap leading-tight">{tag}</span>
                  </div>
                ))}
              </div>
              <h2 className="text-3xl font-bold uppercase leading-tight text-foreground">
                {event.title}
              </h2>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold uppercase leading-tight text-foreground">
                    {venueName}
                  </span>
                  <ArrowUpRight className={`w-4 h-4 ${accent.iconClass}`} />
                </div>
                {venueAddress && (
                  <span className="text-xs font-medium uppercase leading-tight text-muted-foreground">
                    {venueAddress}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-1">
              <WeatherWidget
                eventDate={event.date}
                location={event.location}
                textColor="var(--fg)"
              />
              <div className="rounded-xl px-2.5 py-2.5 bg-card border border-border">
                <span className="text-xs font-bold uppercase whitespace-nowrap leading-tight text-foreground">
                  {dateLabel}{timeLabel ? ` - ${timeLabel}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Event-specific sections */}
          {eventType === 'rehearsal' && (
            <RehearsalSections event={event} accent={accent} memberCount={memberCount} />
          )}
          {eventType === 'gig' && (
            <GigSections event={event} accent={accent} memberCount={memberCount} isAdmin={isAdmin} memberFee={memberFee} />
          )}
          {eventType === 'quote' && (
            <QuoteSections event={event} accent={accent} memberCount={memberCount} miniCalendar={miniCalendar} eventYear={eventYear} eventMonthDay={eventMonthDay} isAdmin={isAdmin} memberFee={memberFee} />
          )}
          {eventType === 'draft' && (
            <DraftSections event={event} accent={accent} memberCount={memberCount} isAdmin={isAdmin} memberFee={memberFee} />
          )}
        </div>

        {/* Footer */}
        <div className="fixed bottom-0 left-0 right-0 rounded-t-3xl px-4 pt-5 pb-8 z-[80] bg-card border-t border-border shadow-sm">
          {isPending && onAccept && onDecline ? (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleAccept}
                  disabled={isSubmitting}
                  className="rounded-xl py-4 flex items-center justify-center gap-2 bg-surface-inverse disabled:opacity-50"
                >
                  <span className="text-base font-bold text-surface-inverse-foreground uppercase">
                    {isSubmitting ? '...' : 'ACCEPT'}
                  </span>
                </button>
                <button
                  onClick={handleDecline}
                  disabled={isSubmitting}
                  className="rounded-xl py-4 flex items-center justify-center gap-2 bg-muted disabled:opacity-50"
                >
                  <span className="text-base font-bold text-foreground uppercase">DECLINE</span>
                </button>
              </div>
            </div>
          ) : isAdmin ? (
            // ADMIN view — edit / delete / chat
            <div className="flex flex-col gap-5 items-center">
              <div className="grid grid-cols-2 gap-2.5 w-full">
                <button
                  onClick={onEdit}
                  className="rounded-xl py-4 flex items-center justify-center gap-2 bg-surface-inverse"
                >
                  <Plus className="w-4.5 h-4.5 text-surface-inverse-foreground" />
                  <span className="text-base font-bold uppercase text-surface-inverse-foreground">EDIT</span>
                </button>
                <button
                  onClick={onChat}
                  className="rounded-xl py-4 flex items-center justify-center gap-2 bg-muted"
                >
                  <MessageCircle className="w-4.5 h-4.5 text-foreground" />
                  <span className="text-base font-bold uppercase text-foreground">
                    {eventType === 'quote' ? '+ CONVERT' : 'CHAT'}
                  </span>
                </button>
              </div>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { onDelete?.(); setShowDeleteConfirm(false); }}
                    className="text-xs font-bold text-destructive-foreground bg-destructive rounded-lg px-4 py-2 uppercase"
                  >
                    CONFIRM DELETE
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-xs font-bold uppercase text-foreground"
                  >
                    CANCEL
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowDeleteConfirm(true)}>
                  <span className="text-xs font-medium text-destructive uppercase">
                    {deleteLabel}
                  </span>
                </button>
              )}
            </div>
          ) : (
            // MEMBER view (already accepted) — chat + drop out (with confirmation)
            <div className="flex flex-col gap-5 items-center">
              <div className="grid grid-cols-2 gap-2.5 w-full">
                <button
                  onClick={onChat}
                  className="rounded-xl py-4 flex items-center justify-center gap-2 bg-muted"
                >
                  <MessageCircle className="w-4.5 h-4.5 text-foreground" />
                  <span className="text-base font-bold uppercase text-foreground">CHAT</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSubmitting}
                  className="rounded-xl py-4 flex items-center justify-center gap-2 bg-muted disabled:opacity-50"
                >
                  <span className="text-base font-bold text-foreground uppercase">
                    {isSubmitting ? '...' : 'DROP OUT'}
                  </span>
                </button>
              </div>
              {showDeleteConfirm && (
                <div className="flex flex-col gap-3 items-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground">Are you sure you want to drop out?</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDecline}
                      disabled={isSubmitting}
                      className="text-xs font-bold text-destructive-foreground bg-destructive rounded-lg px-4 py-2 uppercase disabled:opacity-50"
                    >
                      {isSubmitting ? '...' : 'CONFIRM DROP'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="text-xs font-bold uppercase text-foreground"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

const SectionHeader: React.FC<{
  label: string;
  showArrow?: boolean;
  onTap?: () => void;
  expanded?: boolean;
  accentIcon?: string;
}> = ({ label, showArrow = true, onTap, expanded, accentIcon }) => (
  <button
    className="flex items-center gap-1.5 appearance-none bg-transparent border-none p-0 m-0 cursor-pointer"
    onClick={onTap}
    disabled={!onTap}
  >
    <span className="text-xs font-bold uppercase leading-tight text-foreground">
      {label}
    </span>
    {showArrow && (
      <motion.div
        animate={{ rotate: expanded ? 90 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <ArrowUpRight className={`w-3.5 h-3.5 ${accentIcon || 'text-foreground'}`} />
      </motion.div>
    )}
  </button>
);

const SectionValue: React.FC<{ value: string | number }> = ({ value }) => (
  <span className="text-4xl font-bold leading-tight text-foreground">{value}</span>
);

const ExpandableDetail: React.FC<{
  expanded: boolean;
  children: React.ReactNode;
}> = ({ expanded, children }) => (
  <AnimatePresence>
    {expanded && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden"
      >
        <div className="pt-3 flex flex-col gap-2">
          {children}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

const DetailRow: React.FC<{
  label: string;
  value: string;
}> = ({ label, value }) => (
  <div className="flex items-center justify-between py-2 border-b border-border">
    <span className="text-xs font-medium uppercase leading-tight text-muted-foreground">{label}</span>
    <span className="text-sm font-bold leading-tight text-foreground">{value}</span>
  </div>
);

// ─── REHEARSAL ───
const RehearsalSections: React.FC<{
  event: EventData;
  accent: AccentStyle;
  memberCount: number;
}> = ({ event, accent, memberCount }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const toggle = (key: string) => setExpandedSection(prev => prev === key ? null : key);

  const rehearsalTime = event.time
    ? (event.endTime
        ? `${formatEventTime(event.time)} - ${formatEventTime(event.endTime)}`
        : formatEventTime(event.time))
    : 'TBD';

  const [setlistSongs, setSetlistSongs] = useState<{ title: string; artist?: string }[]>([]);
  useEffect(() => {
    if (!event.setlistId) return;
    const fetchSetlist = async () => {
      const { data } = await supabase
        .from('setlist_songs')
        .select('*, song:songs(title, artist)')
        .eq('setlist_id', event.setlistId)
        .order('position', { ascending: true });
      if (data && data.length > 0) {
        setSetlistSongs(data.map((s: any) => ({ title: s.song?.title || 'Unknown', artist: s.song?.artist })));
      }
    };
    fetchSetlist();
  }, [event.setlistId]);
  const numSongs = setlistSongs.length;

  return (
    <div className="flex flex-col gap-10">
      {/* Rehearsal Time */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col">
          <SectionHeader label="REHEARSAL TIME" accentIcon={accent.iconClass} onTap={() => toggle('time')} expanded={expandedSection === 'time'} />
          <SectionValue value={rehearsalTime} />
        </div>
        <ExpandableDetail expanded={expandedSection === 'time'}>
          <DetailRow label="Start" value={event.time ? formatEventTime(event.time) : 'TBD'} />
          {event.endTime && <DetailRow label="End" value={formatEventTime(event.endTime)} />}
          <DetailRow label="Location" value={event.location?.split(',')[0] || 'TBD'} />
        </ExpandableDetail>
      </div>

      {/* Songs to Play */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col">
          <SectionHeader label="SONGS TO PLAY" accentIcon={accent.iconClass} onTap={() => toggle('songs')} expanded={expandedSection === 'songs'} />
          <SectionValue value={numSongs || 0} />
        </div>
        <ExpandableDetail expanded={expandedSection === 'songs'}>
          {setlistSongs.length > 0 ? setlistSongs.slice(0, 5).map((song, i) => (
            <DetailRow key={i} label={`Song ${i + 1}`} value={song.title} />
          )) : (
            <DetailRow label="Info" value="No setlist assigned" />
          )}
        </ExpandableDetail>
      </div>

      {/* Confirmed Members */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col">
          <SectionHeader label="CONFIRMED MEMBERS" accentIcon={accent.iconClass} onTap={() => toggle('members')} expanded={expandedSection === 'members'} />
          <SectionValue value={memberCount} />
        </div>
        <ExpandableDetail expanded={expandedSection === 'members'}>
          {event.members?.length ? event.members.map((m, i) => (
            <DetailRow key={i} label={`Member ${i + 1}`} value={m} />
          )) : (
            <DetailRow label="Info" value="No members assigned" />
          )}
        </ExpandableDetail>
      </div>
    </div>
  );
};

// ─── GIG ───
const GigSections: React.FC<{
  event: EventData;
  accent: AccentStyle;
  memberCount: number;
  isAdmin?: boolean;
  memberFee?: number;
}> = ({ event, accent, memberCount, isAdmin = true, memberFee }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const toggle = (key: string) => setExpandedSection(prev => prev === key ? null : key);

  const showTime = event.time ? formatEventTime(event.time) : 'TBD';
  const loadInTime = event.loadInTime
    ? formatEventTime(event.loadInTime)
    : event.time
      ? formatEventTime(event.time.replace(/^(\d+)/, (_, h: string) => String(Math.max(1, parseInt(h) - 3))))
      : 'TBD';
  const soundCheckTime = event.soundcheckTime
    ? formatEventTime(event.soundcheckTime)
    : event.time
      ? formatEventTime(event.time.replace(/:\d{2}$/, ':30').replace(/^(\d+)/, (_, h: string) => String(Math.max(1, parseInt(h) - 2))))
      : 'TBD';
  const bandTotal = formatBandTotal(event.price);

  const [setlistSongs, setSetlistSongs] = useState<{ title: string; artist?: string }[]>([]);
  useEffect(() => {
    if (!event.setlistId) return;
    const fetchSetlist = async () => {
      const { data } = await supabase
        .from('setlist_songs')
        .select('*, song:songs(title, artist)')
        .eq('setlist_id', event.setlistId)
        .order('position', { ascending: true });
      if (data && data.length > 0) {
        setSetlistSongs(data.map((s: any) => ({ title: s.song?.title || 'Unknown', artist: s.song?.artist })));
      }
    };
    fetchSetlist();
  }, [event.setlistId]);
  const numSongs = setlistSongs.length;

  const perMemberFee = memberCount > 0 ? Math.round(parseFloat(event.price?.replace(/[^0-9.]/g, '') || '0') / memberCount) : 0;
  const members = event.members?.length > 0
    ? event.members.map((m, i) => ({
        initials: m,
        name: m,
        role: `Member ${i + 1}`,
        fee: `€${perMemberFee}`,
      }))
    : [];

  return (
    <div className="flex flex-col gap-10">
      {/* 2x2 Grid: Load In, Sound Check, Show Start, Band Total Fee */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-10">
        {/* Load In */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <SectionHeader label="LOAD IN" accentIcon={accent.iconClass} onTap={() => toggle('loadin')} expanded={expandedSection === 'loadin'} />
            <SectionValue value={loadInTime} />
          </div>
          <ExpandableDetail expanded={expandedSection === 'loadin'}>
            <DetailRow label="Time" value={loadInTime} />
            <DetailRow label="Location" value={event.location?.split(',')[0] || 'TBD'} />
          </ExpandableDetail>
        </div>

        {/* Sound Check */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <SectionHeader label="SOUND CHECK" accentIcon={accent.iconClass} onTap={() => toggle('soundcheck')} expanded={expandedSection === 'soundcheck'} />
            <SectionValue value={soundCheckTime} />
          </div>
          <ExpandableDetail expanded={expandedSection === 'soundcheck'}>
            <DetailRow label="Time" value={soundCheckTime} />
          </ExpandableDetail>
        </div>

        {/* Show Start */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <SectionHeader label="SHOW START" accentIcon={accent.iconClass} onTap={() => toggle('showstart')} expanded={expandedSection === 'showstart'} />
            <SectionValue value={showTime} />
          </div>
          <ExpandableDetail expanded={expandedSection === 'showstart'}>
            <DetailRow label="Show Time" value={showTime} />
          </ExpandableDetail>
        </div>

        {/* Fee Section */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <SectionHeader label={isAdmin ? "BAND TOTAL FEE" : "YOUR FEE"} accentIcon={accent.iconClass} onTap={() => toggle('fee')} expanded={expandedSection === 'fee'} />
            <SectionValue value={isAdmin ? bandTotal : (memberFee != null ? `$${memberFee}` : '\u2014')} />
          </div>
          {isAdmin && (
            <ExpandableDetail expanded={expandedSection === 'fee'}>
              {members.map((m, i) => (
                <DetailRow key={i} label={m.name} value={m.fee} />
              ))}
              <DetailRow label="Total" value={bandTotal} />
            </ExpandableDetail>
          )}
        </div>
      </div>

      {/* Setlist */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col">
          <SectionHeader label="SETLIST" accentIcon={accent.iconClass} onTap={() => toggle('setlist')} expanded={expandedSection === 'setlist'} />
          <div className="flex items-center gap-2.5">
            <SectionValue value={`${numSongs} SONGS`} />
          </div>
        </div>
        <ExpandableDetail expanded={expandedSection === 'setlist'}>
          {numSongs > 0 ? (
            <>
              {setlistSongs.slice(0, 10).map((song, i) => (
                <DetailRow key={i} label={`${i + 1}`} value={song.title} />
              ))}
              {numSongs > 10 && (
                <span className="text-xs font-medium pt-1 text-muted-foreground">
                  + {numSongs - 10} more songs
                </span>
              )}
            </>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">
              No setlist assigned
            </span>
          )}
        </ExpandableDetail>
      </div>

      {/* Lineup */}
      <div className="flex flex-col gap-2">
        <button
          className="flex items-center gap-1.5 appearance-none bg-transparent border-none p-0 m-0 cursor-pointer"
          onClick={() => toggle('lineup')}
        >
          <span className="text-4xl font-bold leading-tight text-foreground">LINEUP</span>
          <motion.div animate={{ rotate: expandedSection === 'lineup' ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ArrowUpRight className={`w-10 h-10 ${accent.iconClass}`} />
          </motion.div>
        </button>

        <AnimatePresence>
          {expandedSection === 'lineup' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2.5 pt-3">
                {members.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-end p-2.5 rounded-xl bg-muted"
                  >
                    <div className="flex-1 flex flex-col">
                      <span className="text-xs font-medium text-muted-foreground">{m.role}</span>
                      <span className="text-xl font-bold text-foreground">{m.name}</span>
                    </div>
                    <span className="text-xl font-bold text-foreground">{m.fee}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Accepted Status — typographic only, no SVG icon */}
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          <span className="text-xs font-bold uppercase leading-tight text-muted-foreground">
            • YOU HAVE ACCEPTED THIS EVENT
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── QUOTE ───
const QuoteSections: React.FC<{
  event: EventData;
  accent: AccentStyle;
  memberCount: number;
  miniCalendar: { daysInMonth: number; firstDay: number; eventDay: number } | null;
  eventYear: string | number;
  isAdmin?: boolean;
  memberFee?: number;
  eventMonthDay: string;
}> = ({ event, accent, memberCount, miniCalendar, eventYear, eventMonthDay, isAdmin = true, memberFee }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const toggle = (key: string) => setExpandedSection(prev => prev === key ? null : key);
  const bandTotal = formatBandTotal(event.price);

  return (
    <div className="flex flex-col gap-10">
      {/* Year + Date */}
      <div className="flex gap-5">
        <div className="flex-1 flex flex-col">
          <SectionHeader label="YEAR" accentIcon={accent.iconClass} onTap={() => toggle('year')} expanded={expandedSection === 'year'} />
          <SectionValue value={eventYear || new Date().getFullYear()} />
          <ExpandableDetail expanded={expandedSection === 'year'}>
            <DetailRow label="Year" value={String(eventYear || new Date().getFullYear())} />
            <DetailRow label="Season" value={(() => { const m = new Date(event.date).getMonth(); return m >= 5 && m <= 8 ? 'Summer' : m >= 2 && m <= 4 ? 'Spring' : m >= 9 && m <= 10 ? 'Autumn' : 'Winter'; })()} />
          </ExpandableDetail>
        </div>
        <div className="flex-1 flex flex-col">
          <SectionHeader label="DATE" accentIcon={accent.iconClass} onTap={() => toggle('date')} expanded={expandedSection === 'date'} />
          <SectionValue value={eventMonthDay} />
          <ExpandableDetail expanded={expandedSection === 'date'}>
            <DetailRow label="Day" value={new Date(event.date).toLocaleDateString('en-US', { weekday: 'long' })} />
            <DetailRow label="Time" value={event.time ? formatEventTime(event.time) : 'TBD'} />
          </ExpandableDetail>
        </div>
      </div>

      {/* Mini Calendar */}
      {miniCalendar && (
        <div className="flex flex-col gap-1">
          <div className="flex">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} className="flex-1 text-center">
                <span className="text-xs font-bold leading-tight text-muted-foreground">{d}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: miniCalendar.firstDay }).map((_, i) => (
              <div key={`e-${i}`} className="h-6" />
            ))}
            {Array.from({ length: miniCalendar.daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isEventDay = day === miniCalendar.eventDay;
              return (
                <div
                  key={day}
                  className={`h-6 flex items-center justify-center rounded-full ${isEventDay ? accent.tagClass : 'text-muted-foreground'}`}
                >
                  <span className="text-xs font-medium leading-tight">{day}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Client + Pricing */}
      <div className="grid grid-cols-2 gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <SectionHeader label="CLIENT" accentIcon={accent.iconClass} onTap={() => toggle('client')} expanded={expandedSection === 'client'} />
            <div className="flex flex-col">
              <span className="text-4xl font-bold leading-tight text-foreground">
                {(event.clientName || event.title || '—').split(' ')[0]?.toUpperCase()}
              </span>
              <span className="text-xl font-bold leading-tight text-foreground">
                {(event.clientName || event.title || '').split(' ').slice(1).join(' ')?.toUpperCase()}
              </span>
            </div>
          </div>
          <ExpandableDetail expanded={expandedSection === 'client'}>
            <DetailRow label="Name" value={event.clientName || '—'} />
            <DetailRow label="Event Type" value={(event.eventType || '—').toUpperCase()} />
            <DetailRow label="Location" value={event.location?.split(',')[0] || 'TBD'} />
          </ExpandableDetail>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <SectionHeader label={isAdmin ? "PRICING" : "YOUR FEE"} accentIcon={accent.iconClass} onTap={() => toggle('pricing')} expanded={expandedSection === 'pricing'} />
            <div className="flex flex-col">
              <span className="text-4xl font-bold leading-tight text-foreground">
                {isAdmin ? bandTotal : (memberFee != null ? `$${memberFee}` : '\u2014')}
              </span>
            </div>
          </div>
          {isAdmin && (
            <ExpandableDetail expanded={expandedSection === 'pricing'}>
              <DetailRow label="Band Total" value={bandTotal} />
              <DetailRow label="Venue" value={event.location?.split(',')[0] || 'TBD'} />
            </ExpandableDetail>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col">
          <SectionHeader label="MEMBERS" accentIcon={accent.iconClass} onTap={() => toggle('members')} expanded={expandedSection === 'members'} />
          <SectionValue value={memberCount} />
        </div>
        <ExpandableDetail expanded={expandedSection === 'members'}>
          {event.members?.length ? event.members.map((m, i) => (
            <DetailRow key={i} label={`Member ${i + 1}`} value={m} />
          )) : (
            <DetailRow label="Info" value="No members assigned" />
          )}
        </ExpandableDetail>
      </div>
    </div>
  );
};

// ─── DRAFT ───
const DraftSections: React.FC<{
  event: EventData;
  accent: AccentStyle;
  memberCount: number;
  isAdmin?: boolean;
  memberFee?: number;
}> = ({ event, accent, memberCount, isAdmin = true, memberFee }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const toggle = (key: string) => setExpandedSection(prev => prev === key ? null : key);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col">
          <SectionHeader label="TEAM MEMBERS" accentIcon={accent.iconClass} onTap={() => toggle('members')} expanded={expandedSection === 'members'} />
          <SectionValue value={memberCount} />
        </div>
        <ExpandableDetail expanded={expandedSection === 'members'}>
          {event.members?.length ? event.members.map((m, i) => (
            <DetailRow key={i} label={`Member ${i + 1}`} value={m} />
          )) : (
            <DetailRow label="Info" value="No members assigned" />
          )}
        </ExpandableDetail>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col">
          <SectionHeader label={isAdmin ? "BAND TOTAL" : "YOUR FEE"} accentIcon={accent.iconClass} onTap={() => toggle('total')} expanded={expandedSection === 'total'} />
          <SectionValue value={isAdmin ? formatBandTotal(event.price) : (memberFee != null ? `$${memberFee}` : '\u2014')} />
        </div>
        {isAdmin && (
          <ExpandableDetail expanded={expandedSection === 'total'}>
            <DetailRow label="Total" value={formatBandTotal(event.price)} />
          </ExpandableDetail>
        )}
      </div>

      {event.notes && (
        <div className="flex flex-col gap-2.5">
          <SectionHeader label="NOTES" showArrow={false} />
          <p className="text-sm leading-relaxed text-muted-foreground">{event.notes}</p>
        </div>
      )}
    </div>
  );
};