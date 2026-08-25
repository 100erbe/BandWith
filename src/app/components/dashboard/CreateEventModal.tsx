import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactGoogleAutocomplete from 'react-google-autocomplete';
import { X, Plus, Minus, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, ArrowRight, ArrowUpRight, AlertCircle, Music, Folder, Heart, Briefcase, Home, PartyPopper, Sparkles, Star, MapPin, type LucideIcon } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { SongPicker, type PickedSong } from '@/app/components/ui/SongPicker';
import { RehearsalCreationWizard } from '@/app/components/rehearsal/RehearsalCreationWizard';
import { useBand } from '@/lib/BandContext';
import { getSongs, getSetlists, getSetlist, type Song, type Setlist, type SetlistWithSongs } from '@/lib/services/songs';
import { supabase } from '@/lib/supabase';

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

const EVENT_TYPES: { value: EventType; label: string; icon: LucideIcon }[] = [
  { value: 'wedding', label: 'WEDDING', icon: Heart },
  { value: 'corporate', label: 'CORPORATE', icon: Briefcase },
  { value: 'private', label: 'PRIVATE', icon: Home },
  { value: 'festival', label: 'FESTIVAL', icon: PartyPopper },
  { value: 'club', label: 'CLUB', icon: Sparkles },
  { value: 'other', label: 'OTHER', icon: Star },
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

// --- Step Indicator ---
const StepIndicator: React.FC<{ current: number; total: number; activeColor?: string; inactiveColor?: string }> = ({ current, total, activeColor, inactiveColor }) => (
  <div className="flex items-center justify-center gap-1">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={cn(
          'h-1 rounded-xl',
          i === current ? 'w-4' : 'w-2',
          !activeColor && (i === current ? 'bg-foreground' : 'bg-foreground/30'),
        )}
        style={activeColor ? { backgroundColor: i === current ? activeColor : inactiveColor } : undefined}
      />
    ))}
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
          <span className={cn('text-xs font-bold uppercase tracking-wider block', 'text-muted-foreground')}>EVENT DATE</span>
          <span className={cn('text-xl font-bold uppercase', 'text-foreground')}>{monthLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center', 'border-border')}>
            <ChevronLeft className={cn('w-4 h-4', 'text-foreground')} />
          </button>
          <button onClick={nextMonth} className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center', 'border-border')}>
            <ChevronRight className={cn('w-4 h-4', 'text-foreground')} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DAYS_OF_WEEK.map((d, i) => (
          <div key={i} className={cn('text-center text-xs font-bold py-1', 'text-foreground/40')}>{d}</div>
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
                ? ('bg-accent text-accent-foreground')
                : ('text-foreground hover:bg-muted')
            )}
          >
            {day}
          </button>
        ))}
      </div>
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

  const [step, setStep] = useState(isEditing ? firstWarningStep : 0);
  const [songsView, setSongsView] = useState(false);
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [songPickerTargetSet, setSongPickerTargetSet] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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
        fees[id] = editingEvent.memberFeeMap?.[uid] || '';
      });
      return fees;
    }
    if (isEditing) return {};
    return currentUserMemberId ? { [currentUserMemberId]: '' } : {};
  });
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

  // Event-specific accent (applied strategically — never as a full-screen background)
  const accentBg = modalCategory === 'rehearsal' ? 'var(--accent-rehearsal)' : modalCategory === 'quote' ? 'var(--accent-quote)' : 'var(--accent-gig)';
  const accentFg = modalCategory === 'rehearsal' ? 'var(--accent-rehearsal-fg)' : modalCategory === 'quote' ? 'var(--accent-quote-fg)' : 'var(--accent-gig-fg)';
  const accentBgClass = modalCategory === 'rehearsal' ? 'bg-accent-rehearsal' : modalCategory === 'quote' ? 'bg-accent-quote' : 'bg-accent-gig';
  const accentTextClass = modalCategory === 'rehearsal' ? 'text-accent-rehearsal-foreground' : modalCategory === 'quote' ? 'text-accent-quote-foreground' : 'text-accent-gig-foreground';
  const accentFocusBorder = modalCategory === 'rehearsal' ? 'focus:border-accent-rehearsal' : modalCategory === 'quote' ? 'focus:border-accent-quote' : 'focus:border-accent-gig';
  const pillAccent = modalCategory === 'rehearsal' ? 'text-accent-rehearsal' : modalCategory === 'quote' ? 'text-accent-quote' : 'text-accent-gig';

  // Standard surface tokens (modal sits on --bg, no accent wash)
  const tc = 'text-foreground';
  const tcMuted = 'text-muted-foreground';
  const tcFaint = 'text-foreground/30';
  const tcSub = 'text-foreground/40';
  const bcMuted = 'border-border/40';
  const bcSolid = 'border-border';
  const bgPillSelected = `${accentBgClass} ${accentTextClass}`;
  const bgPillUnselected = 'bg-muted text-muted-foreground';
  const dotActive = accentBg;
  const dotInactive = 'var(--dot-inactive)';

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
      setSelectedMembers(prev => [...prev, memberId]);
      setMemberFees(prev => ({ ...prev, [memberId]: '' }));
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
      status: 'confirmed',
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
    <div className="flex flex-col gap-3">
      {EVENT_TYPES.map(({ value, label, icon: Icon }) => {
        const isSelected = eventType === value;
        return (
          <button
            key={value}
            onClick={() => setEventType(value)}
            className={cn(
              'flex items-center justify-between gap-3 w-full text-left px-4 py-3 rounded-xl border transition-all',
              isSelected ? bgPillSelected : 'border-border/60 bg-transparent'
            )}
          >
            <span className="text-lg font-bold uppercase">{label}</span>
            <Icon className={cn('w-5 h-5 shrink-0', isSelected ? '' : 'text-muted-foreground')} />
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
        <span className={cn('text-xs font-bold uppercase tracking-wider block mb-1', tcMuted)}>CLIENT NAME</span>
        <input
          type="text"
          value={details.clientName}
          onChange={(e) => {
            setDetails(prev => ({ ...prev, clientName: e.target.value }));
            autoGenerateTitle(e.target.value, eventType);
          }}
          placeholder="EG. ROSSI"
          className={cn('w-full bg-transparent border-b pb-2 text-xl font-medium uppercase focus:outline-none', tc, bcMuted, `${accentFocusBorder} placeholder:text-muted-foreground`)}
        />
      </div>

      {/* Event Title */}
      <div>
        <span className={cn('text-xs font-bold uppercase tracking-wider block mb-1', tcMuted)}>EVENT TITLE</span>
        <input
          type="text"
          value={details.title}
          onChange={(e) => {
            setDetails({ ...details, title: e.target.value });
            setTitleManuallyEdited(true);
          }}
          placeholder="EG. WEDDING PARTY"
          className={cn('w-full bg-transparent border-b pb-2 text-xl font-medium uppercase focus:outline-none', tc, bcMuted, `${accentFocusBorder} placeholder:text-muted-foreground`)}
        />
      </div>

      {/* Venue */}
      <div className={cn(warnField('venue') && 'rounded-xl p-3 -m-3 bg-warning/10 ring-2 ring-warning/30')}>
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('text-xs font-bold uppercase tracking-wider', warnField('venue') ? 'text-warning' : tcMuted)}>VENUE</span>
          {warnField('venue') && <AlertCircle className="w-3 h-3 text-warning" />}
        </div>
        <input
          type="text"
          value={details.venue}
          onChange={(e) => setDetails({ ...details, venue: e.target.value })}
          placeholder="VENUE NAME"
          className={cn('w-full bg-transparent border-b pb-2 text-xl font-medium uppercase focus:outline-none mb-3', tc, warnField('venue') ? 'border-warning/50' : bcMuted, `${accentFocusBorder} placeholder:text-muted-foreground`)}
        />
        {/* Address Autocomplete */}
        <div className="relative">
          <MapPin className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <ReactGoogleAutocomplete
            apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
            onPlaceSelected={(place) => setDetails(prev => ({ ...prev, address: place.formatted_address || '', city: '', province: '', zip: '', country: '' }))}
            options={{ componentRestrictions: { country: 'es' }, types: ['establishment', 'geocode'] }}
            type="text"
            defaultValue={details.address}
            placeholder="SEARCH ADDRESS"
            className="w-full bg-transparent border-b border-border/40 pb-2 pl-6 text-lg font-medium uppercase focus:outline-none focus:border-primary placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Calendar */}
      <div className={cn(warnField('date') && 'rounded-lg p-3 -m-3 bg-warning/10 ring-2 ring-warning/30')}>
        {warnField('date') && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-warning uppercase tracking-wider">DATE</span>
            <AlertCircle className="w-3 h-3 text-warning" />
          </div>
        )}
        <CalendarGrid selectedDate={details.date} onSelectDate={(d) => setDetails({ ...details, date: d })}/>
      </div>

      {/* Start / End Times */}
      <div className={cn('grid grid-cols-2 gap-6', warnField('time') && 'rounded-xl p-3 -m-3 bg-warning/10 ring-2 ring-warning/30')}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-xs font-bold uppercase tracking-wider', warnField('time') ? 'text-warning' : tcMuted)}>START</span>
            {warnField('time') && <AlertCircle className="w-3 h-3 text-warning" />}
          </div>
          <input
            type="time"
            value={details.startTime}
            onChange={(e) => setDetails({ ...details, startTime: e.target.value })}
            className={cn('w-full bg-transparent border-b pb-2 text-xl font-medium uppercase focus:outline-none', tc, warnField('time') ? 'border-warning/50' : bcMuted, accentFocusBorder)}
          />
        </div>
        <div>
          <span className={cn('text-xs font-bold uppercase tracking-wider block mb-1', tcMuted)}>END</span>
          <input
            type="time"
            value={details.endTime}
            onChange={(e) => setDetails({ ...details, endTime: e.target.value })}
            className={cn('w-full bg-transparent border-b pb-2 text-xl font-medium uppercase focus:outline-none', tc, bcMuted, accentFocusBorder)}
          />
        </div>
      </div>

      {/* Guests */}
      <div>
        <span className={cn('text-xs font-bold uppercase tracking-wider block mb-1', tcMuted)}>GUESTS</span>
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => setDetails({ ...details, guests: Math.max(0, details.guests - 10) })}
            className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', 'bg-muted')}
          >
            <Minus className={cn('w-5 h-5', 'text-foreground')} />
          </button>
          <span className={cn('text-4xl font-bold leading-tight flex-1 text-center', tc)}>{details.guests}</span>
          <button
            onClick={() => setDetails({ ...details, guests: details.guests + 10 })}
            className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', 'bg-muted')}
          >
            <Plus className={cn('w-5 h-5', 'text-foreground')} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {[50, 100, 150, 200, 300, 500].map(n => (
            <button
              key={n}
              onClick={() => setDetails({ ...details, guests: n })}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
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
        <span className={cn('text-xs font-bold uppercase tracking-wider block mb-2', tcMuted)}>SETTING</span>
        <div className="flex gap-2">
          <button
            onClick={() => setSetting('indoor')}
            className={cn(
              'px-4 py-2 rounded-md text-xs font-bold uppercase border transition-all',
              setting === 'indoor' ? bgPillSelected + ' border-current' : ('bg-transparent text-muted-foreground border-border/40')
            )}
          >
            INDOOR
          </button>
          <button
            onClick={() => setSetting('outdoor')}
            className={cn(
              'px-4 py-2 rounded-md text-xs font-bold uppercase border transition-all',
              setting === 'outdoor' ? bgPillSelected + ' border-current' : ('bg-transparent text-muted-foreground border-border/40')
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
          <span className={cn('text-xs font-bold uppercase tracking-wider block mb-1', tcMuted)}>PERFORMANCE</span>
          <span className={cn('text-3xl font-bold uppercase block mb-3', tc)}>TYPE</span>
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
                  newSelected.forEach(id => { newFees[id] = memberFees[id] || ''; });
                  setMemberFees(newFees);
                }}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-bold uppercase border transition-all',
                  selectedCount === preset.count
                    ? bgPillSelected + ' border-current'
                    : ('bg-transparent text-muted-foreground border-border/40')
                )}
              >
                {preset.label}
              </button>
            ))}
            <span className={cn('text-xs font-bold self-center ml-1', tcFaint)}>({selectedCount}/{totalAvailable})</span>
          </div>
        </div>

        {/* Full Roster Checklist */}
        <div className={cn(warnField('members') && 'rounded-xl p-3 -m-3 bg-warning/10 ring-2 ring-warning/30')}>
          <div className="flex items-center gap-2 mb-4">
            <span className={cn('text-xs font-bold uppercase tracking-wider', warnField('members') ? 'text-warning' : tcMuted)}>MUSICIANS</span>
            {warnField('members') && <AlertCircle className="w-3 h-3 text-warning" />}
          </div>

          {totalAvailable === 0 ? (
            <div className={cn('text-center py-8 px-4 rounded-xl border-2 border-dashed bg-muted/40', bcMuted)}>
              <span className={cn('text-xs font-bold block mb-0.5', tcMuted)}>LOADING MEMBERS...</span>
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
                    className={cn(
                      'flex items-center justify-between py-3 border-b last:border-0',
                      'border-border'
                    )}
                  >
                    <div className="flex flex-col gap-1 flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-bold uppercase rounded',
                          isSelected
                            ? (bgPillSelected)
                            : (bgPillUnselected)
                        )}>
                          {isCurrentUser ? 'YOU / ' + member.role : member.role}
                        </span>
                        {isLocked && (
                          <span className={cn('text-xs font-bold uppercase', tcSub)}>REQUIRED</span>
                        )}
                      </div>
                      <span className="text-lg font-medium text-foreground">
                        {member.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
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
                            <div className="flex items-center gap-1">
                              <span className={cn('font-bold text-sm', tcSub)}>$</span>
                              <input
                                type="number"
                                value={memberFees[member.id] || ''}
                                onChange={(e) => updateFee(member.id, e.target.value)}
                                placeholder="0"
                                className={cn(
                                  'bg-transparent font-bold text-sm border-b focus:outline-none w-20 pb-0.5',
                                  `text-foreground/60 border-border ${accentFocusBorder} placeholder:text-muted-foreground`
                                )}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <button
                        onClick={() => toggleMember(member.id)}
                        className="shrink-0"
                      >
                        <DotCheckbox
                          checked={isSelected}
                          disabled={isLocked}
                          activeColor={dotActive}
                          inactiveColor={dotInactive}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state hint */}
          {totalAvailable <= 1 && (
            <div className={cn('text-center py-4 px-4 rounded-xl border-2 border-dashed bg-muted/40 mt-4', bcMuted)}>
              <span className={cn('text-xs font-bold block mb-0.5', tcMuted)}>PLAYING SOLO?</span>
              <span className={cn('text-xs font-medium block', tcFaint)}>You can add more bandmates later from your dashboard to split fees.</span>
            </div>
          )}
        </div>

        {/* Fee Summary */}
        {isAdmin && (
          <div className={cn('flex flex-col gap-4 pt-4 border-t', 'border-border')}>
            {totalPayout > 0 && (
              <div className="flex items-center justify-between">
                <span className={cn('text-xs font-bold uppercase tracking-wider', tcMuted)}>MEMBERS TOTAL</span>
                <span className={cn('text-xl font-bold', tc)}>${totalPayout}</span>
              </div>
            )}

            <div>
              <span className={cn('text-xs font-bold uppercase tracking-wider block mb-1', tcMuted)}>EXTRA BAND FEE / GIG RENTAL</span>
              <div className="flex items-center">
                <span className={cn('text-xl font-bold', tcSub)}>$</span>
                <input
                  type="number"
                  value={extraBandFee}
                  onChange={(e) => setExtraBandFee(e.target.value)}
                  placeholder="0"
                  className={cn('bg-transparent text-xl font-medium focus:outline-none w-full', tc, 'placeholder:text-muted-foreground')}
                />
              </div>
            </div>

            {/* Summary bar: selected count + total */}
            <div className={cn('flex items-center justify-between py-3 border-t', 'border-border')}>
              <div className="flex flex-col">
                <span className={cn('text-xs font-bold uppercase tracking-wider', tcMuted)}>TEAM SUMMARY</span>
                <span className={cn('text-sm font-bold', tcFaint)}>
                  {selectedCount} of {totalAvailable} musician{selectedCount !== 1 ? 's' : ''} selected
                </span>
              </div>
              {grandTotalFee > 0 && (
                <span className={cn('text-3xl font-bold', tc)}>${grandTotalFee}</span>
              )}
            </div>
          </div>
        )}

        {/* Duration */}
        <div className={cn('pt-4 border-t', 'border-border')}>
          <span className={cn('text-xs font-bold uppercase tracking-wider block mb-1', tcMuted)}>DURATION</span>
          <select
            value={details.duration}
            onChange={(e) => setDetails({ ...details, duration: parseInt(e.target.value) || 0 })}
            className={cn('bg-transparent text-3xl font-bold focus:outline-none w-full appearance-none cursor-pointer', tc)}
          >
            {[30, 60, 90, 120, 150, 180, 210, 240].map(m => (
              <option key={m} value={m} className="text-foreground bg-background text-base">
                {m >= 60 ? `${Math.floor(m / 60)}h${m % 60 > 0 ? `${m % 60}m` : ''}` : `${m}m`}
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
        <div className="flex flex-col gap-10">
          {/* Header */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-1 flex-wrap">
              <div className="rounded-full px-2.5 py-1 bg-muted">
                <span className="text-xs font-bold text-foreground uppercase">QUOTE</span>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-foreground uppercase leading-tight">{details.title || 'UNTITLED'}</h2>
            <span className="text-sm font-medium text-muted-foreground uppercase">{dateStr}</span>
          </div>

          {/* Year + Date */}
          <div className="flex gap-5">
            <div className="flex-1 flex flex-col">
              <button className="flex items-center gap-1.5 bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('year')}>
                <span className="text-xs font-bold uppercase text-foreground">YEAR</span>
                <motion.div animate={{ rotate: expandedSection === 'year' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ArrowUpRight className="w-3.5 h-3.5 text-foreground" />
                </motion.div>
              </button>
              <span className="text-4xl font-bold leading-tight text-foreground">{eventYear}</span>
              <AnimatePresence>
                {expandedSection === 'year' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="pt-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between py-2 border-b" style={{ borderColor }}>
                        <span className="text-xs font-medium uppercase" style={{ color: subtitleColor }}>Year</span>
                        <span className="text-sm font-bold" style={{ color: textColor }}>{eventYear}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b" style={{ borderColor }}>
                        <span className="text-xs font-medium uppercase" style={{ color: subtitleColor }}>Season</span>
                        <span className="text-sm font-bold" style={{ color: textColor }}>
                          {(() => { const m = selectedDate.getMonth(); return m >= 5 && m <= 8 ? 'Summer' : m >= 2 && m <= 4 ? 'Spring' : m >= 9 && m <= 10 ? 'Autumn' : 'Winter'; })()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex-1 flex flex-col">
              <button className="flex items-center gap-1.5 bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('date')}>
                <span className="text-xs font-bold uppercase text-foreground">DATE</span>
                <motion.div animate={{ rotate: expandedSection === 'date' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ArrowUpRight className="w-3.5 h-3.5 text-foreground" />
                </motion.div>
              </button>
              <span className="text-4xl font-bold leading-tight text-foreground">{eventMonthDay}</span>
              <AnimatePresence>
                {expandedSection === 'date' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="pt-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between py-2 border-b" style={{ borderColor }}>
                        <span className="text-xs font-medium uppercase" style={{ color: subtitleColor }}>Day</span>
                        <span className="text-sm font-bold" style={{ color: textColor }}>{selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b" style={{ borderColor }}>
                        <span className="text-xs font-medium uppercase" style={{ color: subtitleColor }}>Time</span>
                        <span className="text-sm font-bold" style={{ color: textColor }}>{details.startTime || 'TBD'}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Client + Pricing */}
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col">
                <button className="flex items-center gap-1.5 bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('client')}>
                  <span className="text-xs font-bold uppercase text-foreground">CLIENT</span>
                  <motion.div animate={{ rotate: expandedSection === 'client' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ArrowUpRight className="w-3.5 h-3.5 text-foreground" />
                  </motion.div>
                </button>
                <span className="text-4xl font-bold leading-tight text-foreground">
                  {(details.clientName || details.title || '—').split(' ')[0]?.toUpperCase()}
                </span>
                {(details.clientName || details.title || '').split(' ').length > 1 && (
                  <span className="text-xl font-bold leading-tight text-foreground">
                    {(details.clientName || details.title || '').split(' ').slice(1).join(' ')?.toUpperCase()}
                  </span>
                )}
              </div>
              <AnimatePresence>
                {expandedSection === 'client' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="pt-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between py-2 border-b" style={{ borderColor }}>
                        <span className="text-xs font-medium uppercase" style={{ color: subtitleColor }}>Name</span>
                        <span className="text-sm font-bold" style={{ color: textColor }}>{details.clientName || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b" style={{ borderColor }}>
                        <span className="text-xs font-medium uppercase" style={{ color: subtitleColor }}>Event Type</span>
                        <span className="text-sm font-bold" style={{ color: textColor }}>QUOTE</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b" style={{ borderColor }}>
                        <span className="text-xs font-medium uppercase" style={{ color: subtitleColor }}>Location</span>
                        <span className="text-sm font-bold" style={{ color: textColor }}>{details.address || 'TBD'}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-col">
                <button className="flex items-center gap-1.5 bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('pricing')}>
                  <span className="text-xs font-bold uppercase text-foreground">PRICING</span>
                  <motion.div animate={{ rotate: expandedSection === 'pricing' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ArrowUpRight className="w-3.5 h-3.5 text-foreground" />
                  </motion.div>
                </button>
                <span className="text-4xl font-bold leading-tight text-foreground">
                  €{grandTotalFee || details.pay || '0'}
                </span>
              </div>
              <AnimatePresence>
                {expandedSection === 'pricing' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="pt-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between py-2 border-b" style={{ borderColor }}>
                        <span className="text-xs font-medium uppercase" style={{ color: subtitleColor }}>Band Total</span>
                        <span className="text-sm font-bold" style={{ color: textColor }}>€{grandTotalFee || details.pay || '0'}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b" style={{ borderColor }}>
                        <span className="text-xs font-medium uppercase" style={{ color: subtitleColor }}>Venue</span>
                        <span className="text-sm font-bold" style={{ color: textColor }}>{details.address || 'TBD'}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Songs */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col">
              <button className="flex items-center gap-1.5 bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => setSongsView(true)}>
                <span className="text-xs font-bold uppercase text-foreground">SONGS</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-foreground" />
              </button>
              <span className="text-4xl font-bold leading-tight text-foreground">{songCount}</span>
            </div>
          </div>

          {/* Tasks */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col">
              <button className="flex items-center gap-1.5 bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('tasks')}>
                <span className="text-xs font-bold uppercase text-foreground">TASKS</span>
                <motion.div animate={{ rotate: expandedSection === 'tasks' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ArrowUpRight className="w-3.5 h-3.5 text-foreground" />
                </motion.div>
              </button>
              <span className="text-4xl font-bold leading-tight text-foreground">{tasks.length}</span>
            </div>
            <AnimatePresence>
              {expandedSection === 'tasks' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <div className="pt-3 flex flex-col gap-2">
                    {taskTemplates.length > 0 && tasks.length === 0 && (
                      <div className="mb-3">
                        <span className="text-xs font-bold uppercase block mb-1.5 text-foreground/40">LOAD FROM TEMPLATE</span>
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
                              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all bg-muted text-foreground hover:bg-muted/80"
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
                          className="flex-1 bg-transparent border-b-2 border-border py-1 text-sm font-bold text-foreground focus:outline-none focus:border-accent-quote placeholder:text-muted-foreground transition-all"
                        />
                        <button onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))} className="text-foreground/20 hover:text-destructive transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setTasks([...tasks, { uid: `t-${Date.now()}`, title: '', completed: false }])}
                      className="text-xs font-bold uppercase flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors mt-1"
                    >
                      <Plus className="w-3 h-3" /> Add task
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Members */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col">
              <button className="flex items-center gap-1.5 bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('members')}>
                <span className="text-xs font-bold uppercase text-foreground">MEMBERS</span>
                <motion.div animate={{ rotate: expandedSection === 'members' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ArrowUpRight className="w-3.5 h-3.5 text-foreground" />
                </motion.div>
              </button>
              <span className="text-4xl font-bold leading-tight text-foreground">{selectedMembers.length}</span>
            </div>
            <AnimatePresence>
              {expandedSection === 'members' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <div className="pt-3 flex flex-col gap-2">
                    {selectedMembers.length > 0 ? selectedMembers.map((mid, i) => {
                      const m = MEMBERS.find(x => x.id === mid);
                      return (
                        <div key={mid} className="flex items-center justify-between py-2 border-b" style={{ borderColor }}>
                          <span className="text-xs font-medium uppercase" style={{ color: subtitleColor }}>Member {i + 1}</span>
                          <span className="text-sm font-bold" style={{ color: textColor }}>{m?.name || mid}</span>
                        </div>
                      );
                    }) : (
                      <div className="flex items-center justify-between py-2 border-b" style={{ borderColor }}>
                        <span className="text-xs font-medium uppercase" style={{ color: subtitleColor }}>Info</span>
                        <span className="text-sm font-bold" style={{ color: textColor }}>No members assigned</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notes */}
          {notes && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col">
                <button className="flex items-center gap-1.5 bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('notes')}>
                  <span className="text-xs font-bold uppercase text-foreground">NOTES</span>
                  <motion.div animate={{ rotate: expandedSection === 'notes' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ArrowUpRight className="w-3.5 h-3.5 text-foreground" />
                  </motion.div>
                </button>
              </div>
              <AnimatePresence>
                {expandedSection === 'notes' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="pt-3">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any notes for the band..."
                        rows={3}
                        className="w-full bg-transparent border-b-2 border-border py-2 text-sm font-medium text-foreground focus:outline-none focus:border-accent-quote placeholder:text-muted-foreground transition-all resize-none"
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
              <span className={cn('px-2 py-0.5 text-xs font-bold uppercase rounded', bgPillSelected)}>
                {currentUserMember.role}
              </span>
            )}
          </div>
          <h2 className={cn('text-4xl font-bold uppercase leading-none', tc)}>
            {details.title || 'EVENT TITLE'}
          </h2>
          <span className="text-sm font-medium text-muted-foreground">{dateStr}</span>
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
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                    {tag}
                  </span>
                  <span className="text-2xl font-bold text-foreground">{value}</span>
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
                        <span className={cn('text-xs font-bold uppercase block mb-1', tcSub)}>DURATION</span>
                        <input
                          type="number"
                          value={details.duration}
                          onChange={(e) => setDetails({ ...details, duration: parseInt(e.target.value) || 0 })}
                          className={cn('w-full bg-transparent border-b-2 py-1 text-lg font-bold focus:outline-none transition-all', tc, `border-border ${accentFocusBorder}`)}
                        />
                        <span className={cn('text-xs font-bold', tcFaint)}>minutes</span>
                      </div>
                      <div>
                        <span className={cn('text-xs font-bold uppercase block mb-1', tcSub)}>SETS</span>
                        <input
                          type="number"
                          value={1}
                          readOnly
                          className={cn('w-full bg-transparent border-b-2 py-1 text-lg font-bold focus:outline-none', tc, 'border-border')}
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
                          <span className={cn('text-xs font-bold uppercase block mb-1.5', tcSub)}>LOAD FROM TEMPLATE</span>
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
                                className={cn('px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all', 'bg-muted text-foreground hover:bg-muted/80')}
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
                            className={cn('flex-1 bg-transparent border-b-2 py-1 text-sm font-bold focus:outline-none transition-all', tc, `border-border placeholder:text-muted-foreground ${accentFocusBorder}`)}
                          />
                          <button
                            onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))}
                            className={cn('text-foreground/20', 'hover:text-destructive transition-colors')}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setTasks([...tasks, { uid: `t-${Date.now()}`, title: '', completed: false }])}
                        className={cn('text-xs font-bold uppercase flex items-center gap-1 transition-colors mt-1', tcMuted, 'hover:text-foreground')}
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
                        className={cn('w-full bg-transparent border-b-2 py-2 text-sm font-medium focus:outline-none transition-all resize-none', tc, `border-border placeholder:text-muted-foreground ${accentFocusBorder}`)}
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
      className="fixed inset-0 z-[101] flex flex-col overflow-hidden bg-background text-foreground"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Songs Header */}
      <div className="px-4 pt-4 pb-4 flex items-center justify-between shrink-0">
        <button onClick={() => setSongsView(false)} className={cn('w-10 h-10 rounded-full border-2 flex items-center justify-center', bcSolid)}>
          <ArrowLeft className={cn('w-5 h-5', tc)} />
        </button>
        <span className={cn('text-xl font-bold uppercase', tc)}>SONGS</span>
        <button onClick={onClose} className={cn('w-12 h-12 rounded-full border border-border bg-muted flex items-center justify-center', bcSolid)}>
          <X className={cn('w-6 h-6', tc)} />
        </button>
      </div>

      {/* Setlist Builder */}
      <div className="flex-1 overflow-y-auto px-4">
        {savedSetlists.length > 0 && setlist.length === 0 && (
          <div className="mb-6">
            <span className="text-xs font-bold text-foreground/50 uppercase block mb-2">LOAD FROM SAVED SETLISTS</span>
            <div className="flex flex-wrap gap-2">
              {savedSetlists.map(sl => (
                <button
                  key={sl.id}
                  onClick={() => loadSavedSetlist(sl)}
                  className="px-3 py-2 rounded-xl bg-muted flex items-center gap-2 hover:bg-muted/80 transition-all"
                >
                  <Folder className="w-3.5 h-3.5 text-foreground/50" />
                  <span className="text-xs font-bold text-foreground">{sl.name}</span>
                  {sl.song_count != null && (
                    <span className="text-xs font-bold text-foreground/30">{sl.song_count} songs</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start justify-between mb-6">
          <div className="flex flex-col gap-1">
            <span className={cn('px-2 py-0.5 text-xs font-bold uppercase rounded inline-flex self-start', bgPillUnselected)}>
              {setlist.length} {setlist.length === 1 ? 'SET' : 'SETS'}
            </span>
            <span className={cn('text-3xl font-bold uppercase', tc)}>SETLIST BUILDER</span>
          </div>
          <button
            onClick={addSet}
            className={cn('w-10 h-10 rounded-full border-2 flex items-center justify-center mt-2 transition-colors', bcSolid, tc, `hover:bg-muted hover:${pillAccent}`)}
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
                      <span className="px-2 py-0.5 bg-surface-inverse text-surface-inverse-fg text-xs font-bold uppercase rounded inline-flex self-start">
                        {item.title}
                      </span>
                      <span className="text-4xl font-bold text-foreground leading-tight">{songCount}</span>
                      <span className="text-xs font-bold text-foreground/50 uppercase">
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
                            className={`bg-transparent border-b-2 border-border py-1 text-sm font-bold text-foreground placeholder:text-muted-foreground focus:outline-none ${accentFocusBorder} transition-all`}
                            placeholder="Set name..."
                          />

                          {(item.songs || []).map((song: any, si: number) => (
                            <div key={song.uid} className="flex items-start gap-2">
                              <span className="text-xs font-bold text-foreground/30 mt-2 w-5 shrink-0">{si + 1}.</span>
                              <div className="flex-1 flex flex-col gap-1">
                                <input
                                  type="text"
                                  value={song.title}
                                  onChange={(e) => updateSongInSet(item.uid, song.uid, 'title', e.target.value)}
                                  placeholder="Song title..."
                                  className={`bg-transparent border-b-2 border-border py-1 text-sm font-bold text-foreground placeholder:text-muted-foreground focus:outline-none ${accentFocusBorder} transition-all`}
                                />
                                <input
                                  type="text"
                                  value={song.artist}
                                  onChange={(e) => updateSongInSet(item.uid, song.uid, 'artist', e.target.value)}
                                  placeholder="Artist..."
                                  className={`bg-transparent border-b border-border/40 py-1 text-xs font-bold text-foreground/50 placeholder:text-muted-foreground focus:outline-none ${accentFocusBorder} transition-all`}
                                />
                              </div>
                              <button
                                onClick={() => removeSongFromSet(item.uid, song.uid)}
                                className="text-foreground/20 hover:text-destructive transition-colors mt-1"
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
                                className="text-xs font-bold text-foreground/70 uppercase flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                <Music className="w-3 h-3" /> From library
                              </button>
                              <button
                                onClick={() => addSongToSet(item.uid)}
                                className="text-xs font-bold text-foreground/50 uppercase flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                <Plus className="w-3 h-3" /> Manual
                              </button>
                            </div>
                            <button
                              onClick={() => removeSet(item.uid)}
                              className="text-xs font-bold text-destructive/50 uppercase flex items-center gap-1 hover:text-destructive transition-colors"
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
      <div className="px-4 py-5 shrink-0">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setSongsView(false)}
            className="py-4 bg-muted rounded-xl flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
            <span className="text-base font-bold text-foreground">BACK</span>
          </button>
          <button
            onClick={handleSongsViewDone}
            className={`py-4 ${accentBgClass} rounded-xl flex items-center justify-center gap-2`}
          >
            <span className="text-base font-bold" style={{ color: accentFg }}>DONE</span>
            <ArrowRight className="w-4 h-4" style={{ color: accentFg }} />
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

  // --- Footer button config ---
  const isLastStep = step === STEPS.length - 1;
  const isFirstStep = isEditing ? step <= 1 : step === 0;
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
    ? (isEditing ? 'SAVE CHANGES' : 'CREATE EVENT')
    : isSkippable
      ? (hasStepData ? 'NEXT' : 'SKIP')
      : 'NEXT';
  const rightButtonAction = isLastStep ? handleCreate : handleNext;

  return (
    <>
      <motion.div
        data-modal-open="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background text-foreground"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Fixed Header */}
        <div className="px-4 pt-4 pb-6 flex flex-col gap-2 shrink-0 relative z-20">
          <StepIndicator current={step} total={STEPS.length} activeColor={dotActive} inactiveColor={dotInactive} />

          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className={cn('text-xs font-bold uppercase', 'text-foreground/60')}>
                {isEditing ? 'EDITING' : STEPS[step].label}
              </span>
              <span className={cn('text-xs font-bold uppercase', pillAccent)}>
                {isEditing ? 'EDITING GIG' : 'NEW GIG'}
              </span>
              <h1 className={cn('text-3xl font-bold uppercase leading-none whitespace-pre-line', tc)}>
                {STEPS[step].title}
              </h1>
              <span className={cn('text-base font-bold uppercase', tcMuted)}>
                {isEditing ? (editingWarnings.length > 0 ? `${editingWarnings.length} FIELD${editingWarnings.length > 1 ? 'S' : ''} TO COMPLETE` : 'REVIEW & SAVE') : (step === 1 && modalCategory === 'gig' ? 'SET LOGISTICS' : STEPS[step].subtitle)}
              </span>
            </div>
            <button
              onClick={onClose}
              className={cn('w-12 h-12 rounded-full border border-border bg-muted flex items-center justify-center shrink-0', bcSolid)}
            >
              <X className={cn('w-6 h-6', tc)} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
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
        <div className="px-4 py-5 shrink-0">
          <div className="grid grid-cols-2 gap-2.5">
            {isFirstStep ? (
              <button
                onClick={onClose}
                className="py-4 bg-muted rounded-xl flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4 text-foreground" />
                <span className="text-base font-bold text-foreground">CANCEL</span>
              </button>
            ) : (
              <button
                onClick={handleBack}
                className="py-4 bg-muted rounded-xl flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4 text-foreground" />
                <span className="text-base font-bold text-foreground">BACK</span>
              </button>
            )}
            <button
              onClick={rightButtonAction}
              disabled={!canProceed}
              className={cn(
                'py-4 rounded-xl flex items-center justify-center gap-2 transition-all',
                canProceed
                  ? `${accentBgClass} ${accentTextClass}`
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <span className="text-base font-bold">
                {rightButtonLabel}
              </span>
              <ArrowRight className="w-4 h-4" />
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
};
