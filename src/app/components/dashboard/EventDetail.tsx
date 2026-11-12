import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowUpRight,
  MapPin,
  MessageSquare,
  Check,
  Pencil,
  Music,
  RotateCcw,
  Play,
  Plus,
  Trash2,
  AlertCircle,
  Copy,
  Share2,
  MoreHorizontal,
  LogOut,
  EyeOff,
  Send,
  CheckCircle2,
  XCircle,
} from '@/app/components/icons';
import { springs } from '@/styles/motion';
import { EventData } from './EventCard';
import { WeatherWidget } from '@/app/components/ui/WeatherWidget';
import { supabase } from '@/lib/supabase';
import { useBand } from '@/lib/BandContext';
import { cn } from '@/app/components/ui/utils';
import { useRailAction, useRailOwnsChrome } from '@/lib/railActions';
import { DotText } from '@/app/components/bw';
import { IconButton, NavBackButton, Tag, BwSheet } from '@/app/components/bw/Screen';
import { PillButton, Selector } from '@/app/components/bw/Form';
import { haptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { QuoteShareModal } from '@/app/components/quotes/QuoteShareModal';
import { StageMode } from './StageMode';
import { FloorWedgeMode, useLaptopPose } from '@/app/components/duo';
import { parseLocalDate } from '@/lib/dates';
import { setStatusBarTone, toneForForeground } from '@/lib/systemBars';
import { FIT, FitText } from '@/app/components/bw/FitText';
import { getActiveSymbol as sym, money, useCurrency } from '@/lib/currency';
import { openMaps } from '@/app/components/ui/MapsLink';
import type { RsvpStatus } from '@/app/components/notifications/EventRSVPSheet';
import { AskDeputySheet } from '@/app/components/band/AskDeputySheet';
import { KeyValueRow, LINK_CLASS, MemberRow, SectionTitle, type ResolvedMember } from '@/app/components/event/parts';
import { useEventMembers } from '@/app/components/event/useEventMembers';
import { useLinkedQuote, QuoteSummaryCard, QuoteLineItems, QuoteClientSection } from '@/app/components/event/QuoteSections';
import { RsvpChoiceCard, type RsvpAnswer } from '@/app/components/event/RsvpChoiceCard';
import {
  PersonalPrivacyCard,
  ScheduleConflictCard,
  PaidToggleRow,
  findBandConflict,
} from '@/app/components/event/PersonalGigParts';
import { FeePayoutsContent } from '@/app/components/event/FeePayoutsContent';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { useEventTasks } from '@/lib/services/eventTasks';
import {
  dayBefore,
  daysUntil,
  durationHours,
  formatDayShort,
  formatHours,
  formatTime12,
  parseAmount,
  rehearsalCadence,
  shortPlace,
} from '@/app/components/event/format';

interface EventDetailProps {
  event: EventData;
  onClose: () => void;
  /** The viewer's own answer ('maybe' selects MAYBE on the rehearsal RSVP card). */
  userResponse?: RsvpAnswer;
  onAccept?: () => Promise<void>;
  onDecline?: () => Promise<void>;
  /**
   * One handler for GOING / MAYBE / CAN'T (rehearsal RSVP card). When set it
   * is used instead of onAccept / onDecline there, and enables MAYBE.
   */
  onRespond?: (status: RsvpStatus, note?: string) => Promise<void>;
  /** The viewer has an event_members row (shows the rehearsal RSVP card). Defaults to !isAdmin. */
  canRespond?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onChat?: () => void;
  onConfirmQuote?: (event: EventData) => Promise<void> | void;
  onRevertQuote?: (event: EventData) => Promise<void> | void;
  onShareQuote?: (event: EventData) => void;
  onOpenBandSettings?: () => void;
  /** Calendar events (for the personal-gig schedule conflict). */
  allEvents?: EventData[];
  /** Personal gig clashes with a band event: tell that band's admin. */
  onNotifyConflict?: (bandId: string, eventId: string) => Promise<void> | void;
  /** Something on the event was saved from here (personal gig "Paid"). */
  onEventUpdated?: () => void;
  memberFee?: number;
  isAdmin?: boolean;
  currentUserId?: string;
}

const formatEventDateShort = (dateStr: string): string => {
  if (!dateStr) return 'TBD';
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return 'TBD';
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  return `${month} ${day}`;
};

const formatEventDateFull = (dateStr: string): string => {
  if (!dateStr) return 'DATE TBD';
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return 'DATE TBD';
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  const year = d.getFullYear();
  return `${weekday}, ${month} ${day}, ${year}`;
};

const formatEventTime = (timeStr?: string): string => formatTime12(timeStr);

const formatCurrencyExact = (price?: string | number): string => {
  if (price === undefined || price === null || price === '') return `${sym()}0`;
  const raw = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^0-9.]/g, ''));
  if (isNaN(raw)) return String(price);
  return `${sym()}${Math.round(raw).toLocaleString()}`;
};

type EventCategory = 'rehearsal' | 'gig' | 'quote' | 'draft';
type ActiveSheetType = 'fee' | 'setlist' | 'lineup' | 'notes' | null;

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

/* ─────────────── Figma kit pieces local to the event detail ─────────────── */

