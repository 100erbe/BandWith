import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Minus, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, ArrowRight, ArrowUpRight, AlertCircle, Music, Folder, Check } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { DotRadio } from '@/app/components/ui/DotRadio';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { SongPicker, type PickedSong } from '@/app/components/ui/SongPicker';
import { WizardAccentRail, getEventAccentColor } from '@/app/components/ui/WizardAccentRail';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { TimePicker } from '@/app/components/ui/TimePicker';
import { RehearsalCreationWizard } from '@/app/components/rehearsal/RehearsalCreationWizard';
import { useBand } from '@/lib/BandContext';
import { getSongs, getSetlists, getSetlist, type Song, type Setlist, type SetlistWithSongs } from '@/lib/services/songs';
import { supabase } from '@/lib/supabase';
import { getBandPricing, DEFAULT_BAND_PRICING, type BandPricingSettings } from '@/lib/services/pricing';

interface TaskTemplate {
  id: string;
  name: string;
  category: string;
  tasks: { id: string; title: string; dueOffset: number; required: boolean }[];
}

export interface BandMember {
  id: string;
  user_id: string;
  name: string;
  role: string;
  fee: string;
  initials: string;
}

type EventType = 'gig' | 'wedding' | 'corporate' | 'private' | 'festival' | 'club' | 'other' | 'rehearsal';
type PerformanceType = 'full_band' | 'duo' | 'trio' | 'solo' | 'dj_set' | 'acoustic' | 'karaoke';
type SettingType = 'indoor' | 'outdoor';

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'wedding', label: 'WEDDING' },
  { value: 'corporate', label: 'CORPORATE' },
  { value: 'private', label: 'PRIVATE' },
  { value: 'festival', label: 'FESTIVAL' },
  { value: 'club', label: 'CLUB' },
  { value: 'other', label: 'OTHER' },
];

const PERFORMANCE_TYPES: { value: PerformanceType; label: string }[] = [
  { value: 'full_band', label: 'FULL BAND' },
  { value: 'duo', label: 'DUO' },
  { value: 'trio', label: 'TRIO' },
  { value: 'solo', label: 'SOLO' },
  { value: 'dj_set', label: 'DJ SET' },
  { value: 'acoustic', label: 'ACOUSTIC' },
  { value: 'karaoke', label: 'KARAOKE' },
];

const STEPS = [
  { id: 'type', label: 'STEP 01', title: 'EVENT TYPE', subtitle: 'CLICK TO SELECT', skippable: false },
  { id: 'details', label: 'STEP 02', title: 'DATE &\nLOCATION', subtitle: 'BUILD YOUR QUOTE', skippable: false },
  { id: 'team', label: 'STEP 03', title: 'TEAM & PAY', subtitle: 'OPTIONAL', skippable: true },
  { id: 'overview', label: 'STEP 04', title: 'DETAILS', subtitle: 'REVIEW & CREATE', skippable: false },
];

const DAYS_OF_WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const DURATION_15M_OPTIONS = [
  15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 270, 300, 360
];

