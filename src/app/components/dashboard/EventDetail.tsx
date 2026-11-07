import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowUpRight,
  MessageCircle,
  Check,
  Pencil,
  Music,
  RotateCcw,
  MapPin,
  Calendar,
  Clock,
  Users,
  ListMusic,
  FileText,
  Truck,
  Volume2,
  Play,
  Wallet,
  AlertCircle,
  X,
  Copy,
  Share2,
} from '@/app/components/icons';
import { springs } from '@/styles/motion';
import { EventData } from './EventCard';
import { WeatherWidget } from '@/app/components/ui/WeatherWidget';
import { supabase } from '@/lib/supabase';
import { useBand } from '@/lib/BandContext';
import { cn } from '@/app/components/ui/utils';
import { WizardAccentRail } from '@/app/components/ui/WizardAccentRail';
import { haptic } from '@/lib/haptics';
import { QuoteShareModal } from '@/app/components/quotes/QuoteShareModal';

interface EventDetailProps {
  event: EventData;
  onClose: () => void;
  userResponse?: 'pending' | 'accepted' | 'declined';
  onAccept?: () => Promise<void>;
  onDecline?: () => Promise<void>;
  onEdit?: () => void;
  onDelete?: () => void;
  onChat?: () => void;
  onConfirmQuote?: (event: EventData) => Promise<void> | void;
  onRevertQuote?: (event: EventData) => Promise<void> | void;
  onShareQuote?: (event: EventData) => void;
  onOpenBandSettings?: () => void;
  memberFee?: number;
  isAdmin?: boolean;
  currentUserId?: string;
}

const formatEventDateShort = (dateStr: string): string => {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'TBD';
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  return `${month} ${day}`;
};

const formatEventDateFull = (dateStr: string): string => {
  if (!dateStr) return 'DATE TBD';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'DATE TBD';
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  const year = d.getFullYear();
  return `${weekday}, ${month} ${day}, ${year}`;
};

const formatEventTime = (timeStr?: string): string => {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return m > 0 ? `${h}:${match[2]} ${ampm}` : `${h} ${ampm}`;
  }
  return timeStr;
};

const formatCurrencyCompact = (price?: string | number): string => {
  if (price === undefined || price === null || price === '') return '€0';
  const raw = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^0-9.]/g, ''));
  if (isNaN(raw)) return String(price);
  if (raw >= 1000) return `€${(raw / 1000).toFixed(raw % 1000 === 0 ? 0 : 1)}K`;
  return `€${Math.round(raw).toLocaleString()}`;
};

const formatCurrencyExact = (price?: string | number): string => {
  if (price === undefined || price === null || price === '') return '€0';
  const raw = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^0-9.]/g, ''));
  if (isNaN(raw)) return String(price);
  return `€${Math.round(raw).toLocaleString()}`;
};

type EventCategory = 'rehearsal' | 'gig' | 'quote' | 'draft';
type ActiveSheetType = 'fee' | 'setlist' | 'lineup' | 'notes' | null;

interface ResolvedMember {
  userId?: string;
  name: string;
  initials: string;
  role: string;
  fee: number;
  status: 'confirmed' | 'pending' | 'declined' | 'maybe';
}

