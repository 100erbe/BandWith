import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Minus, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, ArrowRight, Music, Folder } from 'lucide-react';
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
}

// --- Step Indicator ---
const StepIndicator: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <div className="flex items-center justify-center gap-1">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={cn(
          'h-1 rounded-[10px]',
          i === current ? 'w-4 bg-black' : 'w-2 bg-black/30'
        )}
      />
    ))}
  </div>
);

// --- Calendar Grid ---
const CalendarGrid: React.FC<{
  selectedDate: string;
  onSelectDate: (date: string) => void;
}> = ({ selectedDate, onSelectDate }) => {
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
          <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider block">EVENT DATE</span>
          <span className="text-[22px] font-bold text-black uppercase">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 rounded-full border-2 border-black flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-black" />
          </button>
          <button onClick={nextMonth} className="w-8 h-8 rounded-full border-2 border-black flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-black" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DAYS_OF_WEEK.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-black/40 py-1">{d}</div>
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
              day && isSelected(day) ? 'bg-black text-[#D5FB46]' : 'text-black hover:bg-black/10'
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
const GuestDots: React.FC<{ count: number }> = ({ count }) => {
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
            'w-[10px] h-[10px] rounded-full',
            i < filled ? 'bg-black' : 'bg-black/20'
          )}
        />
      ))}
    </div>
  );
};

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  onClose, onCreate, initialType, bandMembers = [], currentUserId,
}) => {
  const { selectedBand } = useBand();
  const [step, setStep] = useState(0);
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
  const [eventType, setEventType] = useState<EventType | null>(
    initialType === 'rehearsal' ? 'rehearsal' : (initialType as EventType | null) || null
  );
  const [performanceType, setPerformanceType] = useState<PerformanceType>('full_band');
  const [setting, setSetting] = useState<SettingType>('indoor');
  const [details, setDetails] = useState({
    title: '',
    clientName: '',
    venue: '',
    address: '',
    city: '',
    province: '',
    zip: '',
    country: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '20:00',
    endTime: '23:30',
    guests: 0,
    duration: 120,
    pay: '',
  });
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);

  const [selectedMembers, setSelectedMembers] = useState<string[]>(currentUserMemberId ? [currentUserMemberId] : []);
  const [memberFees, setMemberFees] = useState<Record<string, string>>(currentUserMemberId ? { [currentUserMemberId]: '0' } : {});
  const [memberMandatory, setMemberMandatory] = useState<Record<string, boolean>>(currentUserMemberId ? { [currentUserMemberId]: true } : {});

  const [setlist, setSetlist] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState('');

  const musicianCount = selectedMembers.length;

  const totalPayout = useMemo(() =>
    Object.values(memberFees).reduce((acc, fee) => acc + (parseFloat(fee) || 0), 0),
  [memberFees]);

  // --- Handlers ---
  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleCreate();
  };
  const handleBack = () => { if (step > 0) setStep(step - 1); };

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
        pay: details.pay,
      },
      eventType,
      performanceType,
      setting,
      members: membersWithUserIds,
      audienceIds: membersWithUserIds.map(m => m.id),
      setlist,
      tasks,
      notes,
      status: 'confirmed',
    };
    onCreate(eventData);
  };

  // --- Rehearsal passthrough ---
  if (eventType === 'rehearsal') {
    return <RehearsalCreationWizard onClose={onClose} onCreate={onCreate} />;
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
                isSelected ? 'bg-black text-white' : 'bg-black/30 text-black/50'
              )}>
                {value.toUpperCase()}
              </div>
              <span className={cn(
                'text-[32px] font-bold uppercase leading-tight',
                isSelected ? 'text-black' : 'text-black/30'
              )}>
                {label}
              </span>
            </div>
            <DotRadio selected={isSelected} activeColor="#000000" inactiveColor="rgba(0,0,0,0.20)" />
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

  // --- RENDER STEP 2: Date & Location ---
  const renderStep2 = () => (
    <div className="flex flex-col gap-8">
      {/* Client Name */}
      <div>
        <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider block mb-1">CLIENT NAME</span>
        <input
          type="text"
          value={details.clientName}
          onChange={(e) => {
            setDetails(prev => ({ ...prev, clientName: e.target.value }));
            autoGenerateTitle(e.target.value, eventType);
          }}
          placeholder="EG. ROSSI"
          className="w-full bg-transparent border-b border-black/20 pb-2 text-[22px] font-bold text-black uppercase placeholder:text-black/20 focus:outline-none focus:border-black"
        />
      </div>

      {/* Event Title */}
      <div>
        <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider block mb-1">EVENT TITLE</span>
        <input
          type="text"
          value={details.title}
          onChange={(e) => {
            setDetails({ ...details, title: e.target.value });
            setTitleManuallyEdited(true);
          }}
          placeholder="EG. WEDDING PARTY"
          className="w-full bg-transparent border-b border-black/20 pb-2 text-[22px] font-bold text-black uppercase placeholder:text-black/20 focus:outline-none focus:border-black"
        />
      </div>

      {/* Venue */}
      <div>
        <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider block mb-1">VENUE</span>
        <input
          type="text"
          value={details.venue}
          onChange={(e) => setDetails({ ...details, venue: e.target.value })}
          placeholder="VENUE NAME"
          className="w-full bg-transparent border-b border-black/20 pb-2 text-[22px] font-bold text-black uppercase placeholder:text-black/20 focus:outline-none focus:border-black mb-3"
        />
        {/* Address Tags */}
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={details.address}
            onChange={(e) => setDetails({ ...details, address: e.target.value })}
            placeholder="ADDRESS"
            className="px-3 py-1.5 rounded-full bg-black/10 text-[11px] font-bold text-black/60 uppercase placeholder:text-black/30 focus:outline-none focus:bg-black/20 w-auto min-w-[140px]"
          />
          <input
            type="text"
            value={details.city}
            onChange={(e) => setDetails({ ...details, city: e.target.value })}
            placeholder="CITY"
            className="px-3 py-1.5 rounded-full bg-black/10 text-[11px] font-bold text-black/60 uppercase placeholder:text-black/30 focus:outline-none focus:bg-black/20 w-auto min-w-[80px]"
          />
          <input
            type="text"
            value={details.province}
            onChange={(e) => setDetails({ ...details, province: e.target.value })}
            placeholder="PROVINCE"
            className="px-3 py-1.5 rounded-full bg-black/10 text-[11px] font-bold text-black/60 uppercase placeholder:text-black/30 focus:outline-none focus:bg-black/20 w-auto min-w-[80px]"
          />
          <input
            type="text"
            value={details.zip}
            onChange={(e) => setDetails({ ...details, zip: e.target.value })}
            placeholder="ZIP"
            className="px-3 py-1.5 rounded-full bg-black/10 text-[11px] font-bold text-black/60 uppercase placeholder:text-black/30 focus:outline-none focus:bg-black/20 w-auto min-w-[50px]"
          />
          <input
            type="text"
            value={details.country}
            onChange={(e) => setDetails({ ...details, country: e.target.value })}
            placeholder="COUNTRY"
            className="px-3 py-1.5 rounded-full bg-black/10 text-[11px] font-bold text-black/60 uppercase placeholder:text-black/30 focus:outline-none focus:bg-black/20 w-auto min-w-[60px]"
          />
        </div>
      </div>

      {/* Calendar */}
      <CalendarGrid selectedDate={details.date} onSelectDate={(d) => setDetails({ ...details, date: d })} />

      {/* Start / End Times */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider block mb-1">START</span>
          <input
            type="time"
            value={details.startTime}
            onChange={(e) => setDetails({ ...details, startTime: e.target.value })}
            className="w-full bg-transparent border-b border-black/20 pb-2 text-[22px] font-bold text-black uppercase focus:outline-none focus:border-black"
          />
        </div>
        <div>
          <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider block mb-1">END</span>
          <input
            type="time"
            value={details.endTime}
            onChange={(e) => setDetails({ ...details, endTime: e.target.value })}
            className="w-full bg-transparent border-b border-black/20 pb-2 text-[22px] font-bold text-black uppercase focus:outline-none focus:border-black"
          />
        </div>
      </div>

      {/* Guests */}
      <div>
        <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider block mb-1">GUESTS</span>
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => setDetails({ ...details, guests: Math.max(0, details.guests - 10) })}
            className="w-10 h-10 rounded-full bg-black flex items-center justify-center shrink-0"
          >
            <Minus className="w-5 h-5 text-white" />
          </button>
          <span className="text-[40px] font-bold text-black leading-none flex-1 text-center">{details.guests}</span>
          <button
            onClick={() => setDetails({ ...details, guests: details.guests + 10 })}
            className="w-10 h-10 rounded-full bg-black flex items-center justify-center shrink-0"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {[50, 100, 150, 200, 300, 500].map(n => (
            <button
              key={n}
              onClick={() => setDetails({ ...details, guests: n })}
              className={cn(
                'px-3 py-1.5 rounded-[8px] text-[11px] font-bold transition-all',
                details.guests === n ? 'bg-black text-[#D5FB46]' : 'bg-black/10 text-black/50 hover:bg-black/20'
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <GuestDots count={details.guests} />
      </div>

      {/* Setting */}
      <div>
        <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider block mb-2">SETTING</span>
        <div className="flex gap-2">
          <button
            onClick={() => setSetting('indoor')}
            className={cn(
              'px-4 py-2 rounded-md text-[12px] font-bold uppercase border transition-all',
              setting === 'indoor' ? 'bg-black text-[#D5FB46] border-black' : 'bg-transparent text-black/40 border-black/20'
            )}
          >
            INDOOR
          </button>
          <button
            onClick={() => setSetting('outdoor')}
            className={cn(
              'px-4 py-2 rounded-md text-[12px] font-bold uppercase border transition-all',
              setting === 'outdoor' ? 'bg-black text-[#D5FB46] border-black' : 'bg-transparent text-black/40 border-black/20'
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
      {/* Performance Type */}
      <div>
        <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider block mb-1">PERFORMANCE</span>
        <span className="text-[28px] font-bold text-black uppercase block mb-3">TYPE</span>
        <div className="flex flex-wrap gap-2">
          {PERFORMANCE_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPerformanceType(value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-[11px] font-bold uppercase border transition-all',
                performanceType === value
                  ? 'bg-black text-white border-black'
                  : 'bg-transparent text-black/50 border-black/20'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Team Presets */}
      <div>
        <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider block mb-2">QUICK SELECT</span>
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: 'SOLO', count: 1 },
            { label: 'DUO', count: 2 },
            { label: 'TRIO', count: 3 },
            { label: 'QUARTET', count: 4 },
            { label: 'FULL BAND', count: MEMBERS.length },
          ].map(preset => (
            <button
              key={preset.label}
              onClick={() => {
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
                'px-3 py-1.5 rounded-[8px] text-[11px] font-bold uppercase transition-all',
                musicianCount === preset.count ? 'bg-black text-[#D5FB46]' : 'bg-black/10 text-black/50 hover:bg-black/20'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Musicians Count */}
      <div>
        <div className="flex items-end justify-between">
          <div>
            <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider block mb-1">MUSICIANS</span>
            <span className="text-[40px] font-bold text-black leading-none">{musicianCount}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => adjustMusicians(-1)}
              className="w-10 h-10 rounded-full bg-black flex items-center justify-center"
            >
              <Minus className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => adjustMusicians(1)}
              className="w-10 h-10 rounded-full bg-black flex items-center justify-center"
            >
              <Plus className="w-5 h-5 text-white" />
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

          return (
            <div key={member.id} className="flex items-start justify-between">
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-black text-white text-[10px] font-bold uppercase rounded">
                    {member.role}
                  </span>
                  <button
                    onClick={() => toggleMandatory(member.id)}
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-bold uppercase rounded border transition-all',
                      isMandatory
                        ? 'bg-black text-white border-black'
                        : 'bg-transparent text-black/40 border-black/20'
                    )}
                  >
                    MANDATORY
                  </button>
                </div>
                <span className="text-[20px] font-bold text-black uppercase">{member.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-black/40 font-bold text-sm">$</span>
                  <input
                    type="number"
                    value={memberFees[member.id] || ''}
                    onChange={(e) => updateFee(member.id, e.target.value)}
                    placeholder="0"
                    className="bg-transparent text-black/60 font-bold text-sm border-b border-black/10 focus:outline-none focus:border-black w-20 pb-0.5"
                  />
                </div>
              </div>
              <DotCheckbox checked={true} activeColor="#000000" inactiveColor="rgba(0,0,0,0.20)" />
            </div>
          );
        })}
      </div>

      {/* Total Payout summary */}
      {totalPayout > 0 && (
        <div className="flex items-center justify-between py-3 border-t border-black/10">
          <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider">TOTAL PAYOUT</span>
          <span className="text-[22px] font-bold text-black">${totalPayout}</span>
        </div>
      )}

      {/* Price & Duration */}
      <div className="grid grid-cols-2 gap-6 pt-4 border-t border-black/10">
        <div>
          <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider block mb-1">BAND FEE</span>
          <div className="flex items-center">
            <span className="text-[28px] font-bold text-black">$</span>
            <input
              type="number"
              value={details.pay}
              onChange={(e) => setDetails({ ...details, pay: e.target.value })}
              placeholder="0"
              className="bg-transparent text-[28px] font-bold text-black focus:outline-none w-full placeholder:text-black/20"
            />
          </div>
          {totalPayout > 0 && details.pay && (
            <span className="text-[10px] font-bold text-black/30 block mt-1">
              Margin: ${(parseFloat(details.pay) || 0) - totalPayout}
            </span>
          )}
        </div>
        <div>
          <span className="text-[10px] font-bold text-black/50 uppercase tracking-wider block mb-1">DURATION</span>
          <select
            value={details.duration}
            onChange={(e) => setDetails({ ...details, duration: parseInt(e.target.value) || 0 })}
            className="bg-transparent text-[28px] font-bold text-black focus:outline-none w-full appearance-none cursor-pointer"
          >
            {[30, 60, 90, 120, 150, 180, 210, 240].map(m => (
              <option key={m} value={m} className="text-black bg-white text-base">
                {m >= 60 ? `${Math.floor(m / 60)}h${m % 60 > 0 ? `${m % 60}m` : ''}` : `${m}m`}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  // --- RENDER STEP 4: Overview ---
  const renderStep4 = () => {
    const selectedDate = details.date ? new Date(details.date + 'T00:00:00') : new Date();
    const dateStr = selectedDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

    const toggleSection = (id: string) => setExpandedSection(prev => prev === id ? null : id);

    const sections = [
      { id: 'songs', tag: 'SONGS', value: String(setlist.reduce((acc: number, s: any) => acc + ((s.songs || []).length), 0)), hasData: setlist.length > 0 },
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
              <span className="px-2 py-0.5 bg-black text-white text-[10px] font-bold uppercase rounded">
                {currentUserMember.role}
              </span>
            )}
            <span className="text-[12px] font-bold text-black/50">{dateStr} @{details.startTime?.replace(':', '') || '2000'}</span>
          </div>
          <h2 className="text-[40px] font-bold text-black uppercase leading-[0.95]">
            {details.title || 'EVENT TITLE'}
          </h2>
          <span className="text-[12px] font-bold text-black/50 mt-1 block">{dateStr} @{details.startTime?.replace(':', '') || '2000'}</span>
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
                  <span className="px-2 py-0.5 bg-black text-white text-[10px] font-bold uppercase rounded inline-flex self-start">
                    {tag}
                  </span>
                  <span className="text-[40px] font-bold text-black leading-none">{value}</span>
                </div>
                <DotCheckbox checked={hasData} activeColor="#000000" inactiveColor="rgba(0,0,0,0.20)" />
              </button>

              {/* Expanded inline editor */}
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
                        <span className="text-[10px] font-bold text-black/40 uppercase block mb-1">DURATION</span>
                        <input
                          type="number"
                          value={details.duration}
                          onChange={(e) => setDetails({ ...details, duration: parseInt(e.target.value) || 0 })}
                          className="w-full bg-transparent border-b-2 border-black/10 py-1 text-lg font-bold text-black focus:outline-none focus:border-black transition-all"
                        />
                        <span className="text-[10px] font-bold text-black/30">minutes</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-black/40 uppercase block mb-1">SETS</span>
                        <input
                          type="number"
                          value={1}
                          readOnly
                          className="w-full bg-transparent border-b-2 border-black/10 py-1 text-lg font-bold text-black focus:outline-none"
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
                      {/* Task templates quick-load */}
                      {taskTemplates.length > 0 && tasks.length === 0 && (
                        <div className="mb-3">
                          <span className="text-[10px] font-bold text-black/40 uppercase block mb-1.5">LOAD FROM TEMPLATE</span>
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
                                className="px-3 py-1.5 rounded-[10px] bg-white text-[11px] font-bold text-black flex items-center gap-1.5 hover:bg-white/80 transition-all"
                              >
                                <Folder className="w-3 h-3 text-black/40" />
                                {tpl.name}
                                <span className="text-black/30">{tpl.tasks.length}</span>
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
                            className="flex-1 bg-transparent border-b-2 border-black/10 py-1 text-sm font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                          />
                          <button
                            onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))}
                            className="text-black/20 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setTasks([...tasks, { uid: `t-${Date.now()}`, title: '', completed: false }])}
                        className="text-[12px] font-bold text-black/50 uppercase flex items-center gap-1 hover:text-black transition-colors mt-1"
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
                        className="w-full bg-transparent border-b-2 border-black/10 py-2 text-sm font-medium text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all resize-none"
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
      setSetlist(prev => prev.map(s =>
        s.uid === songPickerTargetSet
          ? { ...s, songs: [...(s.songs || []), { uid: `song-${Date.now()}`, title: picked.title, artist: picked.artist, songId: picked.id }] }
          : s
      ));
    }
  };

  const handlePickedMultipleSongs = (picked: PickedSong[]) => {
    if (songPickerTargetSet) {
      setSetlist(prev => prev.map(s =>
        s.uid === songPickerTargetSet
          ? { ...s, songs: [...(s.songs || []), ...picked.map(p => ({ uid: `song-${Date.now()}-${Math.random().toString(36).slice(2)}`, title: p.title, artist: p.artist, songId: p.id }))] }
          : s
      ));
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
      className="fixed inset-0 z-[101] bg-[#D5FB46] flex flex-col overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Songs Header */}
      <div className="px-4 pt-4 pb-4 flex items-center justify-between shrink-0">
        <button onClick={() => setSongsView(false)} className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-black" />
        </button>
        <span className="text-[20px] font-bold text-black uppercase">SONGS</span>
        <button onClick={onClose} className="w-[50px] h-[50px] rounded-full border-2 border-black bg-[rgba(216,216,216,0.3)] flex items-center justify-center">
          <X className="w-6 h-6 text-black" />
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
            <span className="px-2 py-0.5 bg-black/30 text-black/50 text-[10px] font-bold uppercase rounded inline-flex self-start">
              {setlist.length} {setlist.length === 1 ? 'SET' : 'SETS'}
            </span>
            <span className="text-[28px] font-bold text-black uppercase">SETLIST BUILDER</span>
          </div>
          <button
            onClick={addSet}
            className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center mt-2 hover:bg-black hover:text-[#D5FB46] text-black transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {setlist.length === 0 ? (
          <div className="text-center py-12 text-black/30">
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
            <span className="text-[16px] font-bold text-[#D5FB46]">DONE</span>
            <ArrowRight className="w-4 h-4 text-[#D5FB46]" />
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
  const isFirstStep = step === 0;
  const currentStepConfig = STEPS[step];
  const isSkippable = currentStepConfig.skippable;

  const canProceed = (() => {
    switch (step) {
      case 0: return eventType !== null;
      case 1: return !!details.date;
      case 2: return true;
      case 3: return true;
      default: return true;
    }
  })();

  const hasStepData = (() => {
    if (step === 2) return Object.values(memberFees).some(f => parseFloat(f) > 0) || !!details.pay;
    return false;
  })();

  const rightButtonLabel = isLastStep
    ? 'CREATE EVENT'
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
        className="fixed inset-0 z-[100] bg-[#D5FB46] flex flex-col overflow-hidden"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 pt-16 pb-4">
          {/* Step Indicator */}
          <div className="mb-2">
            <StepIndicator current={step} total={STEPS.length} />
          </div>

          {/* Header + Close */}
          <div className="flex items-start justify-between mb-10">
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-bold text-black uppercase">{STEPS[step].label}</span>
              <h1 className="text-[32px] font-bold text-black uppercase leading-[1] whitespace-pre-line">
                {STEPS[step].title}
              </h1>
              <span className="text-[16px] font-bold text-black/50 uppercase">{STEPS[step].subtitle}</span>
            </div>
            <button
              onClick={onClose}
              className="w-[50px] h-[50px] rounded-full border-2 border-black bg-[rgba(216,216,216,0.3)] flex items-center justify-center shrink-0"
            >
              <X className="w-6 h-6 text-black" />
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
