import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Minus, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, ArrowRight, ArrowUpRight, Music, Folder, AlertCircle } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { DotRadio } from '@/app/components/ui/DotRadio';
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

type EventType = 'wedding' | 'corporate' | 'private' | 'festival' | 'club' | 'other' | 'rehearsal';
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
          'h-1 rounded-[10px]',
          i === current ? 'w-4' : 'w-2',
          !activeColor && (i === current ? 'bg-black' : 'bg-black/30'),
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
          <span className={cn('text-[10px] font-bold uppercase tracking-wider block', isDark ? 'text-white/50' : 'text-black/50')}>EVENT DATE</span>
          <span className={cn('text-[22px] font-bold uppercase', isDark ? 'text-white' : 'text-black')}>{monthLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center', isDark ? 'border-white' : 'border-black')}>
            <ChevronLeft className={cn('w-4 h-4', isDark ? 'text-white' : 'text-black')} />
          </button>
          <button onClick={nextMonth} className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center', isDark ? 'border-white' : 'border-black')}>
            <ChevronRight className={cn('w-4 h-4', isDark ? 'text-white' : 'text-black')} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DAYS_OF_WEEK.map((d, i) => (
          <div key={i} className={cn('text-center text-[10px] font-bold py-1', isDark ? 'text-white/40' : 'text-black/40')}>{d}</div>
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
                ? (isDark ? 'bg-white text-black' : 'bg-black text-[#D5FB46]')
                : (isDark ? 'text-white hover:bg-white/10' : 'text-black hover:bg-black/10')
            )}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  );
};

