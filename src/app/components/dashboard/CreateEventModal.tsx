import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Minus,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Music,
  Music2,
  Folder,
  Check,
  Sparkles,
  Briefcase,
  Users,
  Mic2,
  Sliders,
  MapPin,
  Calendar,
  Clock,
  Edit3,
  CheckSquare,
  Layers,
  Euro,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { DotRadio } from '@/app/components/ui/DotRadio';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { SongPicker, type PickedSong } from '@/app/components/ui/SongPicker';
import { WizardAccentRail, getEventAccentColor } from '@/app/components/ui/WizardAccentRail';
import { PeekingScrollContainer } from '@/app/components/ui/PeekingScrollContainer';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { TimePicker } from '@/app/components/ui/TimePicker';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { RehearsalCreationWizard } from '@/app/components/rehearsal/RehearsalCreationWizard';
import { useBand } from '@/lib/BandContext';
import { getSongs, getSetlists, getSetlist, type Song, type Setlist } from '@/lib/services/songs';
import { supabase } from '@/lib/supabase';
import { getBandPricing, DEFAULT_BAND_PRICING, type BandPricingSettings } from '@/lib/services/pricing';

export interface BandMember {
  id: string;
  user_id: string;
  name: string;
  role: string;
  fee: string;
  initials: string;
}

interface TaskTemplate {
  id: string;
  name: string;
  category: string;
  tasks: { id: string; title: string; dueOffset: number; required: boolean }[];
}

type EventType = 'gig' | 'wedding' | 'corporate' | 'private' | 'festival' | 'club' | 'other' | 'rehearsal';
type PerformanceType = 'full_band' | 'duo' | 'trio' | 'solo' | 'dj_set' | 'acoustic' | 'karaoke';
type SettingType = 'indoor' | 'outdoor';

const EVENT_TYPE_OPTIONS: {
  value: EventType;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'wedding', label: 'Wedding', subtitle: 'Ceremony, dinner & party', icon: Sparkles },
  { value: 'corporate', label: 'Corporate', subtitle: 'Company gala & summits', icon: Briefcase },
  { value: 'private', label: 'Private Party', subtitle: 'Birthdays & celebrations', icon: Users },
  { value: 'festival', label: 'Festival', subtitle: 'Open-air & main stages', icon: Music },
  { value: 'club', label: 'Club / Pub', subtitle: 'Live music & night venue', icon: Mic2 },
  { value: 'other', label: 'Other', subtitle: 'Custom musician lineup', icon: Sliders },
];

const STEPS = [
  { id: 'basics', title: 'EVENT & LINEUP' },
  { id: 'datetime', title: 'DATE & VENUE' },
  { id: 'review', title: 'REVIEW & CONFIRM' },
];

export const DURATION_15M_OPTIONS = [
  15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 270, 300, 360,
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
  onOpenPollBuilder?: () => void;
  onOpenProposeRehearsal?: () => void;
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
  steps: { id: string; title: string }[];
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
          aria-label={`Step ${i + 1}: ${steps[i]?.title || ''}`}
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
                ? activeColor || 'var(--wizard-accent)'
                : isAccessible
                  ? activeColor || 'var(--wizard-accent)'
                  : inactiveColor || 'var(--border)',
              opacity: isCurrent ? 1 : isAccessible ? 0.4 : 0.15,
            }}
          />
          <div className="flex items-center gap-1 mt-1">
            <span
              className={cn(
                'text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap',
                isCurrent ? 'text-[var(--fg)]' : 'text-muted-foreground group-hover:text-[var(--fg)]'
              )}
            >
              STEP 0{i + 1}
            </span>
          </div>
        </button>
      );
    })}
  </div>
);

