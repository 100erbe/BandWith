import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowUpRight, Plus, MessageCircle } from 'lucide-react';
import { springs } from '@/styles/motion';
import { EventData } from './EventCard';
import { StatusBadge } from '@/app/components/ui/StatusBadge';
import { WeatherWidget } from '@/app/components/ui/WeatherWidget';
import { supabase } from '@/lib/supabase';
import { cn } from '@/app/components/ui/utils';
import { WizardAccentRail } from '@/app/components/ui/WizardAccentRail';

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

const THEME = {
  rehearsal: {
    accentColor: 'var(--accent-rehearsal)',
    accentFg: 'var(--accent-rehearsal-fg)',
    deleteLabel: 'DELETE THIS REHEARSAL',
    secondBtnLabel: undefined,
  },
  gig: {
    accentColor: 'var(--accent-gig)',
    accentFg: 'var(--accent-gig-fg)',
    deleteLabel: 'DELETE THIS GIG',
    secondBtnLabel: undefined,
  },
  quote: {
    accentColor: 'var(--accent-quote)',
    accentFg: 'var(--accent-quote-fg)',
    deleteLabel: 'DELETE THIS QUOTE',
    secondBtnLabel: '+ CONVERT',
  },
  draft: {
    accentColor: 'var(--muted-fg)',
    accentFg: 'var(--bg)',
    deleteLabel: 'DELETE THIS DRAFT',
    secondBtnLabel: undefined,
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
  const theme = THEME[eventType];
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
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={springs.smooth}
        className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-background text-foreground"
      >
        <WizardAccentRail color={theme.accentColor} />

        <div className="flex-1 flex flex-col gap-[40px] px-[16px] pt-[62px] pb-[200px]">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[20px]">
              <button
                onClick={onClose}
                className="w-[50px] h-[50px] rounded-full flex items-center justify-center border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 transition-colors"
              >
                <ArrowLeft className="w-[24px] h-[24px] text-foreground" />
              </button>
              <StatusBadge status={event.status} />
            </div>
          </div>

          {/* Event Info */}
          <div className="flex gap-[20px] items-start">
            <div className="flex-1 flex flex-col gap-[4px] min-w-0">
              <div className="flex gap-[4px] items-center flex-wrap">
                {tags.map((tag, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-[6px] px-[10px] py-[4px] leading-tight",
                      i === 0 ? "font-bold shadow-sm" : "bg-foreground/10 text-foreground/70 font-bold"
                    )}
                    style={i === 0 ? { backgroundColor: theme.accentColor, color: theme.accentFg } : undefined}
                  >
                    <span className="text-[12px] uppercase whitespace-nowrap leading-tight">{tag}</span>
                  </div>
                ))}
              </div>
              <h2 className="text-[32px] font-bold text-foreground uppercase leading-tight">
                {event.title}
              </h2>
              <div className="flex flex-col gap-[2px]">
                <div className="flex items-center gap-[8px]">
                  <span className="text-[16px] font-bold text-foreground uppercase leading-tight">
                    {venueName}
                  </span>
                  <ArrowUpRight className="w-[18px] h-[18px] text-foreground" />
                </div>
                {venueAddress && (
                  <span className="text-[12px] font-medium text-foreground/50 uppercase leading-tight">
                    {venueAddress}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-[4px]">
              <WeatherWidget
                eventDate={event.date}
                location={event.location}
                textColor="var(--fg)"
              />
              <div
                className="rounded-[10px] px-[10px] py-[10px] font-bold shadow-sm"
                style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
              >
                <span className="text-[12px] uppercase whitespace-nowrap leading-tight">
                  {dateLabel}{timeLabel ? ` - ${timeLabel}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Event-specific sections */}
          {eventType === 'rehearsal' && (
            <RehearsalSections event={event} theme={theme as any} memberCount={memberCount} />
          )}
          {eventType === 'gig' && (
            <GigSections event={event} theme={theme as any} memberCount={memberCount} isAdmin={isAdmin} memberFee={memberFee} />
          )}
          {eventType === 'quote' && (
            <QuoteSections event={event} theme={theme as any} memberCount={memberCount} miniCalendar={miniCalendar} eventYear={eventYear} eventMonthDay={eventMonthDay} isAdmin={isAdmin} memberFee={memberFee} />
          )}
          {eventType === 'draft' && (
            <DraftSections event={event} theme={theme as any} memberCount={memberCount} isAdmin={isAdmin} memberFee={memberFee} />
          )}
        </div>

        {/* Footer */}
        <div
          className="fixed bottom-0 left-0 right-0 rounded-t-[26px] px-[16px] pt-[20px] pb-[30px] z-[80] bg-background/95 backdrop-blur-md border-t border-foreground/15 shadow-[0px_-4px_20px_rgba(0,0,0,0.15)]"
        >
          {isPending && onAccept && onDecline ? (
            <div className="flex flex-col gap-[20px]">
              <div className="grid grid-cols-2 gap-[10px]">
                <button
                  onClick={handleAccept}
                  disabled={isSubmitting}
                  style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
                  className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] font-bold shadow-lg shadow-black/10 hover:opacity-95 transition-opacity disabled:opacity-50"
                >
                  <span className="text-[16px] font-bold uppercase">
                    {isSubmitting ? '...' : 'ACCEPT'}
                  </span>
                </button>
                <button
                  onClick={handleDecline}
                  disabled={isSubmitting}
                  className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] bg-foreground/10 hover:bg-foreground/15 text-foreground font-bold transition-colors disabled:opacity-50"
                >
                  <span className="text-[16px] font-bold uppercase">DECLINE</span>
                </button>
              </div>
            </div>
          ) : isAdmin ? (
            // ADMIN view — edit / delete / chat
            <div className="flex flex-col gap-[20px] items-center">
              <div className="grid grid-cols-2 gap-[10px] w-full">
                <button
                  onClick={onEdit}
                  style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
                  className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] font-bold shadow-lg shadow-black/10 hover:opacity-95 transition-opacity"
                >
                  <Plus className="w-[18px] h-[18px]" />
                  <span className="text-[16px] font-bold uppercase">EDIT</span>
                </button>
                <button
                  onClick={onChat}
                  className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] bg-foreground/10 hover:bg-foreground/15 text-foreground font-bold transition-colors"
                >
                  <MessageCircle className="w-[18px] h-[18px] text-foreground" />
                  <span className="text-[16px] font-bold uppercase">
                    {eventType === 'quote' ? (THEME.quote.secondBtnLabel || 'CONVERT') : 'CHAT'}
                  </span>
                </button>
              </div>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-[12px]">
                  <button
                    onClick={() => { onDelete?.(); setShowDeleteConfirm(false); }}
                    className="text-[12px] font-bold text-white bg-[var(--warning)] rounded-[8px] px-[16px] py-[8px] uppercase"
                  >
                    CONFIRM DELETE
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-[12px] font-bold text-foreground/70 hover:text-foreground uppercase transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowDeleteConfirm(true)}>
                  <span className="text-[12px] font-medium text-[var(--destructive)] uppercase hover:opacity-80 transition-opacity">
                    {theme.deleteLabel}
                  </span>
                </button>
              )}
            </div>
          ) : (
            // MEMBER view (already accepted) — chat + drop out (with confirmation)
            <div className="flex flex-col gap-[20px] items-center">
              <div className="grid grid-cols-2 gap-[10px] w-full">
                <button
                  onClick={onChat}
                  style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
                  className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] font-bold shadow-lg shadow-black/10 hover:opacity-95 transition-opacity"
                >
                  <MessageCircle className="w-[18px] h-[18px]" />
                  <span className="text-[16px] font-bold uppercase">CHAT</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSubmitting}
                  className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] bg-foreground/10 hover:bg-foreground/15 text-foreground font-bold transition-colors disabled:opacity-50"
                >
                  <span className="text-[16px] font-bold uppercase">
                    {isSubmitting ? '...' : 'DROP OUT'}
                  </span>
                </button>
              </div>
              {showDeleteConfirm && (
                <div className="flex flex-col gap-[12px] items-center">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/70">Are you sure you want to drop out?</p>
                  <div className="flex items-center gap-[12px]">
                    <button
                      onClick={handleDecline}
                      disabled={isSubmitting}
                      className="text-[12px] font-bold text-white bg-[var(--warning)] rounded-[8px] px-[16px] py-[8px] uppercase disabled:opacity-50"
                    >
                      {isSubmitting ? '...' : 'CONFIRM DROP'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="text-[12px] font-bold text-foreground/70 hover:text-foreground uppercase transition-colors"
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
  color?: string;
  showArrow?: boolean;
  alertColor?: string;
  onTap?: () => void;
  expanded?: boolean;
}> = ({ label, color, showArrow = true, alertColor, onTap, expanded }) => (
  <button
    className="flex items-center gap-[6px] appearance-none bg-transparent border-none p-0 m-0 cursor-pointer text-left"
    onClick={onTap}
    disabled={!onTap}
  >
    <span
      className={cn("text-[12px] font-bold uppercase leading-tight", !alertColor && !color && "text-foreground/60")}
      style={alertColor || color ? { color: alertColor || color } : undefined}
    >
      {label}
    </span>
    {showArrow && (
      <motion.div
        animate={{ rotate: expanded ? 90 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <ArrowUpRight
          className={cn("w-[14px] h-[14px]", !alertColor && !color && "text-foreground/40")}
          style={alertColor || color ? { color: alertColor || color } : undefined}
        />
      </motion.div>
    )}
  </button>
);

const SectionValue: React.FC<{ value: string | number; color?: string }> = ({ value, color }) => (
  <span
    className={cn("text-[42px] font-bold leading-none tracking-tight", !color && "text-foreground")}
    style={color ? { color } : undefined}
  >
    {value}
  </span>
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
        <div className="pt-[12px] flex flex-col gap-[8px]">
          {children}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

const DetailRow: React.FC<{
  label: string;
  value: string;
  color?: string;
  subtitleColor?: string;
}> = ({ label, value, color, subtitleColor }) => (
  <div
    className="flex items-center justify-between py-[8px] border-b border-foreground/10"
    style={subtitleColor ? { borderColor: subtitleColor } : undefined}
  >
    <span
      className={cn("text-[12px] font-medium uppercase leading-tight", !subtitleColor && "text-foreground/50")}
      style={subtitleColor ? { color: subtitleColor } : undefined}
    >
      {label}
    </span>
    <span
      className={cn("text-[14px] font-bold leading-tight", !color && "text-foreground")}
      style={color ? { color } : undefined}
    >
      {value}
    </span>
  </div>
);

// ─── REHEARSAL ───
const RehearsalSections: React.FC<{
  event: EventData;
  theme: typeof THEME.rehearsal;
  memberCount: number;
}> = ({ event, theme, memberCount }) => {
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
    <div className="flex flex-col gap-[40px]">
      {/* Rehearsal Time */}
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label="REHEARSAL TIME" onTap={() => toggle('time')} expanded={expandedSection === 'time'} />
          <span className="text-[42px] font-bold leading-none tracking-tight text-foreground">
            {rehearsalTime}
          </span>
        </div>
        <ExpandableDetail expanded={expandedSection === 'time'}>
          <DetailRow label="Start" value={event.time ? formatEventTime(event.time) : 'TBD'} />
          {event.endTime && <DetailRow label="End" value={formatEventTime(event.endTime)} />}
          <DetailRow label="Location" value={event.location?.split(',')[0] || 'TBD'} />
        </ExpandableDetail>
      </div>

      {/* Songs to Play */}
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label="SONGS TO PLAY" onTap={() => toggle('songs')} expanded={expandedSection === 'songs'} />
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
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label="CONFIRMED MEMBERS" onTap={() => toggle('members')} expanded={expandedSection === 'members'} />
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
  theme: typeof THEME.gig;
  memberCount: number;
  isAdmin?: boolean;
  memberFee?: number;
}> = ({ event, theme, memberCount, isAdmin = true, memberFee }) => {
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
    <div className="flex flex-col gap-[40px]">
      {/* 2x2 Grid: Load In, Sound Check, Show Start, Band Total Fee */}
      <div className="grid grid-cols-2 gap-x-[20px] gap-y-[40px]">
        {/* Load In */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label="LOAD IN" onTap={() => toggle('loadin')} expanded={expandedSection === 'loadin'} />
            <SectionValue value={loadInTime} />
          </div>
          <ExpandableDetail expanded={expandedSection === 'loadin'}>
            <DetailRow label="Time" value={loadInTime} />
            <DetailRow label="Location" value={event.location?.split(',')[0] || 'TBD'} />
          </ExpandableDetail>
        </div>

        {/* Sound Check */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label="SOUND CHECK" onTap={() => toggle('soundcheck')} expanded={expandedSection === 'soundcheck'} />
            <SectionValue value={soundCheckTime} />
          </div>
          <ExpandableDetail expanded={expandedSection === 'soundcheck'}>
            <DetailRow label="Time" value={soundCheckTime} />
          </ExpandableDetail>
        </div>

        {/* Show Start */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label="SHOW START" onTap={() => toggle('showstart')} expanded={expandedSection === 'showstart'} />
            <SectionValue value={showTime} />
          </div>
          <ExpandableDetail expanded={expandedSection === 'showstart'}>
            <DetailRow label="Show Time" value={showTime} />
          </ExpandableDetail>
        </div>

        {/* Fee Section */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label={isAdmin ? "BAND TOTAL FEE" : "YOUR FEE"} onTap={() => toggle('fee')} expanded={expandedSection === 'fee'} />
            <SectionValue value={isAdmin ? bandTotal : (memberFee != null ? `$${memberFee}` : bandTotal)} />
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
      <div className="flex flex-col gap-[8px]">
        <div className="flex flex-col">
          <SectionHeader label="SETLIST" alertColor={numSongs > 0 ? undefined : 'var(--warning)'} onTap={() => toggle('setlist')} expanded={expandedSection === 'setlist'} />
          <div className="flex items-center gap-[10px]">
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
                <span className="text-[12px] font-medium pt-[4px] text-foreground/50">
                  + {numSongs - 10} more songs
                </span>
              )}
            </>
          ) : (
            <span className="text-[12px] font-medium text-foreground/50">
              No setlist assigned
            </span>
          )}
        </ExpandableDetail>
      </div>

      {/* Lineup */}
      <div className="flex flex-col gap-[8px]">
        <button
          className="flex items-center gap-[6px] appearance-none bg-transparent border-none p-0 m-0 cursor-pointer"
          onClick={() => toggle('lineup')}
        >
          <span className="text-[42px] font-bold leading-none tracking-tight text-foreground">LINEUP</span>
          <motion.div animate={{ rotate: expandedSection === 'lineup' ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ArrowUpRight className="w-[42px] h-[42px] text-foreground" />
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
              <div className="flex flex-col gap-[10px] pt-[12px]">
                {members.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-end p-[12px] rounded-[10px] bg-foreground/5 border border-foreground/10"
                  >
                    <div className="flex-1 flex flex-col">
                      <span className="text-[12px] font-medium text-foreground/50">{m.role}</span>
                      <span className="text-[22px] font-bold text-foreground">{m.name}</span>
                    </div>
                    <span className="text-[22px] font-bold text-foreground">{m.fee}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Accepted Status — typographic only, no SVG icon */}
        <div className="flex items-center justify-center gap-[6px] mt-[10px]">
          <span className="text-[12px] font-bold uppercase leading-tight text-foreground/50">
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
  theme: typeof THEME.quote;
  memberCount: number;
  miniCalendar: { daysInMonth: number; firstDay: number; eventDay: number } | null;
  eventYear: string | number;
  isAdmin?: boolean;
  memberFee?: number;
  eventMonthDay: string;
}> = ({ event, theme, memberCount, miniCalendar, eventYear, eventMonthDay, isAdmin = true, memberFee }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const toggle = (key: string) => setExpandedSection(prev => prev === key ? null : key);
  const bandTotal = formatBandTotal(event.price);

  return (
    <div className="flex flex-col gap-[40px]">
      {/* Year + Date */}
      <div className="flex gap-[20px]">
        <div className="flex-1 flex flex-col">
          <SectionHeader label="YEAR" onTap={() => toggle('year')} expanded={expandedSection === 'year'} />
          <span className="text-[42px] font-bold leading-none tracking-tight text-foreground">{eventYear || new Date().getFullYear()}</span>
          <ExpandableDetail expanded={expandedSection === 'year'}>
            <DetailRow label="Year" value={String(eventYear || new Date().getFullYear())} />
            <DetailRow label="Season" value={(() => { const m = new Date(event.date).getMonth(); return m >= 5 && m <= 8 ? 'Summer' : m >= 2 && m <= 4 ? 'Spring' : m >= 9 && m <= 10 ? 'Autumn' : 'Winter'; })()} />
          </ExpandableDetail>
        </div>
        <div className="flex-1 flex flex-col">
          <SectionHeader label="DATE" onTap={() => toggle('date')} expanded={expandedSection === 'date'} />
          <span className="text-[42px] font-bold leading-none tracking-tight text-foreground">{eventMonthDay}</span>
          <ExpandableDetail expanded={expandedSection === 'date'}>
            <DetailRow label="Day" value={new Date(event.date).toLocaleDateString('en-US', { weekday: 'long' })} />
            <DetailRow label="Time" value={event.time ? formatEventTime(event.time) : 'TBD'} />
          </ExpandableDetail>
        </div>
      </div>

      {/* Mini Calendar */}
      {miniCalendar && (
        <div className="flex flex-col gap-[4px] p-[16px] rounded-[16px] bg-foreground/5 border border-foreground/10">
          <div className="flex">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} className="flex-1 text-center">
                <span className="text-[10px] font-bold leading-tight text-foreground/40">{d}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-[2px]">
            {Array.from({ length: miniCalendar.firstDay }).map((_, i) => (
              <div key={`e-${i}`} className="h-[28px]" />
            ))}
            {Array.from({ length: miniCalendar.daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isEventDay = day === miniCalendar.eventDay;
              return (
                <div
                  key={day}
                  className="h-[28px] flex items-center justify-center rounded-[6px]"
                  style={
                    isEventDay
                      ? { backgroundColor: theme.accentColor, color: theme.accentFg }
                      : undefined
                  }
                >
                  <span
                    className={cn(
                      "text-[12px] leading-tight",
                      isEventDay ? "font-bold" : "font-medium text-foreground/70"
                    )}
                  >
                    {day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Client + Pricing */}
      <div className="grid grid-cols-2 gap-[20px]">
        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label="CLIENT" onTap={() => toggle('client')} expanded={expandedSection === 'client'} />
            <div className="flex flex-col">
              <span className="text-[42px] font-bold leading-none tracking-tight text-foreground">
                {(event.clientName || event.title || '—').split(' ')[0]?.toUpperCase()}
              </span>
              <span className="text-[22px] font-bold leading-none text-foreground/60">
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

        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label={isAdmin ? "PRICING" : "YOUR FEE"} onTap={() => toggle('pricing')} expanded={expandedSection === 'pricing'} />
            <div className="flex flex-col">
              <span className="text-[42px] font-bold leading-none tracking-tight text-foreground">
                {isAdmin ? bandTotal : (memberFee != null ? `$${memberFee}` : bandTotal)}
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
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label="MEMBERS" onTap={() => toggle('members')} expanded={expandedSection === 'members'} />
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
  theme: typeof THEME.draft;
  memberCount: number;
  isAdmin?: boolean;
  memberFee?: number;
}> = ({ event, theme, memberCount, isAdmin = true, memberFee }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const toggle = (key: string) => setExpandedSection(prev => prev === key ? null : key);

  return (
    <div className="flex flex-col gap-[40px]">
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label="TEAM MEMBERS" onTap={() => toggle('members')} expanded={expandedSection === 'members'} />
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

      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label={isAdmin ? "BAND TOTAL" : "YOUR FEE"} onTap={() => toggle('total')} expanded={expandedSection === 'total'} />
          <SectionValue value={isAdmin ? formatBandTotal(event.price) : (memberFee != null ? `$${memberFee}` : formatBandTotal(event.price))} />
        </div>
        {isAdmin && (
          <ExpandableDetail expanded={expandedSection === 'total'}>
            <DetailRow label="Total" value={formatBandTotal(event.price)} />
          </ExpandableDetail>
        )}
      </div>

      {event.notes && (
        <div className="flex flex-col gap-[10px]">
          <SectionHeader label="NOTES" showArrow={false} />
          <p className="text-[14px] leading-relaxed text-foreground/70">{event.notes}</p>
        </div>
      )}
    </div>
  );
};