// --- Guest Dots ---
const GuestDots: React.FC<{ count: number; activeColor?: string; inactiveColor?: string }> = ({ count, activeColor, inactiveColor }) => {
  const maxDots = 200;
  const filled = Math.min(count, maxDots);
  const cols = 20;
  const rows = Math.ceil(maxDots / cols);
  return (
    <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: rows * cols }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-full h-[10px] rounded-full',
            !activeColor && (i < filled ? 'bg-black' : 'bg-black/20')
          )}
          style={activeColor ? { backgroundColor: i < filled ? activeColor : inactiveColor } : undefined}
        />
      ))}
    </div>
  );
};

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  onClose, onCreate, initialType, bandMembers = [], currentUserId, editingEvent,
}) => {
  const isEditing = !!editingEvent;
  const { selectedBand } = useBand();

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

  const MEMBERS = useMemo(() => bandMembers, [bandMembers]);
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
        fees[id] = editingEvent.memberFeeMap?.[uid] || '0';
      });
      return fees;
    }
    if (isEditing) return {};
    return currentUserMemberId ? { [currentUserMemberId]: '0' } : {};
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
    : initialType === 'quote' || editingEvent?.status?.toUpperCase() === 'QUOTE' || editingEvent?.status?.toUpperCase() === 'QUOTED' ? 'quote'
    : 'gig';

  const modalBg = modalCategory === 'rehearsal' ? '#0147FF' : modalCategory === 'quote' ? '#9A8878' : '#D5FB46';
  const isDarkBg = modalCategory === 'rehearsal' || modalCategory === 'quote';
  const tc = isDarkBg ? 'text-white' : 'text-black';
  const tcMuted = isDarkBg ? 'text-white/50' : 'text-black/50';
  const tcFaint = isDarkBg ? 'text-white/30' : 'text-black/30';
  const tcSub = isDarkBg ? 'text-white/40' : 'text-black/40';
  const bcMuted = isDarkBg ? 'border-white/20' : 'border-black/20';
  const bcSolid = isDarkBg ? 'border-white' : 'border-black';
  const bgPill = isDarkBg ? 'bg-white/10' : 'bg-black/10';
  const pillAccent = modalCategory === 'rehearsal' ? 'text-[#0147FF]' : modalCategory === 'quote' ? 'text-[#9A8878]' : 'text-[#D5FB46]';
  const bgPillSelected = isDarkBg ? 'bg-white text-black' : `bg-black ${pillAccent}`;
  const bgPillUnselected = isDarkBg ? 'bg-white/10 text-white/50' : 'bg-black/10 text-black/50';
  const dotActive = isDarkBg ? '#FFFFFF' : '#000000';
  const dotInactive = isDarkBg ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';

  const musicianCount = selectedMembers.length;

  const totalPayout = useMemo(() =>
    Object.values(memberFees).reduce((acc, fee) => acc + (parseFloat(fee) || 0), 0),
  [memberFees]);

  const allMemberFeesValid = useMemo(() =>
    selectedMembers.length === 0 || selectedMembers.every(id => parseFloat(memberFees[id]) > 0),
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
      setMemberFees(prev => ({ ...prev, [memberId]: '0' }));
    }
  };

  const updateFee = useCallback((memberId: string, amount: string) => {
    setMemberFees(prev => ({ ...prev, [memberId]: amount }));
  }, []);

  const toggleMandatory = (memberId: string) => {
    setMemberMandatory(prev => ({ ...prev, [memberId]: !prev[memberId] }));
  };

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
        fee: memberFees[id],
        name: member?.name,
        role: member?.role,
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
                isSelected ? (isDarkBg ? 'bg-white text-black' : 'bg-black text-white') : (isDarkBg ? 'bg-white/20 text-white/50' : 'bg-black/30 text-black/50')
              )}>
                {value.toUpperCase()}
              </div>
              <span className={cn(
                'text-[32px] font-bold uppercase leading-tight',
                isSelected ? tc : tcFaint
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
    // Dynamic override: if user has already filled the field, don't show warning
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
          className={cn('w-full bg-transparent border-b pb-2 text-[22px] font-bold uppercase focus:outline-none', tc, bcMuted, isDarkBg ? 'placeholder:text-white/20 focus:border-white' : 'placeholder:text-black/20 focus:border-black')}
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
          className={cn('w-full bg-transparent border-b pb-2 text-[22px] font-bold uppercase focus:outline-none', tc, bcMuted, isDarkBg ? 'placeholder:text-white/20 focus:border-white' : 'placeholder:text-black/20 focus:border-black')}
        />
      </div>

      {/* Venue */}
      <div className={cn(warnField('venue') && 'rounded-[10px] p-3 -m-3 bg-[#F23030]/10 ring-2 ring-[#F23030]/30')}>
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('text-[10px] font-bold uppercase tracking-wider', warnField('venue') ? 'text-[#F23030]' : tcMuted)}>VENUE</span>
          {warnField('venue') && <AlertCircle className="w-3 h-3 text-[#F23030]" />}
        </div>
        <input
          type="text"
          value={details.venue}
          onChange={(e) => setDetails({ ...details, venue: e.target.value })}
          placeholder="VENUE NAME"
          className={cn('w-full bg-transparent border-b pb-2 text-[22px] font-bold uppercase focus:outline-none mb-3', tc, warnField('venue') ? 'border-[#F23030]/50' : bcMuted, isDarkBg ? 'placeholder:text-white/20 focus:border-white' : 'placeholder:text-black/20 focus:border-black')}
        />
        {/* Address Tags */}
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={details.address}
            onChange={(e) => setDetails({ ...details, address: e.target.value })}
            placeholder="ADDRESS"
            className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[140px]', bgPill, isDarkBg ? 'text-white/60 placeholder:text-white/30 focus:bg-white/20' : 'text-black/60 placeholder:text-black/30 focus:bg-black/20')}
          />
          <input
            type="text"
            value={details.city}
            onChange={(e) => setDetails({ ...details, city: e.target.value })}
            placeholder="CITY"
            className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[80px]', bgPill, isDarkBg ? 'text-white/60 placeholder:text-white/30 focus:bg-white/20' : 'text-black/60 placeholder:text-black/30 focus:bg-black/20')}
          />
          <input
            type="text"
            value={details.province}
            onChange={(e) => setDetails({ ...details, province: e.target.value })}
            placeholder="PROVINCE"
            className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[80px]', bgPill, isDarkBg ? 'text-white/60 placeholder:text-white/30 focus:bg-white/20' : 'text-black/60 placeholder:text-black/30 focus:bg-black/20')}
          />
          <input
            type="text"
            value={details.zip}
            onChange={(e) => setDetails({ ...details, zip: e.target.value })}
            placeholder="ZIP"
            className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[50px]', bgPill, isDarkBg ? 'text-white/60 placeholder:text-white/30 focus:bg-white/20' : 'text-black/60 placeholder:text-black/30 focus:bg-black/20')}
          />
          <input
            type="text"
            value={details.country}
            onChange={(e) => setDetails({ ...details, country: e.target.value })}
            placeholder="COUNTRY"
            className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold uppercase focus:outline-none w-auto min-w-[60px]', bgPill, isDarkBg ? 'text-white/60 placeholder:text-white/30 focus:bg-white/20' : 'text-black/60 placeholder:text-black/30 focus:bg-black/20')}
          />
        </div>
      </div>

      {/* Calendar */}
      <div className={cn(warnField('date') && 'rounded-lg p-3 -m-3 bg-[#F23030]/10 ring-2 ring-[#F23030]/30')}>
        {warnField('date') && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold text-[#F23030] uppercase tracking-wider">DATE</span>
            <AlertCircle className="w-3 h-3 text-[#F23030]" />
          </div>
        )}
        <CalendarGrid selectedDate={details.date} onSelectDate={(d) => setDetails({ ...details, date: d })} isDark={isDarkBg} />
      </div>

      {/* Start / End Times */}
      <div className={cn('grid grid-cols-2 gap-6', warnField('time') && 'rounded-[10px] p-3 -m-3 bg-[#F23030]/10 ring-2 ring-[#F23030]/30')}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', warnField('time') ? 'text-[#F23030]' : tcMuted)}>START</span>
            {warnField('time') && <AlertCircle className="w-3 h-3 text-[#F23030]" />}
          </div>
          <input
            type="time"
            value={details.startTime}
            onChange={(e) => setDetails({ ...details, startTime: e.target.value })}
            className={cn('w-full bg-transparent border-b pb-2 text-[22px] font-bold uppercase focus:outline-none', tc, warnField('time') ? 'border-[#F23030]/50' : bcMuted, isDarkBg ? 'focus:border-white' : 'focus:border-black')}
          />
        </div>
        <div>
          <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>END</span>
          <input
            type="time"
            value={details.endTime}
            onChange={(e) => setDetails({ ...details, endTime: e.target.value })}
            className={cn('w-full bg-transparent border-b pb-2 text-[22px] font-bold uppercase focus:outline-none', tc, bcMuted, isDarkBg ? 'focus:border-white' : 'focus:border-black')}
          />
        </div>
      </div>

      {/* Guests */}
      <div>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>GUESTS</span>
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => setDetails({ ...details, guests: Math.max(0, details.guests - 10) })}
            className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', isDarkBg ? 'bg-white' : 'bg-black')}
          >
            <Minus className={cn('w-5 h-5', isDarkBg ? 'text-black' : 'text-white')} />
          </button>
          <span className={cn('text-[40px] font-bold leading-none flex-1 text-center', tc)}>{details.guests}</span>
          <button
            onClick={() => setDetails({ ...details, guests: details.guests + 10 })}
            className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', isDarkBg ? 'bg-white' : 'bg-black')}
          >
            <Plus className={cn('w-5 h-5', isDarkBg ? 'text-black' : 'text-white')} />
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
        <GuestDots count={details.guests} activeColor={dotActive} inactiveColor={dotInactive} />
      </div>

      {/* Setting */}
      <div>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-2', tcMuted)}>SETTING</span>
        <div className="flex gap-2">
          <button
            onClick={() => setSetting('indoor')}
            className={cn(
              'px-4 py-2 rounded-md text-[12px] font-bold uppercase border transition-all',
              setting === 'indoor' ? bgPillSelected + ' border-current' : (isDarkBg ? 'bg-transparent text-white/40 border-white/20' : 'bg-transparent text-black/40 border-black/20')
            )}
          >
            INDOOR
          </button>
          <button
            onClick={() => setSetting('outdoor')}
            className={cn(
              'px-4 py-2 rounded-md text-[12px] font-bold uppercase border transition-all',
              setting === 'outdoor' ? bgPillSelected + ' border-current' : (isDarkBg ? 'bg-transparent text-white/40 border-white/20' : 'bg-transparent text-black/40 border-black/20')
            )}
          >
            OUTDOOR
          </button>
        </div>
      </div>
    </div>
  );

  // --- RENDER STEP 3: Team & Pay ---
  const renderStep3 = () => (
    <div className="flex flex-col gap-8">
      {/* Team Size */}
      <div>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>PERFORMANCE</span>
        <span className={cn('text-[28px] font-bold uppercase block mb-3', tc)}>TYPE</span>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'SOLO', count: 1, type: 'solo' as PerformanceType },
            { label: 'DUO', count: 2, type: 'duo' as PerformanceType },
            { label: 'TRIO', count: 3, type: 'trio' as PerformanceType },
            { label: 'QUARTET', count: 4, type: 'full_band' as PerformanceType },
            { label: 'FULL BAND', count: MEMBERS.length, type: 'full_band' as PerformanceType },
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
                newSelected.forEach(id => { newFees[id] = memberFees[id] || '0'; });
                setMemberFees(newFees);
              }}
              className={cn(
                'px-3 py-1.5 rounded-md text-[11px] font-bold uppercase border transition-all',
                musicianCount === preset.count
                  ? bgPillSelected + ' border-current'
                  : (isDarkBg ? 'bg-transparent text-white/50 border-white/20' : 'bg-transparent text-black/50 border-black/20')
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Musicians Count */}
      <div className={cn(warnField('members') && 'rounded-[10px] p-3 -m-3 bg-[#F23030]/10 ring-2 ring-[#F23030]/30')}>
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-[10px] font-bold uppercase tracking-wider', warnField('members') ? 'text-[#F23030]' : tcMuted)}>MUSICIANS</span>
              {warnField('members') && <AlertCircle className="w-3 h-3 text-[#F23030]" />}
            </div>
            <span className={cn('text-[40px] font-bold leading-none', tc)}>{musicianCount}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => adjustMusicians(-1)}
              className={cn('w-10 h-10 rounded-full flex items-center justify-center', isDarkBg ? 'bg-white' : 'bg-black')}
            >
              <Minus className={cn('w-5 h-5', isDarkBg ? 'text-black' : 'text-white')} />
            </button>
            <button
              onClick={() => adjustMusicians(1)}
              className={cn('w-10 h-10 rounded-full flex items-center justify-center', isDarkBg ? 'bg-white' : 'bg-black')}
            >
              <Plus className={cn('w-5 h-5', isDarkBg ? 'text-black' : 'text-white')} />
            </button>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="flex flex-col gap-6">
        {MEMBERS.map((member) => {
          const isSelected = selectedMembers.includes(member.id);
          const isMandatory = memberMandatory[member.id] || false;
          if (!isSelected) return null;
          const feeVal = parseFloat(memberFees[member.id]) || 0;
          const feeMissing = feeVal <= 0;

          return (
            <div key={member.id} className="flex items-start justify-between">
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('px-2 py-0.5 text-[10px] font-bold uppercase rounded', isDarkBg ? 'bg-white text-black' : 'bg-black text-white')}>
                    {member.role}
                  </span>
                  <button
                    onClick={() => toggleMandatory(member.id)}
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-bold uppercase rounded border transition-all',
                      isMandatory
                        ? (isDarkBg ? 'bg-white text-black border-white' : 'bg-black text-white border-black')
                        : (isDarkBg ? 'bg-transparent text-white/40 border-white/20' : 'bg-transparent text-black/40 border-black/20')
                    )}
                  >
                    MANDATORY
                  </button>
                </div>
                <span className={cn('text-[20px] font-bold uppercase', tc)}>{member.name}</span>
                <div className="flex items-center gap-1">
                  <span className={cn('font-bold text-sm', feeMissing ? 'text-[#F23030]' : tcSub)}>$</span>
                  <input
                    type="number"
                    value={memberFees[member.id] || ''}
                    onChange={(e) => updateFee(member.id, e.target.value)}
                    placeholder="0"
                    className={cn('bg-transparent font-bold text-sm border-b focus:outline-none w-20 pb-0.5', feeMissing ? 'text-[#F23030] border-[#F23030]/50 focus:border-[#F23030] placeholder:text-[#F23030]/40' : (isDarkBg ? 'text-white/60 border-white/10 focus:border-white' : 'text-black/60 border-black/10 focus:border-black'))}
                  />
                  {feeMissing && <span className="text-[9px] font-bold text-[#F23030] uppercase ml-1">Required</span>}
                </div>
              </div>
              <DotCheckbox checked={true} activeColor={dotActive} inactiveColor={dotInactive} />
            </div>
          );
        })}
      </div>

      {/* Fee Summary */}
      <div className={cn('flex flex-col gap-4 pt-4 border-t', isDarkBg ? 'border-white/10' : 'border-black/10')}>
        {totalPayout > 0 && (
          <div className="flex items-center justify-between">
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', tcMuted)}>MEMBERS TOTAL</span>
            <span className={cn('text-[22px] font-bold', tc)}>${totalPayout}</span>
          </div>
        )}

        <div>
          <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>EXTRA BAND FEE</span>
          <div className="flex items-center">
            <span className={cn('text-[22px] font-bold', tcSub)}>$</span>
            <input
              type="number"
              value={extraBandFee}
              onChange={(e) => setExtraBandFee(e.target.value)}
              placeholder="0"
              className={cn('bg-transparent text-[22px] font-bold focus:outline-none w-full', tc, isDarkBg ? 'placeholder:text-white/20' : 'placeholder:text-black/20')}
            />
          </div>
        </div>

        {grandTotalFee > 0 && (
          <div className={cn('flex items-center justify-between py-3 border-t', isDarkBg ? 'border-white/10' : 'border-black/10')}>
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', tcMuted)}>TOTAL BAND FEE</span>
            <span className={cn('text-[28px] font-bold', tc)}>${grandTotalFee}</span>
          </div>
        )}
      </div>

      {/* Duration */}
      <div className={cn('pt-4 border-t', isDarkBg ? 'border-white/10' : 'border-black/10')}>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider block mb-1', tcMuted)}>DURATION</span>
        <select
          value={details.duration}
          onChange={(e) => setDetails({ ...details, duration: parseInt(e.target.value) || 0 })}
          className={cn('bg-transparent text-[28px] font-bold focus:outline-none w-full appearance-none cursor-pointer', tc)}
        >
          {[30, 60, 90, 120, 150, 180, 210, 240].map(m => (
            <option key={m} value={m} className="text-black bg-white text-base">
              {m >= 60 ? `${Math.floor(m / 60)}h${m % 60 > 0 ? `${m % 60}m` : ''}` : `${m}m`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  // --- RENDER STEP 4: Overview ---
  const renderStep4 = () => {
    const selectedDate = details.date ? new Date(details.date + 'T00:00:00') : new Date();
    const dateStr = selectedDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const toggleSection = (id: string) => setExpandedSection(prev => prev === id ? null : id);
    const songCount = setlist.reduce((acc: number, s: any) => acc + ((s.songs || []).length), 0);
    const eventYear = selectedDate.getFullYear();
    const eventMonthDay = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    const borderColor = isDarkBg ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
    const subtitleColor = isDarkBg ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
    const textColor = isDarkBg ? 'white' : 'black';

    const isQuote = modalCategory === 'quote';

    if (isQuote) {
      return (
        <div className="flex flex-col gap-[40px]">
          {/* Header */}
          <div className="flex flex-col gap-[8px]">
            <div className="flex gap-[4px] flex-wrap">
              <div className="rounded-[6px] px-[10px] py-[4px] bg-white/20">
                <span className="text-[12px] font-bold text-white uppercase">QUOTE</span>
              </div>
            </div>
            <h2 className="text-[32px] font-bold text-white uppercase leading-none">{details.title || 'UNTITLED'}</h2>
            <span className="text-[14px] font-medium text-white/50 uppercase">{dateStr}</span>
          </div>

          {/* Year + Date */}
          <div className="flex gap-[20px]">
            <div className="flex-1 flex flex-col">
              <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('year')}>
                <span className="text-[12px] font-bold uppercase text-white">YEAR</span>
                <motion.div animate={{ rotate: expandedSection === 'year' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ArrowUpRight className="w-[14px] h-[14px] text-white" />
                </motion.div>
              </button>
              <span className="text-[42px] font-bold leading-none text-white">{eventYear}</span>
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
                <span className="text-[12px] font-bold uppercase text-white">DATE</span>
                <motion.div animate={{ rotate: expandedSection === 'date' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ArrowUpRight className="w-[14px] h-[14px] text-white" />
                </motion.div>
              </button>
              <span className="text-[42px] font-bold leading-none text-white">{eventMonthDay}</span>
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
                  <span className="text-[12px] font-bold uppercase text-white">CLIENT</span>
                  <motion.div animate={{ rotate: expandedSection === 'client' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ArrowUpRight className="w-[14px] h-[14px] text-white" />
                  </motion.div>
                </button>
                <span className="text-[42px] font-bold leading-none text-white">
                  {(details.clientName || details.title || '—').split(' ')[0]?.toUpperCase()}
                </span>
                {(details.clientName || details.title || '').split(' ').length > 1 && (
                  <span className="text-[22px] font-bold leading-none text-white">
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
                  <span className="text-[12px] font-bold uppercase text-white">PRICING</span>
                  <motion.div animate={{ rotate: expandedSection === 'pricing' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ArrowUpRight className="w-[14px] h-[14px] text-white" />
                  </motion.div>
                </button>
                <span className="text-[42px] font-bold leading-none text-white">
                  €{details.price || '0'}
                </span>
              </div>
              <AnimatePresence>
                {expandedSection === 'pricing' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="pt-[12px] flex flex-col gap-[8px]">
                      <div className="flex items-center justify-between py-[8px] border-b" style={{ borderColor }}>
                        <span className="text-[12px] font-medium uppercase" style={{ color: subtitleColor }}>Band Total</span>
                        <span className="text-[14px] font-bold" style={{ color: textColor }}>€{details.price || '0'}</span>
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
                <span className="text-[12px] font-bold uppercase text-white">SONGS</span>
                <ArrowUpRight className="w-[14px] h-[14px] text-white" />
              </button>
              <span className="text-[42px] font-bold leading-none text-white">{songCount}</span>
            </div>
          </div>

          {/* Tasks */}
          <div className="flex flex-col gap-[20px]">
            <div className="flex flex-col">
              <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleSection('tasks')}>
                <span className="text-[12px] font-bold uppercase text-white">TASKS</span>
                <motion.div animate={{ rotate: expandedSection === 'tasks' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ArrowUpRight className="w-[14px] h-[14px] text-white" />
                </motion.div>
              </button>
              <span className="text-[42px] font-bold leading-none text-white">{tasks.length}</span>
            </div>
            <AnimatePresence>
              {expandedSection === 'tasks' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <div className="pt-[12px] flex flex-col gap-[8px]">
                    {taskTemplates.length > 0 && tasks.length === 0 && (
                      <div className="mb-3">
                        <span className="text-[10px] font-bold uppercase block mb-1.5 text-white/40">LOAD FROM TEMPLATE</span>
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
                              className="px-3 py-1.5 rounded-[10px] text-[11px] font-bold flex items-center gap-1.5 transition-all bg-white/15 text-white hover:bg-white/25"
                            >
                              <Folder className="w-3 h-3 text-white/40" />
                              {tpl.name}
                              <span className="text-white/30">{tpl.tasks.length}</span>
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
                          className="flex-1 bg-transparent border-b-2 border-white/10 py-1 text-sm font-bold text-white focus:outline-none focus:border-white placeholder:text-white/20 transition-all"
                        />
                        <button onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))} className="text-white/20 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setTasks([...tasks, { uid: `t-${Date.now()}`, title: '', completed: false }])}
                      className="text-[12px] font-bold uppercase flex items-center gap-1 text-white/50 hover:text-white transition-colors mt-1"
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
                <span className="text-[12px] font-bold uppercase text-white">MEMBERS</span>
                <motion.div animate={{ rotate: expandedSection === 'members' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ArrowUpRight className="w-[14px] h-[14px] text-white" />
                </motion.div>
              </button>
              <span className="text-[42px] font-bold leading-none text-white">{selectedMembers.length}</span>
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
                  <span className="text-[12px] font-bold uppercase text-white">NOTES</span>
                  <motion.div animate={{ rotate: expandedSection === 'notes' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ArrowUpRight className="w-[14px] h-[14px] text-white" />
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
                        className="w-full bg-transparent border-b-2 border-white/10 py-2 text-sm font-medium text-white focus:outline-none focus:border-white placeholder:text-white/20 transition-all resize-none"
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
              <span className={cn('px-2 py-0.5 text-[10px] font-bold uppercase rounded', isDarkBg ? 'bg-white text-black' : 'bg-black text-white')}>
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
                  <span className={cn('px-2 py-0.5 text-[10px] font-bold uppercase rounded inline-flex self-start', isDarkBg ? 'bg-white text-black' : 'bg-black text-white')}>
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
                        <input
                          type="number"
                          value={details.duration}
                          onChange={(e) => setDetails({ ...details, duration: parseInt(e.target.value) || 0 })}
                          className={cn('w-full bg-transparent border-b-2 py-1 text-lg font-bold focus:outline-none transition-all', tc, isDarkBg ? 'border-white/10 focus:border-white' : 'border-black/10 focus:border-black')}
                        />
                        <span className={cn('text-[10px] font-bold', tcFaint)}>minutes</span>
                      </div>
                      <div>
                        <span className={cn('text-[10px] font-bold uppercase block mb-1', tcSub)}>SETS</span>
                        <input
                          type="number"
                          value={1}
                          readOnly
                          className={cn('w-full bg-transparent border-b-2 py-1 text-lg font-bold focus:outline-none', tc, isDarkBg ? 'border-white/10' : 'border-black/10')}
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
                                className={cn('px-3 py-1.5 rounded-[10px] text-[11px] font-bold flex items-center gap-1.5 transition-all', isDarkBg ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-white text-black hover:bg-white/80')}
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
                            className={cn('flex-1 bg-transparent border-b-2 py-1 text-sm font-bold focus:outline-none transition-all', tc, isDarkBg ? 'border-white/10 placeholder:text-white/20 focus:border-white' : 'border-black/10 placeholder:text-black/20 focus:border-black')}
                          />
                          <button
                            onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))}
                            className={cn(isDarkBg ? 'text-white/20' : 'text-black/20', 'hover:text-red-500 transition-colors')}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setTasks([...tasks, { uid: `t-${Date.now()}`, title: '', completed: false }])}
                        className={cn('text-[12px] font-bold uppercase flex items-center gap-1 transition-colors mt-1', tcMuted, isDarkBg ? 'hover:text-white' : 'hover:text-black')}
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
                        className={cn('w-full bg-transparent border-b-2 py-2 text-sm font-medium focus:outline-none transition-all resize-none', tc, isDarkBg ? 'border-white/10 placeholder:text-white/20 focus:border-white' : 'border-black/10 placeholder:text-black/20 focus:border-black')}
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
    data.songs.forEach(ss => {
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
      {/* Songs Header */}
      <div className="px-4 pt-4 pb-4 flex items-center justify-between shrink-0">
        <button onClick={() => setSongsView(false)} className={cn('w-10 h-10 rounded-full border-2 flex items-center justify-center', bcSolid)}>
          <ArrowLeft className={cn('w-5 h-5', tc)} />
        </button>
        <span className={cn('text-[20px] font-bold uppercase', tc)}>SONGS</span>
        <button onClick={onClose} className={cn('w-[50px] h-[50px] rounded-full border-2 bg-[rgba(216,216,216,0.3)] flex items-center justify-center', bcSolid)}>
          <X className={cn('w-6 h-6', tc)} />
        </button>
      </div>

      {/* Setlist Builder */}
      <div className="flex-1 overflow-y-auto px-4">
        {/* Saved setlist templates quick-load */}
        {savedSetlists.length > 0 && setlist.length === 0 && (
          <div className="mb-6">
            <span className="text-[10px] font-bold text-black/50 uppercase block mb-2">LOAD FROM SAVED SETLISTS</span>
            <div className="flex flex-wrap gap-2">
              {savedSetlists.map(sl => (
                <button
                  key={sl.id}
                  onClick={() => loadSavedSetlist(sl)}
                  className="px-3 py-2 rounded-[10px] bg-white flex items-center gap-2 hover:bg-white/80 transition-all"
                >
                  <Folder className="w-3.5 h-3.5 text-black/50" />
                  <span className="text-[12px] font-bold text-black">{sl.name}</span>
                  {sl.song_count != null && (
                    <span className="text-[10px] font-bold text-black/30">{sl.song_count} songs</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start justify-between mb-6">
          <div className="flex flex-col gap-1">
            <span className={cn('px-2 py-0.5 text-[10px] font-bold uppercase rounded inline-flex self-start', isDarkBg ? 'bg-white/20 text-white/50' : 'bg-black/30 text-black/50')}>
              {setlist.length} {setlist.length === 1 ? 'SET' : 'SETS'}
            </span>
            <span className={cn('text-[28px] font-bold uppercase', tc)}>SETLIST BUILDER</span>
          </div>
          <button
            onClick={addSet}
            className={cn('w-10 h-10 rounded-full border-2 flex items-center justify-center mt-2 transition-colors', bcSolid, tc, isDarkBg ? 'hover:bg-white hover:text-black' : `hover:bg-black hover:${pillAccent}`)}
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
                      <span className="text-[10px] font-bold text-black/50 uppercase">
                        {songCount === 1 ? 'SONG' : 'SONGS'}
                      </span>
                    </div>
                    <DotCheckbox checked={songCount > 0} activeColor="#000000" inactiveColor="rgba(0,0,0,0.20)" />
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
                            className="bg-transparent border-b-2 border-black/10 py-1 text-sm font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                            placeholder="Set name..."
                          />

                          {(item.songs || []).map((song: any, si: number) => (
                            <div key={song.uid} className="flex items-start gap-2">
                              <span className="text-[11px] font-bold text-black/30 mt-2 w-5 shrink-0">{si + 1}.</span>
                              <div className="flex-1 flex flex-col gap-1">
                                <input
                                  type="text"
                                  value={song.title}
                                  onChange={(e) => updateSongInSet(item.uid, song.uid, 'title', e.target.value)}
                                  placeholder="Song title..."
                                  className="bg-transparent border-b-2 border-black/10 py-1 text-sm font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                                />
                                <input
                                  type="text"
                                  value={song.artist}
                                  onChange={(e) => updateSongInSet(item.uid, song.uid, 'artist', e.target.value)}
                                  placeholder="Artist..."
                                  className="bg-transparent border-b border-black/5 py-1 text-[11px] font-bold text-black/50 placeholder:text-black/15 focus:outline-none focus:border-black/30 transition-all"
                                />
                              </div>
                              <button
                                onClick={() => removeSongFromSet(item.uid, song.uid)}
                                className="text-black/20 hover:text-red-500 transition-colors mt-1"
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
                                className="text-[12px] font-bold text-black/70 uppercase flex items-center gap-1 hover:text-black transition-colors"
                              >
                                <Music className="w-3 h-3" /> From library
                              </button>
                              <button
                                onClick={() => addSongToSet(item.uid)}
                                className="text-[12px] font-bold text-black/50 uppercase flex items-center gap-1 hover:text-black transition-colors"
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
      <div className="px-4 py-5 shrink-0">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setSongsView(false)}
            className="py-4 bg-white rounded-[10px] flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4 text-black" />
            <span className="text-[16px] font-bold text-black">BACK</span>
          </button>
          <button
            onClick={handleSongsViewDone}
            className="py-4 bg-black rounded-[10px] flex items-center justify-center gap-2"
          >
            <span className="text-[16px] font-bold" style={{ color: modalBg }}>DONE</span>
            <ArrowRight className="w-4 h-4" style={{ color: modalBg }} />
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
      case 2: return selectedMembers.length === 0 || allMemberFeesValid;
      case 3: return true;
      default: return true;
    }
  })();

  const hasStepData = (() => {
    if (step === 2) return selectedMembers.length > 0 && allMemberFeesValid;
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
        className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
        style={{
          backgroundColor: modalBg,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 pt-16 pb-4">
          {/* Step Indicator */}
          <div className="mb-2">
            <StepIndicator current={step} total={STEPS.length} activeColor={dotActive} inactiveColor={dotInactive} />
          </div>

          {/* Header + Close */}
          <div className="flex items-start justify-between mb-10">
            <div className="flex flex-col gap-1">
              <span className={cn('text-[12px] font-bold uppercase', tc)}>
                {isEditing ? 'EDITING' : STEPS[step].label}
              </span>
              <h1 className={cn('text-[32px] font-bold uppercase leading-[1] whitespace-pre-line', tc)}>
                {STEPS[step].title}
              </h1>
              <span className={cn('text-[16px] font-bold uppercase', tcMuted)}>
                {isEditing ? (editingWarnings.length > 0 ? `${editingWarnings.length} FIELD${editingWarnings.length > 1 ? 'S' : ''} TO COMPLETE` : 'REVIEW & SAVE') : STEPS[step].subtitle}
              </span>
            </div>
            <button
              onClick={onClose}
              className={cn('w-[50px] h-[50px] rounded-full border-2 bg-[rgba(216,216,216,0.3)] flex items-center justify-center shrink-0', bcSolid)}
            >
              <X className={cn('w-6 h-6', tc)} />
            </button>
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
        <div className="px-4 py-5 shrink-0">
          <div className="grid grid-cols-2 gap-2.5">
            {isFirstStep ? (
              <button
                onClick={onClose}
                className="py-4 bg-white rounded-[10px] flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4 text-black" />
                <span className="text-[16px] font-bold text-black">CANCEL</span>
              </button>
            ) : (
              <button
                onClick={handleBack}
                className="py-4 bg-white rounded-[10px] flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4 text-black" />
                <span className="text-[16px] font-bold text-black">BACK</span>
              </button>
            )}
            <button
              onClick={rightButtonAction}
              disabled={!canProceed}
              className={cn(
                'py-4 rounded-[10px] flex items-center justify-center gap-2 transition-all',
                canProceed
                  ? 'bg-black'
                  : 'bg-black/30'
              )}
            >
              <span className={cn(
                'text-[16px] font-bold',
                canProceed ? 'text-white' : 'text-white/50'
              )}>
                {rightButtonLabel}
              </span>
              <ArrowRight className={cn('w-4 h-4', canProceed ? 'text-white' : 'text-white/50')} />
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