// --- Accordion Card for Editing ---
const EditAccordionCard: React.FC<{
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
    <div
      className={cn(
        'rounded-2xl border transition-all overflow-hidden',
        hasWarning
          ? 'border-[var(--warning)]/50 bg-[var(--warning)]/5'
          : isOpen
            ? 'border-border/60 bg-card/60'
            : 'border-border/40 bg-card hover:border-border/60'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors cursor-pointer"
      >
        <div className="flex flex-col gap-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {stepNumber}
            </span>
            <span className="text-base font-bold uppercase text-[var(--fg)]">{title}</span>
            {hasWarning && (
              <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-[var(--warning)]/15 text-[var(--warning)] flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {warningLabel}
              </span>
            )}
          </div>
          <span className="text-xs font-semibold uppercase text-muted-foreground truncate">
            {summary}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 w-8 h-8 rounded-full border border-border/40 flex items-center justify-center text-muted-foreground"
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
            <div className="px-5 pb-5 pt-2 border-t border-border/30 flex flex-col gap-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  onClose,
  onCreate,
  initialType,
  bandMembers = [],
  currentUserId,
  editingEvent,
  onOpenPollBuilder,
  onOpenProposeRehearsal,
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
    const hasMembers =
      (editingEvent.memberUserIds?.length ?? 0) > 0 || (editingEvent.members?.length ?? 0) > 0;
    if (!hasMembers) w.push('members');
    return w;
  }, [editingEvent]);

  const [step, setStep] = useState(0);
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [songPickerTargetSet, setSongPickerTargetSet] = useState<string | null>(null);

  // Review step collapsibles (closed by default)
  const [isReviewSetlistExpanded, setIsReviewSetlistExpanded] = useState(false);
  const [isReviewLogisticsExpanded, setIsReviewLogisticsExpanded] = useState(false);
  const [isReviewTasksExpanded, setIsReviewTasksExpanded] = useState(false);

  // Lineup bar expansion in Step 1
  const [isRosterExpanded, setIsRosterExpanded] = useState(false);

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

  const [savedSetlists, setSavedSetlists] = useState<Setlist[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);

  useEffect(() => {
    if (!selectedBand?.id) return;
    const fetchLibrary = async () => {
      const [setlistsRes, taskTplRes] = await Promise.all([
        getSetlists(selectedBand.id),
        supabase
          .from('task_templates')
          .select('*')
          .eq('band_id', selectedBand.id)
          .order('created_at', { ascending: false }),
      ]);
      if (setlistsRes.data) setSavedSetlists(setlistsRes.data);
      if (taskTplRes.data) setTaskTemplates(taskTplRes.data);
    };
    fetchLibrary();
  }, [selectedBand?.id]);

  const MEMBERS = useMemo(() => bandMembers || [], [bandMembers]);
  const currentUserMember = useMemo(
    () => MEMBERS.find(m => m.user_id === currentUserId),
    [MEMBERS, currentUserId]
  );
  const currentUserMemberId = currentUserMember?.id || currentUserId || '';

  // --- Derive category ---
  const modalCategory: 'gig' | 'quote' | 'rehearsal' =
    initialType === 'rehearsal' ||
    editingEvent?.eventType?.toLowerCase() === 'rehearsal' ||
    editingEvent?.status?.toUpperCase() === 'REHEARSAL'
      ? 'rehearsal'
      : initialType === ('quote' as any) ||
          editingEvent?.status?.toUpperCase() === 'QUOTE' ||
          editingEvent?.status?.toUpperCase() === 'QUOTED'
        ? 'quote'
        : 'gig';

  useEffect(() => {
    if (!isAdmin && modalCategory === 'quote') {
      onClose();
    }
  }, [isAdmin, modalCategory, onClose]);

  if (!isAdmin && modalCategory === 'quote') {
    return null;
  }

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
      const member = memberObj || MEMBERS.find(m => m.id === memberId || m.user_id === memberId);
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
    if (s === 'QUOTED' || s === 'QUOTE') return 'wedding';
    return 'club';
  }, [editingEvent]);

  // Default eventType is null for quotes unless editing or explicitly passed
  const defaultEventType: EventType | null =
    initialType && initialType !== ('quote' as any)
      ? initialType
      : editingType || (modalCategory === 'quote' ? null : 'club');

  const [eventType, setEventType] = useState<EventType | null>(defaultEventType);
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
      return editingEvent.memberUserIds
        .map(uid => {
          const member = MEMBERS.find(m => m.user_id === uid);
          return member?.id || uid;
        })
        .filter(Boolean);
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
      const defaultRate =
        m?.fee && parseFloat(m.fee) > 0 ? m.fee : String(DEFAULT_BAND_PRICING.core_member_rate);
      return { [currentUserMemberId]: defaultRate };
    }
    return {};
  });

  // Load Band Pricing Settings and auto-populate fees if not editing
  useEffect(() => {
    if (!selectedBand?.id) return;
    let isCancelled = false;
    getBandPricing(selectedBand.id).then(settings => {
      if (isCancelled) return;
      setPricingSettings(settings);
      if (!isEditing) {
        if (selectedMembers.length === 0 && currentUserMemberId) {
          setSelectedMembers([currentUserMemberId]);
          const m = MEMBERS.find(mem => mem.id === currentUserMemberId || mem.user_id === currentUserMemberId);
          const autoFee =
            m?.fee && parseFloat(m.fee) > 0 ? m.fee : String(settings.core_member_rate);
          setMemberFees({ [currentUserMemberId]: autoFee });
        } else {
          setMemberFees(prev => {
            let changed = false;
            const updated = { ...prev };
            selectedMembers.forEach((id, index) => {
              if (!updated[id] || updated[id] === '0') {
                const m = MEMBERS.find(mem => mem.id === id || mem.user_id === id);
                const isCore = index < (settings.core_members_count ?? 1);
                const rate =
                  m?.fee && parseFloat(m.fee) > 0
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
  }, [selectedBand?.id, isEditing, currentUserMemberId, MEMBERS, selectedMembers]);

  const [setlist, setSetlist] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [notes, setNotes] = useState(editingEvent?.notes || '');
  const [extraBandFee, setExtraBandFee] = useState('');

  const activeAccentColor = useMemo(
    () => getEventAccentColor(eventType, modalCategory),
    [eventType, modalCategory]
  );

  const activeAccentFg = useMemo(() => {
    if (modalCategory === 'rehearsal') return 'var(--accent-rehearsal-fg)';
    if (modalCategory === 'quote') return 'var(--accent-quote-fg)';
    return 'var(--accent-gig-fg)';
  }, [modalCategory]);

  const totalPayout = useMemo(
    () => Object.values(memberFees).reduce((acc, fee) => acc + (parseFloat(fee) || 0), 0),
    [memberFees]
  );

  const grandTotalFee = useMemo(
    () => totalPayout + (parseFloat(extraBandFee) || 0),
    [totalPayout, extraBandFee]
  );

  const calculatedDurationBadge = useMemo(() => {
    if (!details.startTime || !details.endTime) return formatDurationOption(details.duration);
    const [sh, sm] = details.startTime.split(':').map(Number);
    const [eh, em] = details.endTime.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return formatDurationOption(details.duration);
    let totalMinutes = eh * 60 + em - (sh * 60 + sm);
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    if (totalMinutes === 0) return formatDurationOption(details.duration);
    return formatDurationOption(totalMinutes);
  }, [details.startTime, details.endTime, details.duration]);

  const formattedDateStr = useMemo(() => {
    if (!details.date) return 'DATE TBD';
    const d = new Date(details.date + 'T00:00:00');
    if (isNaN(d.getTime())) return details.date;
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [details.date]);

  const maxAccessibleStep = useMemo(() => {
    if (isEditing) return STEPS.length - 1;
    if (!eventType) return 0;
    if (!details.date) return 1;
    return STEPS.length - 1;
  }, [isEditing, eventType, details.date]);

  const getEffectiveTitle = useCallback(() => {
    if (details.title.trim()) return details.title.trim();
    const typeLabel = eventType ? eventType.charAt(0).toUpperCase() + eventType.slice(1) : 'Event';
    if (details.clientName.trim()) {
      return `${typeLabel} - ${details.clientName.trim()}`;
    }
    return `${typeLabel} ${modalCategory === 'quote' ? 'Quote' : 'Gig'}`;
  }, [details.title, details.clientName, eventType, modalCategory]);

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleCreate();
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
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

  const applyPerformancePreset = (preset: { label: string; count: number; type: PerformanceType }) => {
    setPerformanceType(preset.type);
    let newSelected: string[] = [];
    if (MEMBERS.length > 0) {
      newSelected = MEMBERS.slice(0, preset.count).map(m => m.id);
      if (currentUserMemberId && !newSelected.includes(currentUserMemberId)) {
        newSelected[0] = currentUserMemberId;
      }
    } else if (currentUserMemberId) {
      newSelected = [currentUserMemberId];
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
  };

  const handleCreate = () => {
    const fallbackTitle = getEffectiveTitle();

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
      eventType: (eventType || (modalCategory === 'quote' ? 'wedding' : 'club')) as EventType,
      _originalEventType: editingEvent?.eventType || eventType || 'club',
      performanceType,
      setting,
      members: membersWithUserIds,
      audienceIds: membersWithUserIds.map(m => m.id),
      setlist,
      tasks,
      notes,
      status: modalCategory === 'quote' ? 'tentative' : 'confirmed',
      ...(isEditing && editingEvent
        ? { _editing: true, _editingEventId: editingEvent.eventId, _editingLocalId: editingEvent.id }
        : {}),
    };
    onCreate(eventData);
  };

  // --- Rehearsal passthrough ---
  if (eventType === 'rehearsal') {
    if (!isAdmin) {
      return (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-rehearsal)]/15 border border-[var(--accent-rehearsal)]/30 flex items-center justify-center mb-4 text-[var(--accent-rehearsal)]">
            <Music className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black uppercase text-foreground mb-2">Member Restriction</h2>
          <p className="text-sm font-medium text-muted-foreground max-w-sm mb-6 leading-relaxed">
            Only band admins can directly schedule rehearsal events on the band calendar. Standard
            members can submit a rehearsal proposal instead.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-5 rounded-xl border border-foreground/15 text-foreground hover:bg-foreground/5 font-bold text-xs uppercase transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProposeRehearsal?.();
              }}
              className="py-3 px-6 rounded-xl bg-[var(--accent-rehearsal)] text-white hover:opacity-95 font-bold text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer"
            >
              Propose Rehearsal Instead
            </button>
          </div>
        </div>
      );
    }
    return (
      <RehearsalCreationWizard
        onClose={onClose}
        onCreate={onCreate}
        editingEvent={editingEvent}
        onOpenPollBuilder={onOpenPollBuilder}
      />
    );
  }

  // --- Inline Song & Setlist Handlers for Review Step ---
  const handlePickedSong = (picked: PickedSong) => {
    setSetlist(prev => {
      if (prev.length === 0) {
        return [
          {
            uid: `set-${Date.now()}`,
            title: 'Set 1',
            songs: [
              {
                uid: `song-${Date.now()}`,
                title: picked.title,
                artist: picked.artist,
                songId: picked.id,
              },
            ],
          },
        ];
      }
      const targetUid = songPickerTargetSet || prev[0].uid;
      return prev.map(s => {
        if (s.uid === targetUid) {
          const existingIds = new Set(
            (s.songs || []).filter((sg: any) => sg.songId).map((sg: any) => sg.songId)
          );
          if (existingIds.has(picked.id)) return s;
          return {
            ...s,
            songs: [
              ...(s.songs || []),
              {
                uid: `song-${Date.now()}`,
                title: picked.title,
                artist: picked.artist,
                songId: picked.id,
              },
            ],
          };
        }
        return s;
      });
    });
  };

  const handlePickedMultipleSongs = (picked: PickedSong[]) => {
    setSetlist(prev => {
      if (prev.length === 0) {
        return [
          {
            uid: `set-${Date.now()}`,
            title: 'Set 1',
            songs: picked.map(p => ({
              uid: `song-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              title: p.title,
              artist: p.artist,
              songId: p.id,
            })),
          },
        ];
      }
      const targetUid = songPickerTargetSet || prev[0].uid;
      return prev.map(s => {
        if (s.uid === targetUid) {
          const existingIds = new Set(
            (s.songs || []).filter((sg: any) => sg.songId).map((sg: any) => sg.songId)
          );
          const newSongs = picked.filter(p => !existingIds.has(p.id));
          return {
            ...s,
            songs: [
              ...(s.songs || []),
              ...newSongs.map(p => ({
                uid: `song-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                title: p.title,
                artist: p.artist,
                songId: p.id,
              })),
            ],
          };
        }
        return s;
      });
    });
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
    setSetlist(prev =>
      prev.map(s =>
        s.uid === setUid
          ? {
              ...s,
              songs: [...(s.songs || []), { uid: `song-${Date.now()}`, title: '', artist: '' }],
            }
          : s
      )
    );
  };

  const updateSongInSet = (setUid: string, songUid: string, field: string, value: string) => {
    setSetlist(prev =>
      prev.map(s =>
        s.uid === setUid
          ? {
              ...s,
              songs: (s.songs || []).map((song: any) =>
                song.uid === songUid ? { ...song, [field]: value } : song
              ),
            }
          : s
      )
    );
  };

  const removeSongFromSet = (setUid: string, songUid: string) => {
    setSetlist(prev =>
      prev.map(s =>
        s.uid === setUid
          ? { ...s, songs: (s.songs || []).filter((song: any) => song.uid !== songUid) }
          : s
      )
    );
  };

  const totalSongCount = useMemo(
    () => setlist.reduce((acc: number, s: any) => acc + (s.songs || []).length, 0),
    [setlist]
  );

  const handleAddNewTask = () => {
    if (!newTaskText.trim()) return;
    setTasks(prev => [
      ...prev,
      {
        uid: `t-${Date.now()}`,
        title: newTaskText.trim(),
        completed: false,
      },
    ]);
    setNewTaskText('');
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

  // ── STEP 01: EVENT & LINEUP ─────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
      {/* Optional Title & Client Inputs (2-Column) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            EVENT TITLE <span className="text-xs font-normal text-muted-foreground/60 lowercase">(optional)</span>
          </label>
          <input
            type="text"
            value={details.title}
            onChange={e => {
              setDetails(prev => ({ ...prev, title: e.target.value }));
              setTitleManuallyEdited(true);
            }}
            placeholder={getEffectiveTitle()}
            className="w-full bg-transparent border-b border-border/40 pb-2 text-base font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:border-[var(--wizard-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            CLIENT / PROMOTER <span className="text-xs font-normal text-muted-foreground/60 lowercase">(optional)</span>
          </label>
          <input
            type="text"
            value={details.clientName}
            onChange={e => {
              const val = e.target.value;
              setDetails(prev => ({ ...prev, clientName: val }));
              if (!titleManuallyEdited) {
                const typeLabel = eventType ? eventType.charAt(0).toUpperCase() + eventType.slice(1) : 'Event';
                const title = val ? `${typeLabel} - ${val}` : '';
                setDetails(prev => ({ ...prev, title }));
              }
            }}
            placeholder="e.g. Rossi / Red Bull"
            className="w-full bg-transparent border-b border-border/40 pb-2 text-base font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:border-[var(--wizard-accent)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Event Type Grid (Compact 2-Column with Lucide icons) */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2.5">
          EVENT TYPE
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          {EVENT_TYPE_OPTIONS.map(opt => {
            const isSelected = eventType === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setEventType(opt.value);
                  if (!titleManuallyEdited) {
                    const typeLabel = opt.value.charAt(0).toUpperCase() + opt.value.slice(1);
                    const title = details.clientName ? `${typeLabel} - ${details.clientName}` : '';
                    setDetails(prev => ({ ...prev, title }));
                  }
                }}
                className={cn(
                  'p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2',
                  isSelected
                    ? 'bg-[var(--wizard-accent)]/10 border-[var(--wizard-accent)] shadow-xs'
                    : 'bg-card/60 border-border/40 hover:border-border hover:bg-card'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                      isSelected ? 'bg-[var(--wizard-accent)] text-white' : 'bg-muted/60 text-muted-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[var(--fg)] leading-tight">{opt.label}</div>
                    <div className="text-xs text-muted-foreground truncate leading-snug mt-0.5">{opt.subtitle}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsible Lineup & Pay Summary Bar */}
      <div className="space-y-3 pt-1">
        {/* Presets Row */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              LINEUP PRESETS
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {selectedMembers.length} of {MEMBERS.length} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'SOLO', count: 1, type: 'solo' as PerformanceType },
              { label: 'DUO', count: 2, type: 'duo' as PerformanceType },
              { label: 'TRIO', count: 3, type: 'trio' as PerformanceType },
              { label: 'FULL BAND', count: MEMBERS.length || 1, type: 'full_band' as PerformanceType },
            ].map(preset => {
              const isPresetActive = selectedMembers.length === preset.count;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPerformancePreset(preset)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold uppercase border transition-all cursor-pointer',
                    isPresetActive
                      ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)] shadow-xs'
                      : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact Interactive Summary Card */}
        <div className="bg-card border border-border/40 rounded-xl p-3 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex -space-x-1.5 overflow-hidden shrink-0">
              {MEMBERS.filter(m => selectedMembers.includes(m.id))
                .slice(0, 5)
                .map(m => (
                  <div
                    key={m.id}
                    className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center border-2 border-card bg-foreground text-background"
                    title={m.name}
                  >
                    {m.initials}
                  </div>
                ))}
              {selectedMembers.length > 5 && (
                <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center border-2 border-card">
                  +{selectedMembers.length - 5}
                </div>
              )}
            </div>

            <div className="min-w-0 flex flex-col">
              <span className="text-sm font-semibold text-[var(--fg)] truncate">
                {selectedMembers.length} of {MEMBERS.length} Musicians
              </span>
              {isAdmin && grandTotalFee > 0 && (
                <span className="text-xs font-bold text-[var(--wizard-accent)]">
                  {currencySymbol}{grandTotalFee} est. total
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsRosterExpanded(!isRosterExpanded)}
            className="text-xs font-bold text-[var(--wizard-accent)] hover:opacity-80 flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
          >
            <span>{isRosterExpanded ? 'Done' : 'Customize'}</span>
            <ChevronDown
              className={cn('w-3.5 h-3.5 transition-transform', isRosterExpanded && 'rotate-180')}
            />
          </button>
        </div>

        {/* Expanded 1-Column Member Checklist with inline fees */}
        <AnimatePresence>
          {isRosterExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-3 pt-1"
            >
              <div className="divide-y divide-border/30 border-y border-border/30">
                {MEMBERS.map(member => {
                  const isSelected = selectedMembers.includes(member.id);
                  const isCurrentUser = member.id === currentUserMemberId;
                  const isLocked = isSelected && isCurrentUser;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-2.5 px-2 hover:bg-card/60 transition-colors rounded-lg"
                    >
                      <div
                        onClick={() => !isLocked && toggleMember(member.id)}
                        className={cn(
                          'flex items-center gap-3 min-w-0 flex-1 pr-3',
                          !isLocked && 'cursor-pointer'
                        )}
                      >
                        <DotCheckbox
                          checked={isSelected}
                          disabled={isLocked}
                          activeColor="var(--wizard-accent)"
                          inactiveColor="var(--border)"
                        />
                        <div className="min-w-0">
                          <span
                            className={cn(
                              'text-sm font-medium truncate block leading-normal',
                              isSelected ? 'text-[var(--fg)] font-semibold' : 'text-muted-foreground'
                            )}
                          >
                            {member.name}
                          </span>
                          <span className="text-xs text-muted-foreground uppercase tracking-wider block leading-normal">
                            {isCurrentUser ? 'YOU / ' + member.role : member.role}
                          </span>
                        </div>
                      </div>

                      {isSelected && isAdmin && (
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-xs font-bold text-muted-foreground">{currencySymbol}</span>
                          <input
                            type="number"
                            value={memberFees[member.id] || ''}
                            onChange={e => updateFee(member.id, e.target.value)}
                            placeholder={getAutoFeeForMember(
                              member.id,
                              selectedMembers,
                              pricingSettings
                            )}
                            className="w-20 bg-card border border-border/40 focus:border-[var(--wizard-accent)] rounded-lg px-2 py-1 text-right text-xs font-bold text-[var(--fg)] placeholder:text-muted-foreground/40 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Extra Band Fee / Services input */}
              {isAdmin && (
                <div className="bg-card/50 rounded-xl p-3 border border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      EXTRA BAND FEE / SERVICES
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-muted-foreground">{currencySymbol}</span>
                      <input
                        type="number"
                        value={extraBandFee}
                        onChange={e => setExtraBandFee(e.target.value)}
                        placeholder="0"
                        className="w-24 bg-card border border-border/40 focus:border-[var(--wizard-accent)] rounded-lg px-2 py-1 text-right text-xs font-bold text-[var(--fg)] placeholder:text-muted-foreground/40 focus:outline-none"
                      />
                    </div>
                  </div>
                  {pricingSettings.custom_services?.filter(s => s.is_active).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {pricingSettings.custom_services
                        .filter(s => s.is_active)
                        .map(service => (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => {
                              const current = parseFloat(extraBandFee) || 0;
                              setExtraBandFee(String(current + service.price));
                            }}
                            className="px-2 py-1 rounded-md text-xs font-semibold bg-muted hover:bg-muted/80 text-[var(--fg)] border border-border/40 transition-colors cursor-pointer"
                          >
                            + {service.name} ({currencySymbol}{service.price})
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  // ── STEP 02: DATE & VENUE ───────────────────────────────────
  const renderStep2 = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
      {/* Unified Venue Input */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
          VENUE / LOCATION
        </label>
        <div className="relative">
          <VenueAutocomplete
            value={details.venue}
            onChange={val => setDetails(prev => ({ ...prev, venue: val }))}
            onSelect={place => {
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
            placeholder="Search venue or location..."
            className="w-full bg-transparent border-b border-border/40 focus:border-[var(--wizard-accent)] pb-2 text-base font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:outline-none transition-colors pl-7"
          />
          <MapPin className="w-4 h-4 text-muted-foreground absolute left-0 bottom-3" />
        </div>

        {/* Quick-select chips */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {['TBD', 'Main Stage', 'Private Venue'].map(loc => (
            <button
              key={loc}
              type="button"
              onClick={() => setDetails(prev => ({ ...prev, venue: loc }))}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer border',
                details.venue === loc
                  ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                  : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
              )}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      {/* Date & Time Group */}
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
            EVENT DATE
          </label>
          <DatePicker
            value={details.date}
            onChange={d => setDetails(prev => ({ ...prev, date: d }))}
            accentColor={activeAccentColor}
            placeholder="Select event date..."
          />
        </div>

        {/* 2-Column Start Time and End Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
              START TIME
            </label>
            <TimePicker
              value={details.startTime}
              onChange={val => setDetails(prev => ({ ...prev, startTime: val }))}
              accentColor={activeAccentColor}
              textSize="text-base"
              showIcon
              className="border-b border-border/40 text-[var(--fg)] focus-within:border-[var(--wizard-accent)] transition-colors pb-1.5"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                END TIME
              </label>
              <span className="text-xs font-bold text-[var(--wizard-accent)]">
                {calculatedDurationBadge}
              </span>
            </div>
            <TimePicker
              value={details.endTime}
              onChange={val => setDetails(prev => ({ ...prev, endTime: val }))}
              accentColor={activeAccentColor}
              align="end"
              textSize="text-base"
              showIcon
              className="border-b border-border/40 text-[var(--fg)] focus-within:border-[var(--wizard-accent)] transition-colors pb-1.5"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // ── STEP 03: REVIEW & OPTIONAL EXTRAS ───────────────────────
  const renderStep3 = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
      {/* Unified Summary Card */}
      <div className="bg-card rounded-2xl p-4 sm:p-5 border border-border/40 space-y-4 shadow-2xs">
        {/* Badges & Title */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--wizard-accent)]/15 text-[var(--wizard-accent)]">
              {modalCategory === 'quote' ? 'QUOTE' : 'GIG'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-muted text-muted-foreground">
              {eventType?.toUpperCase() || 'EVENT'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-muted text-muted-foreground">
              {setting.toUpperCase()}
            </span>
            {isAdmin && grandTotalFee > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground flex items-center gap-1">
                {currencySymbol}{grandTotalFee}
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold text-[var(--fg)] tracking-tight">
            {getEffectiveTitle()}
          </h3>
          {details.clientName && (
            <span className="text-xs text-muted-foreground font-semibold block mt-0.5 uppercase">
              Client: {details.clientName}
            </span>
          )}
        </div>

        {/* Date, Time, Duration */}
        <div className="flex items-start gap-3 text-sm text-[var(--fg)]">
          <Calendar className="w-4 h-4 text-[var(--wizard-accent)] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-semibold block leading-normal">
              {details.date ? formattedDateStr : 'Date TBD'}
            </span>
            <span className="text-xs text-muted-foreground font-medium block leading-normal">
              {details.startTime || '20:00'} – {details.endTime || '23:30'} ({calculatedDurationBadge})
            </span>
          </div>
        </div>

        {/* Venue */}
        <div className="flex items-start gap-3 text-sm text-[var(--fg)]">
          <MapPin className="w-4 h-4 text-[var(--wizard-accent)] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-semibold block truncate leading-normal">
              {details.venue || 'Venue TBD'}
              {details.city ? ` • ${details.city}` : ''}
            </span>
          </div>
        </div>

        {/* Confirmed Members Avatar Stack */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <Users className="w-4 h-4 text-[var(--wizard-accent)] shrink-0" />
            <span className="text-sm font-semibold text-[var(--fg)] truncate">
              {selectedMembers.length} of {MEMBERS.length} Musicians Confirmed
            </span>
          </div>
          <div className="flex -space-x-1.5 overflow-hidden shrink-0 ml-2">
            {MEMBERS.filter(m => selectedMembers.includes(m.id))
              .slice(0, 6)
              .map(m => (
                <div
                  key={m.id}
                  className="w-6 h-6 rounded-full bg-muted border-2 border-card text-xs font-bold flex items-center justify-center text-muted-foreground"
                  title={m.name}
                >
                  {m.initials}
                </div>
              ))}
            {selectedMembers.length > 6 && (
              <div className="w-6 h-6 rounded-full bg-muted border-2 border-card text-xs font-bold flex items-center justify-center text-muted-foreground">
                +{selectedMembers.length - 6}
              </div>
            )}
          </div>
        </div>

        {/* Jump Actions */}
        <div className="pt-3 border-t border-border/30 flex items-center justify-between text-xs font-bold text-[var(--wizard-accent)]">
          <button
            type="button"
            onClick={() => setStep(0)}
            className="hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Event & Lineup</span>
          </button>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Date & Venue</span>
          </button>
        </div>
      </div>

      {/* Accordion 1: Setlist & Songs (Optional) */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setIsReviewSetlistExpanded(!isReviewSetlistExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--wizard-accent)]/10 text-[var(--wizard-accent)] flex items-center justify-center shrink-0">
              <Music2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--fg)]">Setlist & Songs</span>
                <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Optional
                </span>
              </div>
              <span className="text-xs text-muted-foreground block truncate mt-0.5">
                {totalSongCount === 0
                  ? '0 Songs / No Setlist'
                  : `${setlist.length} Set${setlist.length === 1 ? '' : 's'} • ${totalSongCount} Song${totalSongCount === 1 ? '' : 's'}`}
              </span>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2',
              isReviewSetlistExpanded && 'rotate-180'
            )}
          />
        </button>

        <AnimatePresence>
          {isReviewSetlistExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4 border-t border-border/30 pt-3 space-y-3 overflow-hidden"
            >
              {/* Load saved setlists */}
              {savedSetlists.length > 0 && setlist.length === 0 && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                    LOAD FROM TEMPLATES
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {savedSetlists.map(sl => (
                      <button
                        key={sl.id}
                        type="button"
                        onClick={() => loadSavedSetlist(sl)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-[var(--fg)] border border-border/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Folder className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{sl.name}</span>
                        {sl.song_count != null && (
                          <span className="text-muted-foreground">({sl.song_count})</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSongPickerTargetSet(setlist[0]?.uid || null);
                    setSongPickerOpen(true);
                  }}
                  className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-xs font-bold text-[var(--fg)] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[var(--wizard-accent)]" />
                  <span>+ Add Songs</span>
                </button>
                <button
                  type="button"
                  onClick={addSet}
                  className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-xs font-bold text-[var(--fg)] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-[var(--wizard-accent)]" />
                  <span>+ Add Set</span>
                </button>
              </div>

              {/* Sets List */}
              {setlist.length > 0 ? (
                <div className="space-y-3 pt-1">
                  {setlist.map((item, i) => (
                    <div
                      key={item.uid || i}
                      className="p-3 rounded-xl border border-border/40 bg-background/50 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={item.title}
                          onChange={e =>
                            setSetlist(prev =>
                              prev.map(s => (s.uid === item.uid ? { ...s, title: e.target.value } : s))
                            )
                          }
                          className="bg-transparent font-bold text-sm text-[var(--fg)] focus:outline-none focus:border-b border-border/40"
                          placeholder="Set name..."
                        />
                        <button
                          type="button"
                          onClick={() => removeSet(item.uid)}
                          className="text-xs text-muted-foreground hover:text-[var(--danger)] transition-colors cursor-pointer"
                        >
                          Remove Set
                        </button>
                      </div>

                      {/* Song list in this set */}
                      <div className="divide-y divide-border/20 rounded-lg border border-border/30 overflow-hidden bg-card/60">
                        {(item.songs || []).map((song: any, si: number) => (
                          <div
                            key={song.uid || si}
                            className="flex items-center justify-between py-1.5 px-2.5 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="text-xs font-bold text-muted-foreground w-4">
                                {si + 1}.
                              </span>
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-[var(--fg)] truncate block">
                                  {song.title || 'Untitled song'}
                                </span>
                                {song.artist && (
                                  <span className="text-xs text-muted-foreground truncate block">
                                    {song.artist}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeSongFromSet(item.uid, song.uid)}
                              className="p-1 text-muted-foreground hover:text-[var(--danger)] transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {(item.songs || []).length === 0 && (
                          <div className="py-2.5 px-3 text-center text-xs text-muted-foreground">
                            No songs in this set.
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSongPickerTargetSet(item.uid);
                            setSongPickerOpen(true);
                          }}
                          className="text-xs font-bold text-[var(--wizard-accent)] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Music className="w-3 h-3" />
                          <span>From Library</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => addSongToSet(item.uid)}
                          className="text-xs font-bold text-muted-foreground hover:text-[var(--fg)] flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Manual</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-3 text-center">
                  <span className="text-xs text-muted-foreground">
                    No sets added yet. Load a saved template or add songs from your catalog.
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Accordion 2: Logistics, Guests & Setting (Optional) */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setIsReviewLogisticsExpanded(!isReviewLogisticsExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--wizard-accent)]/10 text-[var(--wizard-accent)] flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--fg)]">
                  Logistics, Guests & Setting
                </span>
                <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Optional
                </span>
              </div>
              <span className="text-xs text-muted-foreground block truncate mt-0.5">
                {setting.toUpperCase()} • {details.guests || '0'} Guests •{' '}
                {formatDurationOption(details.duration)}
              </span>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2',
              isReviewLogisticsExpanded && 'rotate-180'
            )}
          />
        </button>

        <AnimatePresence>
          {isReviewLogisticsExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4 border-t border-border/30 pt-3 space-y-4 overflow-hidden"
            >
              {/* Setting Toggle */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  SETTING
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSetting('indoor')}
                    className={cn(
                      'py-2 px-3 rounded-xl border text-xs font-bold uppercase transition-all cursor-pointer text-center',
                      setting === 'indoor'
                        ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)] shadow-xs'
                        : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                    )}
                  >
                    Indoor
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetting('outdoor')}
                    className={cn(
                      'py-2 px-3 rounded-xl border text-xs font-bold uppercase transition-all cursor-pointer text-center',
                      setting === 'outdoor'
                        ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)] shadow-xs'
                        : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                    )}
                  >
                    Outdoor
                  </button>
                </div>
              </div>

              {/* Guests Count */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  ESTIMATED GUESTS
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDetails(prev => ({ ...prev, guests: Math.max(0, prev.guests - 10) }))
                    }
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-muted hover:bg-muted/80 text-[var(--fg)] transition-colors cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-2xl font-bold leading-none flex-1 text-center text-[var(--fg)]">
                    {details.guests}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDetails(prev => ({ ...prev, guests: prev.guests + 10 }))}
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-muted hover:bg-muted/80 text-[var(--fg)] transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[50, 100, 150, 200, 300].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setDetails(prev => ({ ...prev, guests: n }))}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer',
                        details.guests === n
                          ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                          : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                      )}
                    >
                      {n === 300 ? '300+' : n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Performance Duration */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  PERFORMANCE DURATION
                </label>
                <select
                  value={details.duration}
                  onChange={e =>
                    setDetails(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full bg-card border border-border/40 focus:border-[var(--wizard-accent)] rounded-xl px-3 py-2 text-sm font-semibold text-[var(--fg)] focus:outline-none cursor-pointer"
                >
                  {DURATION_15M_OPTIONS.map(m => (
                    <option key={m} value={m} className="bg-card text-[var(--fg)]">
                      {formatDurationOption(m)} ({m} min)
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Accordion 3: Tasks & Band Notes (Optional) */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setIsReviewTasksExpanded(!isReviewTasksExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--wizard-accent)]/10 text-[var(--wizard-accent)] flex items-center justify-center shrink-0">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--fg)]">Tasks & Band Notes</span>
                <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Optional
                </span>
              </div>
              <span className="text-xs text-muted-foreground block truncate mt-0.5">
                {tasks.length} Tasks • {notes ? 'Notes added' : 'No notes'}
              </span>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2',
              isReviewTasksExpanded && 'rotate-180'
            )}
          />
        </button>

        <AnimatePresence>
          {isReviewTasksExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4 border-t border-border/30 pt-3 space-y-4 overflow-hidden"
            >
              {/* Task Templates */}
              {taskTemplates.length > 0 && tasks.length === 0 && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                    LOAD FROM TEMPLATES
                  </span>
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
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-[var(--fg)] border border-border/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Folder className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{tpl.name}</span>
                        <span className="text-muted-foreground">({tpl.tasks.length})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Custom Task */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={e => setNewTaskText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewTask();
                    }
                  }}
                  placeholder="Add a preparation task..."
                  className="flex-1 bg-background border border-border/40 focus:border-[var(--wizard-accent)] rounded-lg px-3 py-2 text-sm text-[var(--fg)] placeholder:text-muted-foreground focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={handleAddNewTask}
                  disabled={!newTaskText.trim()}
                  className={cn(
                    'px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer',
                    newTaskText.trim()
                      ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] hover:opacity-90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  Add
                </button>
              </div>

              {/* Tasks List */}
              {tasks.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="divide-y divide-border/20 rounded-lg border border-border/30 bg-background/50 overflow-hidden">
                    {tasks.map((task, idx) => (
                      <div
                        key={task.uid || idx}
                        className="flex items-center justify-between py-2 px-3 hover:bg-muted/30 transition-colors"
                      >
                        <span className="text-sm font-medium text-[var(--fg)] truncate pr-2">
                          {task.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTasks(tasks.filter((_, i) => i !== idx))}
                          className="p-1 text-muted-foreground hover:text-[var(--danger)] transition-colors cursor-pointer shrink-0"
                          aria-label="Delete task"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Band Notes Textarea */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  BAND NOTES
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any details, directions, or notes for the band..."
                  rows={3}
                  className="w-full bg-background border border-border/40 focus:border-[var(--wizard-accent)] rounded-xl p-3 text-sm text-[var(--fg)] placeholder:text-muted-foreground focus:outline-none resize-none transition-colors"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  // ── ACCORDION EDIT VIEW (FOR isEditing === true) ─────────────
  const renderEditAccordionView = () => (
    <div className="flex flex-col gap-5">
      {/* Section 1: Event Basics & Client */}
      <EditAccordionCard
        isOpen={!!expandedSections.basics}
        onToggle={() => toggleEditSection('basics')}
        stepNumber="01"
        title="EVENT BASICS & CLIENT"
        summary={`${eventType?.toUpperCase() || 'EVENT'} • ${details.clientName ? `CLIENT: ${details.clientName}` : 'NO CLIENT'} • ${details.guests || 0} GUESTS • ${setting.toUpperCase()}`}
      >
        {/* Event Type selector */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider block mb-2 text-muted-foreground">
            EVENT TYPE
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {EVENT_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => {
              const isSelected = eventType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setEventType(value);
                    if (!titleManuallyEdited) {
                      const typeLabel = value.charAt(0).toUpperCase() + value.slice(1);
                      const title = details.clientName ? `${typeLabel} - ${details.clientName}` : '';
                      setDetails(prev => ({ ...prev, title }));
                    }
                  }}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer',
                    isSelected
                      ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)] shadow-sm'
                      : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)] hover:border-border/70'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold uppercase truncate">{label}</span>
                  </div>
                  <DotRadio
                    selected={isSelected}
                    activeColor="var(--wizard-accent-fg)"
                    inactiveColor="var(--border)"
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Client Name */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1 text-muted-foreground">
            CLIENT NAME
          </label>
          <input
            type="text"
            value={details.clientName}
            onChange={e => {
              const val = e.target.value;
              setDetails(prev => ({ ...prev, clientName: val }));
              if (!titleManuallyEdited) {
                const typeLabel = eventType ? eventType.charAt(0).toUpperCase() + eventType.slice(1) : 'Event';
                const title = val ? `${typeLabel} - ${val}` : '';
                setDetails(prev => ({ ...prev, title }));
              }
            }}
            placeholder="EG. ROSSI"
            className="w-full bg-transparent border-b border-border/40 pb-2 text-base font-bold uppercase focus:outline-none text-[var(--fg)] focus:border-[var(--wizard-accent)] transition-colors placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Event Title */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1 text-muted-foreground">
            EVENT TITLE
          </label>
          <input
            type="text"
            value={details.title}
            onChange={e => {
              setDetails({ ...details, title: e.target.value });
              setTitleManuallyEdited(true);
            }}
            placeholder={getEffectiveTitle()}
            className="w-full bg-transparent border-b border-border/40 pb-2 text-base font-bold uppercase focus:outline-none text-[var(--fg)] focus:border-[var(--wizard-accent)] transition-colors placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Guests & Setting */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-2 text-muted-foreground">
              GUESTS
            </label>
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={() =>
                  setDetails(prev => ({ ...prev, guests: Math.max(0, prev.guests - 10) }))
                }
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-muted hover:bg-muted/80 text-[var(--fg)] cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-2xl font-bold leading-none flex-1 text-center text-[var(--fg)]">
                {details.guests}
              </span>
              <button
                type="button"
                onClick={() => setDetails(prev => ({ ...prev, guests: prev.guests + 10 }))}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-muted hover:bg-muted/80 text-[var(--fg)] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[50, 100, 150, 200, 300].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDetails(prev => ({ ...prev, guests: n }))}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-bold transition-all border cursor-pointer',
                    details.guests === n
                      ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                      : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                  )}
                >
                  {n === 300 ? '300+' : n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-2 text-muted-foreground">
              SETTING
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSetting('indoor')}
                className={cn(
                  'flex-1 py-2 rounded-xl text-xs font-bold uppercase border transition-all text-center cursor-pointer',
                  setting === 'indoor'
                    ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                    : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                )}
              >
                Indoor
              </button>
              <button
                type="button"
                onClick={() => setSetting('outdoor')}
                className={cn(
                  'flex-1 py-2 rounded-xl text-xs font-bold uppercase border transition-all text-center cursor-pointer',
                  setting === 'outdoor'
                    ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                    : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                )}
              >
                Outdoor
              </button>
            </div>
          </div>
        </div>
      </EditAccordionCard>

      {/* Section 2: Date, Time & Venue */}
      <EditAccordionCard
        isOpen={!!expandedSections.date_venue}
        onToggle={() => toggleEditSection('date_venue')}
        stepNumber="02"
        title="DATE, TIME & VENUE"
        summary={`${formattedDateStr} @ ${details.startTime} - ${details.endTime} • ${details.venue || 'VENUE TBD'}`}
        hasWarning={warnField('date') || warnField('venue') || warnField('time')}
      >
        {/* Venue */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1 text-muted-foreground">
            VENUE
          </label>
          <div className="relative">
            <VenueAutocomplete
              value={details.venue}
              onChange={val => setDetails({ ...details, venue: val })}
              onSelect={place => {
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
              className="w-full bg-transparent border-b border-border/40 pb-2 text-base font-bold uppercase focus:outline-none mb-3 text-[var(--fg)] focus:border-[var(--wizard-accent)] transition-colors pl-7"
            />
            <MapPin className="w-4 h-4 text-muted-foreground absolute left-0 bottom-4" />
          </div>
        </div>

        {/* Date & Time Group */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
              EVENT DATE
            </label>
            <DatePicker
              value={details.date}
              onChange={d => setDetails(prev => ({ ...prev, date: d }))}
              accentColor={activeAccentColor}
              placeholder="Select event date..."
            />
          </div>

          {/* Start / End Times */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1 text-muted-foreground">
                START
              </label>
              <TimePicker
                value={details.startTime}
                onChange={val => setDetails({ ...details, startTime: val })}
                accentColor={activeAccentColor}
                textSize="text-base"
                showIcon
                className="border-b border-border/40 pb-2 uppercase focus-within:border-[var(--wizard-accent)] text-[var(--fg)]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1 text-muted-foreground">
                END
              </label>
              <TimePicker
                value={details.endTime}
                onChange={val => setDetails({ ...details, endTime: val })}
                accentColor={activeAccentColor}
                align="end"
                textSize="text-base"
                showIcon
                className="border-b border-border/40 pb-2 uppercase focus-within:border-[var(--wizard-accent)] text-[var(--fg)]"
              />
            </div>
          </div>
        </div>
      </EditAccordionCard>

      {/* Section 3: Band Roster & Compensation */}
      <EditAccordionCard
        isOpen={!!expandedSections.team_pay}
        onToggle={() => toggleEditSection('team_pay')}
        stepNumber="03"
        title="BAND & COMPENSATION"
        summary={`${selectedMembers.length} OF ${MEMBERS.length} MUSICIANS • TOTAL: ${currencySymbol}${grandTotalFee}`}
        hasWarning={warnField('members') || warnField('fee')}
      >
        {/* Performance Type Presets */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider block mb-2 text-muted-foreground">
            PERFORMANCE PRESETS
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'SOLO', count: 1, type: 'solo' as PerformanceType },
              { label: 'DUO', count: 2, type: 'duo' as PerformanceType },
              { label: 'TRIO', count: 3, type: 'trio' as PerformanceType },
              { label: 'FULL BAND', count: MEMBERS.length || 1, type: 'full_band' as PerformanceType },
            ].map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPerformancePreset(preset)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold uppercase border transition-all cursor-pointer',
                  selectedMembers.length === preset.count
                    ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)] shadow-xs'
                    : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Musicians Roster */}
        <div className="divide-y divide-border/30 border-y border-border/30">
          {MEMBERS.map(member => {
            const isSelected = selectedMembers.includes(member.id);
            const isCurrentUser = member.id === currentUserMemberId;
            const isLocked = isSelected && isCurrentUser;
            const showFee = isSelected && isAdmin;

            return (
              <div
                key={member.id}
                className="flex items-center justify-between py-2.5 px-2 hover:bg-card/60 transition-colors rounded-lg"
              >
                <div
                  onClick={() => !isLocked && toggleMember(member.id)}
                  className={cn(
                    'flex items-center gap-3 min-w-0 flex-1 pr-3',
                    !isLocked && 'cursor-pointer'
                  )}
                >
                  <DotCheckbox
                    checked={isSelected}
                    disabled={isLocked}
                    activeColor="var(--wizard-accent)"
                    inactiveColor="var(--border)"
                  />
                  <div className="min-w-0">
                    <span
                      className={cn(
                        'text-sm font-medium truncate block leading-normal',
                        isSelected ? 'text-[var(--fg)] font-semibold' : 'text-muted-foreground'
                      )}
                    >
                      {member.name}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider block leading-normal">
                      {isCurrentUser ? 'YOU / ' + member.role : member.role}
                    </span>
                  </div>
                </div>

                {showFee && (
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="text-xs font-bold text-muted-foreground">{currencySymbol}</span>
                    <input
                      type="number"
                      value={memberFees[member.id] || ''}
                      onChange={e => updateFee(member.id, e.target.value)}
                      placeholder={getAutoFeeForMember(member.id, selectedMembers, pricingSettings)}
                      className="w-20 bg-card border border-border/40 focus:border-[var(--wizard-accent)] rounded-lg px-2 py-1 text-right text-xs font-bold text-[var(--fg)] placeholder:text-muted-foreground/40 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Extra fee & duration */}
        <div className="flex flex-col gap-4 pt-2 border-t border-border/30">
          {isAdmin && (
            <div className="bg-card/50 rounded-xl p-3 border border-border/40 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  EXTRA BAND FEE / SERVICES
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-muted-foreground">{currencySymbol}</span>
                  <input
                    type="number"
                    value={extraBandFee}
                    onChange={e => setExtraBandFee(e.target.value)}
                    placeholder="0"
                    className="w-24 bg-card border border-border/40 focus:border-[var(--wizard-accent)] rounded-lg px-2 py-1 text-right text-xs font-bold text-[var(--fg)] placeholder:text-muted-foreground/40 focus:outline-none"
                  />
                </div>
              </div>
              {pricingSettings.custom_services?.filter(s => s.is_active).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {pricingSettings.custom_services
                    .filter(s => s.is_active)
                    .map(service => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => {
                          const current = parseFloat(extraBandFee) || 0;
                          setExtraBandFee(String(current + service.price));
                        }}
                        className="px-2 py-1 rounded-md text-xs font-semibold bg-muted hover:bg-muted/80 text-[var(--fg)] border border-border/40 transition-colors cursor-pointer"
                      >
                        + {service.name} ({currencySymbol}{service.price})
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1 text-muted-foreground">
              DURATION
            </label>
            <select
              value={details.duration}
              onChange={e =>
                setDetails({ ...details, duration: parseInt(e.target.value) || 0 })
              }
              className="w-full bg-card border border-border/40 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--fg)] focus:outline-none cursor-pointer"
            >
              {DURATION_15M_OPTIONS.map(m => (
                <option key={m} value={m} className="bg-card text-[var(--fg)]">
                  {formatDurationOption(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-border/30">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              TOTAL ESTIMATE
            </span>
            <span className="text-xl font-bold text-[var(--fg)]">
              {currencySymbol}{grandTotalFee}
            </span>
          </div>
        </div>
      </EditAccordionCard>

      {/* Section 4: Setlist, Tasks & Notes */}
      <EditAccordionCard
        isOpen={!!expandedSections.setlist_tasks}
        onToggle={() => toggleEditSection('setlist_tasks')}
        stepNumber="04"
        title="SETLIST, TASKS & NOTES"
        summary={`${totalSongCount} SONGS • ${tasks.length} TASKS • ${notes ? 'NOTES ATTACHED' : 'NO NOTES'}`}
      >
        {/* Setlist Summary Card */}
        <div className="p-4 rounded-xl border border-border/40 bg-card/60 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase text-muted-foreground">SETLIST</span>
            <span className="text-base font-bold text-[var(--fg)]">
              {setlist.length} {setlist.length === 1 ? 'Set' : 'Sets'} • {totalSongCount} Songs
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSongPickerTargetSet(setlist[0]?.uid || null);
              setSongPickerOpen(true);
            }}
            className="px-3.5 py-2 rounded-lg text-xs font-bold uppercase bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Music className="w-4 h-4" />
            <span>PICK SONGS</span>
          </button>
        </div>

        {/* Tasks List */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider block mb-2 text-muted-foreground">
            TASKS
          </span>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddNewTask();
                }
              }}
              placeholder="Add a preparation task..."
              className="flex-1 bg-background border border-border/40 focus:border-[var(--wizard-accent)] rounded-lg px-3 py-2 text-sm text-[var(--fg)] placeholder:text-muted-foreground focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={handleAddNewTask}
              disabled={!newTaskText.trim()}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer',
                newTaskText.trim()
                  ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] hover:opacity-90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              Add
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {tasks.map((task, i) => (
              <div key={task.uid || i} className="flex items-center gap-3">
                <input
                  type="text"
                  value={task.title}
                  onChange={e => {
                    const newTasks = [...tasks];
                    newTasks[i] = { ...newTasks[i], title: e.target.value };
                    setTasks(newTasks);
                  }}
                  placeholder="Task description..."
                  className="flex-1 bg-transparent border-b border-border/40 py-1 text-sm font-bold focus:outline-none focus:border-[var(--wizard-accent)] text-[var(--fg)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-[var(--danger)] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1 text-muted-foreground">
            NOTES FOR THE BAND
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any details or notes for the band..."
            rows={3}
            className="w-full bg-background border border-border/40 p-3 rounded-xl text-sm font-medium focus:outline-none focus:border-[var(--wizard-accent)] text-[var(--fg)] placeholder:text-muted-foreground transition-all resize-none"
          />
        </div>
      </EditAccordionCard>
    </div>
  );

  const isLastStep = step === STEPS.length - 1;
  const isFirstStep = step === 0;

  const canProceed = useMemo(() => {
    switch (step) {
      case 0:
        return eventType !== null;
      case 1:
        return !!details.date;
      case 2:
        return true;
      default:
        return true;
    }
  }, [step, eventType, details.date]);

  const rightButtonLabel = isLastStep
    ? modalCategory === 'quote'
      ? 'CREATE QUOTE'
      : 'CREATE GIG'
    : 'NEXT';

  const rightButtonAction = isLastStep ? handleCreate : handleNext;

  // ── EDIT MODE RENDER ────────────────────────────────────────
  if (isEditing) {
    return (
      <>
        <motion.div
          data-modal-open="true"
          data-wizard-type={modalCategory}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          style={{ '--wizard-accent': activeAccentColor } as React.CSSProperties}
          className="fixed inset-0 z-[100] bg-[var(--bg)] flex flex-col h-full overflow-hidden"
        >
          <WizardAccentRail color={activeAccentColor} />

          {/* Top Header Zone (shrink-0) */}
          <div className="px-6 pb-4 shrink-0 bg-[var(--bg)]/95 backdrop-blur-md border-b border-border/40 z-10 flex items-start justify-between" style={{ paddingTop: 'var(--wizard-header-pt, max(env(safe-area-inset-top, 0px), 56px))' }}>
            <div className="flex flex-col gap-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-md bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] shadow-xs">
                  EDITING
                </span>
                <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-md bg-muted text-muted-foreground">
                  {modalCategory.toUpperCase()}
                </span>
                {eventType && (
                  <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-md bg-muted text-muted-foreground">
                    {eventType.toUpperCase()}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold uppercase leading-tight text-[var(--fg)] truncate mt-1">
                {getEffectiveTitle()}
              </h1>
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                {formattedDateStr} @ {details.startTime} – {details.endTime} •{' '}
                {details.venue || 'VENUE TBD'}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close edit ${modalCategory} modal`}
              className="w-11 h-11 rounded-full border border-border/40 bg-card hover:bg-muted flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-[var(--fg)]" />
            </button>
          </div>

          {/* Scrollable Body Zone with 90% Viewport Peeking Affordance */}
          <PeekingScrollContainer className="flex-1 px-6 py-4 min-h-0">
            {renderEditAccordionView()}
          </PeekingScrollContainer>

          {/* Bottom Action Bar (shrink-0) */}
          <div className="px-6 pb-[max(env(safe-area-inset-bottom,16px),16px)] pt-4 shrink-0 border-t border-border/40 bg-[var(--bg)]/95 backdrop-blur-md">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="bg-card text-[var(--fg)] border border-border/40 rounded-xl py-4 font-bold text-sm uppercase tracking-wider hover:bg-muted transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <X className="w-4 h-4 text-[var(--fg)]" />
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!details.date}
                className={cn(
                  'rounded-xl py-4 font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2',
                  !details.date
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] hover:opacity-95 shadow-lg shadow-black/20 cursor-pointer'
                )}
              >
                <Check className="w-4 h-4" />
                SAVE CHANGES
              </button>
            </div>
          </div>
        </motion.div>

        {/* SongPicker overlay */}
        <AnimatePresence>
          {songPickerOpen && (
            <SongPicker
              isOpen={songPickerOpen}
              onClose={() => {
                setSongPickerOpen(false);
                setSongPickerTargetSet(null);
              }}
              onSelect={handlePickedSong}
              onSelectMultiple={handlePickedMultipleSongs}
              multiSelect={true}
              selectedIds={setlist.flatMap((s: any) =>
                (s.songs || []).filter((sg: any) => sg.songId).map((sg: any) => sg.songId)
              )}
              theme="lime"
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // ── CREATION MODE RENDER (3-ZONE SHELL) ─────────────────────
  return (
    <>
      <motion.div
        data-modal-open="true"
        data-wizard-type={modalCategory}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        style={{ '--wizard-accent': activeAccentColor } as React.CSSProperties}
        className="fixed inset-0 z-[100] bg-[var(--bg)] flex flex-col h-full overflow-hidden"
      >
        <WizardAccentRail color={activeAccentColor} />

        {/* Top Header Zone (shrink-0) */}
        <div className="shrink-0 px-6 pb-3 border-b border-border/40 bg-[var(--bg)] z-10 flex flex-col gap-3" style={{ paddingTop: 'var(--wizard-header-pt, max(env(safe-area-inset-top, 0px), 56px))' }}>
          {/* Step indicator bar */}
          <div className="pt-1">
            <InteractiveStepIndicator
              current={step}
              total={STEPS.length}
              steps={STEPS}
              maxAccessibleStep={maxAccessibleStep}
              onSelectStep={s => setStep(s)}
              activeColor="var(--wizard-accent)"
              inactiveColor="var(--border)"
            />
          </div>

          {/* Eyebrow + Title and Close button */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {modalCategory === 'quote' ? 'NEW QUOTE' : 'NEW GIG'}
              </span>
              <h2 className="text-2xl font-bold tracking-tight leading-tight text-[var(--fg)] mt-0.5 truncate">
                {STEPS[step].title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${modalCategory === 'quote' ? 'quote' : 'gig'} wizard`}
              className="w-10 h-10 rounded-full border border-border/40 bg-card hover:bg-muted flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-[var(--fg)]" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Zone with 90% Viewport Peeking Affordance */}
        <PeekingScrollContainer className="flex-1 px-6 py-4 space-y-5 min-h-0">
          {step === 0 && renderStep1()}
          {step === 1 && renderStep2()}
          {step === 2 && renderStep3()}
        </PeekingScrollContainer>

        {/* Bottom Action Bar */}
        <div className="shrink-0 border-t border-border/40 px-6 pb-[max(env(safe-area-inset-bottom,16px),16px)] pt-4 bg-[var(--bg)]/95 backdrop-blur-md">
          <div className="grid grid-cols-2 gap-3">
            {isFirstStep ? (
              <button
                type="button"
                onClick={onClose}
                className="bg-card text-[var(--fg)] border border-border/40 rounded-xl py-4 font-bold text-sm uppercase tracking-wider hover:bg-muted transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <X className="w-4 h-4 text-[var(--fg)]" />
                CANCEL
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBack}
                className="bg-card text-[var(--fg)] border border-border/40 rounded-xl py-4 font-bold text-sm uppercase tracking-wider hover:bg-muted transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-[var(--fg)]" />
                BACK
              </button>
            )}
            <button
              type="button"
              onClick={rightButtonAction}
              disabled={!canProceed}
              className={cn(
                'rounded-xl py-4 font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2',
                !canProceed
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] hover:opacity-95 shadow-lg shadow-black/20 cursor-pointer'
              )}
            >
              <span>{rightButtonLabel}</span>
              {isLastStep ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </motion.div>

      {/* SongPicker overlay */}
      <AnimatePresence>
        {songPickerOpen && (
          <SongPicker
            isOpen={songPickerOpen}
            onClose={() => {
              setSongPickerOpen(false);
              setSongPickerTargetSet(null);
            }}
            onSelect={handlePickedSong}
            onSelectMultiple={handlePickedMultipleSongs}
            multiSelect={true}
            selectedIds={setlist.flatMap((s: any) =>
              (s.songs || []).filter((sg: any) => sg.songId).map((sg: any) => sg.songId)
            )}
            theme="lime"
          />
        )}
      </AnimatePresence>
    </>
  );
};