export const formatDurationOption = (m: number): string => {
  if (m < 60) return `${m}m`;
  const hrs = Math.floor(m / 60);
  const mins = m % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

interface CreateEventModalProps {
  onClose: () => void;
  onCreate: (eventData: any) => void;
  initialType?: EventType | null;
  layoutId?: string;
  bandMembers?: BandMember[];
  currentUserId?: string;
  editingEvent?: {
    id: number;
    eventId?: string;
    title: string;
    status: string;
    date: string;
    time: string;
    location: string;
    price: string;
    clientName?: string;
    venueAddress?: string;
    venueCity?: string;
    guests?: number;
    notes?: string;
    endTime?: string;
    loadInTime?: string;
    soundcheckTime?: string;
    eventType?: string;
    members?: string[];
    memberUserIds?: string[];
    memberFeeMap?: Record<string, string>;
  } | null;
}

// --- Interactive Step Indicator ---
const InteractiveStepIndicator: React.FC<{
  current: number;
  total: number;
  steps: { id: string; label: string; title: string }[];
  maxAccessibleStep: number;
  onSelectStep: (step: number) => void;
  activeColor?: string;
  inactiveColor?: string;
}> = ({ current, total, steps, maxAccessibleStep, onSelectStep, activeColor, inactiveColor }) => (
  <div className="flex items-center gap-1.5 w-full">
    {Array.from({ length: total }).map((_, i) => {
      const isCurrent = i === current;
      const isAccessible = i <= maxAccessibleStep;
      return (
        <button
          key={i}
          type="button"
          onClick={() => isAccessible && onSelectStep(i)}
          disabled={!isAccessible}
          aria-label={`Step ${i + 1}: ${steps[i]?.title?.replace('\n', ' ') || ''}`}
          className={cn(
            'group flex-1 py-1 flex flex-col items-center justify-center transition-all',
            isAccessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-35'
          )}
        >
          <div
            className={cn(
              'h-1.5 w-full rounded-full transition-all duration-300',
              isCurrent ? 'h-2' : 'group-hover:opacity-80'
            )}
            style={{
              backgroundColor: isCurrent
                ? (activeColor || 'var(--foreground)')
                : isAccessible
                  ? (activeColor || 'var(--foreground)')
                  : (inactiveColor || 'var(--border)'),
              opacity: isCurrent ? 1 : isAccessible ? 0.4 : 0.15,
            }}
          />
          <div className="flex items-center gap-1 mt-1">
            <span
              className={cn(
                'text-[9px] font-bold tracking-wider uppercase transition-colors whitespace-nowrap',
                isCurrent ? 'text-foreground' : 'text-foreground/40 group-hover:text-foreground/70'
              )}
            >
              {steps[i]?.label}
            </span>
          </div>
        </button>
      );
    })}
  </div>
);

// --- Calendar Grid ---
const CalendarGrid: React.FC<{
  selectedDate: string;
  onSelectDate: (date: string) => void;
  isDark?: boolean;
}> = ({ selectedDate, onSelectDate, isDark }) => {
  const [viewDate, setViewDate] = useState(() => {
    const d = selectedDate ? new Date(selectedDate) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedD = selectedDate ? new Date(selectedDate) : null;
  const isSelected = (day: number) =>
    selectedD && selectedD.getFullYear() === year && selectedD.getMonth() === month && selectedD.getDate() === day;

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider block text-foreground/50">EVENT DATE</span>
          <span className="text-[22px] font-bold uppercase text-foreground">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 rounded-full border border-foreground/20 flex items-center justify-center text-foreground hover:bg-foreground/10 transition-colors">
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <button onClick={nextMonth} className="w-8 h-8 rounded-full border border-foreground/20 flex items-center justify-center text-foreground hover:bg-foreground/10 transition-colors">
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DAYS_OF_WEEK.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold py-1 text-foreground/40">{d}</div>
        ))}
        {cells.map((day, i) => (
          <button
            key={i}
            disabled={!day}
            onClick={() => {
              if (day) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                onSelectDate(dateStr);
              }
            }}
            className={cn(
              'aspect-square rounded-full flex items-center justify-center text-sm font-bold transition-all',
              !day && 'invisible',
              day && isSelected(day)
                ? 'bg-foreground text-background'
                : 'text-foreground hover:bg-foreground/10'
            )}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  );
};

// --- Accordion Card for Editing ---
const AccordionCard: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  stepNumber: string;
  title: string;
  summary: string;
  hasWarning?: boolean;
  warningLabel?: string;
  children: React.ReactNode;
}> = ({ isOpen, onToggle, stepNumber, title, summary, hasWarning, warningLabel = 'NEEDS ATTENTION', children }) => {
  return (
    <div className={cn(
      'rounded-[16px] border transition-all overflow-hidden',
      hasWarning
        ? 'border-[var(--warning)]/50 bg-[var(--warning)]/5'
        : isOpen
          ? 'border-foreground/20 bg-foreground/[0.02]'
          : 'border-foreground/10 bg-transparent hover:border-foreground/15'
    )}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors"
      >
        <div className="flex flex-col gap-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">{stepNumber}</span>
            <span className="text-[15px] font-bold uppercase text-foreground">{title}</span>
            {hasWarning && (
              <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-[var(--warning)]/15 text-[var(--warning)] flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {warningLabel}
              </span>
            )}
          </div>
          <span className="text-[11px] font-bold uppercase text-foreground/45 truncate">
            {summary}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 w-8 h-8 rounded-full border border-foreground/10 flex items-center justify-center text-foreground/60"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-2 border-t border-foreground/10 flex flex-col gap-6">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  onClose, onCreate, initialType, bandMembers = [], currentUserId, editingEvent,
}) => {
  const isEditing = !!editingEvent;
  const { selectedBand, isAdmin } = useBand();

  const editingWarnings = useMemo(() => {
    if (!editingEvent) return [];
    const w: string[] = [];
    if (!editingEvent.location || editingEvent.location === 'TBD') w.push('venue');
    if (!editingEvent.date) w.push('date');
    const type = editingEvent.eventType?.toLowerCase();
    if (type !== 'rehearsal' && (!editingEvent.price || editingEvent.price === '0')) w.push('fee');
    const hasMembers = (editingEvent.memberUserIds?.length ?? 0) > 0 || (editingEvent.members?.length ?? 0) > 0;
    if (!hasMembers) w.push('members');
    return w;
  }, [editingEvent]);

  const firstWarningStep = useMemo(() => {
    if (editingWarnings.length === 0) return 1;
    const step1Warnings = ['venue', 'date', 'time'];
    const step2Warnings = ['fee', 'members'];
    if (editingWarnings.some(w => step1Warnings.includes(w))) return 1;
    if (editingWarnings.some(w => step2Warnings.includes(w))) return 2;
    return 1;
  }, [editingWarnings]);

  const [step, setStep] = useState(0);
  const [songsView, setSongsView] = useState(false);
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [songPickerTargetSet, setSongPickerTargetSet] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Accordion state for Edit mode
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      basics: false,
      date_venue: false,
      team_pay: false,
      setlist_tasks: false,
    };
    if (editingWarnings.some(w => ['fee', 'members'].includes(w))) {
      initial.team_pay = true;
    } else if (editingWarnings.some(w => ['venue', 'date', 'time'].includes(w))) {
      initial.date_venue = true;
    } else {
      initial.date_venue = true;
    }
    return initial;
  });

  const toggleEditSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [librarySongs, setLibrarySongs] = useState<Song[]>([]);
  const [savedSetlists, setSavedSetlists] = useState<Setlist[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  useEffect(() => {
    if (!selectedBand?.id) return;
    const fetchLibrary = async () => {
      setLoadingLibrary(true);
      const [songsRes, setlistsRes, taskTplRes] = await Promise.all([
        getSongs(selectedBand.id),
        getSetlists(selectedBand.id),
        supabase.from('task_templates').select('*').eq('band_id', selectedBand.id).order('created_at', { ascending: false }),
      ]);
      if (songsRes.data) setLibrarySongs(songsRes.data);
      if (setlistsRes.data) setSavedSetlists(setlistsRes.data);
      if (taskTplRes.data) setTaskTemplates(taskTplRes.data);
      setLoadingLibrary(false);
    };
    fetchLibrary();
  }, [selectedBand?.id]);

  const MEMBERS = useMemo(() => bandMembers || [], [bandMembers]);
  const currentUserMember = useMemo(() => MEMBERS.find(m => m.user_id === currentUserId), [MEMBERS, currentUserId]);
  const currentUserMemberId = currentUserMember?.id || currentUserId || '';

  // --- Pricing Settings ---
  const [pricingSettings, setPricingSettings] = useState<BandPricingSettings>(DEFAULT_BAND_PRICING);

  const currencySymbol = useMemo(() => {
    if (pricingSettings.currency === 'USD') return '$';
    if (pricingSettings.currency === 'GBP') return '£';
    return '€';
  }, [pricingSettings.currency]);

  const getAutoFeeForMember = useCallback(
    (
      memberId: string,
      currentSelected: string[],
      settings: BandPricingSettings = pricingSettings,
      memberObj?: BandMember
    ): string => {
      const member = memberObj || MEMBERS.find((m) => m.id === memberId || m.user_id === memberId);
      if (member?.fee && parseFloat(member.fee) > 0) {
        return member.fee;
      }
      const idx = currentSelected.includes(memberId)
        ? currentSelected.indexOf(memberId)
        : currentSelected.length;
      const isCore = idx < (settings.core_members_count ?? 1);
      const rate = isCore ? settings.core_member_rate : settings.session_musician_rate;
      return String(rate || (isCore ? 300 : 250));
    },
    [MEMBERS, pricingSettings]
  );

  // --- Form State ---
  const editingType = useMemo<EventType | null>(() => {
    if (!editingEvent) return null;
    if (editingEvent.eventType) return editingEvent.eventType as EventType;
    const s = editingEvent.status?.toUpperCase();
    if (s === 'REHEARSAL') return 'rehearsal';
    if (s === 'QUOTED' || s === 'QUOTE') return 'other';
    return 'other';
  }, [editingEvent]);

  const [eventType, setEventType] = useState<EventType | null>(
    editingType || (initialType === 'rehearsal' ? 'rehearsal' : (initialType as EventType | null) || null)
  );
  const [performanceType, setPerformanceType] = useState<PerformanceType>('full_band');
  const [setting, setSetting] = useState<SettingType>('indoor');
  const [details, setDetails] = useState({
    title: editingEvent?.title || '',
    clientName: editingEvent?.clientName || '',
    venue: editingEvent?.location || '',
    address: editingEvent?.venueAddress || '',
    city: editingEvent?.venueCity || '',
    province: '',
    zip: '',
    country: '',
    date: editingEvent?.date || new Date().toISOString().split('T')[0],
    startTime: editingEvent?.time || '20:00',
    endTime: editingEvent?.endTime || '23:30',
    guests: editingEvent?.guests || 0,
    duration: 120,
    pay: editingEvent?.price || '',
  });
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(!!editingEvent);

  const [selectedMembers, setSelectedMembers] = useState<string[]>(() => {
    if (editingEvent?.memberUserIds?.length) {
      return editingEvent.memberUserIds.map(uid => {
        const member = MEMBERS.find(m => m.user_id === uid);
        return member?.id || uid;
      }).filter(Boolean);
    }
    if (isEditing) return [];
    return currentUserMemberId ? [currentUserMemberId] : [];
  });
  const [memberFees, setMemberFees] = useState<Record<string, string>>(() => {
    if (editingEvent?.memberUserIds?.length && editingEvent.memberFeeMap) {
      const fees: Record<string, string> = {};
      editingEvent.memberUserIds.forEach(uid => {
        const member = MEMBERS.find(m => m.user_id === uid);
        const id = member?.id || uid;
        fees[id] = editingEvent.memberFeeMap?.[uid] || '0';
      });
      return fees;
    }
    if (isEditing) return {};
    if (currentUserMemberId) {
      const m = MEMBERS.find(mem => mem.id === currentUserMemberId || mem.user_id === currentUserMemberId);
      const defaultRate = (m?.fee && parseFloat(m.fee) > 0) ? m.fee : String(DEFAULT_BAND_PRICING.core_member_rate);
      return { [currentUserMemberId]: defaultRate };
    }
    return {};
  });

  // Load Band Pricing Settings and auto-populate fees if not editing
  useEffect(() => {
    if (!selectedBand?.id) return;
    let isCancelled = false;
    getBandPricing(selectedBand.id).then((settings) => {
      if (isCancelled) return;
      setPricingSettings(settings);
      if (!isEditing) {
        if (selectedMembers.length === 0 && currentUserMemberId) {
          setSelectedMembers([currentUserMemberId]);
          const m = MEMBERS.find((mem) => mem.id === currentUserMemberId || mem.user_id === currentUserMemberId);
          const autoFee = (m?.fee && parseFloat(m.fee) > 0) ? m.fee : String(settings.core_member_rate);
          setMemberFees({ [currentUserMemberId]: autoFee });
        } else {
          setMemberFees((prev) => {
            let changed = false;
            const updated = { ...prev };
            selectedMembers.forEach((id, index) => {
              if (!updated[id] || updated[id] === '0') {
                const m = MEMBERS.find((mem) => mem.id === id || mem.user_id === id);
                const isCore = index < (settings.core_members_count ?? 1);
                const rate = (m?.fee && parseFloat(m.fee) > 0)
                  ? m.fee
                  : String(isCore ? settings.core_member_rate : settings.session_musician_rate);
                updated[id] = rate;
                changed = true;
              }
            });
            return changed ? updated : prev;
          });
        }
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [selectedBand?.id, isEditing]);
  const [memberMandatory, setMemberMandatory] = useState<Record<string, boolean>>(() => {
    if (editingEvent?.memberUserIds?.length) {
      const mandatory: Record<string, boolean> = {};
      editingEvent.memberUserIds.forEach(uid => {
        const member = MEMBERS.find(m => m.user_id === uid);
        const id = member?.id || uid;
        mandatory[id] = true;
      });
      return mandatory;
    }
    return currentUserMemberId ? { [currentUserMemberId]: true } : {};
  });

  const [setlist, setSetlist] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState(editingEvent?.notes || '');
  const [extraBandFee, setExtraBandFee] = useState('');

  // Derive the event category (gig / quote / rehearsal) for theming
  const modalCategory: 'gig' | 'quote' | 'rehearsal' =
    initialType === 'rehearsal' || eventType === 'rehearsal' ? 'rehearsal'
    : initialType === ('quote' as any) || editingEvent?.status?.toUpperCase() === 'QUOTE' || editingEvent?.status?.toUpperCase() === 'QUOTED' ? 'quote'
    : 'gig';

  useEffect(() => {
    if (!isAdmin && modalCategory === 'quote') {
      onClose();
    }
  }, [isAdmin, modalCategory, onClose]);

  if (!isAdmin && modalCategory === 'quote') {
    return null;
  }

  const activeAccentColor = useMemo(
    () => getEventAccentColor(eventType, modalCategory),
    [eventType, modalCategory]
  );

  const activeAccentFg = useMemo(() => {
    if (modalCategory === 'rehearsal') return 'var(--accent-rehearsal-fg)';
    if (modalCategory === 'quote') return 'var(--accent-quote-fg)';
    return 'var(--accent-gig-fg)';
  }, [modalCategory]);

  const modalBg = 'var(--bg)';
  const isDarkBg = false;
  const tc = 'text-foreground';
  const tcMuted = 'text-foreground/60';
  const tcFaint = 'text-foreground/30';
  const tcSub = 'text-foreground/40';
  const bcMuted = 'border-foreground/15';
  const bcSolid = 'border-foreground/30';
  const bgPill = 'bg-foreground/10';
  const pillAccent = 'text-foreground';
  const bgPillSelected = 'bg-foreground text-background';
  const bgPillUnselected = 'bg-foreground/10 text-foreground/50';
  const dotActive = activeAccentColor;
  const dotInactive = 'var(--border)';

  const musicianCount = selectedMembers.length;

  const totalPayout = useMemo(() =>
    Object.values(memberFees).reduce((acc, fee) => acc + (parseFloat(fee) || 0), 0),
  [memberFees]);

  const allMemberFeesValid = useMemo(() =>
    selectedMembers.length === 0 || selectedMembers.every(id => memberFees[id] !== undefined && memberFees[id] !== ''),
  [selectedMembers, memberFees]);

  const grandTotalFee = useMemo(() =>
    totalPayout + (parseFloat(extraBandFee) || 0),
  [totalPayout, extraBandFee]);

  const selectedDateObj = useMemo(() => {
    return details.date ? new Date(details.date + 'T00:00:00') : new Date();
  }, [details.date]);

  const formattedDateStr = useMemo(() => {
    if (!details.date) return 'NO DATE';
    return selectedDateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }, [details.date, selectedDateObj]);

  const maxAccessibleStep = useMemo(() => {
    if (isEditing) return STEPS.length - 1;
    if (!eventType) return 0;
    if (!details.date) return 1;
    return STEPS.length - 1;
  }, [isEditing, eventType, details.date]);

  const canQuickSave = useMemo(() => {
    return !isEditing && eventType !== null && !!details.date;
  }, [isEditing, eventType, details.date]);

  // --- Handlers ---
  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleCreate();
  };
  const handleBack = () => {
    const minStep = isEditing ? 1 : 0;
    if (step > minStep) setStep(step - 1);
  };

  const toggleMember = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      if (memberId === currentUserMemberId) return;
      setSelectedMembers(prev => prev.filter(id => id !== memberId));
      const newFees = { ...memberFees };
      delete newFees[memberId];
      setMemberFees(newFees);
    } else {
      const nextSelected = [...selectedMembers, memberId];
      setSelectedMembers(nextSelected);
      const autoFee = getAutoFeeForMember(memberId, selectedMembers, pricingSettings);
      setMemberFees(prev => ({ ...prev, [memberId]: autoFee }));
    }
  };

  const updateFee = useCallback((memberId: string, amount: string) => {
    setMemberFees(prev => ({ ...prev, [memberId]: amount }));
  }, []);

  const adjustMusicians = (delta: number) => {
    if (delta > 0 && MEMBERS.length > selectedMembers.length) {
      const next = MEMBERS.find(m => !selectedMembers.includes(m.id));
      if (next) toggleMember(next.id);
    } else if (delta < 0 && selectedMembers.length > 1) {
      const last = selectedMembers[selectedMembers.length - 1];
      if (last !== currentUserMemberId) toggleMember(last);
    }
  };

  const handleCreate = () => {
    const fallbackTitle = details.title?.trim() || (details.clientName ? `${(eventType || 'Event').toUpperCase()} - ${details.clientName}` : `${(eventType || 'Event').toUpperCase()} @ ${details.venue || 'TBD'}`);

    const membersWithUserIds = selectedMembers.map(id => {
      const member = MEMBERS.find(m => m.id === id || m.user_id === id);
      return {
        id: member?.user_id || id,
        memberId: id,
        fee: memberFees[id] || '0',
        name: member?.name || 'Unknown',
        role: member?.role || 'Member',
      };
    });

    const eventData = {
      details: {
        ...details,
        title: fallbackTitle,
        time: details.startTime,
        pay: String(grandTotalFee || details.pay || '0'),
      },
      eventType,
      _originalEventType: editingEvent?.eventType || eventType,
      performanceType,
      setting,
      members: membersWithUserIds,
      audienceIds: membersWithUserIds.map(m => m.id),
      setlist,
      tasks,
      notes,
      status: modalCategory === 'quote' ? 'tentative' : 'confirmed',
      ...(isEditing && editingEvent ? { _editing: true, _editingEventId: editingEvent.eventId, _editingLocalId: editingEvent.id } : {}),
    };
    onCreate(eventData);
  };

  // --- Rehearsal passthrough (both new and editing) ---
  if (eventType === 'rehearsal') {
    return <RehearsalCreationWizard onClose={onClose} onCreate={onCreate} editingEvent={editingEvent} />;
  }

  // --- RENDER STEP 1: Event Type ---
  const renderStep1 = () => (
    <div className="flex flex-col gap-10">
      {EVENT_TYPES.map(({ value, label }) => {
        const isSelected = eventType === value;
        return (
          <button
            key={value}
            onClick={() => setEventType(value)}
            className="flex items-start justify-between gap-5 w-full text-left"
          >
            <div className="flex flex-col gap-1 flex-1">
              <div className={cn(
                'inline-flex self-start px-2.5 py-1 rounded-md text-[12px] font-bold uppercase',
                isSelected ? 'bg-foreground text-background' : 'bg-foreground/10 text-foreground/50'
              )}>
                {value.toUpperCase()}
              </div>
              <span className={cn(
                'text-[32px] font-bold uppercase leading-tight',
                isSelected ? 'text-foreground' : 'text-foreground/30'
              )}>
                {label}
              </span>
            </div>
            <DotRadio selected={isSelected} activeColor={dotActive} inactiveColor={dotInactive} />
          </button>
        );
      })}
    </div>
  );

  const autoGenerateTitle = (clientName: string, type: EventType | null) => {
    if (titleManuallyEdited) return;
    const typeLabel = type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Event';
    const title = clientName ? `${typeLabel} - ${clientName}` : '';
    setDetails(prev => ({ ...prev, title }));
  };

  const warnField = (field: string) => {
    if (!isEditing) return false;
    if (!editingWarnings.includes(field)) return false;
    if (field === 'members' && selectedMembers.length > 0) return false;
    if (field === 'venue' && details.venue && details.venue !== 'TBD') return false;
    if (field === 'date' && details.date) return false;
    if (field === 'fee' && details.pay && details.pay !== '0') return false;
    return true;
  };

  // --- RENDER STEP 2: Date & Location ---
  const renderStep2 = () => (
    <div className="flex flex-col gap-8">
      {/* Client Name */}
      <div>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>CLIENT NAME</span>
        <input
          type="text"
          value={details.clientName}
          onChange={(e) => {
            setDetails(prev => ({ ...prev, clientName: e.target.value }));
            autoGenerateTitle(e.target.value, eventType);
          }}
          placeholder="EG. ROSSI"
          className={cn('w-full bg-transparent border-b pb-2 text-[22px] font-bold uppercase focus:outline-none', tc, bcMuted, 'placeholder:text-foreground/30 focus:border-foreground')}
        />
      </div>

      {/* Event Title */}
      <div>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>EVENT TITLE</span>
        <input
          type="text"
          value={details.title}
          onChange={(e) => {
            setDetails({ ...details, title: e.target.value });
            setTitleManuallyEdited(true);
          }}
          placeholder="EG. WEDDING PARTY"
          className={cn('w-full bg-transparent border-b pb-2 text-[22px] font-bold uppercase focus:outline-none', tc, bcMuted, 'placeholder:text-foreground/30 focus:border-foreground')}
        />
      </div>

      {/* Venue */}
      <div className={cn(warnField('venue') && 'rounded-[10px] p-3 -m-3 bg-[var(--warning)]/10 ring-2 ring-[var(--warning)]/30')}>
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('text-[10px] font-bold uppercase tracking-wider', warnField('venue') ? 'text-[var(--warning)]' : tcMuted)}>VENUE</span>
          {warnField('venue') && <AlertCircle className="w-3 h-3 text-[var(--warning)]" />}
        </div>
        <VenueAutocomplete
          value={details.venue}
          onChange={(val) => setDetails({ ...details, venue: val })}
          onSelect={(place) => {
            setDetails(prev => ({
              ...prev,
              venue: place.name,
              ...(place.address ? { address: place.address } : {}),
              ...(place.city ? { city: place.city } : {}),
              ...(place.state ? { province: place.state } : {}),
              ...(place.postcode ? { zip: place.postcode } : {}),
              ...(place.country ? { country: place.country } : {}),
            }));
          }}
          placeholder="VENUE NAME"
          className={cn('w-full bg-transparent border-b pb-2 text-[22px] font-bold uppercase focus:outline-none mb-3', tc, warnField('venue') ? 'border-[var(--warning)]/50' : bcMuted, 'placeholder:text-foreground/30 focus:border-foreground')}
        />
        {/* Address Tags */}
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={details.address}
            onChange={(e) => setDetails({ ...details, address: e.target.value })}
            placeholder="ADDRESS"
            className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[140px]', bgPill, 'text-foreground/80 placeholder:text-foreground/30 focus:bg-foreground/15')}
          />
          <input
            type="text"
            value={details.city}
            onChange={(e) => setDetails({ ...details, city: e.target.value })}
            placeholder="CITY"
            className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[80px]', bgPill, 'text-foreground/80 placeholder:text-foreground/30 focus:bg-foreground/15')}
          />
          <input
            type="text"
            value={details.province}
            onChange={(e) => setDetails({ ...details, province: e.target.value })}
            placeholder="PROVINCE"
            className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[80px]', bgPill, 'text-foreground/80 placeholder:text-foreground/30 focus:bg-foreground/15')}
          />
          <input
            type="text"
            value={details.zip}
            onChange={(e) => setDetails({ ...details, zip: e.target.value })}
            placeholder="ZIP"
            className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[50px]', bgPill, 'text-foreground/80 placeholder:text-foreground/30 focus:bg-foreground/15')}
          />
          <input
            type="text"
            value={details.country}
            onChange={(e) => setDetails({ ...details, country: e.target.value })}
            placeholder="COUNTRY"
            className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[60px]', bgPill, 'text-foreground/80 placeholder:text-foreground/30 focus:bg-foreground/15')}
          />
        </div>
      </div>

      {/* Calendar */}
      <div className={cn(warnField('date') && 'rounded-lg p-3 -m-3 bg-[var(--warning)]/10 ring-2 ring-[var(--warning)]/30')}>
        {warnField('date') && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold text-[var(--warning)] uppercase tracking-wider">DATE</span>
            <AlertCircle className="w-3 h-3 text-[var(--warning)]" />
          </div>
        )}
        <CalendarGrid selectedDate={details.date} onSelectDate={(d) => setDetails({ ...details, date: d })} isDark={isDarkBg} />
      </div>

      {/* Start / End Times */}
      <div className={cn('grid grid-cols-2 gap-6', warnField('time') && 'rounded-[10px] p-3 -m-3 bg-[var(--warning)]/10 ring-2 ring-[var(--warning)]/30')}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', warnField('time') ? 'text-[var(--warning)]' : tcMuted)}>START</span>
            {warnField('time') && <AlertCircle className="w-3 h-3 text-[var(--warning)]" />}
          </div>
          <TimePicker
            value={details.startTime}
            onChange={(val) => setDetails({ ...details, startTime: val })}
            textSize="text-[22px]"
            showIcon
            className={cn('border-b pb-2 uppercase focus-within:border-foreground', tc, warnField('time') ? 'border-[var(--warning)]/50' : bcMuted)}
          />
        </div>
        <div>
          <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>END</span>
          <TimePicker
            value={details.endTime}
            onChange={(val) => setDetails({ ...details, endTime: val })}
            textSize="text-[22px]"
            showIcon
            className={cn('border-b pb-2 uppercase focus-within:border-foreground', tc, bcMuted)}
          />
        </div>
      </div>

      {/* Guests */}
      <div>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>GUESTS</span>
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => setDetails({ ...details, guests: Math.max(0, details.guests - 10) })}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-foreground text-background"
          >
            <Minus className="w-5 h-5 text-background" />
          </button>
          <span className={cn('text-[40px] font-bold leading-none flex-1 text-center', tc)}>{details.guests}</span>
          <button
            onClick={() => setDetails({ ...details, guests: details.guests + 10 })}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-foreground text-background"
          >
            <Plus className="w-5 h-5 text-background" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {[50, 100, 150, 200, 300, 500].map(n => (
            <button
              key={n}
              onClick={() => setDetails({ ...details, guests: n })}
              className={cn(
                'px-3 py-1.5 rounded-[8px] text-[11px] font-bold transition-all',
                details.guests === n ? bgPillSelected : bgPillUnselected
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Setting */}
      <div>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-2', tcMuted)}>SETTING</span>
        <div className="flex gap-2">
          <button
            onClick={() => setSetting('indoor')}
            className={cn(
              'px-4 py-2 rounded-md text-[12px] font-bold uppercase border transition-all',
              setting === 'indoor' ? bgPillSelected + ' border-current' : (isDarkBg ? 'bg-transparent text-white/40 border-white/20' : 'bg-transparent text-foreground/40 border-black/20')
            )}
          >
            INDOOR
          </button>
          <button
            onClick={() => setSetting('outdoor')}
            className={cn(
              'px-4 py-2 rounded-md text-[12px] font-bold uppercase border transition-all',
              setting === 'outdoor' ? bgPillSelected + ' border-current' : (isDarkBg ? 'bg-transparent text-white/40 border-white/20' : 'bg-transparent text-foreground/40 border-black/20')
            )}
          >
            OUTDOOR
          </button>
        </div>
      </div>
    </div>
  );

  // --- RENDER STEP 3: Team & Pay ---
  const renderStep3 = () => {
    const selectedCount = selectedMembers.length;
    const totalAvailable = MEMBERS.length;

    return (
      <div className="flex flex-col gap-8">
        {/* Performance Type Presets */}
        <div>
          <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>PERFORMANCE</span>
          <span className={cn('text-[28px] font-bold uppercase block mb-3', tc)}>TYPE</span>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'SOLO', count: 1, type: 'solo' as PerformanceType },
              { label: 'DUO', count: 2, type: 'duo' as PerformanceType },
              { label: 'TRIO', count: 3, type: 'trio' as PerformanceType },
              { label: 'QUARTET', count: 4, type: 'full_band' as PerformanceType },
              { label: 'FULL BAND', count: totalAvailable || 1, type: 'full_band' as PerformanceType },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => {
                  setPerformanceType(preset.type);
                  const newSelected = MEMBERS.slice(0, preset.count).map(m => m.id);
                  if (currentUserMemberId && !newSelected.includes(currentUserMemberId)) {
                    newSelected[0] = currentUserMemberId;
                  }
                  setSelectedMembers(newSelected);
                  const newFees: Record<string, string> = {};
                  newSelected.forEach((id, idx) => {
                    if (memberFees[id] && memberFees[id] !== '0') {
                      newFees[id] = memberFees[id];
                    } else {
                      newFees[id] = getAutoFeeForMember(id, newSelected.slice(0, idx), pricingSettings);
                    }
                  });
                  setMemberFees(newFees);
                }}
                className={cn(
                  'px-3 py-1.5 rounded-md text-[11px] font-bold uppercase border transition-all',
                  selectedCount === preset.count
                    ? bgPillSelected + ' border-current'
                    : 'bg-transparent text-foreground/50 border-foreground/20'
                )}
              >
                {preset.label}
              </button>
            ))}
            <span className={cn('text-[10px] font-bold self-center ml-1', tcFaint)}>({selectedCount}/{totalAvailable})</span>
          </div>
        </div>

        {/* Full Roster Checklist */}
        <div className={cn(warnField('members') && 'rounded-[10px] p-3 -m-3 bg-[var(--warning)]/10 ring-2 ring-[var(--warning)]/30')}>
          <div className="flex items-center gap-2 mb-4">
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', warnField('members') ? 'text-[var(--warning)]' : tcMuted)}>MUSICIANS</span>
            {warnField('members') && <AlertCircle className="w-3 h-3 text-[var(--warning)]" />}
          </div>

          {totalAvailable === 0 ? (
            <div className={cn('text-center py-8 px-4 rounded-[12px] border-2 border-dashed bg-foreground/5', bcMuted)}>
              <span className={cn('text-[11px] font-bold block mb-0.5', tcMuted)}>LOADING MEMBERS...</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {MEMBERS.map((member) => {
                const isSelected = selectedMembers.includes(member.id);
                const isCurrentUser = member.id === currentUserMemberId;
                const isLocked = isSelected && isCurrentUser;
                const showFee = isSelected && isAdmin;

                return (
                  <div
                    key={member.id}
                    className="flex items-start justify-between py-3 border-b last:border-0 border-foreground/10"
                  >
                    <div className="flex flex-col gap-1 flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'px-2 py-0.5 text-[10px] font-bold uppercase rounded',
                          isSelected
                            ? 'bg-foreground text-background'
                            : 'bg-foreground/10 text-foreground/50'
                        )}>
                          {isCurrentUser ? 'YOU / ' + member.role : member.role}
                        </span>
                        {isLocked && (
                          <span className={cn('text-[9px] font-bold uppercase', tcSub)}>REQUIRED</span>
                        )}
                      </div>
                      <span className={cn(
                        'text-[20px] font-bold uppercase transition-opacity',
                        isSelected ? tc : 'text-foreground/30'
                      )}>
                        {member.name}
                      </span>
                      
                      {/* Fee input — expands inline when selected */}
                      <AnimatePresence>
                        {showFee && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="flex items-center gap-1 mt-1">
                              <span className={cn('font-bold text-sm', tcSub)}>{currencySymbol}</span>
                              <input
                                type="number"
                                value={memberFees[member.id] || ''}
                                onChange={(e) => updateFee(member.id, e.target.value)}
                                placeholder={getAutoFeeForMember(member.id, selectedMembers, pricingSettings)}
                                className={cn(
                                  'bg-transparent font-bold text-sm border-b focus:outline-none w-20 pb-0.5',
                                  isDarkBg
                                    ? 'text-white/60 border-white/10 focus:border-white placeholder:text-white/20'
                                    : 'text-foreground/60 border-black/10 focus:border-black placeholder:text-foreground/20'
                                )}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    <button
                      onClick={() => toggleMember(member.id)}
                      className="shrink-0 mt-1"
                    >
                      <DotCheckbox
                        checked={isSelected}
                        disabled={isLocked}
                        activeColor={dotActive}
                        inactiveColor={dotInactive}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state hint */}
          {totalAvailable <= 1 && (
            <div className={cn('text-center py-4 px-4 rounded-[12px] border-2 border-dashed bg-black/5 mt-4', bcMuted)}>
              <span className={cn('text-[11px] font-bold block mb-0.5', tcMuted)}>PLAYING SOLO?</span>
              <span className={cn('text-[10px] font-medium block', tcFaint)}>You can add more bandmates later from your dashboard to split fees.</span>
            </div>
          )}
        </div>

        {/* Fee Summary */}
        {isAdmin && (
          <div className="flex flex-col gap-4 pt-4 border-t border-foreground/10">
            {totalPayout > 0 && (
              <div className="flex items-center justify-between">
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', tcMuted)}>MEMBERS TOTAL</span>
                <span className={cn('text-[22px] font-bold', tc)}>{currencySymbol}{totalPayout}</span>
              </div>
            )}

            <div>
              <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>EXTRA BAND FEE / GIG RENTAL</span>
              <div className="flex items-center">
                <span className={cn('text-[22px] font-bold', tcSub)}>{currencySymbol}</span>
                <input
                  type="number"
                  value={extraBandFee}
                  onChange={(e) => setExtraBandFee(e.target.value)}
                  placeholder="0"
                  className={cn('bg-transparent text-[22px] font-bold focus:outline-none w-full placeholder:text-foreground/30', tc)}
                />
              </div>
              {pricingSettings.custom_services?.filter(s => s.is_active).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pricingSettings.custom_services.filter(s => s.is_active).map(service => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        const current = parseFloat(extraBandFee) || 0;
                        setExtraBandFee(String(current + service.price));
                      }}
                      className="px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase border border-foreground/15 bg-foreground/5 hover:bg-foreground/10 text-foreground/70 transition-colors"
                    >
                      + {service.name} ({currencySymbol}{service.price})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Summary bar: selected count + total */}
            <div className="flex items-center justify-between py-3 border-t border-foreground/10">
              <div className="flex flex-col">
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', tcMuted)}>TEAM SUMMARY</span>
                <span className={cn('text-[14px] font-bold', tcFaint)}>
                  {selectedCount} of {totalAvailable} musician{selectedCount !== 1 ? 's' : ''} selected
                </span>
              </div>
              {grandTotalFee > 0 && (
                <span className={cn('text-[28px] font-bold', tc)}>{currencySymbol}{grandTotalFee}</span>
              )}
            </div>
          </div>
        )}

        {/* Duration */}
        <div className="pt-4 border-t border-foreground/10">
          <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>DURATION</span>
          <select
            value={details.duration}
            onChange={(e) => setDetails({ ...details, duration: parseInt(e.target.value) || 0 })}
            className={cn('bg-transparent text-[28px] font-bold focus:outline-none w-full appearance-none cursor-pointer', tc)}
          >
            {DURATION_15M_OPTIONS.map(m => (
              <option key={m} value={m} className="text-black bg-white text-base">
                {formatDurationOption(m)}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  // --- RENDER STEP 4: Overview ---
  const renderStep4 = () => {
    const selectedDate = details.date ? new Date(details.date + 'T00:00:00') : new Date();
    const dateStr = selectedDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const toggleSection = (id: string) => setExpandedSection(prev => prev === id ? null : id);
    const songCount = setlist.reduce((acc: number, s: any) => acc + ((s.songs || []).length), 0);
    const eventYear = selectedDate.getFullYear();
    const eventMonthDay = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    const borderColor = 'var(--border)';
    const subtitleColor = 'var(--muted-fg)';
    const textColor = 'var(--fg)';

    const isQuote = modalCategory === 'quote';

    if (isQuote) {
      return (
        <div className="flex flex-col gap-[40px]">
          {/* Header */}
          <div className="flex flex-col gap-[8px]">
            <div className="flex gap-[4px] flex-wrap">
              <div className="rounded-[6px] px-[10px] py-[4px] bg-foreground/10">
                <span className="text-[12px] font-bold text-foreground uppercase">QUOTE</span>
              </div>
            </div>
            <h2 className="text-[32px] font-bold text-foreground uppercase leading-none">{details.title || 'UNTITLED'}</h2>
            <span className="text-[14px] font-medium text-foreground/50 uppercase">{dateStr}</span>
          </div>

          {/* Year + Date */}
          <div className="flex gap-[20px]">
            <div className="flex-1 flex flex-col">
              <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('year')}>
                <span className="text-[12px] font-bold uppercase text-foreground">YEAR</span>
                <motion.div animate={{ rotate: expandedSection === 'year' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ArrowUpRight className="w-[14px] h-[14px] text-foreground" />
                </motion.div>
              </button>
              <span className="text-[42px] font-bold leading-none text-foreground">{eventYear}</span>
              <AnimatePresence>
                {expandedSection === 'year' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="pt-[12px] flex flex-col gap-[8px]">
                      <div className="flex items-center justify-between py-[8px] border-b" style={{ borderColor }}>
                        <span className="text-[12px] font-medium uppercase" style={{ color: subtitleColor }}>Year</span>
                        <span className="text-[14px] font-bold" style={{ color: textColor }}>{eventYear}</span>
                      </div>
                      <div className="flex items-center justify-between py-[8px] border-b" style={{ borderColor }}>
                        <span className="text-[12px] font-medium uppercase" style={{ color: subtitleColor }}>Season</span>
                        <span className="text-[14px] font-bold" style={{ color: textColor }}>
                          {(() => { const m = selectedDate.getMonth(); return m >= 5 && m <= 8 ? 'Summer' : m >= 2 && m <= 4 ? 'Spring' : m >= 9 && m <= 10 ? 'Autumn' : 'Winter'; })()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex-1 flex flex-col">
              <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('date')}>
                <span className="text-[12px] font-bold uppercase text-foreground">DATE</span>
                <motion.div animate={{ rotate: expandedSection === 'date' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ArrowUpRight className="w-[14px] h-[14px] text-foreground" />
                </motion.div>
              </button>
              <span className="text-[42px] font-bold leading-none text-foreground">{eventMonthDay}</span>
              <AnimatePresence>
                {expandedSection === 'date' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="pt-[12px] flex flex-col gap-[8px]">
                      <div className="flex items-center justify-between py-[8px] border-b" style={{ borderColor }}>
                        <span className="text-[12px] font-medium uppercase" style={{ color: subtitleColor }}>Day</span>
                        <span className="text-[14px] font-bold" style={{ color: textColor }}>{selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}</span>
                      </div>
                      <div className="flex items-center justify-between py-[8px] border-b" style={{ borderColor }}>
                        <span className="text-[12px] font-medium uppercase" style={{ color: subtitleColor }}>Time</span>
                        <span className="text-[14px] font-bold" style={{ color: textColor }}>{details.startTime || 'TBD'}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Client + Pricing */}
          <div className="grid grid-cols-2 gap-[20px]">
            <div className="flex flex-col gap-[8px]">
              <div className="flex flex-col">
                <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('client')}>
                  <span className="text-[12px] font-bold uppercase text-foreground">CLIENT</span>
                  <motion.div animate={{ rotate: expandedSection === 'client' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ArrowUpRight className="w-[14px] h-[14px] text-foreground" />
                  </motion.div>
                </button>
                <span className="text-[42px] font-bold leading-none text-foreground">
                  {(details.clientName || details.title || '—').split(' ')[0]?.toUpperCase()}
                </span>
                {(details.clientName || details.title || '').split(' ').length > 1 && (
                  <span className="text-[22px] font-bold leading-none text-foreground">
                    {(details.clientName || details.title || '').split(' ').slice(1).join(' ')?.toUpperCase()}
                  </span>
                )}
              </div>
              <AnimatePresence>
                {expandedSection === 'client' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="pt-[12px] flex flex-col gap-[8px]">
                      <div className="flex items-center justify-between py-[8px] border-b" style={{ borderColor }}>
                        <span className="text-[12px] font-medium uppercase" style={{ color: subtitleColor }}>Name</span>
                        <span className="text-[14px] font-bold" style={{ color: textColor }}>{details.clientName || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between py-[8px] border-b" style={{ borderColor }}>
                        <span className="text-[12px] font-medium uppercase" style={{ color: subtitleColor }}>Event Type</span>
                        <span className="text-[14px] font-bold" style={{ color: textColor }}>QUOTE</span>
                      </div>
                      <div className="flex items-center justify-between py-[8px] border-b" style={{ borderColor }}>
                        <span className="text-[12px] font-medium uppercase" style={{ color: subtitleColor }}>Location</span>
                        <span className="text-[14px] font-bold" style={{ color: textColor }}>{details.address || 'TBD'}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col gap-[8px]">
              <div className="flex flex-col">
                <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('pricing')}>
                  <span className="text-[12px] font-bold uppercase text-foreground">PRICING</span>
                  <motion.div animate={{ rotate: expandedSection === 'pricing' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ArrowUpRight className="w-[14px] h-[14px] text-foreground" />
                  </motion.div>
                </button>
                <span className="text-[42px] font-bold leading-none text-foreground">
                  {currencySymbol}{grandTotalFee || details.pay || '0'}
                </span>
              </div>
              <AnimatePresence>
                {expandedSection === 'pricing' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="pt-[12px] flex flex-col gap-[8px]">
                      <div className="flex items-center justify-between py-[8px] border-b" style={{ borderColor }}>
                        <span className="text-[12px] font-medium uppercase" style={{ color: subtitleColor }}>Band Total</span>
                        <span className="text-[14px] font-bold" style={{ color: textColor }}>{currencySymbol}{grandTotalFee || details.pay || '0'}</span>
                      </div>
                      <div className="flex items-center justify-between py-[8px] border-b" style={{ borderColor }}>
                        <span className="text-[12px] font-medium uppercase" style={{ color: subtitleColor }}>Venue</span>
                        <span className="text-[14px] font-bold" style={{ color: textColor }}>{details.address || 'TBD'}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Songs */}
          <div className="flex flex-col gap-[20px]">
            <div className="flex flex-col">
              <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => setSongsView(true)}>
                <span className="text-[12px] font-bold uppercase text-foreground">SONGS</span>
                <ArrowUpRight className="w-[14px] h-[14px] text-foreground" />
              </button>
              <span className="text-[42px] font-bold leading-none text-foreground">{songCount}</span>
            </div>
          </div>

          {/* Tasks */}
          <div className="flex flex-col gap-[20px]">
            <div className="flex flex-col">
              <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('tasks')}>
                <span className="text-[12px] font-bold uppercase text-foreground">TASKS</span>
                <motion.div animate={{ rotate: expandedSection === 'tasks' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ArrowUpRight className="w-[14px] h-[14px] text-foreground" />
                </motion.div>
              </button>
              <span className="text-[42px] font-bold leading-none text-foreground">{tasks.length}</span>
            </div>
            <AnimatePresence>
              {expandedSection === 'tasks' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <div className="pt-[12px] flex flex-col gap-[8px]">
                    {taskTemplates.length > 0 && tasks.length === 0 && (
                      <div className="mb-3">
                        <span className="text-[10px] font-bold uppercase block mb-1.5 text-foreground/40">LOAD FROM TEMPLATE</span>
                        <div className="flex flex-wrap gap-1.5">
                          {taskTemplates.map(tpl => (
                            <button
                              key={tpl.id}
                              onClick={() => {
                                const loaded = tpl.tasks.map((t: any) => ({
                                  uid: `t-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                  title: t.title,
                                  completed: false,
                                  templateId: tpl.id,
                                }));
                                setTasks(loaded);
                              }}
                              className="px-3 py-1.5 rounded-[10px] text-[11px] font-bold flex items-center gap-1.5 transition-all bg-foreground/10 text-foreground hover:bg-foreground/15"
                            >
                              <Folder className="w-3 h-3 text-foreground/40" />
                              {tpl.name}
                              <span className="text-foreground/30">{tpl.tasks.length}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {tasks.map((task, i) => (
                      <div key={task.uid || i} className="flex items-center gap-3">
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) => {
                            const newTasks = [...tasks];
                            newTasks[i] = { ...newTasks[i], title: e.target.value };
                            setTasks(newTasks);
                          }}
                          placeholder="Task description..."
                          className="flex-1 bg-transparent border-b-2 border-foreground/15 py-1 text-sm font-bold text-foreground focus:outline-none focus:border-foreground placeholder:text-foreground/30 transition-all"
                        />
                        <button onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))} className="text-foreground/30 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setTasks([...tasks, { uid: `t-${Date.now()}`, title: '', completed: false }])}
                      className="text-[12px] font-bold uppercase flex items-center gap-1 text-foreground/50 hover:text-foreground transition-colors mt-1"
                    >
                      <Plus className="w-3 h-3" /> Add task
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Members */}
          <div className="flex flex-col gap-[20px]">
            <div className="flex flex-col">
              <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('members')}>
                <span className="text-[12px] font-bold uppercase text-foreground">MEMBERS</span>
                <motion.div animate={{ rotate: expandedSection === 'members' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ArrowUpRight className="w-[14px] h-[14px] text-foreground" />
                </motion.div>
              </button>
              <span className="text-[42px] font-bold leading-none text-foreground">{selectedMembers.length}</span>
            </div>
            <AnimatePresence>
              {expandedSection === 'members' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <div className="pt-[12px] flex flex-col gap-[8px]">
                    {selectedMembers.length > 0 ? selectedMembers.map((mid, i) => {
                      const m = MEMBERS.find(x => x.id === mid);
                      return (
                        <div key={mid} className="flex items-center justify-between py-[8px] border-b" style={{ borderColor }}>
                          <span className="text-[12px] font-medium uppercase" style={{ color: subtitleColor }}>Member {i + 1}</span>
                          <span className="text-[14px] font-bold" style={{ color: textColor }}>{m?.name || mid}</span>
                        </div>
                      );
                    }) : (
                      <div className="flex items-center justify-between py-[8px] border-b" style={{ borderColor }}>
                        <span className="text-[12px] font-medium uppercase" style={{ color: subtitleColor }}>Info</span>
                        <span className="text-[14px] font-bold" style={{ color: textColor }}>No members assigned</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notes */}
          {notes && (
            <div className="flex flex-col gap-[20px]">
              <div className="flex flex-col">
                <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('notes')}>
                  <span className="text-[12px] font-bold uppercase text-foreground">NOTES</span>
                  <motion.div animate={{ rotate: expandedSection === 'notes' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ArrowUpRight className="w-[14px] h-[14px] text-foreground" />
                  </motion.div>
                </button>
              </div>
              <AnimatePresence>
                {expandedSection === 'notes' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="pt-[12px]">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any notes for the band..."
                        rows={3}
                        className="w-full bg-transparent border-b-2 border-foreground/15 py-2 text-sm font-medium text-foreground focus:outline-none focus:border-foreground placeholder:text-foreground/30 transition-all resize-none"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      );
    }

    // GIG layout (original style)
    const sections = [
      { id: 'songs', tag: 'SONGS', value: String(songCount), hasData: setlist.length > 0 },
      { id: 'schedule', tag: 'SCHEDULE', value: 'RoS', hasData: true },
      { id: 'tasks', tag: 'TASKS', value: tasks.length.toString(), hasData: tasks.length > 0 },
      { id: 'notes', tag: 'NOTES', value: notes ? '1' : '0', hasData: !!notes },
    ];

    return (
      <div className="flex flex-col gap-8">
        {/* Event Header */}
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {currentUserMember && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-foreground text-background">
                {currentUserMember.role}
              </span>
            )}
            <span className={cn('text-[12px] font-bold', tcMuted)}>{dateStr} @{details.startTime?.replace(':', '') || '2000'}</span>
          </div>
          <h2 className={cn('text-[40px] font-bold uppercase leading-[0.95]', tc)}>
            {details.title || 'EVENT TITLE'}
          </h2>
          <span className={cn('text-[12px] font-bold mt-1 block', tcMuted)}>{dateStr} @{details.startTime?.replace(':', '') || '2000'}</span>
        </div>

        {/* Stat Cards */}
        <div className="flex flex-col gap-6">
          {sections.map(({ id, tag, value, hasData }) => (
            <div key={id}>
              <button
                onClick={() => id === 'songs' ? setSongsView(true) : toggleSection(id)}
                className="w-full flex items-start justify-between text-left group"
              >
                <div className="flex flex-col gap-1">
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded inline-flex self-start bg-foreground text-background">
                    {tag}
                  </span>
                  <span className={cn('text-[40px] font-bold leading-none', tc)}>{value}</span>
                </div>
                <DotCheckbox checked={hasData} activeColor={dotActive} inactiveColor={dotInactive} />
              </button>

              <AnimatePresence>
                {expandedSection === id && id === 'schedule' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 pb-2 grid grid-cols-2 gap-4">
                      <div>
                        <span className={cn('text-[10px] font-bold uppercase block mb-1', tcSub)}>DURATION</span>
                        <select
                          value={details.duration}
                          onChange={(e) => setDetails({ ...details, duration: parseInt(e.target.value) || 0 })}
                          className={cn('w-full bg-transparent border-b-2 py-1 text-lg font-bold focus:outline-none transition-all border-foreground/15 focus:border-foreground appearance-none cursor-pointer', tc)}
                        >
                          {DURATION_15M_OPTIONS.map(m => (
                            <option key={m} value={m} className="text-black bg-white text-base">
                              {formatDurationOption(m)} ({m} min)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className={cn('text-[10px] font-bold uppercase block mb-1', tcSub)}>SETS</span>
                        <input
                          type="number"
                          value={1}
                          readOnly
                          className={cn('w-full bg-transparent border-b-2 py-1 text-lg font-bold focus:outline-none border-foreground/15', tc)}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {expandedSection === id && id === 'tasks' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 pb-2 flex flex-col gap-2">
                      {taskTemplates.length > 0 && tasks.length === 0 && (
                        <div className="mb-3">
                          <span className={cn('text-[10px] font-bold uppercase block mb-1.5', tcSub)}>LOAD FROM TEMPLATE</span>
                          <div className="flex flex-wrap gap-1.5">
                            {taskTemplates.map(tpl => (
                              <button
                                key={tpl.id}
                                onClick={() => {
                                  const loaded = tpl.tasks.map((t: any) => ({
                                    uid: `t-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                    title: t.title,
                                    completed: false,
                                    templateId: tpl.id,
                                  }));
                                  setTasks(loaded);
                                }}
                                className="px-3 py-1.5 rounded-[10px] text-[11px] font-bold flex items-center gap-1.5 transition-all bg-foreground/10 text-foreground hover:bg-foreground/15"
                              >
                                <Folder className={cn('w-3 h-3', tcSub)} />
                                {tpl.name}
                                <span className={tcFaint}>{tpl.tasks.length}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {tasks.map((task, i) => (
                        <div key={task.uid || i} className="flex items-center gap-3">
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => {
                              const newTasks = [...tasks];
                              newTasks[i] = { ...newTasks[i], title: e.target.value };
                              setTasks(newTasks);
                            }}
                            placeholder="Task description..."
                            className={cn('flex-1 bg-transparent border-b-2 py-1 text-sm font-bold focus:outline-none transition-all border-foreground/15 placeholder:text-foreground/30 focus:border-foreground', tc)}
                          />
                          <button
                            onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))}
                            className="text-foreground/30 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setTasks([...tasks, { uid: `t-${Date.now()}`, title: '', completed: false }])}
                        className={cn('text-[12px] font-bold uppercase flex items-center gap-1 transition-colors mt-1', tcMuted, 'hover:text-foreground')}
                      >
                        <Plus className="w-3 h-3" /> Add task
                      </button>
                    </div>
                  </motion.div>
                )}

                {expandedSection === id && id === 'notes' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 pb-2">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any notes for the band..."
                        rows={3}
                        className={cn('w-full bg-transparent border-b-2 py-2 text-sm font-medium focus:outline-none transition-all resize-none border-foreground/15 placeholder:text-foreground/30 focus:border-foreground', tc)}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // --- Songs / Setlist Builder Sub-view ---
  const openSongPickerForSet = (setUid: string) => {
    setSongPickerTargetSet(setUid);
    setSongPickerOpen(true);
  };

  const handlePickedSong = (picked: PickedSong) => {
    if (songPickerTargetSet) {
      const targetSet = setlist.find((s: any) => s.uid === songPickerTargetSet);
      const existingIds = new Set((targetSet?.songs || []).filter((sg: any) => sg.songId).map((sg: any) => sg.songId));
      if (existingIds.has(picked.id)) {
        alert(`"${picked.title}" is already in this set.`);
        return;
      }
      setSetlist(prev => prev.map(s =>
        s.uid === songPickerTargetSet
          ? { ...s, songs: [...(s.songs || []), { uid: `song-${Date.now()}`, title: picked.title, artist: picked.artist, songId: picked.id }] }
          : s
      ));
    }
  };

  const handlePickedMultipleSongs = (picked: PickedSong[]) => {
    if (songPickerTargetSet) {
      const targetSet = setlist.find((s: any) => s.uid === songPickerTargetSet);
      const existingIds = new Set((targetSet?.songs || []).filter((sg: any) => sg.songId).map((sg: any) => sg.songId));
      const dupes = picked.filter(p => existingIds.has(p.id));
      const newSongs = picked.filter(p => !existingIds.has(p.id));

      if (dupes.length > 0 && newSongs.length > 0) {
        alert(`${dupes.length} song(s) already in this set were skipped: ${dupes.map(d => d.title).join(', ')}`);
      } else if (dupes.length > 0 && newSongs.length === 0) {
        alert(`All selected songs are already in this set.`);
      }

      if (newSongs.length > 0) {
        setSetlist(prev => prev.map(s =>
          s.uid === songPickerTargetSet
            ? { ...s, songs: [...(s.songs || []), ...newSongs.map(p => ({ uid: `song-${Date.now()}-${Math.random().toString(36).slice(2)}`, title: p.title, artist: p.artist, songId: p.id }))] }
            : s
        ));
      }
    }
    setSongPickerOpen(false);
    setSongPickerTargetSet(null);
  };

  const loadSavedSetlist = async (sl: Setlist) => {
    const { data } = await getSetlist(sl.id);
    if (!data?.songs?.length) return;

    const groupedBySet = new Map<number, { title: string; artist: string; songId: string; uid: string }[]>();
    data.songs.forEach((ss: any) => {
      const setNum = ss.set_number || 1;
      if (!groupedBySet.has(setNum)) groupedBySet.set(setNum, []);
      groupedBySet.get(setNum)!.push({
        uid: `song-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: ss.song?.title || 'Untitled',
        artist: ss.song?.artist || '',
        songId: ss.song_id,
      });
    });

    const sets = Array.from(groupedBySet.entries()).map(([num, songs]) => ({
      uid: `set-${Date.now()}-${num}`,
      title: `Set ${num}`,
      songs,
    }));

    setSetlist(sets);
    setExpandedSet(sets[0]?.uid || null);
  };

  const persistManualSongs = async () => {
    if (!selectedBand?.id) return;
    const { createSong: persistSong } = await import('@/lib/services/songs');
    for (const set of setlist) {
      for (const song of (set.songs || [])) {
        if (song.title?.trim() && !song.songId) {
          const { data } = await persistSong({
            band_id: selectedBand.id,
            title: song.title.trim(),
            artist: song.artist?.trim() || undefined,
            status: 'ready',
            priority: 'medium',
          });
          if (data) song.songId = data.id;
        }
      }
    }
  };

  const handleSongsViewDone = async () => {
    await persistManualSongs();
    setSongsView(false);
  };

  const addSet = () => {
    setSetlist(prev => [
      ...prev,
      { uid: `set-${Date.now()}`, title: `Set ${prev.length + 1}`, songs: [] },
    ]);
  };

  const removeSet = (setUid: string) => {
    setSetlist(prev => prev.filter(s => s.uid !== setUid));
  };

  const addSongToSet = (setUid: string) => {
    setSetlist(prev => prev.map(s =>
      s.uid === setUid
        ? { ...s, songs: [...(s.songs || []), { uid: `song-${Date.now()}`, title: '', artist: '' }] }
        : s
    ));
  };

  const updateSongInSet = (setUid: string, songUid: string, field: string, value: string) => {
    setSetlist(prev => prev.map(s =>
      s.uid === setUid
        ? { ...s, songs: (s.songs || []).map((song: any) => song.uid === songUid ? { ...song, [field]: value } : song) }
        : s
    ));
  };

  const removeSongFromSet = (setUid: string, songUid: string) => {
    setSetlist(prev => prev.map(s =>
      s.uid === setUid
        ? { ...s, songs: (s.songs || []).filter((song: any) => song.uid !== songUid) }
        : s
    ));
  };

  const [expandedSet, setExpandedSet] = useState<string | null>(null);

  const renderSongsView = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[101] flex flex-col overflow-hidden"
      style={{
        backgroundColor: modalBg,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <WizardAccentRail color={activeAccentColor} />
      {/* Songs Header */}
      <div className="px-4 pt-4 pb-4 flex items-center justify-between shrink-0">
        <button onClick={() => setSongsView(false)} className={cn('w-10 h-10 rounded-full border flex items-center justify-center', bcSolid)}>
          <ArrowLeft className={cn('w-5 h-5', tc)} />
        </button>
        <span className={cn('text-[20px] font-bold uppercase', tc)}>SONGS</span>
        <button onClick={onClose} className="w-[50px] h-[50px] rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center shrink-0 transition-colors">
          <X className={cn('w-6 h-6', tc)} />
        </button>
      </div>

      {/* Setlist Builder */}
      <div className="flex-1 overflow-y-auto px-4">
        {savedSetlists.length > 0 && setlist.length === 0 && (
          <div className="mb-6">
            <span className="text-[10px] font-bold text-foreground/50 uppercase block mb-2">LOAD FROM SAVED SETLISTS</span>
            <div className="flex flex-wrap gap-2">
              {savedSetlists.map(sl => (
                <button
                  key={sl.id}
                  onClick={() => loadSavedSetlist(sl)}
                  className="px-3 py-2 rounded-[10px] bg-foreground/10 hover:bg-foreground/15 text-foreground flex items-center gap-2 transition-all"
                >
                  <Folder className="w-3.5 h-3.5 text-foreground/50" />
                  <span className="text-[12px] font-bold text-foreground">{sl.name}</span>
                  {sl.song_count != null && (
                    <span className="text-[10px] font-bold text-foreground/40">{sl.song_count} songs</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start justify-between mb-6">
          <div className="flex flex-col gap-1">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded inline-flex self-start bg-foreground text-background">
              {setlist.length} {setlist.length === 1 ? 'SET' : 'SETS'}
            </span>
            <span className={cn('text-[28px] font-bold uppercase', tc)}>SETLIST BUILDER</span>
          </div>
          <button
            onClick={addSet}
            className="w-10 h-10 rounded-full border border-foreground/30 flex items-center justify-center mt-2 transition-colors text-foreground hover:bg-foreground/10"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {setlist.length === 0 ? (
          <div className={cn('text-center py-12', tcFaint)}>
            <span className="text-lg font-bold block mb-2">No sets yet</span>
            <span className="text-sm font-bold">Tap + to create one{savedSetlists.length > 0 ? ' or load a saved setlist' : ''}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {setlist.map((item, i) => {
              const isExpanded = expandedSet === item.uid;
              const songCount = (item.songs || []).length;

              return (
                <div key={item.uid || i}>
                  {/* Set Header Row */}
                  <button
                    onClick={() => setExpandedSet(isExpanded ? null : item.uid)}
                    className="w-full flex items-start justify-between text-left group"
                  >
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="px-2 py-0.5 bg-black text-white text-[10px] font-bold uppercase rounded inline-flex self-start">
                        {item.title}
                      </span>
                      <span className="text-[40px] font-bold text-black leading-none">{songCount}</span>
                      <span className="text-[10px] font-bold text-foreground/50 uppercase">
                        {songCount === 1 ? 'SONG' : 'SONGS'}
                      </span>
                    </div>
                    <DotCheckbox checked={songCount > 0} activeColor="var(--fg)" inactiveColor="var(--dot-inactive)" />
                  </button>

                  {/* Expanded: Songs List */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 pb-2 flex flex-col gap-3">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => setSetlist(prev => prev.map(s => s.uid === item.uid ? { ...s, title: e.target.value } : s))}
                            className="bg-transparent border-b-2 border-black/10 py-1 text-sm font-bold text-black placeholder:text-foreground/20 focus:outline-none focus:border-black transition-all"
                            placeholder="Set name..."
                          />

                          {(item.songs || []).map((song: any, si: number) => (
                            <div key={song.uid} className="flex items-start gap-2">
                              <span className="text-[11px] font-bold text-foreground/30 mt-2 w-5 shrink-0">{si + 1}.</span>
                              <div className="flex-1 flex flex-col gap-1">
                                <input
                                  type="text"
                                  value={song.title}
                                  onChange={(e) => updateSongInSet(item.uid, song.uid, 'title', e.target.value)}
                                  placeholder="Song title..."
                                  className="bg-transparent border-b-2 border-black/10 py-1 text-sm font-bold text-black placeholder:text-foreground/20 focus:outline-none focus:border-black transition-all"
                                />
                                <input
                                  type="text"
                                  value={song.artist}
                                  onChange={(e) => updateSongInSet(item.uid, song.uid, 'artist', e.target.value)}
                                  placeholder="Artist..."
                                  className="bg-transparent border-b border-black/5 py-1 text-[11px] font-bold text-foreground/50 placeholder:text-black/15 focus:outline-none focus:border-black/30 transition-all"
                                />
                              </div>
                              <button
                                onClick={() => removeSongFromSet(item.uid, song.uid)}
                                className="text-foreground/20 hover:text-red-500 transition-colors mt-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}

                          {/* Add from library / Add manually / Remove set */}
                          <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => openSongPickerForSet(item.uid)}
                                className="text-[12px] font-bold text-foreground/70 uppercase flex items-center gap-1 hover:text-black transition-colors"
                              >
                                <Music className="w-3 h-3" /> From library
                              </button>
                              <button
                                onClick={() => addSongToSet(item.uid)}
                                className="text-[12px] font-bold text-foreground/50 uppercase flex items-center gap-1 hover:text-black transition-colors"
                              >
                                <Plus className="w-3 h-3" /> Manual
                              </button>
                            </div>
                            <button
                              onClick={() => removeSet(item.uid)}
                              className="text-[12px] font-bold text-red-500/50 uppercase flex items-center gap-1 hover:text-red-500 transition-colors"
                            >
                              <X className="w-3 h-3" /> Remove set
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-5 shrink-0 border-t border-foreground/10 bg-background/95">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setSongsView(false)}
            className="py-4 bg-foreground/10 hover:bg-foreground/15 text-foreground rounded-[10px] flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
            <span className="text-[16px] font-bold text-foreground">BACK</span>
          </button>
          <button
            onClick={handleSongsViewDone}
            style={{ backgroundColor: activeAccentColor, color: activeAccentFg }}
            className="py-4 rounded-[10px] flex items-center justify-center gap-2 font-bold hover:opacity-95 transition-opacity"
          >
            <span className="text-[16px] font-bold">DONE</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SongPicker overlay */}
      <AnimatePresence>
        {songPickerOpen && (
          <SongPicker
            isOpen={songPickerOpen}
            onClose={() => { setSongPickerOpen(false); setSongPickerTargetSet(null); }}
            onSelect={handlePickedSong}
            onSelectMultiple={handlePickedMultipleSongs}
            multiSelect={true}
            selectedIds={setlist.flatMap((s: any) => (s.songs || []).filter((sg: any) => sg.songId).map((sg: any) => sg.songId))}
            theme="lime"
            />
          )}
        </AnimatePresence>
      </motion.div>
    );

  // --- ACCORDION EDIT VIEW (FOR isEditing === true) ---
  const renderEditAccordionView = () => {
    return (
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-foreground text-background">
                EDITING
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-foreground/10 text-foreground/60">
                {modalCategory.toUpperCase()}
              </span>
            </div>
            <h1 className="text-[28px] font-bold uppercase leading-tight text-foreground truncate mt-1">
              {details.title || 'UNTITLED EVENT'}
            </h1>
            <span className="text-[13px] font-bold uppercase text-foreground/50">
              {formattedDateStr} @ {details.startTime?.replace(':', '') || '2000'} • {details.venue || 'VENUE TBD'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[50px] h-[50px] rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-6 h-6 text-foreground" />
          </button>
        </div>

        {/* Warnings Banner if any */}
        {editingWarnings.length > 0 && (
          <div className="p-4 rounded-[14px] bg-[var(--warning)]/10 border border-[var(--warning)]/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--warning)] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-bold text-[var(--warning)] uppercase tracking-wider">
                {editingWarnings.length} {editingWarnings.length === 1 ? 'FIELD NEEDS' : 'FIELDS NEED'} ATTENTION
              </span>
              <span className="text-[11px] font-medium text-foreground/70">
                Please complete missing information: {editingWarnings.join(', ')}.
              </span>
            </div>
          </div>
        )}

        {/* Section 1: Event Type & Client */}
        <AccordionCard
          isOpen={!!expandedSections.basics}
          onToggle={() => toggleEditSection('basics')}
          stepNumber="01"
          title="EVENT BASICS & CLIENT"
          summary={`${eventType?.toUpperCase() || 'EVENT'} • ${details.clientName ? `CLIENT: ${details.clientName}` : 'NO CLIENT'} • ${details.guests || 0} GUESTS • ${setting.toUpperCase()}`}
        >
          {/* Event Type selector */}
          <div>
            <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-2', tcMuted)}>EVENT TYPE</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EVENT_TYPES.map(({ value, label }) => {
                const isSelected = eventType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setEventType(value);
                      if (!titleManuallyEdited) autoGenerateTitle(details.clientName, value);
                    }}
                    className={cn(
                      'p-3 rounded-[10px] border text-left transition-all flex items-center justify-between',
                      isSelected
                        ? 'bg-foreground text-background border-foreground shadow-sm'
                        : 'bg-foreground/5 text-foreground/70 border-foreground/10 hover:bg-foreground/10'
                    )}
                  >
                    <span className="text-[12px] font-bold uppercase">{label}</span>
                    <DotRadio selected={isSelected} activeColor={isSelected ? 'var(--background)' : dotActive} inactiveColor={dotInactive} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Client Name */}
          <div>
            <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>CLIENT NAME</span>
            <input
              type="text"
              value={details.clientName}
              onChange={(e) => {
                setDetails(prev => ({ ...prev, clientName: e.target.value }));
                autoGenerateTitle(e.target.value, eventType);
              }}
              placeholder="EG. ROSSI"
              className={cn('w-full bg-transparent border-b pb-2 text-[20px] font-bold uppercase focus:outline-none', tc, bcMuted, 'placeholder:text-foreground/30 focus:border-foreground')}
            />
          </div>

          {/* Event Title */}
          <div>
            <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>EVENT TITLE</span>
            <input
              type="text"
              value={details.title}
              onChange={(e) => {
                setDetails({ ...details, title: e.target.value });
                setTitleManuallyEdited(true);
              }}
              placeholder="EG. WEDDING PARTY"
              className={cn('w-full bg-transparent border-b pb-2 text-[20px] font-bold uppercase focus:outline-none', tc, bcMuted, 'placeholder:text-foreground/30 focus:border-foreground')}
            />
          </div>

          {/* Guests & Setting */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div>
              <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-2', tcMuted)}>GUESTS</span>
              <div className="flex items-center gap-3 mb-2">
                <button
                  type="button"
                  onClick={() => setDetails(prev => ({ ...prev, guests: Math.max(0, prev.guests - 10) }))}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-foreground text-background"
                >
                  <Minus className="w-4 h-4 text-background" />
                </button>
                <span className={cn('text-[28px] font-bold leading-none flex-1 text-center', tc)}>{details.guests}</span>
                <button
                  type="button"
                  onClick={() => setDetails(prev => ({ ...prev, guests: prev.guests + 10 }))}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-foreground text-background"
                >
                  <Plus className="w-4 h-4 text-background" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[50, 100, 150, 200, 300, 500].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDetails(prev => ({ ...prev, guests: n }))}
                    className={cn(
                      'px-2.5 py-1 rounded-[6px] text-[10px] font-bold transition-all',
                      details.guests === n ? bgPillSelected : bgPillUnselected
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-2', tcMuted)}>SETTING</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSetting('indoor')}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-[12px] font-bold uppercase border transition-all text-center',
                    setting === 'indoor' ? bgPillSelected + ' border-current' : 'bg-transparent text-foreground/50 border-foreground/20'
                  )}
                >
                  INDOOR
                </button>
                <button
                  type="button"
                  onClick={() => setSetting('outdoor')}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-[12px] font-bold uppercase border transition-all text-center',
                    setting === 'outdoor' ? bgPillSelected + ' border-current' : 'bg-transparent text-foreground/50 border-foreground/20'
                  )}
                >
                  OUTDOOR
                </button>
              </div>
            </div>
          </div>
        </AccordionCard>

        {/* Section 2: Date, Time & Venue */}
        <AccordionCard
          isOpen={!!expandedSections.date_venue}
          onToggle={() => toggleEditSection('date_venue')}
          stepNumber="02"
          title="DATE, TIME & VENUE"
          summary={`${formattedDateStr} @ ${details.startTime} - ${details.endTime} • ${details.venue || 'VENUE TBD'}`}
          hasWarning={warnField('date') || warnField('venue') || warnField('time')}
        >
          {/* Venue */}
          <div className={cn(warnField('venue') && 'rounded-[10px] p-3 -m-3 bg-[var(--warning)]/10 ring-2 ring-[var(--warning)]/30')}>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-[10px] font-bold uppercase tracking-wider', warnField('venue') ? 'text-[var(--warning)]' : tcMuted)}>VENUE</span>
              {warnField('venue') && <AlertCircle className="w-3 h-3 text-[var(--warning)]" />}
            </div>
            <VenueAutocomplete
              value={details.venue}
              onChange={(val) => setDetails({ ...details, venue: val })}
              onSelect={(place) => {
                setDetails(prev => ({
                  ...prev,
                  venue: place.name,
                  ...(place.address ? { address: place.address } : {}),
                  ...(place.city ? { city: place.city } : {}),
                  ...(place.state ? { province: place.state } : {}),
                  ...(place.postcode ? { zip: place.postcode } : {}),
                  ...(place.country ? { country: place.country } : {}),
                }));
              }}
              placeholder="VENUE NAME"
              className={cn('w-full bg-transparent border-b pb-2 text-[20px] font-bold uppercase focus:outline-none mb-3', tc, warnField('venue') ? 'border-[var(--warning)]/50' : bcMuted, 'placeholder:text-foreground/30 focus:border-foreground')}
            />
            {/* Address Tags */}
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={details.address}
                onChange={(e) => setDetails({ ...details, address: e.target.value })}
                placeholder="ADDRESS"
                className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[140px]', bgPill, 'text-foreground/80 placeholder:text-foreground/30 focus:bg-foreground/15')}
              />
              <input
                type="text"
                value={details.city}
                onChange={(e) => setDetails({ ...details, city: e.target.value })}
                placeholder="CITY"
                className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[80px]', bgPill, 'text-foreground/80 placeholder:text-foreground/30 focus:bg-foreground/15')}
              />
              <input
                type="text"
                value={details.province}
                onChange={(e) => setDetails({ ...details, province: e.target.value })}
                placeholder="PROVINCE"
                className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[80px]', bgPill, 'text-foreground/80 placeholder:text-foreground/30 focus:bg-foreground/15')}
              />
              <input
                type="text"
                value={details.zip}
                onChange={(e) => setDetails({ ...details, zip: e.target.value })}
                placeholder="ZIP"
                className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[50px]', bgPill, 'text-foreground/80 placeholder:text-foreground/30 focus:bg-foreground/15')}
              />
              <input
                type="text"
                value={details.country}
                onChange={(e) => setDetails({ ...details, country: e.target.value })}
                placeholder="COUNTRY"
                className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[60px]', bgPill, 'text-foreground/80 placeholder:text-foreground/30 focus:bg-foreground/15')}
              />
            </div>
          </div>

          {/* Calendar */}
          <div className={cn(warnField('date') && 'rounded-lg p-3 -m-3 bg-[var(--warning)]/10 ring-2 ring-[var(--warning)]/30')}>
            {warnField('date') && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-[var(--warning)] uppercase tracking-wider">DATE</span>
                <AlertCircle className="w-3 h-3 text-[var(--warning)]" />
              </div>
            )}
            <CalendarGrid selectedDate={details.date} onSelectDate={(d) => setDetails({ ...details, date: d })} isDark={isDarkBg} />
          </div>

          {/* Start / End Times */}
          <div className={cn('grid grid-cols-2 gap-6', warnField('time') && 'rounded-[10px] p-3 -m-3 bg-[var(--warning)]/10 ring-2 ring-[var(--warning)]/30')}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', warnField('time') ? 'text-[var(--warning)]' : tcMuted)}>START</span>
                {warnField('time') && <AlertCircle className="w-3 h-3 text-[var(--warning)]" />}
              </div>
              <TimePicker
                value={details.startTime}
                onChange={(val) => setDetails({ ...details, startTime: val })}
                textSize="text-[20px]"
                showIcon
                className={cn('border-b pb-2 uppercase focus-within:border-foreground', tc, warnField('time') ? 'border-[var(--warning)]/50' : bcMuted)}
              />
            </div>
            <div>
              <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>END</span>
              <TimePicker
                value={details.endTime}
                onChange={(val) => setDetails({ ...details, endTime: val })}
                textSize="text-[20px]"
                showIcon
                className={cn('border-b pb-2 uppercase focus-within:border-foreground', tc, bcMuted)}
              />
            </div>
          </div>
        </AccordionCard>

        {/* Section 3: Band Roster & Compensation */}
        <AccordionCard
          isOpen={!!expandedSections.team_pay}
          onToggle={() => toggleEditSection('team_pay')}
          stepNumber="03"
          title="BAND & COMPENSATION"
          summary={`${selectedMembers.length} OF ${MEMBERS.length} MUSICIANS • TOTAL: ${currencySymbol}${grandTotalFee}`}
          hasWarning={warnField('members') || warnField('fee')}
        >
          {/* Performance Type Presets */}
          <div>
            <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-2', tcMuted)}>PERFORMANCE TYPE</span>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'SOLO', count: 1, type: 'solo' as PerformanceType },
                { label: 'DUO', count: 2, type: 'duo' as PerformanceType },
                { label: 'TRIO', count: 3, type: 'trio' as PerformanceType },
                { label: 'QUARTET', count: 4, type: 'full_band' as PerformanceType },
                { label: 'FULL BAND', count: MEMBERS.length || 1, type: 'full_band' as PerformanceType },
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setPerformanceType(preset.type);
                    const newSelected = MEMBERS.slice(0, preset.count).map(m => m.id);
                    if (currentUserMemberId && !newSelected.includes(currentUserMemberId)) {
                      newSelected[0] = currentUserMemberId;
                    }
                    setSelectedMembers(newSelected);
                    const newFees: Record<string, string> = {};
                    newSelected.forEach((id, idx) => {
                      if (memberFees[id] && memberFees[id] !== '0') {
                        newFees[id] = memberFees[id];
                      } else {
                        newFees[id] = getAutoFeeForMember(id, newSelected.slice(0, idx), pricingSettings);
                      }
                    });
                    setMemberFees(newFees);
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-[11px] font-bold uppercase border transition-all',
                    selectedMembers.length === preset.count
                      ? bgPillSelected + ' border-current'
                      : 'bg-transparent text-foreground/50 border-foreground/20'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Musicians Roster */}
          <div className={cn(warnField('members') && 'rounded-[10px] p-3 -m-3 bg-[var(--warning)]/10 ring-2 ring-[var(--warning)]/30')}>
            <div className="flex items-center gap-2 mb-3">
              <span className={cn('text-[10px] font-bold uppercase tracking-wider', warnField('members') ? 'text-[var(--warning)]' : tcMuted)}>ROSTER</span>
              {warnField('members') && <AlertCircle className="w-3 h-3 text-[var(--warning)]" />}
            </div>

            <div className="flex flex-col">
              {MEMBERS.map((member) => {
                const isSelected = selectedMembers.includes(member.id);
                const isCurrentUser = member.id === currentUserMemberId;
                const isLocked = isSelected && isCurrentUser;
                const showFee = isSelected && isAdmin;

                return (
                  <div
                    key={member.id}
                    className="flex items-start justify-between py-3 border-b last:border-0 border-foreground/10"
                  >
                    <div className="flex flex-col gap-1 flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'px-2 py-0.5 text-[10px] font-bold uppercase rounded',
                          isSelected
                            ? 'bg-foreground text-background'
                            : 'bg-foreground/10 text-foreground/50'
                        )}>
                          {isCurrentUser ? 'YOU / ' + member.role : member.role}
                        </span>
                        {isLocked && (
                          <span className={cn('text-[9px] font-bold uppercase', tcSub)}>REQUIRED</span>
                        )}
                      </div>
                      <span className={cn(
                        'text-[18px] font-bold uppercase transition-opacity',
                        isSelected ? tc : 'text-foreground/30'
                      )}>
                        {member.name}
                      </span>
                      
                      {/* Fee input */}
                      <AnimatePresence>
                        {showFee && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="flex items-center gap-1 mt-1">
                              <span className={cn('font-bold text-sm', tcSub)}>{currencySymbol}</span>
                              <input
                                type="number"
                                value={memberFees[member.id] || ''}
                                onChange={(e) => updateFee(member.id, e.target.value)}
                                placeholder={getAutoFeeForMember(member.id, selectedMembers, pricingSettings)}
                                className={cn(
                                  'bg-transparent font-bold text-sm border-b focus:outline-none w-20 pb-0.5',
                                  'text-foreground/60 border-foreground/10 focus:border-foreground placeholder:text-foreground/20'
                                )}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => toggleMember(member.id)}
                      className="shrink-0 mt-1"
                    >
                      <DotCheckbox
                        checked={isSelected}
                        disabled={isLocked}
                        activeColor={dotActive}
                        inactiveColor={dotInactive}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Extra fee & duration */}
          <div className="flex flex-col gap-4 pt-2 border-t border-foreground/10">
            {isAdmin && (
              <div>
                <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>EXTRA BAND FEE / GIG RENTAL</span>
                <div className="flex items-center">
                  <span className={cn('text-[20px] font-bold', tcSub)}>{currencySymbol}</span>
                  <input
                    type="number"
                    value={extraBandFee}
                    onChange={(e) => setExtraBandFee(e.target.value)}
                    placeholder="0"
                    className={cn('bg-transparent text-[20px] font-bold focus:outline-none w-full placeholder:text-foreground/30', tc)}
                  />
                </div>
                {pricingSettings.custom_services?.filter(s => s.is_active).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {pricingSettings.custom_services.filter(s => s.is_active).map(service => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => {
                          const current = parseFloat(extraBandFee) || 0;
                          setExtraBandFee(String(current + service.price));
                        }}
                        className="px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase border border-foreground/15 bg-foreground/5 hover:bg-foreground/10 text-foreground/70 transition-colors"
                      >
                        + {service.name} ({currencySymbol}{service.price})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>DURATION</span>
              <select
                value={details.duration}
                onChange={(e) => setDetails({ ...details, duration: parseInt(e.target.value) || 0 })}
                className={cn('bg-transparent text-[20px] font-bold focus:outline-none w-full appearance-none cursor-pointer', tc)}
              >
                {DURATION_15M_OPTIONS.map(m => (
                  <option key={m} value={m} className="text-black bg-white text-base">
                    {formatDurationOption(m)}
                  </option>
                ))}
              </select>
            </div>

            {/* Total calculation row */}
            <div className="flex items-center justify-between py-2 border-t border-foreground/10">
              <span className={cn('text-[11px] font-bold uppercase tracking-wider', tcMuted)}>TOTAL ESTIMATE</span>
              <span className={cn('text-[24px] font-bold', tc)}>{currencySymbol}{grandTotalFee}</span>
            </div>
          </div>
        </AccordionCard>

        {/* Section 4: Setlist, Tasks & Notes */}
        <AccordionCard
          isOpen={!!expandedSections.setlist_tasks}
          onToggle={() => toggleEditSection('setlist_tasks')}
          stepNumber="04"
          title="SETLIST, TASKS & NOTES"
          summary={`${setlist.reduce((acc, s) => acc + (s.songs?.length || 0), 0)} SONGS • ${tasks.length} TASKS • ${notes ? 'NOTES ATTACHED' : 'NO NOTES'}`}
        >
          {/* Setlist Card */}
          <div className="p-4 rounded-xl border border-foreground/10 bg-foreground/[0.03] flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase text-foreground/50">SETLIST</span>
              <span className="text-[16px] font-bold text-foreground">
                {setlist.length} {setlist.length === 1 ? 'Set' : 'Sets'} • {setlist.reduce((acc: number, s: any) => acc + ((s.songs || []).length), 0)} Songs
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSongsView(true)}
              className="px-4 py-2 rounded-lg text-[12px] font-bold uppercase bg-foreground text-background hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <Music className="w-4 h-4" />
              <span>MANAGE SETLIST</span>
            </button>
          </div>

          {/* Tasks List */}
          <div>
            <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-2', tcMuted)}>TASKS</span>
            {taskTemplates.length > 0 && tasks.length === 0 && (
              <div className="mb-3">
                <span className={cn('text-[9px] font-bold uppercase block mb-1', tcSub)}>LOAD TEMPLATE</span>
                <div className="flex flex-wrap gap-1.5">
                  {taskTemplates.map(tpl => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        const loaded = tpl.tasks.map((t: any) => ({
                          uid: `t-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                          title: t.title,
                          completed: false,
                          templateId: tpl.id,
                        }));
                        setTasks(loaded);
                      }}
                      className="px-2.5 py-1 rounded-[8px] text-[10px] font-bold flex items-center gap-1.5 transition-all bg-foreground/10 text-foreground hover:bg-foreground/15"
                    >
                      <Folder className={cn('w-3 h-3', tcSub)} />
                      {tpl.name}
                      <span className={tcFaint}>{tpl.tasks.length}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {tasks.map((task, i) => (
                <div key={task.uid || i} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) => {
                      const newTasks = [...tasks];
                      newTasks[i] = { ...newTasks[i], title: e.target.value };
                      setTasks(newTasks);
                    }}
                    placeholder="Task description..."
                    className={cn('flex-1 bg-transparent border-b-2 py-1 text-sm font-bold focus:outline-none transition-all border-foreground/15 placeholder:text-foreground/30 focus:border-foreground', tc)}
                  />
                  <button
                    type="button"
                    onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))}
                    className="text-foreground/30 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setTasks([...tasks, { uid: `t-${Date.now()}`, title: '', completed: false }])}
                className={cn('text-[12px] font-bold uppercase flex items-center gap-1 transition-colors mt-1', tcMuted, 'hover:text-foreground')}
              >
                <Plus className="w-3 h-3" /> Add task
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>NOTES FOR THE BAND</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details or notes for the band..."
              rows={3}
              className={cn('w-full bg-transparent border p-3 rounded-lg text-sm font-medium focus:outline-none transition-all border-foreground/15 placeholder:text-foreground/30 focus:border-foreground', tc)}
            />
          </div>
        </AccordionCard>
      </div>
    );
  };

  // --- Render current step ---
  const renderStep = () => {
    switch (step) {
      case 0: return renderStep1();
      case 1: return renderStep2();
      case 2: return renderStep3();
      case 3: return renderStep4();
      default: return null;
    }
  };

  // --- Footer button config for Wizard ---
  const isLastStep = step === STEPS.length - 1;
  const isFirstStep = step === 0;
  const currentStepConfig = STEPS[step];
  const isSkippable = currentStepConfig.skippable;

  const canProceed = (() => {
    switch (step) {
      case 0: return eventType !== null;
      case 1: return !!details.date;
      case 2: return true; // Optional step: Never hard-lock the user
      case 3: return true;
      default: return true;
    }
  })();

  const hasStepData = (() => {
    if (step === 2) return Object.values(memberFees).some(f => parseFloat(f) > 0) || parseFloat(extraBandFee) > 0;
    return false;
  })();

  const rightButtonLabel = isLastStep
    ? 'CREATE EVENT'
    : isSkippable
      ? (hasStepData ? 'NEXT' : 'SKIP')
      : 'NEXT';
  const rightButtonAction = isLastStep ? handleCreate : handleNext;

  if (isEditing) {
    return (
      <>
        <motion.div
          data-modal-open="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
          style={{
            backgroundColor: modalBg,
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <WizardAccentRail color={activeAccentColor} />
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-6">
            {renderEditAccordionView()}
          </div>

          {/* Sticky Footer for Edit */}
          <div className="px-4 py-5 shrink-0 border-t border-foreground/10 bg-background/95 backdrop-blur-md">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="py-4 bg-foreground/10 hover:bg-foreground/15 rounded-[10px] flex items-center justify-center gap-2 transition-colors font-bold text-[16px] text-foreground"
              >
                <X className="w-4 h-4 text-foreground" />
                <span>CANCEL</span>
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!details.date}
                style={{
                  backgroundColor: details.date ? activeAccentColor : undefined,
                  color: details.date ? activeAccentFg : undefined,
                }}
                className={cn(
                  'py-4 rounded-[10px] flex items-center justify-center gap-2 transition-all font-bold text-[16px]',
                  details.date
                    ? 'shadow-lg shadow-black/20 hover:opacity-95 cursor-pointer'
                    : 'bg-foreground/10 text-foreground/30 cursor-not-allowed'
                )}
              >
                <Check className="w-4 h-4" />
                <span>SAVE CHANGES</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Songs Sub-view */}
        <AnimatePresence>
          {songsView && renderSongsView()}
        </AnimatePresence>
      </>
    );
  }

  return (
    <>
      <motion.div
        data-modal-open="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
        style={{
          backgroundColor: modalBg,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <WizardAccentRail color={activeAccentColor} />
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 pt-16 pb-4">
          {/* Interactive Step Indicator */}
          <div className="mb-2">
            <InteractiveStepIndicator
              current={step}
              total={STEPS.length}
              steps={STEPS}
              maxAccessibleStep={maxAccessibleStep}
              onSelectStep={(s) => setStep(s)}
              activeColor={dotActive}
              inactiveColor={dotInactive}
            />
          </div>

          {/* Header + Quick Save + Close */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex flex-col gap-1 min-w-0 pr-2">
              <span className={cn('text-[12px] font-bold uppercase', tc)}>
                {STEPS[step].label}
              </span>
              <h1 className={cn('text-[32px] font-bold uppercase leading-[1] whitespace-pre-line', tc)}>
                {STEPS[step].title}
              </h1>
              <span className={cn('text-[16px] font-bold uppercase', tcMuted)}>
                {STEPS[step].subtitle}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canQuickSave && !isLastStep && (
                <button
                  type="button"
                  onClick={handleCreate}
                  style={{
                    backgroundColor: activeAccentColor,
                    color: activeAccentFg,
                  }}
                  className="px-3.5 py-2 rounded-full text-[11px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 shadow-sm hover:opacity-95 cursor-pointer"
                  title="Create event now with current details"
                >
                  <span>QUICK SAVE</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-[50px] h-[50px] rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center shrink-0 transition-colors"
              >
                <X className={cn('w-6 h-6', tc)} />
              </button>
            </div>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-4 py-5 shrink-0 border-t border-foreground/10 bg-background/95 backdrop-blur-md">
          <div className="grid grid-cols-2 gap-2.5">
            {isFirstStep ? (
              <button
                type="button"
                onClick={onClose}
                className="py-4 bg-foreground/10 hover:bg-foreground/15 rounded-[10px] flex items-center justify-center gap-2 transition-colors"
              >
                <X className="w-4 h-4 text-foreground" />
                <span className="text-[16px] font-bold text-foreground">CANCEL</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBack}
                className="py-4 bg-foreground/10 hover:bg-foreground/15 rounded-[10px] flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-foreground" />
                <span className="text-[16px] font-bold text-foreground">BACK</span>
              </button>
            )}
            <button
              type="button"
              onClick={rightButtonAction}
              disabled={!canProceed}
              style={{
                backgroundColor: canProceed ? activeAccentColor : undefined,
                color: canProceed ? activeAccentFg : undefined,
              }}
              className={cn(
                'py-4 rounded-[10px] flex items-center justify-center gap-2 transition-all font-bold text-[16px]',
                canProceed
                  ? 'shadow-lg shadow-black/20 hover:opacity-95 cursor-pointer'
                  : 'bg-foreground/10 text-foreground/30 cursor-not-allowed'
              )}
            >
              <span>{rightButtonLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Secondary Quick Save option in footer on Steps 1 and 2 */}
          {canQuickSave && !isLastStep && (
            <div className="pt-2.5 text-center">
              <button
                type="button"
                onClick={handleCreate}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground/50 hover:text-foreground transition-colors py-1 cursor-pointer"
              >
                <span>⚡ Quick Save (Skip remaining steps)</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Songs Sub-view */}
      <AnimatePresence>
        {songsView && renderSongsView()}
      </AnimatePresence>
    </>
  );
};
