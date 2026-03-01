import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowUpRight, Plus, MessageCircle, AlertCircle } from 'lucide-react';
import { springs } from '@/styles/motion';
import { EventData } from './EventCard';
import { WeatherWidget } from '@/app/components/ui/WeatherWidget';

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
}

const DetailDotGrid: React.FC<{
  filled: number;
  total: number;
  cols?: number;
  rows?: number;
  activeColor: string;
  inactiveColor: string;
}> = ({ filled, total, cols = 6, rows = 2, activeColor, inactiveColor }) => {
  const capped = Math.min(filled, total);
  return (
    <div
      className="grid w-full gap-[4px]"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        height: rows * 15 + (rows - 1) * 4,
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-[10px]"
          style={{ backgroundColor: i < capped ? activeColor : inactiveColor }}
        />
      ))}
    </div>
  );
};

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
    bg: '#0147FF',
    text: 'white',
    textClass: 'text-white',
    tagBg: 'white',
    tagText: '#0147FF',
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
    deleteLabel: 'DELETE THIS REHARSAL',
  },
  gig: {
    bg: '#D5FB46',
    text: 'black',
    textClass: 'text-black',
    tagBg: 'black',
    tagText: '#D5FB46',
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
  },
  quote: {
    bg: '#9A8878',
    text: 'white',
    textClass: 'text-white',
    tagBg: 'white',
    tagText: '#9A8878',
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
    bg: '#3A3A3A',
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
  },
};