const getEventType = (status?: string): EventCategory => {
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
  },
  gig: {
    accentColor: 'var(--accent-gig)',
    accentFg: 'var(--accent-gig-fg)',
    deleteLabel: 'DELETE THIS GIG',
  },
  quote: {
    accentColor: 'var(--accent-quote)',
    accentFg: 'var(--accent-quote-fg)',
    deleteLabel: 'DELETE THIS QUOTE',
  },
  draft: {
    accentColor: 'var(--muted-fg)',
    accentFg: 'var(--bg)',
    deleteLabel: 'DELETE THIS DRAFT',
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

const getEventTags = (event: EventData, eventType: EventCategory): string[] => {
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
  onConfirmQuote,
  onRevertQuote,
  onShareQuote,
  onOpenBandSettings,
  memberFee,
  isAdmin = true,
  currentUserId,
}) => {
  const { selectedBand, bands } = useBand();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheetType>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [isShareQuoteOpen, setIsShareQuoteOpen] = useState(false);

  const isPending = userResponse === 'pending';
  const eventType = getEventType(event.status);
  const isPersonalGig = !event.band_id && (event.createdBy === currentUserId || !event.band_id);

  // Setlist state
  const [setlistSongs, setSetlistSongs] = useState<{ title: string; artist?: string; duration?: string; key?: string }[]>([]);
  const [setlistLoading, setSetlistLoading] = useState(false);

  // Real Event Members state
  const [dbMembers, setDbMembers] = useState<ResolvedMember[] | null>(null);

  useEffect(() => {
    if (!isAdmin && !isPersonalGig && (eventType === 'quote' || userResponse === 'declined')) {
      onClose();
    }
  }, [isAdmin, isPersonalGig, eventType, userResponse, onClose]);

  // Fetch setlist songs
  useEffect(() => {
    if (!event.setlistId || isPersonalGig) {
      setSetlistSongs([]);
      return;
    }
    let cancelled = false;
    setSetlistLoading(true);
    const fetchSetlist = async () => {
      try {
        const { data } = await supabase
          .from('setlist_songs')
          .select('*, song:songs(title, artist, duration, key)')
          .eq('setlist_id', event.setlistId)
          .order('position', { ascending: true });
        if (!cancelled && data && data.length > 0) {
          setSetlistSongs(
            data.map((s: any) => ({
              title: s.song?.title || 'Unknown Song',
              artist: s.song?.artist || undefined,
              duration: s.song?.duration || undefined,
              key: s.song?.key || undefined,
            }))
          );
        }
      } finally {
        if (!cancelled) setSetlistLoading(false);
      }
    };
    fetchSetlist();
    return () => {
      cancelled = true;
    };
  }, [event.setlistId, isPersonalGig]);

  // Fetch event_members and resolve against band members
  useEffect(() => {
    if (!event.eventId || isPersonalGig) {
      setDbMembers(null);
      return;
    }
    let cancelled = false;
    const fetchMembers = async () => {
      const { data, error } = await supabase
        .from('event_members')
        .select('user_id, fee, status, role')
        .eq('event_id', event.eventId);

      if (cancelled || error || !data || data.length === 0) return;

      // Build profile lookup across active band & all user bands
      const targetBand = bands?.find((b) => b.id === event.band_id) || selectedBand;
      const memberLookup = new Map<string, { name: string; role: string; defaultFee: number }>();
      targetBand?.members?.forEach((bm: any) => {
        if (bm.user_id) {
          const fullName = bm.profile?.full_name || bm.profile?.email?.split('@')[0] || 'Member';
          memberLookup.set(bm.user_id, {
            name: fullName,
            role: bm.instrument || bm.role || 'Musician',
            defaultFee: Number(bm.default_fee || 0),
          });
        }
      });

      const resolved: ResolvedMember[] = data
        .filter((em: any) => em.status !== 'declined')
        .map((em: any, idx: number) => {
          const info = memberLookup.get(em.user_id);
          const name = info?.name || (em.user_id === currentUserId ? 'You' : `Member ${idx + 1}`);
          const initials =
            name
              .split(' ')
              .filter(Boolean)
              .map((w: string) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() || 'M';
          return {
            userId: em.user_id,
            name,
            initials,
            role: em.role || info?.role || 'Musician',
            fee: em.fee != null ? Number(em.fee) : info?.defaultFee || 0,
            status: (em.status as ResolvedMember['status']) || 'confirmed',
          };
        });

      if (!cancelled) {
        setDbMembers(resolved);
      }
    };
    fetchMembers();
    return () => {
      cancelled = true;
    };
  }, [event.eventId, event.band_id, isPersonalGig, bands, selectedBand, currentUserId]);

  const isPast = useMemo(() => {
    if (!event.date) return false;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const normDate = event.date.includes('T') ? event.date.split('T')[0] : event.date;
    return normDate < todayStr;
  }, [event.date]);

  const resolvedMembers: ResolvedMember[] = useMemo(() => {
    if (dbMembers && dbMembers.length > 0) return dbMembers;
    const rawCount = event.members?.length || 0;
    if (rawCount === 0) return [];
    const totalNum = parseFloat(event.price?.replace(/[^0-9.]/g, '') || '0');
    const fallbackSplit = rawCount > 0 ? Math.round(totalNum / rawCount) : 0;
    return event.members.map((m, i) => ({
      name: m.length <= 3 ? `Member ${i + 1} (${m})` : m,
      initials: m.slice(0, 2).toUpperCase(),
      role: 'Musician',
      fee: fallbackSplit,
      status: 'confirmed',
    }));
  }, [dbMembers, event.members, event.price]);

  if (!isAdmin && !isPersonalGig && (eventType === 'quote' || userResponse === 'declined')) {
    return null;
  }

  const baseTheme = THEME[eventType];
  const theme = isPast
    ? {
        ...baseTheme,
        accentColor: 'var(--accent-past)',
        accentFg: 'var(--accent-past-fg)',
        deleteLabel: `DELETE THIS ${eventType.toUpperCase()}`,
      }
    : baseTheme;

  const tags = getEventTags(event, eventType);
  const secondaryTags = tags.filter((t) => t !== 'GIG' && t !== 'REHEARSAL' && t !== 'QUOTE' && t !== 'DRAFT');
  const memberCount = resolvedMembers.length || event.members?.length || 0;
  const confirmedMemberCount = resolvedMembers.filter((m) => m.status === 'confirmed').length || memberCount;
  const pendingMemberCount = resolvedMembers.filter((m) => m.status === 'pending').length;

  const myResolvedFee = useMemo(() => {
    if (memberFee != null) return memberFee;
    if (currentUserId && dbMembers) {
      const me = dbMembers.find((m) => m.userId === currentUserId);
      if (me?.fee != null) return me.fee;
    }
    return undefined;
  }, [memberFee, currentUserId, dbMembers]);

  const handleConfirmQuote = async () => {
    if (isConfirming || !onConfirmQuote) return;
    haptic.confirm();
    setIsConfirming(true);
    try {
      await onConfirmQuote(event);
    } catch (err) {
      console.error('Error confirming quote:', err);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleRevertQuote = async () => {
    if (isReverting || !onRevertQuote) return;
    haptic.tap();
    setIsReverting(true);
    try {
      await onRevertQuote(event);
    } catch (err) {
      console.error('Error reverting to quote:', err);
    } finally {
      setIsReverting(false);
    }
  };

  const handleAccept = async () => {
    if (onAccept && !isSubmitting) {
      haptic.confirm();
      setIsSubmitting(true);
      try {
        await onAccept();
        onClose();
      } catch (err) {
        console.error('Action failed, keeping modal open', err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDecline = async () => {
    if (onDecline && !isSubmitting) {
      haptic.delete();
      setIsSubmitting(true);
      try {
        await onDecline();
        onClose();
      } catch {
        /* handled */
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const venueName = event.location?.split(',')[0]?.trim() || 'TBD';
  const venueAddress =
    event.venueAddress ||
    (event.location?.includes(',') ? event.location.split(',').slice(1).join(',').trim() : '') ||
    event.venueCity ||
    '';
  const hasValidLocation = venueName !== 'TBD' && venueName !== '';
  const fullLocationQuery = [venueName !== 'TBD' ? venueName : '', venueAddress].filter(Boolean).join(', ');

  const handleOpenMaps = () => {
    if (!hasValidLocation) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullLocationQuery)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyAddress = async () => {
    if (!fullLocationQuery) return;
    try {
      await navigator.clipboard.writeText(fullLocationQuery);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch {
      /* ignore */
    }
  };

  // Schedule & Timeline computations
  const showTime = event.time ? formatEventTime(event.time) : 'TBD';
  const endTimeFormatted = event.endTime ? formatEventTime(event.endTime) : '';
  const loadInTime = event.loadInTime
    ? formatEventTime(event.loadInTime)
    : event.time
      ? formatEventTime(event.time.replace(/^(\d+)/, (_, h: string) => String(Math.max(1, parseInt(h) - 3))))
      : 'TBD';
  const soundCheckTime = event.soundcheckTime
    ? formatEventTime(event.soundcheckTime)
    : event.time
      ? formatEventTime(
          event.time.replace(/:\d{2}$/, ':30').replace(/^(\d+)/, (_, h: string) => String(Math.max(1, parseInt(h) - 2)))
        )
      : 'TBD';

  const bandTotalFormatted = formatCurrencyCompact(event.price);
  const displayFeeValue = isPersonalGig
    ? bandTotalFormatted
    : isAdmin
      ? bandTotalFormatted
      : myResolvedFee != null
        ? formatCurrencyCompact(myResolvedFee)
        : bandTotalFormatted;

  const feeCardLabel = isPersonalGig
    ? 'MY PERSONAL FEE'
    : isAdmin
      ? eventType === 'quote'
        ? 'QUOTE TOTAL'
        : 'BAND TOTAL FEE'
      : 'YOUR FEE';

  const numSongs = setlistSongs.length;

  // Sub-type label (e.g., WEDDING, CORPORATE, FESTIVAL) if distinct from generic 'gig'/'other'
  const subTypeEyebrow = useMemo(() => {
    const raw = event.eventType?.toUpperCase();
    if (!raw || raw === 'GIG' || raw === 'REHEARSAL' || raw === 'QUOTE' || raw === 'OTHER') return null;
    return raw;
  }, [event.eventType]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[85] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={springs.smooth}
        className="fixed inset-0 z-[90] flex flex-col overflow-hidden bg-background text-foreground select-none"
      >
        <WizardAccentRail color={theme.accentColor} />

        {/* ═══ MAIN ZERO-SCROLL CONTENT AREA ═══ */}
        <div
          className="flex-1 min-h-0 flex flex-col justify-between gap-2.5 sm:gap-3.5 px-[16px] pl-[20px] max-w-[640px] w-full mx-auto"
          style={{
            paddingTop: 'calc(var(--wizard-header-pt, max(env(safe-area-inset-top, 0px), 44px)) + 4px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 104px)',
          }}
        >
          {/* ─── 1. COMPACT TOP HEADER BAR ─── */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={onClose}
                aria-label="Back"
                className="w-[42px] h-[42px] rounded-full flex items-center justify-center border border-foreground/15 bg-card hover:bg-foreground/10 active:scale-95 transition-all shrink-0 shadow-2xs cursor-pointer"
              >
                <ArrowLeft className="w-[20px] h-[20px] text-foreground" />
              </button>

              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {/* Primary Type Pill */}
                <span
                  className="rounded-[7px] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider leading-none shadow-2xs whitespace-nowrap"
                  style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
                >
                  {isPast ? `PAST ${eventType.toUpperCase()}` : eventType.toUpperCase()}
                </span>

                {/* Secondary Tags (INDOOR, WEEKLY, PENDING, etc.) */}
                {secondaryTags.map((tag, i) => (
                  <span
                    key={i}
                    className="rounded-[7px] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider leading-none bg-foreground/10 text-foreground/75 whitespace-nowrap"
                  >
                    {tag}
                  </span>
                ))}

                {/* Personal or Band Pill */}
                {isPersonalGig ? (
                  <span className="rounded-[7px] px-2 py-1 text-[10px] font-bold uppercase tracking-wider leading-none bg-accent-gig/15 text-accent-gig border border-accent-gig/30 whitespace-nowrap">
                    PERSONAL
                  </span>
                ) : event.band_name ? (
                  <span className="rounded-[7px] px-2 py-1 text-[10px] font-bold uppercase tracking-wider leading-none bg-foreground/[0.07] text-foreground/65 truncate max-w-[110px]">
                    {event.band_name}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Right Status Indicator (RSVP / Completed) */}
            <div className="shrink-0">
              {isPast ? (
                <span className="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase inline-flex items-center gap-1.5 bg-foreground/10 text-foreground/70 border border-foreground/15">
                  <Check className="w-3 h-3 text-foreground/60" />
                  COMPLETED
                </span>
              ) : !isPersonalGig && eventType !== 'quote' && eventType !== 'draft' ? (
                isPending ? (
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase inline-flex items-center gap-1.5 bg-warning/15 text-warning border border-warning/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                    INVITE PENDING
                  </span>
                ) : (
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase inline-flex items-center gap-1.5 bg-success/15 text-success border border-success/30">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                    ACCEPTED
                  </span>
                )
              ) : null}
            </div>
          </div>

          {/* ─── 2. HERO SECTION: TITLE, ACTIONABLE VENUE & WEATHER ─── */}
          <div className="flex items-start justify-between gap-3 shrink-0">
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              {(subTypeEyebrow || isPast) && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 leading-none">
                  {isPast
                    ? `ARCHIVED ${eventType.toUpperCase()}${subTypeEyebrow ? ` • ${subTypeEyebrow}` : ''}`
                    : `${subTypeEyebrow} EVENT`}
                </span>
              )}

              <h1 className="text-[24px] sm:text-[28px] font-black text-foreground uppercase tracking-tight leading-[1.05] line-clamp-2">
                {event.title}
              </h1>

              {/* Actionable Venue Button */}
              <button
                type="button"
                onClick={hasValidLocation ? handleOpenMaps : onEdit}
                disabled={!hasValidLocation && !onEdit}
                title={hasValidLocation ? `Open ${fullLocationQuery} in Maps` : 'Venue TBD'}
                className={cn(
                  'group inline-flex items-center gap-1.5 text-left mt-0.5 rounded-[8px] -ml-1.5 px-1.5 py-0.5 transition-colors max-w-full w-fit',
                  hasValidLocation
                    ? 'hover:bg-foreground/[0.07] active:scale-[0.99] cursor-pointer'
                    : 'cursor-default opacity-75'
                )}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0 text-foreground/60 group-hover:text-foreground transition-colors" />
                <span className="text-[13px] font-bold text-foreground uppercase leading-tight truncate">
                  {venueName}
                </span>
                {venueAddress && (
                  <>
                    <span className="text-foreground/30 text-[12px]">•</span>
                    <span className="text-[12px] font-semibold text-foreground/55 uppercase leading-tight truncate max-w-[160px] sm:max-w-[240px]">
                      {venueAddress}
                    </span>
                  </>
                )}
                {hasValidLocation && (
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                )}
              </button>
            </div>

            {/* Weather Widget (or Past Attendance Badge) */}
            <div className="shrink-0">
              {isPast ? (
                <div className="rounded-[12px] bg-card border border-foreground/10 px-3 py-2.5 flex flex-col items-end justify-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/45">
                    {eventType === 'gig' && !isPersonalGig ? 'ATTENDANCE' : 'STATUS'}
                  </span>
                  <span className="text-[14px] font-black uppercase text-foreground mt-0.5">
                    {memberCount > 0 && !isPersonalGig ? `${memberCount} MEMBERS` : 'ARCHIVED'}
                  </span>
                </div>
              ) : (
                <WeatherWidget
                  eventDate={event.date}
                  location={fullLocationQuery || event.location}
                  textColor="var(--fg)"
                  className="bg-card border-foreground/10 py-[6px] px-[10px]"
                />
              )}
            </div>
          </div>

          {/* ─── 3. UNIFIED SCHEDULE & TIMELINE CARD ─── */}
          <div className="rounded-[16px] bg-card border border-foreground/10 p-3 sm:p-3.5 flex flex-col gap-2.5 shrink-0 shadow-2xs">
            {/* Date & Time Range Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: theme.accentColor }}
                />
                <Calendar className="w-3.5 h-3.5 text-foreground/55 shrink-0" />
                <span className="text-[12px] sm:text-[13px] font-bold uppercase tracking-wider text-foreground truncate">
                  {formatEventDateFull(event.date)}
                </span>
              </div>

              <div
                className="rounded-[7px] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider leading-none shrink-0"
                style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
              >
                {eventType === 'rehearsal'
                  ? getRehearsalCadence(event)
                  : showTime !== 'TBD'
                    ? endTimeFormatted
                      ? `${showTime} – ${endTimeFormatted}`
                      : `${formatEventDateShort(event.date)} • ${showTime}`
                    : formatEventDateShort(event.date)}
              </div>
            </div>

            {/* Horizontal Timeline Strip */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-foreground/10">
              {eventType === 'gig' ? (
                <>
                  <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-[10px] bg-foreground/[0.04]">
                    <div className="flex items-center gap-1 text-foreground/50">
                      <Truck className="w-3 h-3 shrink-0" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">LOAD IN</span>
                    </div>
                    <span className="text-[16px] sm:text-[18px] font-black text-foreground leading-tight tracking-tight">
                      {loadInTime}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-[10px] bg-foreground/[0.04]">
                    <div className="flex items-center gap-1 text-foreground/50">
                      <Volume2 className="w-3 h-3 shrink-0" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">SOUNDCHECK</span>
                    </div>
                    <span className="text-[16px] sm:text-[18px] font-black text-foreground leading-tight tracking-tight">
                      {soundCheckTime}
                    </span>
                  </div>

                  <div
                    className="flex flex-col gap-0.5 px-2.5 py-1.5 rounded-[10px] border"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--accent-gig) 12%, transparent)',
                      borderColor: 'color-mix(in srgb, var(--accent-gig) 30%, transparent)',
                    }}
                  >
                    <div className="flex items-center gap-1" style={{ color: theme.accentColor }}>
                      <Play className="w-3 h-3 shrink-0 fill-current" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">SHOW START</span>
                    </div>
                    <span className="text-[16px] sm:text-[18px] font-black text-foreground leading-tight tracking-tight">
                      {showTime}
                    </span>
                  </div>
                </>
              ) : eventType === 'rehearsal' ? (
                <>
                  <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-[10px] bg-foreground/[0.04]">
                    <div className="flex items-center gap-1 text-foreground/50">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">START</span>
                    </div>
                    <span className="text-[16px] sm:text-[18px] font-black text-foreground leading-tight">
                      {showTime}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-[10px] bg-foreground/[0.04]">
                    <div className="flex items-center gap-1 text-foreground/50">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">END TIME</span>
                    </div>
                    <span className="text-[16px] sm:text-[18px] font-black text-foreground leading-tight">
                      {endTimeFormatted || 'TBD'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-[10px] bg-foreground/[0.04]">
                    <div className="flex items-center gap-1 text-foreground/50">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">ROOM / VENUE</span>
                    </div>
                    <span className="text-[13px] sm:text-[14px] font-black text-foreground uppercase leading-tight truncate mt-0.5">
                      {venueName}
                    </span>
                  </div>
                </>
              ) : (
                /* QUOTE & DRAFT TIMELINE */
                <>
                  <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-[10px] bg-foreground/[0.04]">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/50">SHOW TIME</span>
                    <span className="text-[16px] sm:text-[18px] font-black text-foreground leading-tight">
                      {showTime}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-[10px] bg-foreground/[0.04]">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/50">SETTING</span>
                    <span className="text-[15px] sm:text-[16px] font-black text-foreground uppercase leading-tight">
                      {event.indoorOutdoor?.toUpperCase() || 'INDOOR'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-[10px] bg-foreground/[0.04]">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/50">
                      {event.guests ? 'GUESTS' : 'STATUS'}
                    </span>
                    <span className="text-[15px] sm:text-[16px] font-black text-foreground uppercase leading-tight">
                      {event.guests ? `${event.guests} PAX` : (event.quoteStatus || eventType).toUpperCase()}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ─── 4. BENTO GRID: METRICS & DRILL-DOWNS ─── */}
          <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-2.5 sm:gap-3">
            {eventType === 'rehearsal' ? (
              <>
                {/* Rehearsal Card 1: Songs to Play */}
                <button
                  type="button"
                  onClick={() => setActiveSheet('setlist')}
                  className="rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/20 p-3.5 flex flex-col justify-between text-left transition-all active:scale-[0.99] cursor-pointer shadow-2xs min-h-0"
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <div className="flex items-center gap-1.5">
                      <ListMusic className="w-3.5 h-3.5 text-foreground/55" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                        SONGS TO PLAY
                      </span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40" />
                  </div>

                  <div className="my-auto py-1">
                    <span className="text-[26px] sm:text-[30px] font-black leading-none tracking-tight text-foreground">
                      {setlistLoading ? '...' : `${numSongs} ${numSongs === 1 ? 'SONG' : 'SONGS'}`}
                    </span>
                  </div>

                  <span className="text-[11px] font-semibold text-foreground/55 truncate w-full">
                    {numSongs > 0 ? `1. ${setlistSongs[0].title}` : 'Tap to view setlist'}
                  </span>
                </button>

                {/* Rehearsal Card 2: Confirmed Members */}
                <button
                  type="button"
                  onClick={() => setActiveSheet('lineup')}
                  className="rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/20 p-3.5 flex flex-col justify-between text-left transition-all active:scale-[0.99] cursor-pointer shadow-2xs min-h-0"
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-foreground/55" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                        LINEUP
                      </span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40" />
                  </div>

                  <div className="flex items-center justify-between gap-2 my-auto py-1 w-full">
                    <span className="text-[26px] sm:text-[30px] font-black leading-none tracking-tight text-foreground">
                      {memberCount}
                    </span>
                    {resolvedMembers.length > 0 && (
                      <div className="flex -space-x-2 overflow-hidden">
                        {resolvedMembers.slice(0, 4).map((m, i) => (
                          <div
                            key={i}
                            className="w-7 h-7 rounded-full bg-surface-inverse text-surface-inverse-foreground border-2 border-card flex items-center justify-center text-[9px] font-bold"
                          >
                            {m.initials}
                          </div>
                        ))}
                        {resolvedMembers.length > 4 && (
                          <div className="w-7 h-7 rounded-full bg-foreground/15 text-foreground border-2 border-card flex items-center justify-center text-[9px] font-bold">
                            +{resolvedMembers.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <span className="text-[11px] font-semibold text-foreground/55 truncate w-full">
                    {pendingMemberCount > 0 ? `${pendingMemberCount} pending response` : `${confirmedMemberCount} confirmed`}
                  </span>
                </button>

                {/* Rehearsal Card 3 (Full Width): Notes & Rehearsal Details */}
                <button
                  type="button"
                  onClick={() => setActiveSheet('notes')}
                  className="col-span-2 rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/20 p-3.5 flex flex-col justify-between text-left transition-all active:scale-[0.99] cursor-pointer shadow-2xs min-h-0"
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-foreground/55" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                        REHEARSAL NOTES & LOGISTICS
                      </span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40" />
                  </div>

                  <p className="text-[13px] font-medium text-foreground/80 line-clamp-2 leading-snug my-auto">
                    {event.notes || `Cadence: ${getRehearsalCadence(event)} • Venue: ${fullLocationQuery || 'TBD'}`}
                  </p>

                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    {event.notes ? 'Tap to read full notes' : 'No extra notes added'}
                  </span>
                </button>
              </>
            ) : isPersonalGig ? (
              <>
                {/* Personal Gig Card 1: Personal Fee */}
                <div className="rounded-[16px] bg-card border border-foreground/10 p-3.5 flex flex-col justify-between text-left shadow-2xs min-h-0">
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-accent-gig" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                      MY PERSONAL FEE
                    </span>
                  </div>
                  <div className="my-auto py-1">
                    <span className="text-[28px] sm:text-[32px] font-black leading-none tracking-tight text-foreground">
                      {displayFeeValue}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-foreground/55">
                    Solo gig earnings
                  </span>
                </div>

                {/* Personal Gig Card 2: Location & Setting */}
                <button
                  type="button"
                  onClick={hasValidLocation ? handleOpenMaps : () => setActiveSheet('notes')}
                  className="rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/20 p-3.5 flex flex-col justify-between text-left transition-all active:scale-[0.99] cursor-pointer shadow-2xs min-h-0"
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-foreground/55" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                        LOCATION
                      </span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40" />
                  </div>
                  <div className="my-auto py-1 min-w-0 w-full">
                    <span className="text-[18px] sm:text-[20px] font-black uppercase leading-tight text-foreground block truncate">
                      {venueName}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-foreground/55 truncate w-full">
                    {hasValidLocation ? 'Tap to open in Maps' : 'Location TBD'}
                  </span>
                </button>

                {/* Personal Gig Card 3 (Full Width): Personal Notes */}
                <button
                  type="button"
                  onClick={() => setActiveSheet('notes')}
                  className="col-span-2 rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/20 p-3.5 flex flex-col justify-between text-left transition-all active:scale-[0.99] cursor-pointer shadow-2xs min-h-0"
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-foreground/55" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                        PERSONAL NOTES
                      </span>
                    </div>
                    {event.notes && <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40" />}
                  </div>
                  <p className="text-[13px] font-medium text-foreground/80 line-clamp-2 leading-snug my-auto">
                    {event.notes || 'No personal notes added for this gig.'}
                  </p>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    {event.notes ? 'Tap to view full notes' : 'Tap Edit below to add notes'}
                  </span>
                </button>
              </>
            ) : (
              /* ─── BAND GIG, QUOTE, OR DRAFT 2x2 BENTO ─── */
              <>
                {/* Card 1: Fee / Financials */}
                <button
                  type="button"
                  onClick={() => setActiveSheet('fee')}
                  className="rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/20 p-3.5 flex flex-col justify-between text-left transition-all active:scale-[0.99] cursor-pointer shadow-2xs min-h-0"
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <div className="flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-foreground/55" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                        {feeCardLabel}
                      </span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40" />
                  </div>

                  <div className="my-auto py-1">
                    <span className="text-[28px] sm:text-[32px] font-black leading-none tracking-tight text-foreground">
                      {displayFeeValue}
                    </span>
                  </div>

                  <span className="text-[11px] font-semibold text-foreground/55 truncate w-full">
                    {isAdmin
                      ? myResolvedFee != null && myResolvedFee > 0
                        ? `Your cut: ${formatCurrencyExact(myResolvedFee)} • ${memberCount} split`
                        : `${memberCount} ${memberCount === 1 ? 'member' : 'members'} • Tap for split`
                      : 'Tap for payout details'}
                  </span>
                </button>

                {/* Card 2: Setlist (for Gig) OR Client (for Quote/Draft) */}
                {eventType === 'quote' ? (
                  <button
                    type="button"
                    onClick={() => setActiveSheet('notes')}
                    className="rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/20 p-3.5 flex flex-col justify-between text-left transition-all active:scale-[0.99] cursor-pointer shadow-2xs min-h-0"
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                        CLIENT
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40" />
                    </div>

                    <div className="my-auto py-1 min-w-0 w-full">
                      <span className="text-[20px] sm:text-[22px] font-black uppercase leading-tight tracking-tight text-foreground block truncate">
                        {event.clientName || 'TBD'}
                      </span>
                    </div>

                    <span className="text-[11px] font-semibold text-foreground/55 truncate w-full">
                      {subTypeEyebrow ? `${subTypeEyebrow} • ${venueName}` : venueName}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveSheet('setlist')}
                    className="rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/20 p-3.5 flex flex-col justify-between text-left transition-all active:scale-[0.99] cursor-pointer shadow-2xs min-h-0"
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <div className="flex items-center gap-1.5">
                        <ListMusic
                          className={cn('w-3.5 h-3.5', numSongs === 0 ? 'text-warning' : 'text-foreground/55')}
                        />
                        <span
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-wider',
                            numSongs === 0 ? 'text-warning' : 'text-foreground/60'
                          )}
                        >
                          SETLIST
                        </span>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40" />
                    </div>

                    <div className="my-auto py-1">
                      <span className="text-[28px] sm:text-[32px] font-black leading-none tracking-tight text-foreground">
                        {setlistLoading ? '...' : `${numSongs} ${numSongs === 1 ? 'SONG' : 'SONGS'}`}
                      </span>
                    </div>

                    <span
                      className={cn(
                        'text-[11px] font-semibold truncate w-full',
                        numSongs === 0 ? 'text-warning/90' : 'text-foreground/55'
                      )}
                    >
                      {numSongs > 0 ? `1. ${setlistSongs[0].title}` : 'No setlist assigned'}
                    </span>
                  </button>
                )}

                {/* Card 3: Lineup / Team */}
                <button
                  type="button"
                  onClick={() => setActiveSheet('lineup')}
                  className="rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/20 p-3.5 flex flex-col justify-between text-left transition-all active:scale-[0.99] cursor-pointer shadow-2xs min-h-0"
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-foreground/55" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                        LINEUP
                      </span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40" />
                  </div>

                  <div className="flex items-center justify-between gap-2 my-auto py-1 w-full">
                    <span className="text-[26px] sm:text-[30px] font-black leading-none tracking-tight text-foreground">
                      {memberCount}
                    </span>

                    {resolvedMembers.length > 0 ? (
                      <div className="flex -space-x-2 overflow-hidden">
                        {resolvedMembers.slice(0, 4).map((m, i) => (
                          <div
                            key={i}
                            className="w-7 h-7 rounded-full bg-surface-inverse text-surface-inverse-foreground border-2 border-card flex items-center justify-center text-[9px] font-bold"
                          >
                            {m.initials}
                          </div>
                        ))}
                        {resolvedMembers.length > 4 && (
                          <div className="w-7 h-7 rounded-full bg-foreground/15 text-foreground border-2 border-card flex items-center justify-center text-[9px] font-bold">
                            +{resolvedMembers.length - 4}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-warning/15 text-warning">
                        UNASSIGNED
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-semibold text-foreground/55 truncate w-full">
                    {memberCount === 0
                      ? 'No team assigned yet'
                      : pendingMemberCount > 0
                        ? `${confirmedMemberCount}/${memberCount} confirmed • ${pendingMemberCount} pending`
                        : `All ${memberCount} members confirmed`}
                  </span>
                </button>

                {/* Card 4: Client, Notes & Logistics */}
                <button
                  type="button"
                  onClick={() => setActiveSheet('notes')}
                  className="rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/20 p-3.5 flex flex-col justify-between text-left transition-all active:scale-[0.99] cursor-pointer shadow-2xs min-h-0"
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-foreground/55" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                        {event.clientName && eventType !== 'quote' ? 'CLIENT & NOTES' : 'NOTES & INFO'}
                      </span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40" />
                  </div>

                  <div className="my-auto py-0.5 min-w-0 w-full flex flex-col gap-0.5">
                    {event.clientName && eventType !== 'quote' && (
                      <span className="text-[14px] font-black uppercase text-foreground truncate">
                        {event.clientName}
                      </span>
                    )}
                    <p className="text-[12px] font-medium text-foreground/70 line-clamp-2 leading-snug">
                      {event.notes
                        ? event.notes
                        : event.clientName && eventType !== 'quote'
                          ? `${event.indoorOutdoor?.toUpperCase() || 'INDOOR'} • ${venueName}`
                          : 'No notes added yet'}
                    </p>
                  </div>

                  <span className="text-[11px] font-semibold text-foreground/55 truncate w-full">
                    {event.notes || event.clientName ? 'Tap for logistics & notes' : 'Tap to view details'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ═══ INTERACTIVE DRILL-DOWN BOTTOM SHEET (Setlist / Lineup / Fee / Notes) ═══ */}
        <AnimatePresence>
          {activeSheet && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[105] bg-black/50 backdrop-blur-xs"
                onClick={() => setActiveSheet(null)}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={springs.smooth}
                className="fixed bottom-0 left-0 right-0 z-[110] max-w-[640px] mx-auto rounded-t-[26px] bg-card text-card-foreground border-t border-foreground/15 shadow-2xl max-h-[72dvh] flex flex-col overflow-hidden"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
              >
                {/* Sheet Handle & Header */}
                <div className="pt-3 pb-3 px-5 border-b border-foreground/10 flex flex-col gap-2 shrink-0">
                  <div className="w-10 h-1 rounded-full bg-foreground/20 mx-auto" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: theme.accentColor }}
                      />
                      <h3 className="text-[16px] font-black uppercase tracking-wider text-foreground">
                        {activeSheet === 'fee' && 'Fee & Payout Breakdown'}
                        {activeSheet === 'setlist' && `Setlist (${numSongs} Songs)`}
                        {activeSheet === 'lineup' && `Lineup (${memberCount} Members)`}
                        {activeSheet === 'notes' && 'Logistics & Notes'}
                      </h3>
                    </div>
                    <button
                      onClick={() => setActiveSheet(null)}
                      aria-label="Close sheet"
                      className="w-8 h-8 rounded-full bg-foreground/10 hover:bg-foreground/15 flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sheet Body */}
                <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-3">
                  {activeSheet === 'fee' && (
                    <>
                      <div className="rounded-[14px] bg-foreground/[0.05] border border-foreground/10 p-4 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block">
                            {isAdmin ? 'BAND TOTAL FEE' : 'YOUR ASSIGNED FEE'}
                          </span>
                          <span className="text-[28px] font-black text-foreground leading-tight">
                            {isAdmin
                              ? formatCurrencyExact(event.price)
                              : formatCurrencyExact(myResolvedFee ?? event.price)}
                          </span>
                        </div>
                        {myResolvedFee != null && isAdmin && (
                          <div className="text-right">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block">
                              YOUR SHARE
                            </span>
                            <span className="text-[20px] font-black text-foreground">
                              {formatCurrencyExact(myResolvedFee)}
                            </span>
                          </div>
                        )}
                      </div>

                      {isAdmin && resolvedMembers.length > 0 && (
                        <div className="flex flex-col gap-2 mt-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">
                            MEMBER PAYOUT SPLIT
                          </span>
                          {resolvedMembers.map((m, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 rounded-[12px] bg-foreground/[0.04] border border-foreground/10"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-surface-inverse text-surface-inverse-foreground flex items-center justify-center text-[11px] font-bold shrink-0">
                                  {m.initials}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[14px] font-bold text-foreground truncate">
                                    {m.name}
                                  </span>
                                  <span className="text-[11px] font-medium text-foreground/50 uppercase">
                                    {m.role}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[16px] font-black text-foreground shrink-0">
                                {formatCurrencyExact(m.fee)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {activeSheet === 'setlist' && (
                    <>
                      {numSongs > 0 ? (
                        <div className="flex flex-col gap-2">
                          {setlistSongs.map((song, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-3 rounded-[12px] bg-foreground/[0.04] border border-foreground/10"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-6 h-6 rounded-full bg-foreground/10 text-foreground/70 text-[11px] font-bold flex items-center justify-center shrink-0">
                                  {i + 1}
                                </span>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[14px] font-bold text-foreground truncate">
                                    {song.title}
                                  </span>
                                  {song.artist && (
                                    <span className="text-[11px] font-medium text-foreground/55 truncate">
                                      {song.artist}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {song.key && (
                                  <span className="px-2 py-0.5 rounded bg-foreground/10 text-[10px] font-bold uppercase text-foreground/75">
                                    {song.key}
                                  </span>
                                )}
                                {song.duration && (
                                  <span className="text-[11px] font-semibold text-foreground/50">
                                    {song.duration}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
                          <AlertCircle className="w-8 h-8 text-warning" />
                          <p className="text-[14px] font-bold uppercase text-foreground">
                            No Setlist Assigned
                          </p>
                          <p className="text-[12px] text-foreground/60 max-w-[260px]">
                            {isAdmin
                              ? 'Tap Edit to assign songs or a setlist to this event.'
                              : 'The band admin has not attached a setlist yet.'}
                          </p>
                          {isAdmin && onEdit && (
                            <button
                              onClick={() => {
                                setActiveSheet(null);
                                onEdit();
                              }}
                              style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
                              className="mt-2 px-4 py-2 rounded-[10px] text-[12px] font-bold uppercase tracking-wider shadow-xs cursor-pointer"
                            >
                              Assign Setlist
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {activeSheet === 'lineup' && (
                    <>
                      {resolvedMembers.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {resolvedMembers.map((m, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-3 rounded-[12px] bg-foreground/[0.04] border border-foreground/10"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-surface-inverse text-surface-inverse-foreground flex items-center justify-center text-[12px] font-bold shrink-0">
                                  {m.initials}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[15px] font-bold text-foreground truncate">
                                    {m.name}
                                  </span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] font-semibold uppercase text-foreground/50">
                                      {m.role}
                                    </span>
                                    <span className="text-foreground/30">•</span>
                                    <span
                                      className={cn(
                                        'text-[10px] font-bold uppercase tracking-wider',
                                        m.status === 'confirmed' ? 'text-success' : 'text-warning'
                                      )}
                                    >
                                      {m.status === 'confirmed' ? 'CONFIRMED' : 'PENDING'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {(isAdmin || m.userId === currentUserId) && m.fee > 0 && (
                                <span className="text-[16px] font-black text-foreground shrink-0">
                                  {formatCurrencyExact(m.fee)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-foreground/55 text-[13px] font-medium">
                          No members assigned to this event yet.
                        </div>
                      )}
                    </>
                  )}

                  {activeSheet === 'notes' && (
                    <div className="flex flex-col gap-3">
                      {/* Venue & Address Box */}
                      <div className="rounded-[12px] bg-foreground/[0.04] border border-foreground/10 p-3.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45 block">
                            VENUE & LOCATION
                          </span>
                          <span className="text-[14px] font-bold text-foreground uppercase block truncate mt-0.5">
                            {venueName}
                          </span>
                          {venueAddress && (
                            <span className="text-[12px] font-medium text-foreground/60 block truncate">
                              {venueAddress}
                            </span>
                          )}
                        </div>
                        {hasValidLocation && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={handleCopyAddress}
                              title="Copy address"
                              className="px-2.5 py-1.5 rounded-[8px] bg-foreground/10 hover:bg-foreground/15 text-[11px] font-bold uppercase text-foreground flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              {copiedAddress ? 'COPIED' : 'COPY'}
                            </button>
                            <button
                              onClick={handleOpenMaps}
                              style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
                              className="px-2.5 py-1.5 rounded-[8px] text-[11px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                            >
                              MAPS
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Client & Event Metadata */}
                      {(event.clientName || event.guests || event.indoorOutdoor) && (
                        <div className="grid grid-cols-2 gap-2">
                          {event.clientName && (
                            <div className="rounded-[12px] bg-foreground/[0.04] border border-foreground/10 p-3">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45 block">
                                CLIENT
                              </span>
                              <span className="text-[14px] font-bold text-foreground uppercase block mt-0.5 truncate">
                                {event.clientName}
                              </span>
                            </div>
                          )}
                          <div className="rounded-[12px] bg-foreground/[0.04] border border-foreground/10 p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45 block">
                              SETTING {event.guests ? '• GUESTS' : ''}
                            </span>
                            <span className="text-[14px] font-bold text-foreground uppercase block mt-0.5">
                              {event.indoorOutdoor?.toUpperCase() || 'INDOOR'}
                              {event.guests ? ` • ${event.guests} PAX` : ''}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Event Notes */}
                      <div className="rounded-[12px] bg-foreground/[0.04] border border-foreground/10 p-3.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45 block mb-1">
                          NOTES
                        </span>
                        <p className="text-[13px] font-medium text-foreground/85 whitespace-pre-wrap leading-relaxed">
                          {event.notes || 'No additional notes recorded for this event.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ═══ 5. FIXED BOTTOM ACTION DOCK ═══ */}
        <div
          className="fixed bottom-0 left-0 right-0 rounded-t-[24px] px-[16px] pt-[12px] z-[95] bg-background/95 backdrop-blur-md border-t border-foreground/15 shadow-[0px_-4px_20px_rgba(0,0,0,0.12)]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
        >
          <div className="max-w-[640px] mx-auto w-full">
            {isPast ? (
              <div className="flex flex-col gap-[10px] items-center w-full">
                <div
                  className={cn(
                    'grid gap-[10px] w-full',
                    isAdmin || userResponse === 'accepted' ? 'grid-cols-2' : 'grid-cols-1'
                  )}
                >
                  {(isAdmin || userResponse === 'accepted') && (
                    <button
                      onClick={onChat}
                      className="rounded-[12px] py-[13px] flex items-center justify-center gap-[8px] bg-foreground text-background font-bold shadow-md hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <MessageCircle className="w-[17px] h-[17px]" />
                      <span className="text-[14px] font-bold uppercase">EVENT CHAT</span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveSheet('setlist')}
                    className="rounded-[12px] py-[13px] flex items-center justify-center gap-[8px] bg-foreground/10 hover:bg-foreground/15 text-foreground font-bold border border-foreground/15 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <Music className="w-[17px] h-[17px] text-foreground/75" />
                    <span className="text-[14px] font-bold uppercase">VIEW SETLIST</span>
                  </button>
                </div>
                {isAdmin &&
                  (showDeleteConfirm ? (
                    <div className="flex items-center gap-[12px]">
                      <button
                        onClick={() => {
                          onDelete?.();
                          setShowDeleteConfirm(false);
                        }}
                        className="text-[11px] font-bold text-white bg-[var(--destructive)] rounded-[8px] px-[14px] py-[6px] uppercase cursor-pointer"
                      >
                        CONFIRM DELETE
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="text-[11px] font-bold text-foreground/70 hover:text-foreground uppercase transition-colors cursor-pointer"
                      >
                        CANCEL
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-[12px] text-[11px] font-bold uppercase tracking-wider text-foreground/50">
                      <button
                        onClick={onEdit}
                        className="hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        EDIT DETAILS
                      </button>
                      <span>•</span>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="hover:text-[var(--destructive)] transition-colors cursor-pointer"
                      >
                        REMOVE FROM ARCHIVE
                      </button>
                    </div>
                  ))}
              </div>
            ) : isPersonalGig ? (
              <div className="flex flex-col gap-[10px] items-center w-full">
                <div className="grid grid-cols-2 gap-[10px] w-full">
                  <button
                    onClick={onEdit}
                    style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
                    className="rounded-[12px] py-[13px] flex items-center justify-center gap-[8px] font-bold shadow-md shadow-black/10 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <Pencil className="w-[17px] h-[17px]" />
                    <span className="text-[15px] font-bold uppercase">EDIT GIG</span>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-[12px] py-[13px] flex items-center justify-center gap-[8px] bg-foreground/10 hover:bg-foreground/15 text-[var(--destructive)] font-bold active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <span className="text-[15px] font-bold uppercase">DELETE GIG</span>
                  </button>
                </div>
                {showDeleteConfirm && (
                  <div className="flex items-center gap-[12px]">
                    <button
                      onClick={() => {
                        onDelete?.();
                        setShowDeleteConfirm(false);
                      }}
                      className="text-[11px] font-bold text-white bg-[var(--destructive)] rounded-[8px] px-[14px] py-[6px] uppercase cursor-pointer"
                    >
                      CONFIRM DELETE
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="text-[11px] font-bold text-foreground/70 hover:text-foreground uppercase transition-colors cursor-pointer"
                    >
                      CANCEL
                    </button>
                  </div>
                )}
              </div>
            ) : isPending && onAccept && onDecline ? (
              <div className="grid grid-cols-2 gap-[10px] w-full">
                <button
                  onClick={handleAccept}
                  disabled={isSubmitting}
                  style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
                  className="rounded-[12px] py-[14px] flex items-center justify-center gap-[8px] font-bold shadow-md shadow-black/10 hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-[17px] h-[17px]" />
                  <span className="text-[15px] font-bold uppercase">
                    {isSubmitting ? '...' : 'ACCEPT'}
                  </span>
                </button>
                <button
                  onClick={handleDecline}
                  disabled={isSubmitting}
                  className="rounded-[12px] py-[14px] flex items-center justify-center gap-[8px] bg-foreground/10 hover:bg-foreground/15 text-foreground font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <span className="text-[15px] font-bold uppercase">DECLINE</span>
                </button>
              </div>
            ) : isAdmin ? (
              eventType === 'quote' ? (
                <div className="flex flex-col gap-[10px] items-center w-full">
                  <div className="grid grid-cols-3 gap-[8px] w-full">
                    <button
                      onClick={handleConfirmQuote}
                      disabled={isConfirming}
                      style={{ backgroundColor: 'var(--accent-gig)', color: 'var(--accent-gig-fg)' }}
                      className="rounded-[12px] py-[13px] flex items-center justify-center gap-[6px] font-bold shadow-md shadow-black/10 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="w-[16px] h-[16px]" />
                      <span className="text-[13px] font-bold uppercase">
                        {isConfirming ? '...' : 'CONFIRM'}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        if (onShareQuote) onShareQuote(event);
                        else setIsShareQuoteOpen(true);
                      }}
                      style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
                      className="rounded-[12px] py-[13px] flex items-center justify-center gap-[6px] font-bold shadow-md shadow-black/10 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <Share2 className="w-[16px] h-[16px]" />
                      <span className="text-[13px] font-bold uppercase">SHARE QUOTE</span>
                    </button>
                    <button
                      onClick={onEdit}
                      className="rounded-[12px] py-[13px] flex items-center justify-center gap-[6px] bg-foreground/10 hover:bg-foreground/15 text-foreground font-bold active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <Pencil className="w-[15px] h-[15px] text-foreground" />
                      <span className="text-[13px] font-bold uppercase">EDIT</span>
                    </button>
                  </div>
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-[12px]">
                      <button
                        onClick={() => {
                          onDelete?.();
                          setShowDeleteConfirm(false);
                        }}
                        className="text-[11px] font-bold text-white bg-[var(--destructive)] rounded-[8px] px-[14px] py-[6px] uppercase cursor-pointer"
                      >
                        CONFIRM DELETE
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="text-[11px] font-bold text-foreground/70 hover:text-foreground uppercase transition-colors cursor-pointer"
                      >
                        CANCEL
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-[12px] text-[11px] font-bold uppercase tracking-wider text-foreground/50">
                      <button
                        onClick={onChat}
                        className="hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        CHAT
                      </button>
                      <span>•</span>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-[var(--destructive)] hover:opacity-80 transition-opacity cursor-pointer"
                      >
                        {theme.deleteLabel}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-[10px] items-center w-full">
                  <div className="grid grid-cols-2 gap-[10px] w-full">
                    <button
                      onClick={onEdit}
                      style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
                      className="rounded-[12px] py-[13px] flex items-center justify-center gap-[8px] font-bold shadow-md shadow-black/10 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <Pencil className="w-[16px] h-[16px]" />
                      <span className="text-[15px] font-bold uppercase">EDIT</span>
                    </button>
                    <button
                      onClick={onChat}
                      className="rounded-[12px] py-[13px] flex items-center justify-center gap-[8px] bg-foreground/10 hover:bg-foreground/15 text-foreground font-bold active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <MessageCircle className="w-[17px] h-[17px] text-foreground" />
                      <span className="text-[15px] font-bold uppercase">CHAT</span>
                    </button>
                  </div>
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-[12px]">
                      <button
                        onClick={() => {
                          onDelete?.();
                          setShowDeleteConfirm(false);
                        }}
                        className="text-[11px] font-bold text-white bg-[var(--destructive)] rounded-[8px] px-[14px] py-[6px] uppercase cursor-pointer"
                      >
                        CONFIRM DELETE
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="text-[11px] font-bold text-foreground/70 hover:text-foreground uppercase transition-colors cursor-pointer"
                      >
                        CANCEL
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-[12px] text-[11px] font-bold uppercase tracking-wider text-foreground/50">
                      {onRevertQuote && (
                        <>
                          <button
                            onClick={handleRevertQuote}
                            disabled={isReverting}
                            className="hover:opacity-80 transition-opacity flex items-center gap-1.5 cursor-pointer"
                            style={{ color: 'var(--accent-quote)' }}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{isReverting ? 'REVERTING...' : 'REVERT TO QUOTE'}</span>
                          </button>
                          <span>•</span>
                        </>
                      )}
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-[11px] font-bold text-[var(--destructive)] uppercase hover:opacity-80 transition-opacity tracking-wider cursor-pointer"
                      >
                        {theme.deleteLabel}
                      </button>
                    </div>
                  )}
                </div>
              )
            ) : (
              /* MEMBER VIEW (Accepted) */
              <div className="flex flex-col gap-[10px] items-center w-full">
                <div className="grid grid-cols-2 gap-[10px] w-full">
                  <button
                    onClick={onChat}
                    style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
                    className="rounded-[12px] py-[13px] flex items-center justify-center gap-[8px] font-bold shadow-md shadow-black/10 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-[17px] h-[17px]" />
                    <span className="text-[15px] font-bold uppercase">CHAT</span>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isSubmitting}
                    className="rounded-[12px] py-[13px] flex items-center justify-center gap-[8px] bg-foreground/10 hover:bg-foreground/15 text-foreground font-bold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <span className="text-[15px] font-bold uppercase">
                      {isSubmitting ? '...' : 'DROP OUT'}
                    </span>
                  </button>
                </div>
                {showDeleteConfirm && (
                  <div className="flex items-center gap-[12px]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/70">
                      Drop out?
                    </span>
                    <button
                      onClick={handleDecline}
                      disabled={isSubmitting}
                      className="text-[11px] font-bold text-white bg-[var(--destructive)] rounded-[8px] px-[14px] py-[6px] uppercase disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? '...' : 'CONFIRM DROP'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="text-[11px] font-bold text-foreground/70 hover:text-foreground uppercase transition-colors cursor-pointer"
                    >
                      CANCEL
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <QuoteShareModal
        isOpen={isShareQuoteOpen}
        quote={{
          id: String(event.id),
          quoteNumber: `EVT-${String(event.id).slice(0, 6).toUpperCase()}`,
          eventName: event.title,
          eventTitle: event.title,
          clientName: event.clientName || 'Client',
          eventType: (event.eventType as any) || 'wedding',
          eventDate: event.date,
          eventTimeStart: event.time,
          venueName: event.location,
          venueAddress: event.venueAddress,
          indoorOutdoor: event.indoorOutdoor || 'indoor',
          musicianCount: memberCount || 1,
          musicians: resolvedMembers.map((m, idx) => ({
            id: m.userId || `m-${idx}`,
            name: m.name,
            instrument: m.role,
            fee: m.fee,
            isExternal: false,
            isAvailable: true,
          })),
          baseFee: parseFloat(String(event.price || '0').replace(/[^0-9.]/g, '')) || 0,
          subtotal: parseFloat(String(event.price || '0').replace(/[^0-9.]/g, '')) || 0,
          netAmount: parseFloat(String(event.price || '0').replace(/[^0-9.]/g, '')) || 0,
          total: parseFloat(String(event.price || '0').replace(/[^0-9.]/g, '')) || 0,
          clientNotes: event.notes,
        }}
        bandId={event.band_id || selectedBand?.id}
        bandName={event.band_name || selectedBand?.name}
        onClose={() => setIsShareQuoteOpen(false)}
        onOpenBandSettings={onOpenBandSettings}
      />
    </>
  );
};