const parseDurationSeconds = (d?: string): number => {
  const m = d?.match(/^(\d+):(\d{2})$/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
};

const formatTotalDuration = (secs: number): string => {
  const totalMin = Math.round(secs / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}H ${m}M` : `${m}M`;
};

/** Time tiles read in 24h like Figma ("17:00"): "5 PM" → ["17:00", ""]; anything else as is. */
const splitTimeDisplay = (display: string): [string, string] => {
  const m = display.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return [display, ''];
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return [`${String(h).padStart(2, '0')}:${m[2] || '00'}`, ''];
};

const TimeTile: React.FC<{ label: string; value: string; text?: boolean }> = ({ label, value, text }) => {
  const [main, suffix] = text ? [value, ''] : splitTimeDisplay(value);
  return (
    <div className="@container bg-card rounded-[16px] p-4 flex flex-col gap-1 min-w-0">
      <span className="bw-label-xs text-muted-foreground truncate">{label}</span>
      {text ? (
        <span className="bw-num truncate">{main}</span>
      ) : (
        <span className="flex items-baseline gap-1 min-w-0 whitespace-nowrap overflow-hidden">
          {/* Narrow tiles (320px phones) step the digits down and drop AM/PM. */}
          <span className="bw-num @max-[84px]:text-[19px]">{main}</span>
          {suffix && <span className="bw-label-xs @max-[84px]:hidden">{suffix}</span>}
        </span>
      )}
    </div>
  );
};

/** Set flow: one dot column per song, height = song length (opener → encore). */
const SetFlow: React.FC<{ seconds: number[]; max: number }> = ({ seconds, max }) => {
  const ROWS = 7;
  const dot = seconds.length <= 16 ? 10 : 8;
  return (
    <span className="flex justify-between w-full" aria-hidden="true">
      {seconds.map((s, c) => {
        const lit = s > 0 && max > 0 ? Math.max(1, Math.round((s / max) * ROWS)) : 0;
        return (
          <span key={c} className="flex flex-col gap-1">
            {Array.from({ length: ROWS }).map((_, r) => {
              const fromBottom = ROWS - 1 - r;
              const on = fromBottom < lit;
              const peak = on && fromBottom === lit - 1;
              return (
                <span
                  key={`${r}-${on ? 'on' : 'off'}`}
                  className={'rounded-full block' + (peak ? ' bw-dot-pop' : on ? ' bw-dot-rise' : '')}
                  style={{
                    width: dot,
                    height: dot,
                    backgroundColor: peak ? 'var(--accent-ink)' : on ? 'var(--dot-on)' : 'var(--dot-off)',
                    ['--d' as string]: `${150 + c * 35 + fromBottom * 30}ms`,
                  }}
                />
              );
            })}
          </span>
        );
      })}
    </span>
  );
};

export const EventDetail: React.FC<EventDetailProps> = ({
  event,
  onClose,
  userResponse = 'accepted',
  onAccept,
  onDecline,
  onRespond,
  canRespond,
  onEdit,
  onDelete,
  onChat,
  onConfirmQuote,
  onRevertQuote,
  onShareQuote,
  onOpenBandSettings,
  allEvents,
  onNotifyConflict,
  onEventUpdated,
  memberFee,
  isAdmin = true,
  currentUserId,
}) => {
  const t = useT();
  useCurrency(); // re-render money labels when the band currency changes
  const railChrome = useRailOwnsChrome();
  const { selectedBand, bands } = useBand();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheetType>(null);
  /** Member who declined, being replaced by a deputy ("Find a deputy"). */
  const [deputyFor, setDeputyFor] = useState<ResolvedMember | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [isShareQuoteOpen, setIsShareQuoteOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [isStageOpen, setIsStageOpen] = useState(false);

  const isPending = userResponse === 'pending';
  const eventType = getEventType(event.status);
  // Personal gigs have no band (RLS only lets their creator read them).
  const isPersonalGig = !event.band_id;
  const isQuote = eventType === 'quote' && !isPersonalGig;
  const isRehearsal = eventType === 'rehearsal';

  // The real quote saved with this event: shown on quotes, and used by the
  // PDF so it carries its number, line items and VAT instead of a stand-in.
  const {
    quote: linkedQuote,
    loading: quoteLoading,
    error: quoteError,
  } = useLinkedQuote(event.eventId, event.quoteId, isQuote || isShareQuoteOpen);

  // Setlist state
  const laptopPose = useLaptopPose();
  const [setlistSongs, setSetlistSongs] = useState<{ title: string; artist?: string; duration?: string; key?: string }[]>([]);
  const [setlistLoading, setSetlistLoading] = useState(false);

  // event_members (declined kept), names from the band roster
  const {
    members: dbMembers,
    loading: membersLoading,
    error: membersError,
    paidSupported,
    markAllPaid,
    markingPaid,
    markError,
  } = useEventMembers({
    eventId: event.eventId,
    bandId: event.band_id,
    createdBy: event.createdBy,
    currentUserId,
    disabled: isPersonalGig,
    bands,
    selectedBand,
  });

  useEffect(() => {
    if (!isAdmin && !isPersonalGig && (eventType === 'quote' || userResponse === 'declined')) {
      onClose();
    }
  }, [isAdmin, isPersonalGig, eventType, userResponse, onClose]);

  // Event to-dos (from the create form or a task template).
  const { tasks: eventTasks, toggle: toggleEventTask, error: eventTasksError } = useEventTasks(
    isPersonalGig ? null : event.eventId,
  );
  const tasksDone = eventTasks.filter((task) => task.is_completed).length;

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
          // songs has duration_seconds, not duration: asking for a missing
          // column makes PostgREST fail the whole query.
          .select('*, song:songs(title, artist, duration_seconds, key)')
          .eq('setlist_id', event.setlistId)
          .order('position', { ascending: true });
        if (!cancelled && data && data.length > 0) {
          setSetlistSongs(
            data.map((s: any) => ({
              title: s.song?.title || t('Unknown Song'),
              artist: s.song?.artist || undefined,
              duration:
                typeof s.song?.duration_seconds === 'number' && s.song.duration_seconds > 0
                  ? `${Math.floor(s.song.duration_seconds / 60)}:${String(s.song.duration_seconds % 60).padStart(2, '0')}`
                  : undefined,
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
  }, [event.setlistId, isPersonalGig, t]);

  const isPast = useMemo(() => {
    if (!event.date) return false;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const normDate = event.date.includes('T') ? event.date.split('T')[0] : event.date;
    return normDate < todayStr;
  }, [event.date]);

  // Status bar icons follow the hero colour while the hero sits under the bar
  // (white on rehearsal blue / personal pink / past), then the theme default.
  const heroFg = isPast
    ? 'var(--accent-past-fg)'
    : isPersonalGig
      ? 'var(--accent-personal-fg)'
      : THEME[eventType].accentFg;
  const heroRef = React.useRef<HTMLElement>(null);
  const scrimRef = React.useRef<HTMLDivElement>(null);
  const [heroUnderBar, setHeroUnderBar] = useState(true);
  const handleScroll = React.useCallback(() => {
    const bottom = heroRef.current?.getBoundingClientRect().bottom ?? 0;
    const barHeight = scrimRef.current?.offsetHeight || 24;
    setHeroUnderBar(bottom > barHeight);
  }, []);
  useEffect(() => {
    if (!heroUnderBar) return;
    return setStatusBarTone(toneForForeground(heroFg));
  }, [heroUnderBar, heroFg]);

  // Only real event_members rows: no invented "Member N" rows or even splits.
  const resolvedMembers: ResolvedMember[] = dbMembers || [];
  // A member said no: the admin can ask one of the band's deputies instead.
  const canFindDeputy = isAdmin && !isPast && !isRehearsal && !isPersonalGig && !!event.band_id;
  const activeMembers = resolvedMembers.filter((m) => m.status !== 'declined');

  const myResolvedFee = useMemo(() => {
    if (memberFee != null) return memberFee;
    if (currentUserId && dbMembers) {
      const me = dbMembers.find((m) => m.userId === currentUserId);
      if (me?.fee != null) return me.fee;
    }
    return undefined;
  }, [memberFee, currentUserId, dbMembers]);

  // Personal gig: a band gig / rehearsal on the same date.
  const bandConflict = useMemo(
    () => (isPersonalGig && !isPast ? findBandConflict(event, allEvents) : null),
    [isPersonalGig, isPast, event, allEvents],
  );

  // Stage mode is offered for upcoming band gigs and promoted (filled) on gig day.
  const canStage = eventType === 'gig' && !isPast && !isPersonalGig;
  const isGigDay = (() => {
    if (!event.date) return false;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return (event.date.includes('T') ? event.date.split('T')[0] : event.date) === todayStr;
  })();
  // iPhone Duo: Stage mode joins the rail's Side Actions; on gig day it is
  // the screen's primary action (filled).
  const stageInRail = useRailAction(
    canStage
      ? () => {
          haptic.medium();
          setIsStageOpen(true);
        }
      : undefined,
    {
      label: t('Open stage mode'),
      icon: <Play />,
      pane: true,
      prominent: isGigDay,
    },
  );

  // iPhone Duo: the "…" menu (member rehearsal options) joins the rail's Side
  // Actions like every other header action, instead of sitting by the camera.
  const optionsMenuAvailable =
    isRehearsal && !isAdmin && !isPersonalGig && !isPast && !!onDecline && userResponse !== 'declined';
  const optionsInRail = useRailAction(
    optionsMenuAvailable
      ? () => {
          haptic.tap();
          setConfirmDrop(false);
          setOptionsOpen(true);
        }
      : undefined,
    { label: t('More options'), icon: <MoreHorizontal />, pane: true },
  );

  if (!isAdmin && !isPersonalGig && (eventType === 'quote' || userResponse === 'declined')) {
    return null;
  }

  // Display labels for the event kind (eventType stays the logic value).
  const deleteLabels: Record<EventCategory, string> = {
    rehearsal: t('DELETE THIS REHEARSAL'),
    gig: t('DELETE THIS GIG'),
    quote: t('DELETE THIS QUOTE'),
    draft: t('DELETE THIS DRAFT'),
  };
  const typeLabels: Record<EventCategory, string> = {
    rehearsal: t('REHEARSAL'),
    gig: t('GIG'),
    quote: t('QUOTE'),
    draft: t('DRAFT'),
  };
  const pastTypeLabels: Record<EventCategory, string> = {
    rehearsal: t('PAST REHEARSAL'),
    gig: t('PAST GIG'),
    quote: t('PAST QUOTE'),
    draft: t('PAST DRAFT'),
  };

  const baseTheme = THEME[eventType];
  const theme = isPast
    ? {
        ...baseTheme,
        accentColor: 'var(--accent-past)',
        accentFg: 'var(--accent-past-fg)',
        deleteLabel: deleteLabels[eventType],
      }
    : isPersonalGig
      ? { ...baseTheme, accentColor: 'var(--accent-personal)', accentFg: 'var(--accent-personal-fg)', deleteLabel: t('DELETE THIS GIG') }
      : { ...baseTheme, deleteLabel: deleteLabels[eventType] };

  const memberCount = resolvedMembers.length;

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

  // Reverting takes the gig off the lineup's calendars: it asks first.
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const handleRevertQuote = async () => {
    if (isReverting || !onRevertQuote) return;
    haptic.tap();
    setShowRevertConfirm(false);
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

  /** Rehearsal RSVP card: GOING / MAYBE / CAN'T. Errors are shown on the card. */
  const handleRespond = async (status: RsvpStatus) => {
    if (status === 'declined') haptic.delete();
    else haptic.confirm();
    if (onRespond) {
      await onRespond(status);
      return;
    }
    if (status === 'confirmed' && onAccept) await onAccept();
    else if (status === 'declined' && onDecline) await onDecline();
  };

  const venueName = event.location?.split(',')[0]?.trim() || 'TBD';
  const venueAddress =
    event.venueAddress ||
    (event.location?.includes(',') ? event.location.split(',').slice(1).join(',').trim() : '') ||
    event.venueCity ||
    '';
  const hasValidLocation = venueName !== 'TBD' && venueName !== '';
  const fullLocationQuery = [venueName !== 'TBD' ? venueName : '', venueAddress].filter(Boolean).join(', ');
  const venueShown = venueName === 'TBD' ? t('TBD') : venueName;

  const handleOpenMaps = () => {
    if (!hasValidLocation) return;
    openMaps(fullLocationQuery);
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
  // Only times someone actually set; no invented schedule.
  const loadInTime = event.loadInTime ? formatEventTime(event.loadInTime) : t('TBD');
  const soundCheckTime = event.soundcheckTime ? formatEventTime(event.soundcheckTime) : t('TBD');
  const showTimeShown = showTime === 'TBD' ? t('TBD') : showTime;

  const numSongs = setlistSongs.length;

  // Sub-type label (e.g., WEDDING, CORPORATE, FESTIVAL) if distinct from generic 'gig'/'other'
  const subTypeEyebrow = (() => {
    const raw = event.eventType?.toUpperCase();
    if (!raw || raw === 'GIG' || raw === 'REHEARSAL' || raw === 'QUOTE' || raw === 'OTHER') return null;
    const shown: Record<string, string> = {
      WEDDING: t('WEDDING'),
      CORPORATE: t('CORPORATE'),
      PRIVATE: t('PRIVATE'),
      FESTIVAL: t('FESTIVAL'),
      CLUB: t('CLUB'),
      PUB: t('PUB'),
    };
    return shown[raw] ?? raw;
  })();

  // ─── Hero chips (Figma: "GIG · CONFIRMED", "PERSONAL · ONLY YOU", "REHEARSAL · EVERY TUESDAY") ───
  const primaryChip = isPersonalGig
    ? t('PERSONAL')
    : isPast
      ? pastTypeLabels[eventType]
      : typeLabels[eventType];
  const statusChips: string[] = [];
  if (isPersonalGig) statusChips.push(t('ONLY YOU'));
  else if (isRehearsal) statusChips.push(rehearsalCadence(event.is_recurring, event.recurrence_rule, event.date));
  else if (isQuote) {
    // Same fallback as the status card below: a quote never shared is a draft.
    const qs = String(linkedQuote?.status || event.quoteStatus || 'draft');
    const quoteStatusLabels: Record<string, string> = {
      draft: t('DRAFT'),
      sent: t('SENT'),
      viewed: t('VIEWED'),
      accepted: t('ACCEPTED'),
      declined: t('DECLINED'),
      rejected: t('REJECTED'),
      expired: t('EXPIRED'),
    };
    statusChips.push(quoteStatusLabels[qs.toLowerCase()] ?? qs.toUpperCase());
    // A quote not shared yet: on the admins' calendar only (unless the
    // lineup was asked for availability, then they see the check).
    if (qs.toLowerCase() === 'draft' && !isPast && memberCount === 0) statusChips.push(t('HIDDEN FROM MEMBERS'));
  }
  else if (eventType === 'gig' && !isPast) {
    const gigStatus = (event.status || 'CONFIRMED').toUpperCase();
    const gigStatusLabels: Record<string, string> = { CONFIRMED: t('CONFIRMED'), COMPLETED: t('COMPLETED') };
    statusChips.push(gigStatusLabels[gigStatus] ?? gigStatus);
  }
  const showPendingChip = !isPast && !isPersonalGig && isPending && (eventType === 'gig' || isRehearsal);

  // ─── Quote: where it stands and the way forward (admins) ───
  // Says in words what the status chip means, who has seen it, and which
  // button moves it on, so a draft is never a dead end.
  const quoteGuide = (() => {
    if (!isQuote || !isAdmin || isPast) return null;
    const qs = String(linkedQuote?.status || event.quoteStatus || 'draft').toLowerCase();
    const answered = resolvedMembers.filter((m) => m.status !== 'pending').length;
    const free = resolvedMembers.filter((m) => m.status === 'confirmed').length;
    const lineup =
      memberCount > 0
        ? ` ${
            answered < memberCount
              ? t('Availability: {free} of {total} free, {pending} still to answer (see below).', {
                  free,
                  total: memberCount,
                  pending: memberCount - answered,
                })
              : t('Availability: {free} of {total} free (see below).', { free, total: memberCount })
          }`
        : '';
    if (qs === 'draft')
      return {
        icon: <EyeOff className="w-5 h-5" />,
        title: t('Draft · not sent to the client'),
        body: `${memberCount > 0 ? t('The lineup only got an availability check.') : t("Only admins see it: the band isn't told yet.")} ${t("Share quote sends it to the client (it becomes Sent). When they say yes, Confirm as gig puts it on everyone's calendar.")}${lineup}`,
      };
    if (qs === 'accepted')
      return {
        icon: <CheckCircle2 className="w-5 h-5" />,
        title: t('The client said yes'),
        body: `${t("Confirm as gig to put it on everyone's calendar.")}${lineup}`,
      };
    if (qs === 'declined' || qs === 'rejected' || qs === 'expired')
      return {
        icon: <XCircle className="w-5 h-5" />,
        title: qs === 'expired' ? t('The quote expired') : t('The client said no'),
        body: `${t('Edit it and share a new version, or delete the quote to free the date.')}${lineup}`,
      };
    return {
      icon: <Send className="w-5 h-5" />,
      title: qs === 'viewed' ? t('The client opened it') : t('Sent · waiting for the client'),
      body: `${t("When the client says yes, Confirm as gig puts it on everyone's calendar.")}${lineup}`,
    };
  })();

  // ─── Figma layout helpers (display only) ───
  const heroDate = event.date ? parseLocalDate(event.date) : null;
  const hasHeroDate = !!heroDate && !isNaN(heroDate.getTime());
  const heroDay = hasHeroDate ? String(heroDate!.getDate()).padStart(2, '0') : '--';
  const heroMonth = hasHeroDate
    ? heroDate!.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    : t('TBD');
  const heroDateTime = `${hasHeroDate ? formatEventDateFull(event.date) : t('DATE TBD')}${
    showTime !== 'TBD' ? ` · ${showTime}${endTimeFormatted ? `–${endTimeFormatted}` : ''}` : ''
  }`;

  // ─── Money ───
  const bandFeeNum = parseAmount(event.price);
  const feeCardLabel = isAdmin ? t('Band fee') : t('Your fee');
  // "Fee TBD": the date is confirmed, the money is still being agreed.
  const feeTbd = event.paymentStatus === 'tbd';
  const feeExactValue = feeTbd
    ? 'TBD'
    : isAdmin
    ? formatCurrencyExact(event.price)
    : myResolvedFee != null
      ? formatCurrencyExact(myResolvedFee)
      : 'TBD';
  // The dot-matrix figure keeps 'TBD' (its glyphs are A–Z only); text shows the translation.
  const feeShownValue = feeExactValue === 'TBD' ? t('TBD') : feeExactValue;
  const payoutTotal = activeMembers.reduce((sum, m) => sum + (Number(m.fee) || 0), 0);
  const bandFund = Math.max(0, bandFeeNum - payoutTotal);
  const bandFundPct = bandFeeNum > 0 ? Math.round((bandFund / bandFeeNum) * 100) : null;
  const depositAmount = Number(event.depositAmount) || 0;
  const depositDue = depositAmount > 0 && !event.depositPaid;
  const depositPct = bandFeeNum > 0 && depositAmount > 0 ? Math.round((depositAmount / bandFeeNum) * 100) : null;
  const allPaid = activeMembers.length > 0 && activeMembers.every((m) => !!m.paidAt);

  const confirmedExact = resolvedMembers.filter((m) => m.status === 'confirmed').length;
  const songSeconds = setlistSongs.map((s) => parseDurationSeconds(s.duration));
  const totalSongSeconds = songSeconds.reduce((a, b) => a + b, 0);
  const maxSongSeconds = Math.max(0, ...songSeconds);
  const showSetFlow = numSongs >= 2 && numSongs <= 24 && maxSongSeconds > 0;
  const chatLabel = isRehearsal ? t('REHEARSAL CHAT') : t('EVENT CHAT');

  // ─── RSVP ───
  // Pending gig invite: accept / decline card (unchanged).
  const showRsvpCard =
    !isPast && !isPersonalGig && !isRehearsal && isPending && !!onAccept && !!onDecline;
  // Rehearsal (Figma 22:895): always visible to invited members, current answer selected.
  const showRehearsalRsvp =
    isRehearsal &&
    !isPast &&
    !isPersonalGig &&
    (canRespond ?? !isAdmin) &&
    (!!onRespond || (!!onAccept && !!onDecline));
  const answerByDate = dayBefore(event.date);
  const answerByDays = daysUntil(answerByDate);
  const rsvpCaption =
    answerByDate && answerByDays != null && answerByDays >= 0
      ? t('Answer by {date} so the admin can confirm the room.', { date: formatDayShort(answerByDate) })
      : undefined;
  // Members drop out of a rehearsal from the "…" menu.
  const memberRehearsal = isRehearsal && !isAdmin && !isPersonalGig;
  const showOptionsMenu = memberRehearsal && !isPast && !!onDecline && userResponse !== 'declined';

  // ─── Rehearsal studio cost ───
  const roomLabel = shortPlace(event.venueName || event.location) || '';
  const rehearsalHours = durationHours(event.time, event.endTime);
  const goingCount = confirmedExact;
  const showStudioCost = isRehearsal && !isPersonalGig && bandFeeNum > 0;

  const heroChipStyle: React.CSSProperties = { backgroundColor: theme.accentFg, color: theme.accentColor };
  const heroTintStyle: React.CSSProperties = {
    backgroundColor: 'color-mix(in srgb, currentColor 14%, transparent)',
  };

  // ─── Client & notes (gig / draft): Client, Phone, Dress code, then notes ───
  const notesTitle = event.clientName && !isPersonalGig ? t('CLIENT & NOTES') : t('NOTES');
  const notesRows: { label: string; value: string }[] = [];
  if (!isPersonalGig) {
    if (event.clientName) notesRows.push({ label: t('Client'), value: event.clientName });
    if (event.clientPhone) notesRows.push({ label: t('Phone'), value: event.clientPhone });
    if (event.dressCode) notesRows.push({ label: t('Dress code'), value: event.dressCode });
  }
  const showNotesSection = !isRehearsal && !isQuote;

  // Lineup header action: admins edit the lineup, others open the details.
  const lineupAction =
    isAdmin && onEdit && !isPast
      ? { label: t('EDIT'), run: onEdit }
      : !isRehearsal
        ? { label: t('DETAILS'), run: () => setActiveSheet('lineup') }
        : null;

  const renderDeleteConfirm = (onCancel: () => void) => (
    <div className="flex items-center gap-3">
      <PillButton
        size="sm"
        fullWidth={false}
        className="bg-destructive-solid text-white"
        onClick={() => {
          onDelete?.();
          setShowDeleteConfirm(false);
        }}
      >
        {t('Confirm delete')}
      </PillButton>
      <button onClick={onCancel} className={LINK_CLASS}>
        {t('CANCEL')}
      </button>
    </div>
  );

  const chip = (label: React.ReactNode, style: React.CSSProperties, key?: React.Key, extra?: string) => (
    <span
      key={key}
      className={cn('h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center gap-1 whitespace-nowrap', extra)}
      style={style}
    >
      {label}
    </span>
  );

  const settingLabels: Record<string, string> = { INDOOR: t('INDOOR'), OUTDOOR: t('OUTDOOR'), HYBRID: t('HYBRID') };
  const settingRaw = event.indoorOutdoor?.toUpperCase();
  const settingShown = settingRaw ? settingLabels[settingRaw] ?? settingRaw : undefined;

  // Time tiles (none on quotes). Laptop pose shows them on the Display with
  // the title (index.css: .bw-ed-times-hero), the rest of the time on the sheet.
  const timeTiles = !isQuote ? (
    <div className="grid grid-cols-3 gap-2">
      {isPersonalGig ? (
        <>
          <TimeTile label={t('CALL')} value={loadInTime} />
          <TimeTile label={t('START')} value={showTimeShown} />
          <TimeTile label={t('END')} value={endTimeFormatted || t('TBD')} />
        </>
      ) : eventType === 'gig' ? (
        <>
          <TimeTile label={t('LOAD IN')} value={loadInTime} />
          <TimeTile label={t('SOUNDCHECK')} value={soundCheckTime} />
          <TimeTile label={t('SHOW')} value={showTimeShown} />
        </>
      ) : isRehearsal ? (
        <>
          <TimeTile label={t('START')} value={showTimeShown} />
          <TimeTile label={t('END')} value={endTimeFormatted || t('TBD')} />
          <TimeTile label={t('ROOM')} value={roomLabel || t('TBD')} text />
        </>
      ) : (
        <>
          <TimeTile label={t('SHOW TIME')} value={showTimeShown} />
          <TimeTile label={t('SETTING')} value={settingShown || t('TBD')} text />
          <TimeTile
            label={event.guests ? t('GUESTS') : t('STATUS')}
            value={event.guests ? t('{count} PAX', { count: event.guests }) : typeLabels[eventType]}
            text
          />
        </>
      )}
    </div>
  ) : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="bw-pane-backdrop fixed inset-0 z-[85] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={springs.smooth}
        className="bw-pane-detail bw-event-detail fixed inset-0 z-[90] flex flex-col overflow-hidden bg-background text-foreground select-none"
        // iPhone Duo: the event colour runs under the rail (Figma "Event detail").
        style={railChrome ? { backgroundColor: theme.accentColor } : undefined}
      >
        {/* Status-bar scrim: keeps scrolled content off the clock once the hero is gone */}
        <div
          ref={scrimRef}
          aria-hidden
          className={cn(
            'bw-ed-scrim pointer-events-none absolute inset-x-0 top-0 z-10 bg-background/85 backdrop-blur-md transition-opacity duration-200',
            heroUnderBar ? 'opacity-0' : 'opacity-100',
          )}
          style={{ height: 'var(--safe-top)' }}
        />
        <div className="bw-ed-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain" onScroll={handleScroll}>
          {/* ═══ HERO (event colour, full-bleed) ═══ */}
          <header
            ref={heroRef}
            className="bw-ed-hero w-full"
            style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
          >
            <div
              className="max-w-[640px] mx-auto w-full px-4 pb-14 flex flex-col gap-3"
              style={{ paddingTop: 'calc(var(--wizard-header-pt, max(var(--safe-top), 44px)) + 4px)' }}
            >
              {/* Top bar: back + stage mode / options */}
              <div className="flex items-center justify-between gap-2 h-11 -mt-1 empty:hidden">
                <NavBackButton pane variant="event" size="sm" onClick={onClose} />
                {canStage && !stageInRail && (
                  <button
                    type="button"
                    onClick={() => {
                      haptic.medium();
                      setIsStageOpen(true);
                    }}
                    aria-label={t('Open stage mode')}
                    title={t('Stage mode')}
                    className="w-11 h-11 -mr-2.5 ml-auto rounded-full flex items-center justify-center shrink-0 active:scale-[var(--press-scale)] transition-transform cursor-pointer"
                    style={isGigDay ? heroChipStyle : undefined}
                  >
                    <Play className="w-6 h-6" />
                  </button>
                )}
                {showOptionsMenu && !optionsInRail && (
                  <IconButton
                    label={t('More options')}
                    icon={<MoreHorizontal />}
                    variant="event"
                    size="sm"
                    className="ml-auto"
                    onClick={() => {
                      haptic.tap();
                      setConfirmDrop(false);
                      setOptionsOpen(true);
                    }}
                  />
                )}
              </div>

              {/* Chips + title | dot-matrix date */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    {chip(primaryChip, heroChipStyle)}
                    {statusChips.map((tag, i) => chip(tag, heroChipStyle, `s-${i}`))}
                    {isPast
                      ? chip(
                          <>
                            <Check className="w-3 h-3" />
                            {t('COMPLETED')}
                          </>,
                          heroChipStyle,
                        )
                      : showPendingChip
                        ? chip(
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                              {t('INVITE PENDING')}
                            </>,
                            heroChipStyle,
                          )
                        : null}
                    {!isPersonalGig && subTypeEyebrow && chip(subTypeEyebrow, heroTintStyle)}
                    {!isPersonalGig && event.band_name && chip(event.band_name, heroTintStyle, undefined, 'truncate max-w-[140px]')}
                  </div>

                  <FitText as="h1" text={event.title} sizes={FIT.stage} maxLines={3} expandable className="bw-display-lg" />
                </div>

                <div
                  className="shrink-0 flex flex-col items-end gap-2"
                  style={
                    {
                      '--dot-off': 'color-mix(in srgb, currentColor 18%, transparent)',
                    } as React.CSSProperties
                  }
                >
                  <DotText
                    text={heroDay}
                    size={40}
                    showGrid
                    label={hasHeroDate ? formatEventDateFull(event.date) : t('Date TBD')}
                  />
                  <span className="bw-label-sm opacity-70">{heroMonth}</span>
                </div>
              </div>

              {/* Venue + date·time | weather */}
              <div className="flex items-end justify-between gap-3">
                <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
                  <button
                    type="button"
                    onClick={hasValidLocation ? handleOpenMaps : onEdit}
                    disabled={!hasValidLocation && !onEdit}
                    title={hasValidLocation ? t('Open {place} in Maps', { place: fullLocationQuery }) : t('Venue TBD')}
                    className={cn(
                      'group inline-flex items-center gap-1 text-left max-w-full',
                      hasValidLocation ? 'cursor-pointer active:opacity-70' : 'cursor-default opacity-75'
                    )}
                  >
                    {hasValidLocation && <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden />}
                    <span
                      className={cn(
                        'bw-label-md truncate',
                        hasValidLocation && 'underline decoration-dotted decoration-1 underline-offset-[3px]'
                      )}
                    >
                      {venueShown}
                    </span>
                    {hasValidLocation && (
                      <span className="inline-flex items-center gap-0.5 shrink-0 px-1.5 h-[18px] rounded-full border border-current/40 bw-label-xs opacity-80">
                        {t('MAP')}
                        <ArrowUpRight className="w-2.5 h-2.5" aria-hidden />
                      </span>
                    )}
                  </button>
                  {venueAddress && <span className="bw-label-xs opacity-70 truncate max-w-full">{venueAddress}</span>}
                  <span
                    className="mt-1.5 min-h-5 px-2 py-1 rounded-[4px] bw-label-xs inline-block max-w-full"
                    style={heroTintStyle}
                  >
                    {heroDateTime}
                  </span>
                </div>

                <div className="shrink-0">
                  {isPast ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="bw-label-xs opacity-70">
                        {eventType === 'gig' && !isPersonalGig ? t('ATTENDANCE') : t('STATUS')}
                      </span>
                      <span className="bw-label-md">
                        {activeMembers.length > 0 && !isPersonalGig ? t('{count} MEMBERS', { count: activeMembers.length }) : t('ARCHIVED')}
                      </span>
                    </div>
                  ) : (
                    <WeatherWidget
                      eventDate={event.date}
                      location={fullLocationQuery || event.location}
                      textColor={theme.accentFg}
                      className="bg-transparent border-0 rounded-none p-0 min-w-0 max-w-[150px] justify-end"
                    />
                  )}
                </div>
              </div>
              {timeTiles && <div className="bw-ed-times-hero">{timeTiles}</div>}
            </div>
          </header>

          {/* ═══ CONTENT SHEET ═══ */}
          <div className="bw-ed-sheet relative -mt-8 rounded-t-[32px] bg-background">
            <div
              className="max-w-[640px] mx-auto w-full px-4 pt-6 flex flex-col gap-6"
              style={{ paddingBottom: 'calc(var(--safe-bottom) + 48px)' }}
            >
              {/* ─── RSVP (pending gig invite) ─── */}
              {showRsvpCard && (
                <section className="dark bg-sheet text-sheet-foreground rounded-[16px] p-5 flex flex-col gap-4">
                  <span className="bw-label-sm">{isQuote ? t('Availability check') : t('Your RSVP')}</span>
                  <h2 className="bw-h1">{isQuote ? t('Are you free?') : t('Are you in?')}</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <PillButton variant="primary" size="md" onClick={handleAccept} disabled={isSubmitting}>
                      <Check className="w-4 h-4" />
                      {isSubmitting ? '...' : isQuote ? t("I'M FREE") : t('ACCEPT')}
                    </PillButton>
                    <PillButton variant="white" size="md" onClick={handleDecline} disabled={isSubmitting}>
                      {isQuote ? t('NOT FREE') : t('DECLINE')}
                    </PillButton>
                  </div>
                </section>
              )}

              {/* ─── RSVP (rehearsal, always visible) ─── */}
              {showRehearsalRsvp && (
                <RsvpChoiceCard
                  title={t('Are you coming?')}
                  current={userResponse}
                  onChoose={handleRespond}
                  allowMaybe={!!onRespond}
                  caption={rsvpCaption}
                />
              )}

              {/* ─── TIME TILES ─── */}
              {timeTiles && <div className="bw-ed-times-sheet">{timeTiles}</div>}

              {/* ─── PERSONAL GIG: conflict + privacy ─── */}
              {isPersonalGig && bandConflict && (
                <ScheduleConflictCard conflict={bandConflict} onNotify={onNotifyConflict} />
              )}
              {isPersonalGig && <PersonalPrivacyCard />}

              {/* ─── QUOTE (Figma 23:862) ─── */}
              {isQuote && (
                <>
                  {quoteGuide && (
                    <section
                      aria-label={t('Quote status')}
                      className="rounded-[16px] bg-card p-4 flex items-start gap-3"
                    >
                      <span className="w-9 h-9 rounded-full bg-foreground/[0.08] flex items-center justify-center shrink-0" aria-hidden>
                        {quoteGuide.icon}
                      </span>
                      <span className="flex flex-col gap-1 min-w-0">
                        <span className="bw-label-md">{quoteGuide.title}</span>
                        <span className="bw-body-sm text-muted-foreground [overflow-wrap:anywhere]">{quoteGuide.body}</span>
                      </span>
                    </section>
                  )}
                  <QuoteSummaryCard
                    quote={linkedQuote}
                    loading={quoteLoading}
                    error={quoteError}
                    fallbackTotal={bandFeeNum}
                  />
                  <QuoteLineItems quote={linkedQuote} fallbackTotal={bandFeeNum} />
                  <QuoteClientSection
                    quote={linkedQuote}
                    fallback={{ company: event.clientCompany, contact: event.clientName, guests: event.guests }}
                    notes={event.notes}
                  />
                  {/* Availability check sent with the quote: who is free. */}
                  {!isPersonalGig && (memberCount > 0 || (membersLoading && !dbMembers)) && (
                    <section className="flex flex-col gap-6" aria-label={t('Lineup availability')}>
                      <SectionTitle
                        title={
                          memberCount > 0
                            ? t('AVAILABILITY · {confirmed}/{total} FREE', { confirmed: confirmedExact, total: memberCount })
                            : t('AVAILABILITY')
                        }
                        actionLabel={memberCount > 0 ? t('DETAILS') : undefined}
                        onAction={memberCount > 0 ? () => setActiveSheet('lineup') : undefined}
                      />
                      <div className="bg-card rounded-[16px] p-4 flex flex-col gap-4">
                        {membersLoading && !dbMembers ? (
                          <span className="bw-label-sm text-muted-foreground">{t('LOADING…')}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveSheet('lineup')}
                            className="flex flex-col gap-4 text-left cursor-pointer"
                            aria-label={t('Open availability details')}
                          >
                            {resolvedMembers.slice(0, 6).map((m, i) => (
                              <MemberRow key={m.userId || i} member={m} availability />
                            ))}
                            {resolvedMembers.length > 6 && (
                              <span className="bw-label-xs text-muted-foreground pl-14">
                                {t('+ {count} MORE', { count: resolvedMembers.length - 6 })}
                              </span>
                            )}
                          </button>
                        )}
                        <span className="bw-body-sm text-muted-foreground">
                          {t("Not confirmed yet: everyone's answer is only about the date. They get the gig when you confirm it.")}
                        </span>
                      </div>
                    </section>
                  )}
                </>
              )}

              {/* ─── FEE (band gig / draft) ─── */}
              {!isRehearsal && !isPersonalGig && !isQuote && (
                <section className="dark bg-sheet text-sheet-foreground rounded-[16px] p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="bw-label-sm">{feeCardLabel}</span>
                      <DotText text={feeExactValue} size={32} label={feeShownValue} />
                    </div>
                    {isAdmin && depositDue && <Tag variant="accent">{t('DEPOSIT DUE')}</Tag>}
                    {feeTbd && <Tag variant="subtle">{t('To be discussed')}</Tag>}
                  </div>
                  {isAdmin && (activeMembers.length > 0 || depositAmount > 0 || (myResolvedFee != null && myResolvedFee > 0)) && (
                    <div className="flex flex-col gap-3">
                      {activeMembers.length > 0 && (
                        <KeyValueRow
                          label={t('Musician payouts ({count})', { count: activeMembers.length })}
                          value={formatCurrencyExact(payoutTotal)}
                        />
                      )}
                      {activeMembers.length > 0 && bandFund > 0 && (
                        <KeyValueRow label={t('Band fund')} value={formatCurrencyExact(bandFund)} />
                      )}
                      {depositAmount > 0 && (
                        <KeyValueRow
                          label={`${t('Deposit')}${depositPct != null ? ` ${depositPct}%` : ''}${event.depositPaid ? ` · ${t('paid')}` : ''}`}
                          value={formatCurrencyExact(depositAmount)}
                        />
                      )}
                    </div>
                  )}
                  <PillButton variant="primary" size="md" type="button" onClick={() => setActiveSheet('fee')}>
                    {isAdmin ? t('FEE & PAYOUTS') : t('PAYOUT DETAILS')}
                    <ArrowUpRight className="w-4 h-4" />
                  </PillButton>
                </section>
              )}

              {/* ─── EARNINGS (personal gig) ─── */}
              {isPersonalGig && !isRehearsal && (
                <section className="flex flex-col gap-6">
                  <SectionTitle title={t('EARNINGS')} />
                  <div className="bg-card rounded-[16px] p-4 flex flex-col gap-3">
                    <KeyValueRow label={t('My fee')} value={formatCurrencyExact(event.price)} muted />
                    <PaidToggleRow
                      key={event.eventId}
                      eventId={event.eventId}
                      initial={event.paymentStatus === 'tbd' ? 'pending' : event.paymentStatus}
                      onSaved={onEventUpdated}
                    />
                  </div>
                </section>
              )}

              {/* ─── LINEUP / ATTENDANCE ─── */}
              {!isPersonalGig && !isQuote && (
                <section className="flex flex-col gap-6">
                  <SectionTitle
                    title={`${isRehearsal ? t('ATTENDANCE') : t('LINEUP')}${
                      memberCount > 0 ? ` · ${confirmedExact}/${memberCount}` : ''
                    }`}
                    actionLabel={lineupAction?.label}
                    onAction={lineupAction?.run}
                  />
                  <div className="bg-card rounded-[16px] p-4 flex flex-col gap-4">
                    {membersLoading && !dbMembers ? (
                      <span className="bw-label-sm text-muted-foreground">{t('LOADING LINEUP…')}</span>
                    ) : membersError ? (
                      <span role="alert" className="bw-body-sm text-destructive">
                        {t('Could not load the lineup: {error}', { error: membersError })}
                      </span>
                    ) : resolvedMembers.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setActiveSheet('lineup')}
                        className="flex flex-col gap-4 text-left cursor-pointer"
                        aria-label={t('Open lineup details')}
                      >
                        {resolvedMembers.slice(0, 6).map((m, i) => (
                          <MemberRow key={m.userId || i} member={m} />
                        ))}
                        {resolvedMembers.length > 6 && (
                          <span className="bw-label-xs text-muted-foreground pl-14">
                            {t('+ {count} MORE', { count: resolvedMembers.length - 6 })}
                          </span>
                        )}
                      </button>
                    ) : (
                      <span className="flex items-center justify-between gap-3">
                        <span className="bw-body-sm text-muted-foreground">
                          {isRehearsal ? t('No one invited yet') : t('No musicians added yet')}
                        </span>
                        <span className="bw-label-xs inline-flex items-center gap-1.5 text-warning">
                          <span className="w-2 h-2 rounded-full bg-warning" />
                          {t('UNASSIGNED')}
                        </span>
                      </span>
                    )}
                    {isAdmin && !isPast && onEdit && !isRehearsal && (
                      <PillButton variant="outline" size="md" type="button" onClick={onEdit}>
                        <Plus className="w-4 h-4" />
                        {t('ADD MUSICIAN')}
                      </PillButton>
                    )}
                  </div>
                </section>
              )}

              {/* ─── STUDIO COST (rehearsal) ─── */}
              {showStudioCost && (
                <section className="flex flex-col gap-6">
                  <SectionTitle title={t('STUDIO COST')} />
                  <div className="bg-card rounded-[16px] p-4 flex flex-col gap-3">
                    <KeyValueRow
                      label={[roomLabel || t('Room'), rehearsalHours != null ? `${formatHours(rehearsalHours)} h` : '']
                        .filter(Boolean)
                        .join(' · ')}
                      value={formatCurrencyExact(bandFeeNum)}
                      muted
                    />
                    {goingCount > 0 && (
                      <KeyValueRow
                        label={t('Split between {count} going', { count: goingCount })}
                        value={t('{amount} EACH', { amount: money(bandFeeNum / goingCount, 'auto') })}
                        muted
                      />
                    )}
                  </div>
                </section>
              )}

              {/* ─── SETLIST (gig / draft) ─── */}
              {!isPersonalGig && !isQuote && !isRehearsal && (
                <section className="flex flex-col gap-6">
                  <SectionTitle
                    title={t('SETLIST')}
                    actionLabel={
                      setlistLoading
                        ? '...'
                        : numSongs === 1
                          ? t('{count} SONG', { count: numSongs })
                          : t('{count} SONGS', { count: numSongs })
                    }
                    onAction={() => setActiveSheet('setlist')}
                  />
                  <button
                    type="button"
                    onClick={() => setActiveSheet('setlist')}
                    className="bg-card rounded-[16px] p-4 flex flex-col gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    {setlistLoading ? (
                      <span className="bw-label-sm text-muted-foreground">{t('LOADING SETLIST…')}</span>
                    ) : numSongs === 0 ? (
                      <span className="flex items-center justify-between gap-3 w-full">
                        <span className="bw-label-sm text-warning inline-flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {t('NO SETLIST ASSIGNED')}
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                      </span>
                    ) : (
                      <>
                        {showSetFlow && (
                          <span className="flex flex-col gap-2 w-full pb-3 border-b border-border">
                            <SetFlow seconds={songSeconds} max={maxSongSeconds} />
                            <span className="flex items-center justify-between bw-label-xs text-muted-foreground">
                              <span>{t('SET FLOW · ENERGY')}</span>
                              <span>{t('OPENER → ENCORE')}</span>
                            </span>
                          </span>
                        )}
                        <span className="flex flex-col gap-3 w-full">
                          {setlistSongs.slice(0, 3).map((song, i) => (
                            <span key={i} className="flex items-center gap-3 w-full min-w-0">
                              <span className="bw-label-md text-muted-foreground w-5 shrink-0">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span className="bw-body-lg flex-1 min-w-0 truncate">{song.title}</span>
                              {song.duration && (
                                <span className="bw-label-sm text-muted-foreground shrink-0">{song.duration}</span>
                              )}
                            </span>
                          ))}
                        </span>
                        {(numSongs > 3 || totalSongSeconds > 0) && (
                          <span className="bw-label-xs text-muted-foreground">
                            {[
                              numSongs > 3 ? t('+ {count} MORE', { count: numSongs - 3 }) : '',
                              totalSongSeconds > 0 ? t('{duration} TOTAL', { duration: formatTotalDuration(totalSongSeconds) }) : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                </section>
              )}

              {/* ─── FOCUS SONGS (rehearsal) ─── */}
              {isRehearsal && !isPersonalGig && (
                <section className="flex flex-col gap-6">
                  <SectionTitle
                    title={t('FOCUS SONGS')}
                    actionLabel={setlistLoading ? '...' : t('SETLIST')}
                    onAction={() => setActiveSheet('setlist')}
                  />
                  {setlistLoading ? (
                    <span className="bw-label-sm text-muted-foreground">{t('LOADING…')}</span>
                  ) : numSongs > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {setlistSongs.slice(0, 8).map((song, i) => (
                        <Selector key={i} selected={false} onClick={() => setActiveSheet('setlist')} className="max-w-full truncate">
                          {song.title}
                        </Selector>
                      ))}
                      {numSongs > 8 && (
                        <button
                          type="button"
                          onClick={() => setActiveSheet('setlist')}
                          className="h-7 px-3 rounded-full bw-label-sm inline-flex items-center text-muted-foreground cursor-pointer"
                        >
                          {t('+ {count} MORE', { count: numSongs - 8 })}
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveSheet('setlist')}
                      className="bg-card rounded-[16px] p-4 text-left bw-body-sm text-muted-foreground cursor-pointer"
                    >
                      {t('No songs picked for this rehearsal yet.')}
                    </button>
                  )}
                </section>
              )}

              {/* ─── TASKS (band events with saved to-dos) ─── */}
              {!isPersonalGig && eventTasks.length > 0 && (
                <section className="flex flex-col gap-6">
                  <div className="flex flex-col gap-1">
                    <SectionTitle title={t('TASKS')} />
                    <span className="bw-label-sm text-muted-foreground">
                      {t('{done} of {total} done', { done: tasksDone, total: eventTasks.length })}
                    </span>
                  </div>
                  {eventTasksError && <p role="alert" className="bw-body-sm text-destructive">{eventTasksError}</p>}
                  <div className="bg-card rounded-[16px] px-4 py-1 flex flex-col">
                    {eventTasks.map((task, i) => (
                      <button
                        key={task.id}
                        type="button"
                        role="checkbox"
                        aria-checked={task.is_completed}
                        onClick={() => { haptic.tap(); toggleEventTask(task.id); }}
                        className={cn('flex items-center gap-3 py-3 text-left cursor-pointer', i > 0 && 'border-t border-border')}
                      >
                        <DotCheckbox
                          checked={task.is_completed}
                          activeColor={isRehearsal ? 'var(--accent-rehearsal)' : 'var(--foreground)'}
                          inactiveColor="var(--border)"
                        />
                        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <span className={cn('bw-body-md [overflow-wrap:anywhere]', task.is_completed && 'text-muted-foreground line-through')}>
                            {task.title}
                          </span>
                          {task.due_date && (
                            <span className="bw-label-xs text-muted-foreground">
                              {t('Due {date}', {
                                date: parseLocalDate(task.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
                              })}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* ─── CLIENT & NOTES (gig / draft / personal) ─── */}
              {showNotesSection && (
                <section className="flex flex-col gap-6">
                  <SectionTitle title={notesTitle} actionLabel={t('DETAILS')} onAction={() => setActiveSheet('notes')} />
                  <button
                    type="button"
                    onClick={() => setActiveSheet('notes')}
                    className="bg-card rounded-[16px] p-4 flex flex-col gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    {notesRows.map((row) => (
                      <KeyValueRow key={row.label} label={row.label} value={row.value} muted />
                    ))}
                    <span
                      className={cn(
                        'block bw-body-md whitespace-pre-wrap line-clamp-4 w-full',
                        !event.notes && 'text-muted-foreground'
                      )}
                    >
                      {event.notes ||
                        (isPersonalGig
                          ? t('No personal notes added for this gig.')
                          : t('No notes added yet.'))}
                    </span>
                  </button>
                </section>
              )}

              {/* ─── ACTIONS ─── */}
              <section className="flex flex-col items-center gap-4">
                {isPast ? (
                  <>
                    <div
                      className={cn(
                        'grid gap-3 w-full',
                        isAdmin || userResponse === 'accepted' ? 'grid-cols-2' : 'grid-cols-1'
                      )}
                    >
                      <PillButton variant="outline" size="lg" onClick={() => setActiveSheet('setlist')}>
                        <Music className="w-4 h-4" />
                        {t('VIEW SETLIST')}
                      </PillButton>
                      {(isAdmin || userResponse === 'accepted') && (
                        <PillButton variant="dark" size="lg" onClick={onChat}>
                          <MessageSquare className="w-4 h-4" />
                          {chatLabel}
                        </PillButton>
                      )}
                    </div>
                    {isAdmin &&
                      (showDeleteConfirm ? (
                        renderDeleteConfirm(() => setShowDeleteConfirm(false))
                      ) : (
                        <div className="flex items-center gap-5">
                          <button onClick={onEdit} className={LINK_CLASS}>
                            <Pencil className="w-3.5 h-3.5" />
                            {t('EDIT DETAILS')}
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className={cn(LINK_CLASS, 'text-destructive-solid hover:text-destructive-solid')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('REMOVE FROM ARCHIVE')}
                          </button>
                        </div>
                      ))}
                  </>
                ) : isPersonalGig ? (
                  <>
                    <PillButton variant="outline" size="lg" onClick={onEdit}>
                      <Pencil className="w-4 h-4" />
                      {t('EDIT')}
                    </PillButton>
                    {showDeleteConfirm ? (
                      renderDeleteConfirm(() => setShowDeleteConfirm(false))
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        aria-label={theme.deleteLabel}
                        className={cn(LINK_CLASS, 'text-destructive-solid hover:text-destructive-solid')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('DELETE')}
                      </button>
                    )}
                  </>
                ) : showRsvpCard && !(isAdmin && isQuote) ? null : isAdmin ? (
                  isQuote ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 w-full">
                        <PillButton
                          variant="outline"
                          size="lg"
                          onClick={() => {
                            if (onShareQuote) onShareQuote(event);
                            else setIsShareQuoteOpen(true);
                          }}
                        >
                          <Share2 className="w-4 h-4" />
                          {t('SHARE QUOTE')}
                        </PillButton>
                        <PillButton variant="primary" size="lg" onClick={handleConfirmQuote} disabled={isConfirming}>
                          <Check className="w-4 h-4" />
                          {isConfirming ? '...' : t('CONFIRM AS GIG')}
                        </PillButton>
                      </div>
                      {showDeleteConfirm ? (
                        renderDeleteConfirm(() => setShowDeleteConfirm(false))
                      ) : (
                        <div className="flex items-center gap-5">
                          <button onClick={onEdit} className={LINK_CLASS}>
                            <Pencil className="w-3.5 h-3.5" />
                            {t('EDIT QUOTE')}
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            aria-label={theme.deleteLabel}
                            className={cn(LINK_CLASS, 'text-destructive-solid hover:text-destructive-solid')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('DELETE')}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 w-full">
                        <PillButton variant="outline" size="lg" onClick={onEdit}>
                          <Pencil className="w-4 h-4" />
                          {t('EDIT')}
                        </PillButton>
                        <PillButton variant="dark" size="lg" onClick={onChat}>
                          <MessageSquare className="w-4 h-4" />
                          {chatLabel}
                        </PillButton>
                      </div>
                      {showRevertConfirm ? (
                        <div className="flex flex-col gap-3 w-full" role="group" aria-label={t('Revert to quote?')}>
                          <p className="bw-body-sm text-muted-foreground">
                            {memberCount > 0
                              ? t(
                                  "Back to a quote: the gig leaves the musicians' calendars ({count} in the lineup) until you confirm it again. Their answers are kept.",
                                  { count: memberCount },
                                )
                              : t(
                                  "Back to a quote: the gig leaves the musicians' calendars until you confirm it again. Their answers are kept.",
                                )}
                          </p>
                          <div className="flex items-center gap-3">
                            <PillButton size="sm" fullWidth={false} onClick={handleRevertQuote} disabled={isReverting}>
                              <RotateCcw className="w-3.5 h-3.5" />
                              {t('Revert to quote')}
                            </PillButton>
                            <button onClick={() => setShowRevertConfirm(false)} className={LINK_CLASS}>
                              {t('Keep the gig')}
                            </button>
                          </div>
                        </div>
                      ) : showDeleteConfirm ? (
                        renderDeleteConfirm(() => setShowDeleteConfirm(false))
                      ) : (
                        <div className="flex items-center gap-5">
                          {onRevertQuote && (
                            <button onClick={() => setShowRevertConfirm(true)} disabled={isReverting} className={LINK_CLASS}>
                              <RotateCcw className="w-3.5 h-3.5" />
                              {isReverting ? t('REVERTING...') : t('REVERT TO QUOTE')}
                            </button>
                          )}
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            aria-label={theme.deleteLabel}
                            className={cn(LINK_CLASS, 'text-destructive-solid hover:text-destructive-solid')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('DELETE')}
                          </button>
                        </div>
                      )}
                    </>
                  )
                ) : memberRehearsal ? (
                  /* MEMBER VIEW (rehearsal): one chat button; Drop out lives in the "…" menu */
                  userResponse === 'accepted' || userResponse === 'maybe' ? (
                    <PillButton variant="dark" size="lg" onClick={onChat}>
                      <MessageSquare className="w-4 h-4" />
                      {chatLabel}
                    </PillButton>
                  ) : null
                ) : (
                  /* MEMBER VIEW (Accepted gig) */
                  <>
                    <div className="grid grid-cols-2 gap-3 w-full">
                      <PillButton
                        variant="outline"
                        size="lg"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? '...' : t('DROP OUT')}
                      </PillButton>
                      <PillButton variant="dark" size="lg" onClick={onChat}>
                        <MessageSquare className="w-4 h-4" />
                        {chatLabel}
                      </PillButton>
                    </div>
                    {showDeleteConfirm && (
                      <div className="flex items-center gap-3">
                        <span className="bw-label-sm text-muted-foreground">{t('Drop out?')}</span>
                        <PillButton
                          size="sm"
                          fullWidth={false}
                          className="bg-destructive-solid text-white"
                          onClick={handleDecline}
                          loading={isSubmitting}
                        >
                          {t('Confirm drop')}
                        </PillButton>
                        <button onClick={() => setShowDeleteConfirm(false)} className={LINK_CLASS}>
                          {t('CANCEL')}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>
        </div>

        {/* ═══ DRILL-DOWN BOTTOM SHEET (Setlist / Lineup / Fee / Notes) ═══ */}
        {/* iPhone Duo open: the event moves to the leading page while the sheet
            is on the trailing page (Figma "Open · Event detail / Gig | Event /
            Fee & payouts sheet"). */}
        <BwSheet
          picker
          open={!!activeSheet}
          onClose={() => setActiveSheet(null)}
          closeLabel={t('Close sheet')}
          zIndex={110}
          overline={activeSheet === 'fee' && isAdmin ? t('Admin only') : event.title}
          title={
            <>
              {activeSheet === 'fee' && t('Fee & payouts')}
              {activeSheet === 'setlist' && t('Setlist · {count}', { count: numSongs })}
              {activeSheet === 'lineup' &&
                (isQuote ? t('Availability · {count}', { count: memberCount }) : t('Lineup · {count}', { count: memberCount }))}
              {activeSheet === 'notes' && t('Logistics & notes')}
            </>
          }
          footer={
            activeSheet === 'fee' && isAdmin && paidSupported && activeMembers.length > 0 && !allPaid ? (
              <PillButton
                variant="primary"
                onClick={() => {
                  haptic.confirm();
                  markAllPaid();
                }}
                loading={markingPaid}
                icon={<Check className="w-[18px] h-[18px]" />}
              >
                {t('MARK ALL AS PAID')}
              </PillButton>
            ) : undefined
          }
        >
          <div className="dark flex flex-col gap-3">
            {activeSheet === 'fee' && (
              <FeePayoutsContent
                isAdmin={isAdmin}
                feeLabel={isAdmin ? t('Band fee') : t('Your assigned fee')}
                feeValue={feeShownValue}
                members={activeMembers}
                bandFund={bandFund}
                bandFundPct={bandFundPct}
                paidSupported={paidSupported}
                formatMoney={formatCurrencyExact}
                onEditFee={
                  isAdmin && onEdit
                    ? () => {
                        setActiveSheet(null);
                        onEdit();
                      }
                    : undefined
                }
                error={markError || membersError}
              />
            )}

            {activeSheet === 'setlist' && (
              <>
                {numSongs > 0 ? (
                  <div className="flex flex-col gap-2">
                    {setlistSongs.map((song, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 rounded-[16px] bg-foreground/[0.08] px-4 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="bw-label-sm text-muted-foreground w-5 shrink-0">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="bw-body-md truncate">{song.title}</span>
                            {song.artist && (
                              <span className="bw-label-xs text-muted-foreground truncate mt-1">
                                {song.artist}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {song.key && <Tag variant="subtle">{song.key}</Tag>}
                          {song.duration && (
                            <span className="bw-label-sm text-muted-foreground">{song.duration}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
                    <AlertCircle className="w-8 h-8 text-warning" />
                    <p className="bw-h3">{t('No setlist assigned')}</p>
                    <p className="bw-body-sm text-muted-foreground max-w-[260px]">
                      {isAdmin
                        ? t('Tap Edit to assign songs or a setlist to this event.')
                        : t('The band admin has not attached a setlist yet.')}
                    </p>
                    {isAdmin && onEdit && (
                      <PillButton
                        variant="primary"
                        size="md"
                        fullWidth={false}
                        className="mt-1"
                        onClick={() => {
                          setActiveSheet(null);
                          onEdit();
                        }}
                      >
                        {t('Assign setlist')}
                      </PillButton>
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
                        key={m.userId || i}
                        className="flex items-center justify-between gap-3 rounded-[16px] bg-foreground/[0.08] px-3 py-3"
                      >
                        <MemberRow member={m} availability={isQuote} />
                        {(isAdmin || m.userId === currentUserId) && m.fee > 0 && m.status !== 'declined' && (
                          <span className="bw-label-md shrink-0">{formatCurrencyExact(m.fee)}</span>
                        )}
                        {canFindDeputy && m.status === 'declined' && (
                          <PillButton size="sm" variant="white" fullWidth={false} className="shrink-0" onClick={() => setDeputyFor(m)}>
                            {t('Find a deputy', { context: 'button' })}
                          </PillButton>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center bw-body-sm text-muted-foreground">
                    {membersError
                      ? t('Could not load the lineup: {error}', { error: membersError })
                      : t('No members assigned to this event yet.')}
                  </div>
                )}
              </>
            )}

            {activeSheet === 'notes' && (
              <div className="flex flex-col gap-3">
                {/* Venue & address */}
                <div className="rounded-[16px] bg-foreground/[0.08] p-4 flex flex-col gap-3">
                  <div className="min-w-0 flex flex-col gap-1">
                    <span className="bw-label-sm text-muted-foreground">{t('Venue & location')}</span>
                    <span className="bw-label-md truncate">{venueShown}</span>
                    {venueAddress && (
                      <span className="bw-body-sm text-muted-foreground truncate">{venueAddress}</span>
                    )}
                  </div>
                  {hasValidLocation && (
                    <div className="grid grid-cols-2 gap-2">
                      <PillButton variant="outline" size="sm" onClick={handleCopyAddress} title={t('Copy address')}>
                        <Copy className="w-3.5 h-3.5" />
                        {copiedAddress ? t('Copied') : t('Copy')}
                      </PillButton>
                      <PillButton variant="primary" size="sm" onClick={handleOpenMaps}>
                        {t('Maps')}
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </PillButton>
                    </div>
                  )}
                </div>

                {/* Client & event metadata: only what was entered */}
                {!isPersonalGig &&
                  (event.clientName || event.clientPhone || event.clientEmail || event.dressCode || event.guests || event.indoorOutdoor) && (
                    <div className="rounded-[16px] bg-foreground/[0.08] p-4 flex flex-col gap-3">
                      {event.clientName && <KeyValueRow label={t('Client')} value={event.clientName} muted />}
                      {event.clientPhone && (
                        <KeyValueRow
                          label={t('Phone')}
                          value={
                            <a href={`tel:${event.clientPhone.replace(/\s+/g, '')}`} className="underline underline-offset-2 select-text">
                              {event.clientPhone}
                            </a>
                          }
                          muted
                        />
                      )}
                      {event.clientEmail && (
                        <KeyValueRow
                          label={t('Email')}
                          value={
                            <a href={`mailto:${event.clientEmail}`} className="underline underline-offset-2 select-text">
                              {event.clientEmail}
                            </a>
                          }
                          muted
                        />
                      )}
                      {event.dressCode && <KeyValueRow label={t('Dress code')} value={event.dressCode} muted />}
                      {event.indoorOutdoor && (
                        <KeyValueRow label={t('Setting')} value={settingShown} muted />
                      )}
                      {event.guests ? <KeyValueRow label={t('Guests')} value={t('{count} PAX', { count: event.guests })} muted /> : null}
                    </div>
                  )}

                {/* Notes */}
                <div className="rounded-[16px] bg-foreground/[0.08] p-4 flex flex-col gap-2">
                  <span className="bw-label-sm text-muted-foreground">{t('Notes')}</span>
                  <p className="bw-body-md whitespace-pre-wrap select-text">
                    {event.notes || t('No additional notes recorded for this event.')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </BwSheet>

        {/* ═══ "…" OPTIONS (member rehearsal: drop out) ═══ */}
        <BwSheet
          open={optionsOpen}
          onClose={() => setOptionsOpen(false)}
          closeLabel={t('Close options')}
          zIndex={110}
          overline={event.title}
          title={t('Rehearsal options')}
        >
          <div className="dark flex flex-col gap-3">
            {confirmDrop ? (
              <>
                <p className="bw-body-md">{t('Drop out of this rehearsal? The admin will be notified.')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <PillButton variant="outline" size="md" onClick={() => setConfirmDrop(false)} disabled={isSubmitting}>
                    {t('CANCEL')}
                  </PillButton>
                  <PillButton
                    size="md"
                    className="bg-destructive-solid text-white"
                    onClick={async () => {
                      await handleDecline();
                      setOptionsOpen(false);
                    }}
                    loading={isSubmitting}
                  >
                    {t('DROP OUT')}
                  </PillButton>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDrop(true)}
                className="flex items-center gap-3 min-h-14 px-4 rounded-[16px] bg-foreground/[0.08] text-left text-destructive cursor-pointer active:scale-[var(--press-scale,0.97)] transition-transform"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span className="bw-label-md">{t('Drop out of this rehearsal')}</span>
              </button>
            )}
          </div>
        </BwSheet>
      </motion.div>

      {canFindDeputy && (
        <AskDeputySheet
          open={!!deputyFor}
          onClose={() => setDeputyFor(null)}
          formatFee={(n) => formatCurrencyExact(n)}
          member={
            deputyFor && {
              name: deputyFor.name,
              role: deputyFor.role,
              feeLabel: deputyFor.fee > 0 ? formatCurrencyExact(deputyFor.fee) : null,
            }
          }
          ctx={{
            bandId: event.band_id!,
            bandName: bands.find((b) => b.id === event.band_id)?.name || event.band_name || selectedBand?.name || 'the band',
            eventTitle: event.title,
            dateLabel: heroDate ? heroDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'date to be confirmed',
            timeLabel: event.time ? formatEventTime(event.time) : null,
            venue: venueName !== 'TBD' ? venueName : null,
          }}
        />
      )}

      <QuoteShareModal
        isOpen={isShareQuoteOpen}
        quote={linkedQuote || {
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
          musicianCount: activeMembers.length || 1,
          musicians: activeMembers.map((m, idx) => ({
            id: m.userId || `m-${idx}`,
            name: m.name,
            instrument: m.role,
            fee: m.fee,
            isExternal: false,
            isAvailable: true,
          })),
          baseFee: bandFeeNum,
          subtotal: bandFeeNum,
          netAmount: bandFeeNum,
          total: bandFeeNum,
          clientNotes: event.notes,
        }}
        bandId={event.band_id || selectedBand?.id}
        bandName={event.band_name || selectedBand?.name}
        onClose={() => setIsShareQuoteOpen(false)}
        onOpenBandSettings={onOpenBandSettings}
      />

      <AnimatePresence>
        {isStageOpen && (
          <StageMode
            title={event.title}
            venue={venueName !== 'TBD' ? venueName : undefined}
            city={event.venueCity}
            dateLabel={hasHeroDate ? formatEventDateShort(event.date) : t('TBD')}
            date={event.date}
            accentColor="var(--accent-gig)"
            steps={[
              { label: t('Load in'), time: event.loadInTime, display: t('TBD') },
              { label: t('Soundcheck'), time: event.soundcheckTime, display: t('TBD') },
              { label: t('Show'), time: event.time, display: t('TBD') },
              { label: t('End'), time: event.endTime, display: t('TBD') },
            ]}
            songs={setlistSongs}
            songsLoading={setlistLoading}
            onClose={() => setIsStageOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Laptop pose (Figma "Duo · 11"): Stage mode as a floor wedge. Mounted
          only with Stage mode and only in the pose, since it keeps the screen
          awake and takes the arrow / page-turner keys while mounted. */}
      {isStageOpen && laptopPose && (
        <FloorWedgeMode songs={setlistSongs} songsLoading={setlistLoading} title={event.title} />
      )}
    </>
  );
};