const getEventTags = (event: EventData, eventType: EventType): string[] => {
  const tags: string[] = [];
  if (eventType === 'gig') {
    tags.push('GIG');
    if (event.location?.toLowerCase().includes('outdoor') || event.location?.toLowerCase().includes('park')) {
      tags.push('OUTDOOR');
    } else {
      tags.push('INDOOR');
    }
  } else if (eventType === 'rehearsal') {
    tags.push('REHARSAL');
    tags.push('WEEKLY');
  } else if (eventType === 'quote') {
    tags.push('QUOTE');
    tags.push('WEDDING');
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
      try { await onAccept(); onClose(); }
      catch { /* handled */ }
      finally { setIsSubmitting(false); }
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
              <span className="text-[32px] font-bold uppercase" style={{ color: theme.text }}>
                {eventType === 'gig' ? 'GIG' : eventType === 'rehearsal' ? 'REHARSAL' : eventType === 'quote' ? 'QUOTE' : 'DRAFT'}
              </span>
            </div>
            {eventType === 'gig' && event.notes && (
              <div className="bg-[#F23030] rounded-full p-[7px]">
                <AlertCircle className="w-[36px] h-[36px] text-white" style={{ transform: 'rotate(180deg)' }} />
              </div>
            )}
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
                    <span className="text-[12px] font-bold uppercase whitespace-nowrap">{tag}</span>
                  </div>
                ))}
              </div>
              <h2 className="text-[32px] font-bold uppercase leading-tight" style={{ color: theme.text }}>
                {event.title}
              </h2>
              <div className="flex flex-col gap-[2px]">
                <div className="flex items-center gap-[8px]">
                  <span className="text-[16px] font-bold uppercase" style={{ color: theme.text }}>
                    {venueName}
                  </span>
                  <ArrowUpRight className="w-[18px] h-[18px]" style={{ color: theme.text }} />
                </div>
                {venueAddress && (
                  <span className="text-[12px] font-medium uppercase" style={{ color: theme.subtitleOpacity }}>
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
                <span className="text-[12px] font-bold uppercase whitespace-nowrap" style={{ color: theme.text }}>
                  {dateLabel}{timeLabel ? ` - ${timeLabel}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Event-specific sections */}
          {eventType === 'rehearsal' && (
            <RehearsalSections event={event} theme={theme} memberCount={memberCount} />
          )}
          {eventType === 'gig' && (
            <GigSections event={event} theme={theme} memberCount={memberCount} />
          )}
          {eventType === 'quote' && (
            <QuoteSections event={event} theme={theme} memberCount={memberCount} miniCalendar={miniCalendar} eventYear={eventYear} eventMonthDay={eventMonthDay} />
          )}
          {eventType === 'draft' && (
            <DraftSections event={event} theme={theme} memberCount={memberCount} />
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
          ) : (
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
                    className="text-[12px] font-bold text-white bg-[#F23030] rounded-[8px] px-[16px] py-[8px] uppercase"
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
                  <span className="text-[12px] font-medium text-[#FF7C7C] uppercase">
                    {theme.deleteLabel}
                  </span>
                </button>
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
    <span className="text-[12px] font-bold uppercase" style={{ color: alertColor || color }}>
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
    <span className="text-[12px] font-medium uppercase" style={{ color: subtitleColor }}>{label}</span>
    <span className="text-[14px] font-bold" style={{ color }}>{value}</span>
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
    ? `${formatEventTime(event.time.replace(/^(\d+)/, (_, h) => String(Math.max(1, parseInt(h) - 2))))} - ${formatEventTime(event.time)}`
    : '8 - 10PM';

  return (
    <div className="flex flex-col gap-[40px]">
      {/* Rehearsal Time */}
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label="REHARSAL TIME" color={theme.text} onTap={() => toggle('time')} expanded={expandedSection === 'time'} />
          <span className="text-[42px] font-bold leading-none" style={{ color: theme.text }}>
            {rehearsalTime}
          </span>
        </div>
        <DetailDotGrid filled={8} total={12} cols={6} rows={2} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
        <ExpandableDetail expanded={expandedSection === 'time'}>
          <DetailRow label="Start" value={event.time ? formatEventTime(event.time.replace(/^(\d+)/, (_, h) => String(Math.max(1, parseInt(h) - 2)))) : '8PM'} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          <DetailRow label="End" value={event.time ? formatEventTime(event.time) : '10PM'} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          <DetailRow label="Duration" value="2 Hours" color={theme.text} subtitleColor={theme.subtitleOpacity} />
          <DetailRow label="Location" value={event.location?.split(',')[0] || 'TBD'} color={theme.text} subtitleColor={theme.subtitleOpacity} />
        </ExpandableDetail>
      </div>

      {/* Songs to Play */}
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label="SONGS TO PLAY" color={theme.text} onTap={() => toggle('songs')} expanded={expandedSection === 'songs'} />
          <SectionValue value={4} color={theme.text} />
        </div>
        <DetailDotGrid filled={4} total={12} cols={6} rows={2} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
        <ExpandableDetail expanded={expandedSection === 'songs'}>
          <DetailRow label="Song 1" value="Come Together" color={theme.text} subtitleColor={theme.subtitleOpacity} />
          <DetailRow label="Song 2" value="Superstition" color={theme.text} subtitleColor={theme.subtitleOpacity} />
          <DetailRow label="Song 3" value="Fly Me To The Moon" color={theme.text} subtitleColor={theme.subtitleOpacity} />
          <DetailRow label="Song 4" value="Isn't She Lovely" color={theme.text} subtitleColor={theme.subtitleOpacity} />
        </ExpandableDetail>
      </div>

      {/* Confirmed Members */}
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label="CONFIRMED MEMBERS" color={theme.text} onTap={() => toggle('members')} expanded={expandedSection === 'members'} />
          <SectionValue value={memberCount || 7} color={theme.text} />
        </div>
        <DetailDotGrid filled={memberCount || 7} total={12} cols={6} rows={2} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
        <ExpandableDetail expanded={expandedSection === 'members'}>
          {(event.members?.length ? event.members : ['GB', 'CE', 'AN']).map((m, i) => (
            <DetailRow key={i} label={['SINGER', 'GUITAR', 'DRUMS', 'BASS', 'PIANO', 'SAX', 'TRUMPET', 'KEYS'][i % 8]} value={m} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          ))}
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
}> = ({ event, theme, memberCount }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const toggle = (key: string) => setExpandedSection(prev => prev === key ? null : key);

  const showTime = event.time ? formatEventTime(event.time) : '8PM';
  const loadInTime = event.time
    ? formatEventTime(event.time.replace(/^(\d+)/, (_, h: string) => String(Math.max(1, parseInt(h) - 3))))
    : '5PM';
  const soundCheckTime = event.time
    ? formatEventTime(event.time.replace(/:\d{2}$/, ':30').replace(/^(\d+)/, (_, h: string) => String(Math.max(1, parseInt(h) - 2))))
    : '6:30PM';
  const bandTotal = formatBandTotal(event.price);
  const numSongs = 45;

  const members = event.members?.length > 0
    ? event.members.map((m, i) => ({
        initials: m,
        name: m === 'GB' ? 'GIANLUCA' : m === 'CE' ? 'EMMA' : m === 'AN' ? 'ANTONIO' : `MEMBER ${i + 1}`,
        role: ['SINGER', 'SINGER', 'GUITAR', 'PIANO', 'BASS', 'SAX', 'TRUMPET', 'DRUMS'][i % 8],
        fee: i < 2 ? '$350' : '$300',
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
          <DetailDotGrid filled={4} total={12} cols={6} rows={2} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
          <ExpandableDetail expanded={expandedSection === 'loadin'}>
            <DetailRow label="Time" value={loadInTime} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Location" value={event.location?.split(',')[0] || 'TBD'} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Parking" value="Street" color={theme.text} subtitleColor={theme.subtitleOpacity} />
          </ExpandableDetail>
        </div>

        {/* Sound Check */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label="SOUND CHECK" color={theme.text} onTap={() => toggle('soundcheck')} expanded={expandedSection === 'soundcheck'} />
            <SectionValue value={soundCheckTime} color={theme.text} />
          </div>
          <DetailDotGrid filled={7} total={12} cols={6} rows={2} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
          <ExpandableDetail expanded={expandedSection === 'soundcheck'}>
            <DetailRow label="Time" value={soundCheckTime} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Duration" value="30 Min" color={theme.text} subtitleColor={theme.subtitleOpacity} />
          </ExpandableDetail>
        </div>

        {/* Show Start */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label="SHOW START" color={theme.text} onTap={() => toggle('showstart')} expanded={expandedSection === 'showstart'} />
            <SectionValue value={showTime} color={theme.text} />
          </div>
          <DetailDotGrid filled={8} total={12} cols={6} rows={2} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
          <ExpandableDetail expanded={expandedSection === 'showstart'}>
            <DetailRow label="Show Time" value={showTime} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Set Duration" value="3 Hours" color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Sets" value="2" color={theme.text} subtitleColor={theme.subtitleOpacity} />
          </ExpandableDetail>
        </div>

        {/* Band Total Fee */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label="BAND TOTAL FEE" color={theme.text} onTap={() => toggle('fee')} expanded={expandedSection === 'fee'} />
            <SectionValue value={bandTotal} color={theme.text} />
          </div>
          <DetailDotGrid filled={10} total={12} cols={6} rows={2} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
          <ExpandableDetail expanded={expandedSection === 'fee'}>
            {members.map((m, i) => (
              <DetailRow key={i} label={m.name} value={m.fee} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            ))}
            <DetailRow label="Total" value={bandTotal} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          </ExpandableDetail>
        </div>
      </div>

      {/* Setlist */}
      <div className="flex flex-col gap-[8px]">
        <div className="flex flex-col">
          <SectionHeader label="SETLIST" color={theme.text} alertColor={numSongs > 0 ? undefined : '#F23030'} onTap={() => toggle('setlist')} expanded={expandedSection === 'setlist'} />
          <div className="flex items-center gap-[10px]">
            <SectionValue value={`${numSongs} SONGS`} color={theme.text} />
          </div>
        </div>
        <DetailDotGrid filled={numSongs} total={96} cols={12} rows={8} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
        <ExpandableDetail expanded={expandedSection === 'setlist'}>
          {['Come Together', 'Superstition', 'Fly Me To The Moon', "Isn't She Lovely", 'All Of Me'].map((song, i) => (
            <DetailRow key={i} label={`${i + 1}`} value={song} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          ))}
          <span className="text-[12px] font-medium pt-[4px]" style={{ color: theme.subtitleOpacity }}>
            + {numSongs - 5} more songs
          </span>
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

        <InstrumentGrid members={members} theme={theme} />

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

        {/* Accepted Status */}
        <div className="flex items-center justify-center gap-[6px] mt-[10px]">
          <div className="bg-black rounded-full p-[2px]">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-[12px] font-bold uppercase" style={{ color: theme.subtitleOpacity }}>
            YOU HAVE ACCEPTED THIS EVENT.
          </span>
        </div>
      </div>
    </div>
  );
};

const InstrumentGrid: React.FC<{
  members: { role: string; name: string }[];
  theme: typeof THEME.gig;
}> = ({ members, theme }) => {
  const instruments = members.map(m => m.role);
  const grid = Array.from({ length: 30 }, () => ({ filled: false, label: '' }));

  const placeInstrument = (col: number, row: number, span: number, label: string) => {
    for (let c = col; c < col + span && c < 6; c++) {
      const idx = row * 6 + c;
      if (idx < 30) {
        grid[idx] = { filled: true, label: c === col ? label : '' };
      }
    }
  };

  const placed = new Set<string>();
  const instrumentList = [...new Set(instruments)];
  const positions: [number, number, number, string][] = [
    [2, 0, 2, 'DRUMS'],
    [0, 1, 1, 'PIANO'],
    [4, 1, 1, 'SAX'],
    [5, 1, 1, 'TRUMP'],
    [1, 3, 1, 'GUITAR'],
    [4, 3, 1, 'BASS'],
    [2, 4, 1, 'SINGER'],
    [3, 4, 1, 'SINGER'],
  ];

  positions.forEach(([col, row, span, label]) => {
    if (instrumentList.includes(label) || placed.size < instrumentList.length) {
      placeInstrument(col, row, span, label);
      placed.add(label);
    }
  });

  return (
    <div className="grid grid-cols-6 gap-[4px] w-full" style={{ height: 130 }}>
      {grid.map((cell, i) => (
        <div
          key={i}
          className="rounded-[10px] flex items-center justify-center relative"
          style={{
            backgroundColor: cell.filled ? theme.activeDot : theme.inactiveDot,
          }}
        >
          {cell.label && (
            <span className="text-[10px] font-medium text-center absolute" style={{ color: cell.filled ? theme.bg : theme.text }}>
              {cell.label}
            </span>
          )}
        </div>
      ))}
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
  eventMonthDay: string;
}> = ({ event, theme, memberCount, miniCalendar, eventYear, eventMonthDay }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const toggle = (key: string) => setExpandedSection(prev => prev === key ? null : key);
  const bandTotal = formatBandTotal(event.price);

  return (
    <div className="flex flex-col gap-[40px]">
      {/* Year + Date */}
      <div className="flex gap-[20px]">
        <div className="flex-1 flex flex-col">
          <SectionHeader label="YEAR" color={theme.text} onTap={() => toggle('year')} expanded={expandedSection === 'year'} />
          <span className="text-[42px] font-bold leading-none" style={{ color: theme.text }}>{eventYear || '2028'}</span>
          <ExpandableDetail expanded={expandedSection === 'year'}>
            <DetailRow label="Year" value={String(eventYear || '2028')} color={theme.text} subtitleColor={theme.subtitleOpacity} />
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
                <span className="text-[10px] font-bold" style={{ color: theme.text }}>{d}</span>
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
                    className="text-[12px] font-medium"
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
                {event.notes?.split(' ')[0]?.toUpperCase() || 'MIA'}
              </span>
              <span className="text-[22px] font-bold leading-none" style={{ color: theme.text }}>
                {event.notes?.split(' ').slice(1).join(' ')?.toUpperCase() || 'CALIFA'}
              </span>
            </div>
          </div>
          <DetailDotGrid filled={6} total={40} cols={8} rows={5} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
          <ExpandableDetail expanded={expandedSection === 'client'}>
            <DetailRow label="Name" value={event.notes || 'MIA CALIFA'} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Event Type" value="WEDDING" color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Location" value={event.location?.split(',')[0] || 'TBD'} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          </ExpandableDetail>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label="PRICING & FINANCE" color={theme.text} onTap={() => toggle('pricing')} expanded={expandedSection === 'pricing'} />
            <div className="flex flex-col">
              <span className="text-[42px] font-bold leading-none" style={{ color: theme.text }}>
                {bandTotal}
              </span>
              <span className="text-[22px] font-bold leading-none" style={{ color: theme.text }}>
                DP30%
              </span>
            </div>
          </div>
          <DetailDotGrid filled={8} total={40} cols={8} rows={5} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
          <ExpandableDetail expanded={expandedSection === 'pricing'}>
            <DetailRow label="Band Total" value={bandTotal} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Deposit" value="30%" color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Balance Due" value="70%" color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="Status" value="PENDING" color={theme.text} subtitleColor={theme.subtitleOpacity} />
          </ExpandableDetail>
        </div>
      </div>

      {/* Guests */}
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label="GUESTS" color={theme.text} onTap={() => toggle('guests')} expanded={expandedSection === 'guests'} />
          <SectionValue value={150} color={theme.text} />
        </div>
        <DetailDotGrid filled={150} total={200} cols={20} rows={10} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
        <ExpandableDetail expanded={expandedSection === 'guests'}>
          <DetailRow label="Expected" value="150" color={theme.text} subtitleColor={theme.subtitleOpacity} />
          <DetailRow label="Capacity" value="200" color={theme.text} subtitleColor={theme.subtitleOpacity} />
          <DetailRow label="Venue" value={event.location?.split(',')[0] || 'TBD'} color={theme.text} subtitleColor={theme.subtitleOpacity} />
        </ExpandableDetail>
      </div>

      {/* Music Moments + Members */}
      <div className="grid grid-cols-2 gap-[20px]">
        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label="MUSIC MOMENTS" color={theme.text} onTap={() => toggle('moments')} expanded={expandedSection === 'moments'} />
            <SectionValue value={3} color={theme.text} />
          </div>
          <DetailDotGrid filled={3} total={12} cols={6} rows={2} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
          <ExpandableDetail expanded={expandedSection === 'moments'}>
            <DetailRow label="1" value="Ceremony" color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="2" value="Cocktail Hour" color={theme.text} subtitleColor={theme.subtitleOpacity} />
            <DetailRow label="3" value="Reception" color={theme.text} subtitleColor={theme.subtitleOpacity} />
          </ExpandableDetail>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="flex flex-col">
            <SectionHeader label="MEMBERS" color={theme.text} onTap={() => toggle('members')} expanded={expandedSection === 'members'} />
            <SectionValue value={memberCount || 8} color={theme.text} />
          </div>
          <DetailDotGrid filled={memberCount || 8} total={12} cols={6} rows={2} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
          <ExpandableDetail expanded={expandedSection === 'members'}>
            {(event.members?.length ? event.members : ['GB', 'CE', 'AN']).map((m, i) => (
              <DetailRow key={i} label={['SINGER', 'GUITAR', 'DRUMS', 'BASS', 'PIANO', 'SAX', 'TRUMPET', 'KEYS'][i % 8]} value={m} color={theme.text} subtitleColor={theme.subtitleOpacity} />
            ))}
          </ExpandableDetail>
        </div>
      </div>
    </div>
  );
};

// ─── DRAFT ───
const DraftSections: React.FC<{
  event: EventData;
  theme: typeof THEME.draft;
  memberCount: number;
}> = ({ event, theme, memberCount }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const toggle = (key: string) => setExpandedSection(prev => prev === key ? null : key);

  return (
    <div className="flex flex-col gap-[40px]">
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label="TEAM MEMBERS" color={theme.text} onTap={() => toggle('members')} expanded={expandedSection === 'members'} />
          <SectionValue value={memberCount} color={theme.text} />
        </div>
        <DetailDotGrid filled={memberCount} total={12} cols={6} rows={2} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
        <ExpandableDetail expanded={expandedSection === 'members'}>
          {(event.members?.length ? event.members : []).map((m, i) => (
            <DetailRow key={i} label={['SINGER', 'GUITAR', 'DRUMS', 'BASS', 'PIANO', 'SAX', 'TRUMPET', 'KEYS'][i % 8]} value={m} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          ))}
        </ExpandableDetail>
      </div>

      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col">
          <SectionHeader label="BAND TOTAL" color={theme.text} onTap={() => toggle('total')} expanded={expandedSection === 'total'} />
          <SectionValue value={formatBandTotal(event.price)} color={theme.text} />
        </div>
        <DetailDotGrid filled={6} total={12} cols={6} rows={2} activeColor={theme.activeDot} inactiveColor={theme.inactiveDot} />
        <ExpandableDetail expanded={expandedSection === 'total'}>
          <DetailRow label="Total" value={formatBandTotal(event.price)} color={theme.text} subtitleColor={theme.subtitleOpacity} />
          <DetailRow label="Status" value="DRAFT" color={theme.text} subtitleColor={theme.subtitleOpacity} />
        </ExpandableDetail>
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
