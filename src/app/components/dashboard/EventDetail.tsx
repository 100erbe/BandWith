import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
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
  X,
  Copy,
  Share2,
} from '@/app/components/icons';
import { springs } from '@/styles/motion';
import { EventData } from './EventCard';
import { WeatherWidget } from '@/app/components/ui/WeatherWidget';
import { supabase } from '@/lib/supabase';
import { dbQuoteToAppQuote } from '@/lib/services/quotes';
import type { Quote as AppQuote } from '@/app/data/quotes';
import { useBand } from '@/lib/BandContext';
import { cn } from '@/app/components/ui/utils';
import { useRailAction, useRailOwnsChrome } from '@/lib/railActions';
import { DotText } from '@/app/components/bw';
import { IconButton, NavBackButton, Tag, BwSheet } from '@/app/components/bw/Screen';
import { PillButton, Selector } from '@/app/components/bw/Form';
import { haptic } from '@/lib/haptics';
import { QuoteShareModal } from '@/app/components/quotes/QuoteShareModal';
import { StageMode } from './StageMode';
import { parseLocalDate } from '@/lib/dates';
import { setStatusBarTone, toneForForeground } from '@/lib/systemBars';
import { FIT, FitText } from '@/app/components/bw/FitText';
import { getActiveSymbol as sym, useCurrency } from '@/lib/currency';
import { openMaps } from '@/app/components/ui/MapsLink';

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

const formatCurrencyExact = (price?: string | number): string => {
  if (price === undefined || price === null || price === '') return `${sym()}0`;
  const raw = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^0-9.]/g, ''));
  if (isNaN(raw)) return String(price);
  return `${sym()}${Math.round(raw).toLocaleString()}`;
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

/* ─────────────── Figma kit pieces local to the event detail ─────────────── */

/** Figma Button / Ghost SM: text-only action under the main CTAs. */
const LINK_CLASS =
  'h-9 inline-flex items-center gap-2 bw-button-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50';

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

