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

const THEME = {
  rehearsal: {
    bg: 'var(--accent-rehearsal)',
    text: 'white',
    textClass: 'text-white',
    tagBg: 'white',
    tagText: 'var(--accent-rehearsal)',
    activeDot: 'white',
    inactiveDot: 'rgba(255,255,255,0.2)',
    btnEditBg: 'bg-black',
    btnEditText: 'text-white',
    btnChatBg: 'bg-white',
    btnChatText: 'text-black',
    subtitleOpacity: 'rgba(255,255,255,0.5)',
    dateBadgeBg: 'rgba(255,255,255,0.2)',
    backBorderColor: 'white',
    backBg: 'rgba(216,216,216,0.2)',
    deleteLabel: 'DELETE THIS REHEARSAL',
    secondBtnLabel: undefined,
  },
  gig: {
    bg: 'var(--accent-gig)',
    text: 'black',
    textClass: 'text-accent-gig-foreground',
    tagBg: 'black',
    tagText: 'var(--accent-gig)',
    activeDot: 'black',
    inactiveDot: 'rgba(0,0,0,0.2)',
    btnEditBg: 'bg-black',
    btnEditText: 'text-white',
    btnChatBg: 'bg-white',
    btnChatText: 'text-black',
    subtitleOpacity: 'rgba(0,0,0,0.5)',
    dateBadgeBg: 'rgba(0,0,0,0.2)',
    backBorderColor: 'black',
    backBg: 'rgba(216,216,216,0.2)',
    deleteLabel: 'DELETE THIS GIG',
    secondBtnLabel: undefined,
  },
  quote: {
    bg: 'var(--accent-quote)',
    text: 'white',
    textClass: 'text-white',
    tagBg: 'white',
    tagText: 'var(--accent-quote)',
    activeDot: 'white',
    inactiveDot: 'rgba(255,255,255,0.2)',
    btnEditBg: 'bg-black',
    btnEditText: 'text-white',
    btnChatBg: 'bg-black',
    btnChatText: 'text-white',
    subtitleOpacity: 'rgba(255,255,255,0.5)',
    dateBadgeBg: 'rgba(255,255,255,0.2)',
    backBorderColor: 'white',
    backBg: 'rgba(216,216,216,0.2)',
    deleteLabel: 'DELETE THIS QUOTE',
    secondBtnLabel: '+ CONVERT',
  },
  draft: {
    bg: 'var(--muted-fg)',
    text: 'white',
    textClass: 'text-white',
    tagBg: 'rgba(255,255,255,0.3)',
    tagText: 'white',
    activeDot: 'white',
    inactiveDot: 'rgba(255,255,255,0.2)',
    btnEditBg: 'bg-white',
    btnEditText: 'text-black',
    btnChatBg: 'bg-white/20',
    btnChatText: 'text-white',
    subtitleOpacity: 'rgba(255,255,255,0.5)',
    dateBadgeBg: 'rgba(255,255,255,0.2)',
    backBorderColor: 'white',
    backBg: 'rgba(216,216,216,0.2)',
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
        className="fixed inset-0 z-[60]"
        style={{ backgroundColor: theme.bg }}
      />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={springs.smooth}
        className="fixed inset-0 z-[70] flex flex-col overflow-y-auto"
        style={{ backgroundColor: theme.bg }}
      >
        <div className="flex-1 flex flex-col gap-[40px] px-[16px] pt-[62px] pb-[200px]">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[20px]">
              <button
                onClick={onClose}
                className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-solid"
                style={{
                  backgroundColor: theme.backBg,
                  borderColor: theme.backBorderColor,
                }}
              >
                <ArrowLeft className="w-[24px] h-[24px]" style={{ color: theme.text }} />
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
                    className="rounded-[6px] px-[10px] py-[4px]"
                    style={{ backgroundColor: theme.tagBg, color: theme.tagText }}
                  >
                    <span className="text-[12px] font-bold uppercase whitespace-nowrap leading-tight">{tag}</span>
                  </div>
                ))}
              </div>
              <h2 className="text-[32px] font-bold uppercase leading-tight" style={{ color: theme.text }}>
                {event.title}
              </h2>
              <div className="flex flex-col gap-[2px]">
                <div className="flex items-center gap-[8px]">
                  <span className="text-[16px] font-bold uppercase leading-tight" style={{ color: theme.text }}>
                    {venueName}
                  </span>
                  <ArrowUpRight className="w-[18px] h-[18px]" style={{ color: theme.text }} />
                </div>
                {venueAddress && (
                  <span className="text-[12px] font-medium uppercase leading-tight" style={{ color: theme.subtitleOpacity }}>
                    {venueAddress}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-[4px]">
              <WeatherWidget
                eventDate={event.date}
                location={event.location}
                textColor={theme.text}
              />
              <div
                className="rounded-[10px] px-[10px] py-[10px]"
                style={{ backgroundColor: theme.dateBadgeBg }}
              >
                <span className="text-[12px] font-bold uppercase whitespace-nowrap leading-tight" style={{ color: theme.text }}>
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
          className="fixed bottom-0 left-0 right-0 rounded-t-[26px] px-[16px] pt-[20px] pb-[30px] z-[80]"
          style={{
            backgroundColor: theme.bg,
            boxShadow: '0px -4px 20px rgba(0,0,0,0.15)',
          }}
        >
          {isPending && onAccept && onDecline ? (
            <div className="flex flex-col gap-[20px]">
              <div className="grid grid-cols-2 gap-[10px]">
                <button
                  onClick={handleAccept}
                  disabled={isSubmitting}
                  className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] bg-black disabled:opacity-50"
                >
                  <span className="text-[16px] font-bold text-white uppercase">
                    {isSubmitting ? '...' : 'ACCEPT'}
                  </span>
                </button>
                <button
                  onClick={handleDecline}
                  disabled={isSubmitting}
                  className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] bg-white disabled:opacity-50"
                >
                  <span className="text-[16px] font-bold text-black uppercase">DECLINE</span>
                </button>
              </div>
            </div>
          ) : isAdmin ? (
            // ADMIN view — edit / delete / chat
            <div className="flex flex-col gap-[20px] items-center">
              <div className="grid grid-cols-2 gap-[10px] w-full">
                <button
                  onClick={onEdit}
                  className={`rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] ${theme.btnEditBg}`}
                >
                  <Plus className={`w-[18px] h-[18px] ${theme.btnEditText}`} />
                  <span className={`text-[16px] font-bold uppercase ${theme.btnEditText}`}>EDIT</span>
                </button>
                <button
                  onClick={onChat}
                  className={`rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] ${theme.btnChatBg}`}
                >
                  <MessageCircle className={`w-[18px] h-[18px] ${theme.btnChatText}`} />
                  <span className={`text-[16px] font-bold uppercase ${theme.btnChatText}`}>
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
                    className="text-[12px] font-bold uppercase" style={{ color: theme.text }}
                  >
                    CANCEL
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowDeleteConfirm(true)}>
                  <span className="text-[12px] font-medium text-[var(--destructive)] uppercase">
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
                  className={`rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] ${theme.btnChatBg}`}
                >
                  <MessageCircle className={`w-[18px] h-[18px] ${theme.btnChatText}`} />
                  <span className={`text-[16px] font-bold uppercase ${theme.btnChatText}`}>CHAT</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSubmitting}
                  className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] bg-white disabled:opacity-50"
                >
                  <span className="text-[16px] font-bold text-black uppercase">
                    {isSubmitting ? '...' : 'DROP OUT'}
                  </span>
                </button>
              </div>
              {showDeleteConfirm && (
                <div className="flex flex-col gap-[12px] items-center">
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: theme.text }}>Are you sure you want to drop out?</p>
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
                      className="text-[12px] font-bold uppercase" style={{ color: theme.text }}
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
  color: string;
  showArrow?: boolean;
  alertColor?: string;
  onTap?: () => void;
  expanded?: boolean;
}> = ({ label, color, showArrow = true, alertColor, onTap, expanded }) => (
  <button
    className="flex items-center gap-[6px] appearance-none bg-transparent border-none p-0 m-0 cursor-pointer"
    onClick={onTap}
    disabled={!onTap}
  >
    <span className="text-[12px] font-bold uppercase leading-tight" style={{ color: alertColor || color }}>
      {label}
    </span>
    {showArrow && (
      <motion.div
        animate={{ rotate: expanded ? 90 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <ArrowUpRight className="w-[14px] h-[14px]" style={{ color: alertColor || color }} />
      </motion.div>
    )}
  </button>
);

const SectionValue: React.FC<{ value: string | number; color: string }> = ({ value, color }) => (
  <span className="text-[42px] font-bold leading-none" style={{ color }}>{value}</span>
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
  color: string;
  subtitleColor: string;
}> = ({ label, value, color, subtitleColor }) => (
  <div className="flex items-center justify-between py-[8px] border-b" style={{ borderColor: subtitleColor }}>
    <span className="text-[12px] font-medium uppercase leading-tight" style={{ color: subtitleColor }}>{label}</span>
    <span className="text-[14px] font-bold leading-tight" style={{ color }}>{value}</span>
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
          <SectionHeader label="REHEARSAL TIME" color={theme.text} onTap={() => toggle('time')} expanded={expandedSection === 'time'} />
          <span className="text-[42px] font-bold leading-none" style={{ color: theme.text }}>
            {rehearsalTime}
          </span>
        </div>
        <ExpandableDetail expanded={expandedSection === 'time'}>
          <DetailRow label="Start" value={event.time ? formatEventTime(event.time) : 'TBD'} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          {event.endTime && <DetailRow label="End" value={formatEventTime(event.endTime)} color={theme.text} subtitleColor={theme.subtitleOpacity} />}
          <DetailRow label="Location" value={event.location?.split(',')[0] || 'TBD'} color={theme.text} subtitleColor={theme.subtitleOpacity} />
        </ExpandableDetail>
      </div>

      {/* Songs to Play */}
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label="SONGS TO PLAY" color={theme.text} onTap={() => toggle('songs')} expanded={expandedSection === 'songs'} />
          <SectionValue value={numSongs || 0} color={theme.text} />
        </div>
        <ExpandableDetail expanded={expandedSection === 'songs'}>
          {setlistSongs.length > 0 ? setlistSongs.slice(0, 5).map((song, i) => (
            <DetailRow key={i} label={`Song ${i + 1}`} value={song.title} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          )) : (
            <DetailRow label="Info" value="No setlist assigned" color={theme.text} subtitleColor={theme.subtitleOpacity} />
          )}
        </ExpandableDetail>
      </div>

      {/* Confirmed Members */}
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label="CONFIRMED MEMBERS" color={theme.text} onTap={() => toggle('members')} expanded={expandedSection === 'members'} />
          <SectionValue value={memberCount} color={theme.text} />
        </div>
        <ExpandableDetail expanded={expandedSection === 'members'}>
          {event.members?.length ? event.members.map((m, i) => (
            <DetailRow key={i} label={`Member ${i + 1}`} value={m} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          )) : (
            <DetailRow label="Info" value="No members assigned" color={theme.text} subtitleColor={theme.subtitleOpacity} />
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
            <SectionHeader label="LOAD IN" color={theme.text} onTap={() => toggle('loadin')} expanded={expandedSection === 'loadin'} />
            <SectionValue value={loadInTime} color={theme.text} />
          </div>
          <ExpandableDetail expanded={expandedSection === 'loadin'}>
            <DetailRow label="Time" value={loadInTime} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Location" value={event.location?.split(',')[0] || 'TBD'} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          </ExpandableDetail>
        </div>

        {/* Sound Check */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label="SOUND CHECK" color={theme.text} onTap={() => toggle('soundcheck')} expanded={expandedSection === 'soundcheck'} />
            <SectionValue value={soundCheckTime} color={theme.text} />
          </div>
          <ExpandableDetail expanded={expandedSection === 'soundcheck'}>
            <DetailRow label="Time" value={soundCheckTime} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          </ExpandableDetail>
        </div>

        {/* Show Start */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label="SHOW START" color={theme.text} onTap={() => toggle('showstart')} expanded={expandedSection === 'showstart'} />
            <SectionValue value={showTime} color={theme.text} />
          </div>
          <ExpandableDetail expanded={expandedSection === 'showstart'}>
            <DetailRow label="Show Time" value={showTime} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          </ExpandableDetail>
        </div>

        {/* Fee Section */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label={isAdmin ? "BAND TOTAL FEE" : "YOUR FEE"} color={theme.text} onTap={() => toggle('fee')} expanded={expandedSection === 'fee'} />
            <SectionValue value={isAdmin ? bandTotal : (memberFee != null ? `$${memberFee}` : bandTotal)} color={theme.text} />
          </div>
          {isAdmin && (
            <ExpandableDetail expanded={expandedSection === 'fee'}>
              {members.map((m, i) => (
                <DetailRow key={i} label={m.name} value={m.fee} color={theme.text} subtitleColor={theme.subtitleOpacity} />
              ))}
              <DetailRow label="Total" value={bandTotal} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            </ExpandableDetail>
          )}
        </div>
      </div>

      {/* Setlist */}
      <div className="flex flex-col gap-[8px]">
        <div className="flex flex-col">
          <SectionHeader label="SETLIST" color={theme.text} alertColor={numSongs > 0 ? undefined : 'var(--warning)'} onTap={() => toggle('setlist')} expanded={expandedSection === 'setlist'} />
          <div className="flex items-center gap-[10px]">
            <SectionValue value={`${numSongs} SONGS`} color={theme.text} />
          </div>
        </div>
        <ExpandableDetail expanded={expandedSection === 'setlist'}>
          {numSongs > 0 ? (
            <>
              {setlistSongs.slice(0, 10).map((song, i) => (
                <DetailRow key={i} label={`${i + 1}`} value={song.title} color={theme.text} subtitleColor={theme.subtitleOpacity} />
              ))}
              {numSongs > 10 && (
                <span className="text-[12px] font-medium pt-[4px]" style={{ color: theme.subtitleOpacity }}>
                  + {numSongs - 10} more songs
                </span>
              )}
            </>
          ) : (
            <span className="text-[12px] font-medium" style={{ color: theme.subtitleOpacity }}>
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
          <span className="text-[42px] font-bold leading-none" style={{ color: theme.text }}>LINEUP</span>
          <motion.div animate={{ rotate: expandedSection === 'lineup' ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ArrowUpRight className="w-[42px] h-[42px]" style={{ color: theme.text }} />
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
                    className="flex items-end p-[10px] rounded-[10px]"
                    style={{ backgroundColor: theme.inactiveDot }}
                  >
                    <div className="flex-1 flex flex-col">
                      <span className="text-[12px] font-medium" style={{ color: theme.subtitleOpacity }}>{m.role}</span>
                      <span className="text-[22px] font-bold" style={{ color: theme.text }}>{m.name}</span>
                    </div>
                    <span className="text-[22px] font-bold" style={{ color: theme.text }}>{m.fee}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Accepted Status — typographic only, no SVG icon */}
        <div className="flex items-center justify-center gap-[6px] mt-[10px]">
          <span className="text-[12px] font-bold uppercase leading-tight" style={{ color: theme.subtitleOpacity }}>
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
          <SectionHeader label="YEAR" color={theme.text} onTap={() => toggle('year')} expanded={expandedSection === 'year'} />
          <span className="text-[42px] font-bold leading-none" style={{ color: theme.text }}>{eventYear || new Date().getFullYear()}</span>
          <ExpandableDetail expanded={expandedSection === 'year'}>
            <DetailRow label="Year" value={String(eventYear || new Date().getFullYear())} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Season" value={(() => { const m = new Date(event.date).getMonth(); return m >= 5 && m <= 8 ? 'Summer' : m >= 2 && m <= 4 ? 'Spring' : m >= 9 && m <= 10 ? 'Autumn' : 'Winter'; })()} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          </ExpandableDetail>
        </div>
        <div className="flex-1 flex flex-col">
          <SectionHeader label="DATE" color={theme.text} onTap={() => toggle('date')} expanded={expandedSection === 'date'} />
          <span className="text-[42px] font-bold leading-none" style={{ color: theme.text }}>{eventMonthDay}</span>
          <ExpandableDetail expanded={expandedSection === 'date'}>
            <DetailRow label="Day" value={new Date(event.date).toLocaleDateString('en-US', { weekday: 'long' })} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Time" value={event.time ? formatEventTime(event.time) : 'TBD'} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          </ExpandableDetail>
        </div>
      </div>

      {/* Mini Calendar */}
      {miniCalendar && (
        <div className="flex flex-col gap-[4px]">
          <div className="flex">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} className="flex-1 text-center">
                <span className="text-[10px] font-bold leading-tight" style={{ color: theme.text }}>{d}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-[2px]">
            {Array.from({ length: miniCalendar.firstDay }).map((_, i) => (
              <div key={`e-${i}`} className="h-[24px]" />
            ))}
            {Array.from({ length: miniCalendar.daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isEventDay = day === miniCalendar.eventDay;
              return (
                <div
                  key={day}
                  className="h-[24px] flex items-center justify-center rounded-[6px]"
                  style={{
                    backgroundColor: isEventDay ? 'white' : 'transparent',
                  }}
                >
                  <span
                    className="text-[12px] font-medium leading-tight"
                    style={{ color: isEventDay ? theme.bg : theme.text }}
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
            <SectionHeader label="CLIENT" color={theme.text} onTap={() => toggle('client')} expanded={expandedSection === 'client'} />
            <div className="flex flex-col">
              <span className="text-[42px] font-bold leading-none" style={{ color: theme.text }}>
                {(event.clientName || event.title || '—').split(' ')[0]?.toUpperCase()}
              </span>
              <span className="text-[22px] font-bold leading-none" style={{ color: theme.text }}>
                {(event.clientName || event.title || '').split(' ').slice(1).join(' ')?.toUpperCase()}
              </span>
            </div>
          </div>
          <ExpandableDetail expanded={expandedSection === 'client'}>
            <DetailRow label="Name" value={event.clientName || '—'} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Event Type" value={(event.eventType || '—').toUpperCase()} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Location" value={event.location?.split(',')[0] || 'TBD'} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          </ExpandableDetail>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label={isAdmin ? "PRICING" : "YOUR FEE"} color={theme.text} onTap={() => toggle('pricing')} expanded={expandedSection === 'pricing'} />
            <div className="flex flex-col">
              <span className="text-[42px] font-bold leading-none" style={{ color: theme.text }}>
                {isAdmin ? bandTotal : (memberFee != null ? `$${memberFee}` : bandTotal)}
              </span>
            </div>
          </div>
          {isAdmin && (
            <ExpandableDetail expanded={expandedSection === 'pricing'}>
              <DetailRow label="Band Total" value={bandTotal} color={theme.text} subtitleColor={theme.subtitleOpacity} />
              <DetailRow label="Venue" value={event.location?.split(',')[0] || 'TBD'} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            </ExpandableDetail>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label="MEMBERS" color={theme.text} onTap={() => toggle('members')} expanded={expandedSection === 'members'} />
          <SectionValue value={memberCount} color={theme.text} />
        </div>
        <ExpandableDetail expanded={expandedSection === 'members'}>
          {event.members?.length ? event.members.map((m, i) => (
            <DetailRow key={i} label={`Member ${i + 1}`} value={m} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          )) : (
            <DetailRow label="Info" value="No members assigned" color={theme.text} subtitleColor={theme.subtitleOpacity} />
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
          <SectionHeader label="TEAM MEMBERS" color={theme.text} onTap={() => toggle('members')} expanded={expandedSection === 'members'} />
          <SectionValue value={memberCount} color={theme.text} />
        </div>
        <ExpandableDetail expanded={expandedSection === 'members'}>
          {event.members?.length ? event.members.map((m, i) => (
            <DetailRow key={i} label={`Member ${i + 1}`} value={m} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          )) : (
            <DetailRow label="Info" value="No members assigned" color={theme.text} subtitleColor={theme.subtitleOpacity} />
          )}
        </ExpandableDetail>
      </div>

      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label={isAdmin ? "BAND TOTAL" : "YOUR FEE"} color={theme.text} onTap={() => toggle('total')} expanded={expandedSection === 'total'} />
          <SectionValue value={isAdmin ? formatBandTotal(event.price) : (memberFee != null ? `$${memberFee}` : formatBandTotal(event.price))} color={theme.text} />
        </div>
        {isAdmin && (
          <ExpandableDetail expanded={expandedSection === 'total'}>
            <DetailRow label="Total" value={formatBandTotal(event.price)} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          </ExpandableDetail>
        )}
      </div>

      {event.notes && (
        <div className="flex flex-col gap-[10px]">
          <SectionHeader label="NOTES" color={theme.text} showArrow={false} />
          <p className="text-[14px] leading-relaxed" style={{ color: theme.subtitleOpacity }}>{event.notes}</p>
        </div>
      )}
    </div>
  );
};