/** "7:30 PM" → ["7:30", "PM"], "7 PM" → ["7:00", "PM"]; anything else is shown as is. */
const splitTimeDisplay = (display: string): [string, string] => {
  const m = display.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return [display, ''];
  return [`${m[1]}:${m[2] || '00'}`, m[3].toUpperCase()];
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

const KeyValueRow: React.FC<{ label: string; value: string; muted?: boolean }> = ({ label, value, muted }) => (
  <span className="flex items-baseline justify-between gap-3 w-full min-w-0">
    <span className={cn('bw-body-md min-w-0 truncate', muted && 'text-muted-foreground')}>{label}</span>
    <span className="bw-label-md shrink-0 text-right">{value}</span>
  </span>
);

const SectionTitle: React.FC<{ title: string; actionLabel?: string; onAction?: () => void }> = ({
  title,
  actionLabel,
  onAction,
}) => (
  <div className="flex items-center justify-between gap-3 min-h-10">
    <h2 className="bw-h1 min-w-0">{title}</h2>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        aria-label={`${actionLabel}: ${title}`}
        className="shrink-0 h-9 inline-flex items-center bw-button-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

const MEMBER_STATUS: Record<ResolvedMember['status'], { label: string; color: string }> = {
  confirmed: { label: 'CONFIRMED', color: 'var(--success)' },
  pending: { label: 'PENDING', color: 'var(--warning)' },
  maybe: { label: 'MAYBE', color: 'var(--warning)' },
  declined: { label: 'DECLINED', color: 'var(--destructive-solid)' },
};

const MemberRow: React.FC<{ member: ResolvedMember }> = ({ member }) => {
  const status = MEMBER_STATUS[member.status] || MEMBER_STATUS.confirmed;
  return (
    <span className="flex items-center gap-3 flex-1 min-w-0 w-full">
      <span className="w-11 h-11 rounded-full bg-white text-black border-[1.5px] border-black/15 flex items-center justify-center bw-h3 shrink-0">
        {member.initials}
      </span>
      <span className="flex flex-col gap-1 flex-1 min-w-0">
        <span className="bw-label-md truncate">{member.name}</span>
        <span className="bw-body-sm text-muted-foreground truncate">{member.role}</span>
      </span>
      <span className="inline-flex items-center gap-2 bw-label-sm shrink-0">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
        {status.label}
      </span>
    </span>
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
  useCurrency(); // re-render money labels when the band currency changes
  const railChrome = useRailOwnsChrome();
  const { selectedBand, bands } = useBand();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheetType>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [isShareQuoteOpen, setIsShareQuoteOpen] = useState(false);
  // The real quote saved with this event (quotes.converted_to_event_id), so
  // the PDF carries its number, line items and VAT instead of a stand-in.
  const [linkedQuote, setLinkedQuote] = useState<Partial<AppQuote> | null>(null);
  useEffect(() => {
    if (!isShareQuoteOpen || !event.eventId) return;
    let cancelled = false;
    supabase
      .from('quotes')
      .select('*, musicians:quote_musicians(*)')
      .eq('converted_to_event_id', event.eventId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (!cancelled && data?.[0]) setLinkedQuote(dbQuoteToAppQuote(data[0] as any));
      });
    return () => { cancelled = true; };
  }, [isShareQuoteOpen, event.eventId]);
  const [isStageOpen, setIsStageOpen] = useState(false);

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
          // songs has duration_seconds, not duration: asking for a missing
          // column makes PostgREST fail the whole query.
          .select('*, song:songs(title, artist, duration_seconds, key)')
          .eq('setlist_id', event.setlistId)
          .order('position', { ascending: true });
        if (!cancelled && data && data.length > 0) {
          setSetlistSongs(
            data.map((s: any) => ({
              title: s.song?.title || 'Unknown Song',
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
    : isPersonalGig
      ? { ...baseTheme, accentColor: 'var(--accent-personal)', accentFg: 'var(--accent-personal-fg)' }
      : baseTheme;

  const tags = getEventTags(event, eventType);

  // Stage mode is offered for upcoming gigs and promoted (filled) on gig day.
  const canStage = eventType === 'gig' && !isPast;
  const isGigDay = (() => {
    if (!event.date) return false;
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    return (event.date.includes('T') ? event.date.split('T')[0] : event.date) === todayStr;
  })();
  const secondaryTags = tags.filter((t) => t !== 'GIG' && t !== 'REHEARSAL' && t !== 'QUOTE' && t !== 'DRAFT');
  const memberCount = resolvedMembers.length || event.members?.length || 0;

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
  const loadInTime = event.loadInTime ? formatEventTime(event.loadInTime) : 'TBD';
  const soundCheckTime = event.soundcheckTime ? formatEventTime(event.soundcheckTime) : 'TBD';

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

  // ─── Figma layout helpers (display only) ───
  const heroDate = event.date ? parseLocalDate(event.date) : null;
  const hasHeroDate = !!heroDate && !isNaN(heroDate.getTime());
  const heroDay = hasHeroDate ? String(heroDate!.getDate()).padStart(2, '0') : '--';
  const heroMonth = hasHeroDate
    ? heroDate!.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    : 'TBD';
  const heroDateTime = `${formatEventDateFull(event.date)}${
    showTime !== 'TBD' ? ` · ${showTime}${endTimeFormatted ? `–${endTimeFormatted}` : ''}` : ''
  }`;
  const feeExactValue = isPersonalGig
    ? formatCurrencyExact(event.price)
    : isAdmin
      ? formatCurrencyExact(event.price)
      : myResolvedFee != null
        ? formatCurrencyExact(myResolvedFee)
        : formatCurrencyExact(event.price);
  const payoutTotal = resolvedMembers.reduce((sum, m) => sum + (Number(m.fee) || 0), 0);
  const bandFeeNum = parseFloat(String(event.price ?? '').replace(/[^0-9.]/g, '')) || 0;
  const bandFund = Math.max(0, bandFeeNum - payoutTotal);
  const confirmedExact = resolvedMembers.filter((m) => m.status === 'confirmed').length;
  const songSeconds = setlistSongs.map((s) => parseDurationSeconds(s.duration));
  const totalSongSeconds = songSeconds.reduce((a, b) => a + b, 0);
  const maxSongSeconds = Math.max(0, ...songSeconds);
  const showSetFlow = numSongs >= 2 && numSongs <= 24 && maxSongSeconds > 0;
  const chatLabel = eventType === 'rehearsal' ? 'REHEARSAL CHAT' : 'EVENT CHAT';
  const showRsvpCard = !isPast && !isPersonalGig && isPending && !!onAccept && !!onDecline;
  const heroChipStyle: React.CSSProperties = { backgroundColor: theme.accentFg, color: theme.accentColor };
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
      label: 'Open stage mode',
      icon: <Play />,
      pane: true,
      prominent: isGigDay,
    },
  );
  const heroTintStyle: React.CSSProperties = {
    backgroundColor: 'color-mix(in srgb, currentColor 14%, transparent)',
  };
  const notesTitle = event.clientName && !isPersonalGig ? 'CLIENT & NOTES' : 'NOTES';
  const notesRows: { label: string; value: string }[] = [];
  if (event.clientName && !isPersonalGig) notesRows.push({ label: 'Client', value: event.clientName });
  if (subTypeEyebrow) notesRows.push({ label: 'Event type', value: subTypeEyebrow });
  if (eventType === 'rehearsal') notesRows.push({ label: 'Cadence', value: getRehearsalCadence(event) });
  if (eventType !== 'rehearsal' && event.indoorOutdoor)
    notesRows.push({ label: 'Setting', value: event.indoorOutdoor.toUpperCase() });
  if (event.guests) notesRows.push({ label: 'Guests', value: `${event.guests} PAX` });

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
        Confirm delete
      </PillButton>
      <button onClick={onCancel} className={LINK_CLASS}>
        CANCEL
      </button>
    </div>
  );

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
        className="bw-pane-detail fixed inset-0 z-[90] flex flex-col overflow-hidden bg-background text-foreground select-none"
        // iPhone Duo: the event colour runs under the rail (Figma "Event detail").
        style={railChrome ? { backgroundColor: theme.accentColor } : undefined}
      >
        {/* Status-bar scrim: keeps scrolled content off the clock once the hero is gone */}
        <div
          ref={scrimRef}
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 z-10 bg-background/85 backdrop-blur-md transition-opacity duration-200',
            heroUnderBar ? 'opacity-0' : 'opacity-100',
          )}
          style={{ height: 'var(--safe-top)' }}
        />
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" onScroll={handleScroll}>
          {/* ═══ HERO (event colour, full-bleed) ═══ */}
          <header
            ref={heroRef}
            className="w-full"
            style={{ backgroundColor: theme.accentColor, color: theme.accentFg }}
          >
            <div
              className="max-w-[640px] mx-auto w-full px-4 pb-14 flex flex-col gap-3"
              style={{ paddingTop: 'calc(var(--wizard-header-pt, max(var(--safe-top), 44px)) + 4px)' }}
            >
              {/* Top bar: back + stage mode */}
              <div className="flex items-center justify-between gap-2 h-11 -mt-1 empty:hidden">
                <NavBackButton pane variant="event" size="sm" onClick={onClose} />
                {canStage && !stageInRail && (
                  <button
                    type="button"
                    onClick={() => {
                      haptic.medium();
                      setIsStageOpen(true);
                    }}
                    aria-label="Open stage mode"
                    title="Stage mode"
                    className="w-11 h-11 -mr-2.5 ml-auto rounded-full flex items-center justify-center shrink-0 active:scale-[var(--press-scale)] transition-transform cursor-pointer"
                    style={isGigDay ? heroChipStyle : undefined}
                  >
                    <Play className="w-6 h-6" />
                  </button>
                )}
              </div>

              {/* Chips + title | dot-matrix date */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span
                      className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center whitespace-nowrap"
                      style={heroChipStyle}
                    >
                      {isPast ? `PAST ${eventType.toUpperCase()}` : eventType.toUpperCase()}
                    </span>
                    {secondaryTags.map((tag, i) => (
                      <span
                        key={i}
                        className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center whitespace-nowrap"
                        style={heroChipStyle}
                      >
                        {tag}
                      </span>
                    ))}
                    {isPast ? (
                      <span
                        className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center gap-1 whitespace-nowrap"
                        style={heroChipStyle}
                      >
                        <Check className="w-3 h-3" />
                        COMPLETED
                      </span>
                    ) : !isPersonalGig && eventType !== 'quote' && eventType !== 'draft' ? (
                      <span
                        className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center gap-1 whitespace-nowrap"
                        style={heroChipStyle}
                      >
                        {isPending ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                            INVITE PENDING
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3" />
                            ACCEPTED
                          </>
                        )}
                      </span>
                    ) : null}
                    {subTypeEyebrow && (
                      <span
                        className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center whitespace-nowrap"
                        style={heroTintStyle}
                      >
                        {subTypeEyebrow}
                      </span>
                    )}
                    {isPersonalGig ? (
                      <span
                        className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center whitespace-nowrap"
                        style={heroTintStyle}
                      >
                        PERSONAL
                      </span>
                    ) : event.band_name ? (
                      <span
                        className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center truncate max-w-[140px]"
                        style={heroTintStyle}
                      >
                        {event.band_name}
                      </span>
                    ) : null}
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
                    label={hasHeroDate ? formatEventDateFull(event.date) : 'Date TBD'}
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
                    title={hasValidLocation ? `Open ${fullLocationQuery} in Maps` : 'Venue TBD'}
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
                      {venueName}
                    </span>
                    {hasValidLocation && (
                      <span className="inline-flex items-center gap-0.5 shrink-0 px-1.5 h-[18px] rounded-full border border-current/40 bw-label-xs opacity-80">
                        MAP
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
                        {eventType === 'gig' && !isPersonalGig ? 'ATTENDANCE' : 'STATUS'}
                      </span>
                      <span className="bw-label-md">
                        {memberCount > 0 && !isPersonalGig ? `${memberCount} MEMBERS` : 'ARCHIVED'}
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
            </div>
          </header>

          {/* ═══ CONTENT SHEET ═══ */}
          <div className="relative -mt-8 rounded-t-[32px] bg-background">
            <div
              className="max-w-[640px] mx-auto w-full px-4 pt-6 flex flex-col gap-6"
              style={{ paddingBottom: 'calc(var(--safe-bottom) + 48px)' }}
            >
              {/* ─── RSVP (pending invite) ─── */}
              {showRsvpCard && (
                <section className="dark bg-sheet text-sheet-foreground rounded-[16px] p-5 flex flex-col gap-4">
                  <span className="bw-label-sm">Your RSVP</span>
                  <h2 className="bw-h1">{eventType === 'rehearsal' ? 'Are you coming?' : 'Are you in?'}</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <PillButton variant="primary" size="md" onClick={handleAccept} disabled={isSubmitting}>
                      <Check className="w-4 h-4" />
                      {isSubmitting ? '...' : eventType === 'rehearsal' ? 'GOING' : 'ACCEPT'}
                    </PillButton>
                    <PillButton variant="white" size="md" onClick={handleDecline} disabled={isSubmitting}>
                      {eventType === 'rehearsal' ? "CAN'T" : 'DECLINE'}
                    </PillButton>
                  </div>
                </section>
              )}

              {/* ─── TIME TILES ─── */}
              <div className="grid grid-cols-3 gap-2">
                {eventType === 'gig' ? (
                  <>
                    <TimeTile label="LOAD IN" value={loadInTime} />
                    <TimeTile label="SOUNDCHECK" value={soundCheckTime} />
                    <TimeTile label="SHOW" value={showTime} />
                  </>
                ) : eventType === 'rehearsal' ? (
                  <>
                    <TimeTile label="START" value={showTime} />
                    <TimeTile label="END" value={endTimeFormatted || 'TBD'} />
                    <TimeTile label="ROOM / VENUE" value={venueName} text />
                  </>
                ) : (
                  <>
                    <TimeTile label="SHOW TIME" value={showTime} />
                    <TimeTile label="SETTING" value={event.indoorOutdoor?.toUpperCase() || 'INDOOR'} text />
                    <TimeTile
                      label={event.guests ? 'GUESTS' : 'STATUS'}
                      value={event.guests ? `${event.guests} PAX` : (event.quoteStatus || eventType).toUpperCase()}
                      text
                    />
                  </>
                )}
              </div>

              {/* ─── FEE (band gig / quote / draft) ─── */}
              {eventType !== 'rehearsal' && !isPersonalGig && (
                <section className="dark bg-sheet text-sheet-foreground rounded-[16px] p-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="bw-label-sm">{feeCardLabel}</span>
                    <DotText text={feeExactValue} size={32} label={feeExactValue} />
                  </div>
                  {isAdmin && (resolvedMembers.length > 0 || (myResolvedFee != null && myResolvedFee > 0)) && (
                    <div className="flex flex-col gap-3">
                      {resolvedMembers.length > 0 && (
                        <KeyValueRow
                          label={`Musician payouts (${resolvedMembers.length})`}
                          value={formatCurrencyExact(payoutTotal)}
                        />
                      )}
                      {resolvedMembers.length > 0 && bandFund > 0 && (
                        <KeyValueRow label="Band fund" value={formatCurrencyExact(bandFund)} />
                      )}
                      {myResolvedFee != null && myResolvedFee > 0 && (
                        <KeyValueRow label="Your share" value={formatCurrencyExact(myResolvedFee)} />
                      )}
                    </div>
                  )}
                  <PillButton variant="primary" size="md"
                    type="button"
                    onClick={() => setActiveSheet('fee')}
>
                    {isAdmin ? 'FEE & PAYOUTS' : 'PAYOUT DETAILS'}
                    <ArrowUpRight className="w-4 h-4" />
                  </PillButton>
                </section>
              )}

              {/* ─── EARNINGS (personal gig) ─── */}
              {isPersonalGig && eventType !== 'rehearsal' && (
                <section className="flex flex-col gap-6">
                  <SectionTitle title="EARNINGS" />
                  <div className="bg-card rounded-[16px] p-4 flex flex-col gap-3">
                    <KeyValueRow label="My fee" value={formatCurrencyExact(event.price)} muted />
                  </div>
                </section>
              )}

              {/* ─── LINEUP / ATTENDANCE ─── */}
              {!isPersonalGig && (
                <section className="flex flex-col gap-6">
                  <SectionTitle
                    title={`${eventType === 'rehearsal' ? 'ATTENDANCE' : 'LINEUP'}${
                      memberCount > 0 ? ` · ${confirmedExact}/${memberCount}` : ''
                    }`}
                    actionLabel="DETAILS"
                    onAction={() => setActiveSheet('lineup')}
                  />
                  <div className="bg-card rounded-[16px] p-4 flex flex-col gap-4">
                    {resolvedMembers.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setActiveSheet('lineup')}
                        className="flex flex-col gap-4 text-left cursor-pointer"
                        aria-label="Open lineup details"
                      >
                        {resolvedMembers.slice(0, 6).map((m, i) => (
                          <MemberRow key={m.userId || i} member={m} />
                        ))}
                        {resolvedMembers.length > 6 && (
                          <span className="bw-label-xs text-muted-foreground pl-14">
                            + {resolvedMembers.length - 6} MORE
                          </span>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveSheet('lineup')}
                        className="flex items-center justify-between gap-3 text-left cursor-pointer"
                      >
                        <span className="bw-body-sm text-muted-foreground">No team assigned yet</span>
                        <span className="bw-label-xs inline-flex items-center gap-1.5 text-warning">
                          <span className="w-2 h-2 rounded-full bg-warning" />
                          UNASSIGNED
                        </span>
                      </button>
                    )}
                    {isAdmin && !isPast && onEdit && eventType !== 'rehearsal' && (
                      <PillButton variant="outline" size="md" type="button"
                        onClick={onEdit}>
                        <Plus className="w-4 h-4" />
                        EDIT LINEUP
                      </PillButton>
                    )}
                  </div>
                </section>
              )}

              {/* ─── SETLIST (gig / draft) ─── */}
              {!isPersonalGig && eventType !== 'quote' && eventType !== 'rehearsal' && (
                <section className="flex flex-col gap-6">
                  <SectionTitle
                    title="SETLIST"
                    actionLabel={setlistLoading ? '...' : `${numSongs} ${numSongs === 1 ? 'SONG' : 'SONGS'}`}
                    onAction={() => setActiveSheet('setlist')}
                  />
                  <button
                    type="button"
                    onClick={() => setActiveSheet('setlist')}
                    className="bg-card rounded-[16px] p-4 flex flex-col gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    {setlistLoading ? (
                      <span className="bw-label-sm text-muted-foreground">LOADING SETLIST…</span>
                    ) : numSongs === 0 ? (
                      <span className="flex items-center justify-between gap-3 w-full">
                        <span className="bw-label-sm text-warning inline-flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          NO SETLIST ASSIGNED
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                      </span>
                    ) : (
                      <>
                        {showSetFlow && (
                          <span className="flex flex-col gap-2 w-full pb-3 border-b border-border">
                            <SetFlow seconds={songSeconds} max={maxSongSeconds} />
                            <span className="flex items-center justify-between bw-label-xs text-muted-foreground">
                              <span>SET FLOW · LENGTH</span>
                              <span>OPENER → ENCORE</span>
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
                              numSongs > 3 ? `+ ${numSongs - 3} MORE` : '',
                              totalSongSeconds > 0 ? `${formatTotalDuration(totalSongSeconds)} TOTAL` : '',
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

              {/* ─── SONGS TO PLAY (rehearsal) ─── */}
              {eventType === 'rehearsal' && !isPersonalGig && (
                <section className="flex flex-col gap-6">
                  <SectionTitle
                    title="SONGS TO PLAY"
                    actionLabel={setlistLoading ? '...' : 'SETLIST'}
                    onAction={() => setActiveSheet('setlist')}
                  />
                  {setlistLoading ? (
                    <span className="bw-label-sm text-muted-foreground">LOADING…</span>
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
                          + {numSongs - 8} MORE
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveSheet('setlist')}
                      className="bg-card rounded-[16px] p-4 text-left bw-body-sm text-muted-foreground cursor-pointer"
                    >
                      No songs picked for this rehearsal yet.
                    </button>
                  )}
                </section>
              )}

              {/* ─── CLIENT & NOTES ─── */}
              <section className="flex flex-col gap-6">
                <SectionTitle title={notesTitle} actionLabel="DETAILS" onAction={() => setActiveSheet('notes')} />
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
                        ? 'No personal notes added for this gig.'
                        : 'No notes added yet.')}
                  </span>
                </button>
              </section>

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
                      <PillButton variant="outline" size="lg"
                        onClick={() => setActiveSheet('setlist')}
>
                        <Music className="w-4 h-4" />
                        VIEW SETLIST
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
                            EDIT DETAILS
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className={cn(LINK_CLASS, 'text-destructive-solid hover:text-destructive-solid')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            REMOVE FROM ARCHIVE
                          </button>
                        </div>
                      ))}
                  </>
                ) : isPersonalGig ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 w-full">
                      <PillButton variant="outline" size="lg" onClick={onEdit}>
                        <Pencil className="w-4 h-4" />
                        EDIT GIG
                      </PillButton>
                      <PillButton variant="danger" size="lg"
                        onClick={() => setShowDeleteConfirm(true)}
                        aria-label={theme.deleteLabel}
>
                        <Trash2 className="w-4 h-4" />
                        DELETE GIG
                      </PillButton>
                    </div>
                    {showDeleteConfirm && renderDeleteConfirm(() => setShowDeleteConfirm(false))}
                  </>
                ) : showRsvpCard ? null : isAdmin ? (
                  eventType === 'quote' ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 w-full">
                        <PillButton variant="outline" size="lg"
                          onClick={() => {
                            if (onShareQuote) onShareQuote(event);
                            else setIsShareQuoteOpen(true);
                          }}
>
                          <Share2 className="w-4 h-4" />
                          SHARE QUOTE
                        </PillButton>
                        <PillButton variant="primary" size="lg" onClick={handleConfirmQuote}
                          disabled={isConfirming}>
                          <Check className="w-4 h-4" />
                          {isConfirming ? '...' : 'CONFIRM AS GIG'}
                        </PillButton>
                      </div>
                      {showDeleteConfirm ? (
                        renderDeleteConfirm(() => setShowDeleteConfirm(false))
                      ) : (
                        <div className="flex items-center gap-5">
                          <button onClick={onEdit} className={LINK_CLASS}>
                            <Pencil className="w-3.5 h-3.5" />
                            EDIT QUOTE
                          </button>
                          <button onClick={onChat} className={LINK_CLASS}>
                            <MessageSquare className="w-3.5 h-3.5" />
                            CHAT
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            aria-label={theme.deleteLabel}
                            className={cn(LINK_CLASS, 'text-destructive-solid hover:text-destructive-solid')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            DELETE
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 w-full">
                        <PillButton variant="outline" size="lg" onClick={onEdit}>
                          <Pencil className="w-4 h-4" />
                          EDIT
                        </PillButton>
                        <PillButton variant="dark" size="lg" onClick={onChat}>
                          <MessageSquare className="w-4 h-4" />
                          {chatLabel}
                        </PillButton>
                      </div>
                      {showDeleteConfirm ? (
                        renderDeleteConfirm(() => setShowDeleteConfirm(false))
                      ) : (
                        <div className="flex items-center gap-5">
                          {onRevertQuote && (
                            <button onClick={handleRevertQuote} disabled={isReverting} className={LINK_CLASS}>
                              <RotateCcw className="w-3.5 h-3.5" />
                              {isReverting ? 'REVERTING...' : 'REVERT TO QUOTE'}
                            </button>
                          )}
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            aria-label={theme.deleteLabel}
                            className={cn(LINK_CLASS, 'text-destructive-solid hover:text-destructive-solid')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            DELETE
                          </button>
                        </div>
                      )}
                    </>
                  )
                ) : (
                  /* MEMBER VIEW (Accepted) */
                  <>
                    <div className="grid grid-cols-2 gap-3 w-full">
                      <PillButton variant="outline" size="lg"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={isSubmitting}
>
                        {isSubmitting ? '...' : 'DROP OUT'}
                      </PillButton>
                      <PillButton variant="dark" size="lg" onClick={onChat}>
                        <MessageSquare className="w-4 h-4" />
                        {chatLabel}
                      </PillButton>
                    </div>
                    {showDeleteConfirm && (
                      <div className="flex items-center gap-3">
                        <span className="bw-label-sm text-muted-foreground">Drop out?</span>
                        <PillButton
                          size="sm"
                          fullWidth={false}
                          className="bg-destructive-solid text-white"
                          onClick={handleDecline}
                          loading={isSubmitting}
                        >
                          Confirm drop
                        </PillButton>
                        <button onClick={() => setShowDeleteConfirm(false)} className={LINK_CLASS}>
                          CANCEL
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
        <BwSheet
          open={!!activeSheet}
          onClose={() => setActiveSheet(null)}
          closeLabel="Close sheet"
          zIndex={110}
          overline={activeSheet === 'fee' && isAdmin ? 'Admin only' : event.title}
          title={
            <>
              {activeSheet === 'fee' && 'Fee & payouts'}
              {activeSheet === 'setlist' && `Setlist · ${numSongs}`}
              {activeSheet === 'lineup' && `Lineup · ${memberCount}`}
              {activeSheet === 'notes' && 'Logistics & notes'}
            </>
          }
        >
                <div className="dark flex flex-col gap-3">
                  {activeSheet === 'fee' && (
                    <>
                      <div className="flex items-end justify-between gap-3 pb-2">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="bw-label-sm">
                            {isAdmin ? 'Band total fee' : 'Your assigned fee'}
                          </span>
                          <DotText
                            text={
                              isAdmin
                                ? formatCurrencyExact(event.price)
                                : formatCurrencyExact(myResolvedFee ?? event.price)
                            }
                            size={32}
                          />
                        </div>
                        {myResolvedFee != null && isAdmin && (
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="bw-label-sm text-muted-foreground">Your share</span>
                            <span className="bw-label-md">{formatCurrencyExact(myResolvedFee)}</span>
                          </div>
                        )}
                        {isAdmin && onEdit && (
                          <IconButton
                            label="Edit fee"
                            variant="sheet"
                            size="sm"
                            icon={<Pencil />}
                            onClick={() => {
                              setActiveSheet(null);
                              onEdit();
                            }}
                          />
                        )}
                      </div>

                      {isAdmin && resolvedMembers.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <span className="bw-label-sm text-muted-foreground">Member payout split</span>
                          {resolvedMembers.map((m, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-3 rounded-full bg-foreground/[0.08] pl-2 pr-4 py-2"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center bw-label-sm shrink-0">
                                  {m.initials}
                                </span>
                                <span className="bw-label-sm truncate">
                                  {m.name} · {m.role}
                                </span>
                              </div>
                              <span className="bw-label-md shrink-0">{formatCurrencyExact(m.fee)}</span>
                            </div>
                          ))}
                          {bandFund > 0 && (
                            <div className="flex items-center justify-between gap-3 rounded-full border-[1.5px] border-foreground/30 pl-4 pr-4 py-2 min-h-12">
                              <span className="bw-label-sm">Band fund</span>
                              <span className="bw-label-md shrink-0">{formatCurrencyExact(bandFund)}</span>
                            </div>
                          )}
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
                                {song.key && (
                                  <Tag variant="subtle">{song.key}</Tag>
                                )}
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
                          <p className="bw-h3">No setlist assigned</p>
                          <p className="bw-body-sm text-muted-foreground max-w-[260px]">
                            {isAdmin
                              ? 'Tap Edit to assign songs or a setlist to this event.'
                              : 'The band admin has not attached a setlist yet.'}
                          </p>
                          {isAdmin && onEdit && (
                            <PillButton variant="primary" size="md" fullWidth={false} className="mt-1"
                              onClick={() => {
                                setActiveSheet(null);
                                onEdit();
                              }}
                            >
                              Assign setlist
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
                              key={i}
                              className="flex items-center justify-between gap-3 rounded-[16px] bg-foreground/[0.08] px-3 py-3"
                            >
                              <MemberRow member={m} />
                              {(isAdmin || m.userId === currentUserId) && m.fee > 0 && (
                                <span className="bw-label-md shrink-0">{formatCurrencyExact(m.fee)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center bw-body-sm text-muted-foreground">
                          No members assigned to this event yet.
                        </div>
                      )}
                    </>
                  )}

                  {activeSheet === 'notes' && (
                    <div className="flex flex-col gap-3">
                      {/* Venue & address */}
                      <div className="rounded-[16px] bg-foreground/[0.08] p-4 flex flex-col gap-3">
                        <div className="min-w-0 flex flex-col gap-1">
                          <span className="bw-label-sm text-muted-foreground">Venue & location</span>
                          <span className="bw-label-md truncate">{venueName}</span>
                          {venueAddress && (
                            <span className="bw-body-sm text-muted-foreground truncate">{venueAddress}</span>
                          )}
                        </div>
                        {hasValidLocation && (
                          <div className="grid grid-cols-2 gap-2">
                            <PillButton variant="outline" size="sm" onClick={handleCopyAddress}
                              title="Copy address">
                              <Copy className="w-3.5 h-3.5" />
                              {copiedAddress ? 'Copied' : 'Copy'}
                            </PillButton>
                            <PillButton variant="primary" size="sm" onClick={handleOpenMaps}>
                              Maps
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </PillButton>
                          </div>
                        )}
                      </div>

                      {/* Client & event metadata */}
                      {(event.clientName || event.guests || event.indoorOutdoor) && (
                        <div className="rounded-[16px] bg-foreground/[0.08] p-4 flex flex-col gap-3">
                          {event.clientName && <KeyValueRow label="Client" value={event.clientName} muted />}
                          <KeyValueRow
                            label={event.guests ? 'Setting · Guests' : 'Setting'}
                            value={`${event.indoorOutdoor?.toUpperCase() || 'INDOOR'}${
                              event.guests ? ` · ${event.guests} PAX` : ''
                            }`}
                            muted
                          />
                        </div>
                      )}

                      {/* Notes */}
                      <div className="rounded-[16px] bg-foreground/[0.08] p-4 flex flex-col gap-2">
                        <span className="bw-label-sm text-muted-foreground">Notes</span>
                        <p className="bw-body-md whitespace-pre-wrap select-text">
                          {event.notes || 'No additional notes recorded for this event.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
        </BwSheet>
      </motion.div>

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

      <AnimatePresence>
        {isStageOpen && (
          <StageMode
            title={event.title}
            venue={venueName !== 'TBD' ? venueName : undefined}
            dateLabel={formatEventDateShort(event.date)}
            date={event.date}
            accentColor="var(--accent-gig)"
            steps={[
              { label: 'Load in', time: event.loadInTime, display: loadInTime },
              { label: 'Soundcheck', time: event.soundcheckTime, display: soundCheckTime },
              { label: 'Show', time: event.time, display: showTime },
              { label: 'End', time: event.endTime, display: endTimeFormatted || 'TBD' },
            ]}
            songs={setlistSongs}
            songsLoading={setlistLoading}
            onClose={() => setIsStageOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};
