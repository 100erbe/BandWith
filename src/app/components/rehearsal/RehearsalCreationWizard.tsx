import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Music, Mic2, Calendar, MapPin, Clock, Repeat, DollarSign, Users, 
  ArrowRight, ArrowLeft, Plus, Trash2, FileText, Link, ThumbsUp, 
  ThumbsDown, MessageCircle, CheckCircle2, AlertCircle, Briefcase,
  Wrench, BookOpen, ChevronDown, Play, Search, X, Folder, ListMusic, History, Edit, Layers, ChevronUp, Copy, Paperclip, User, LayoutGrid,
  Euro, Home, Lock, Unlock, Guitar, Check
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { DotRadio } from '@/app/components/ui/DotRadio';
import { SongPicker, type PickedSong } from '@/app/components/ui/SongPicker';
import { RehearsalState, RehearsalType, RehearsalSong, SongProposal, RehearsalTask, RehearsalMember, SetlistTemplate, RehearsalSetlistSnapshotFinal, ProposalAttachment, RecurrenceType } from './types';
import { useBand } from '@/lib/BandContext';
import { getSongs, getSetlists, getSetlist, createSong, type Song, type Setlist, type SetlistWithSongs } from '@/lib/services/songs';
import { supabase } from '@/lib/supabase';

interface TaskTemplateDB {
  id: string;
  name: string;
  category: string;
  tasks: { id: string; title: string; dueOffset: number; required: boolean }[];
}

import { RehearsalCostModal } from './RehearsalCostModal';
import { RehearsalProposeSongModal } from './RehearsalProposeSongModal';
import { RehearsalAddTaskModal } from './RehearsalAddTaskModal';
import { RehearsalSetlistEditorModal } from './RehearsalSetlistEditorModal';
import { RehearsalEditProposalModal } from './RehearsalEditProposalModal';
import { RehearsalTaskDetailModal } from './RehearsalTaskDetailModal';
import { RehearsalReviewSetlistModal } from './RehearsalReviewSetlistModal';
import { RehearsalReviewTasksModal } from './RehearsalReviewTasksModal';
import { RehearsalReviewProposalsModal } from './RehearsalReviewProposalsModal';
import { RehearsalReviewMembersModal } from './RehearsalReviewMembersModal';

const MOCK_PROPOSALS: SongProposal[] = [
  { id: 'p1', title: 'Superstition', artist: 'Stevie Wonder', proposer: 'CE', reason: 'Great for funk set', votes: { yes: 3, no: 0, comments: 2 }, status: 'approved' },
  { id: 'p2', title: 'Cissy Strut', artist: 'The Meters', proposer: 'GB', reason: 'Classic instrumental', votes: { yes: 2, no: 1, comments: 4 }, status: 'pending' },
];

function dbSongToRehearsalSong(song: Song): RehearsalSong {
  const secs = song.duration_seconds || 0;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return {
    id: song.id,
    title: song.title,
    artist: song.artist || 'Unknown',
    duration: secs > 0 ? `${m}:${String(s).padStart(2, '0')}` : '0:00',
    priority: song.priority || 'medium',
    type: 'song',
    category: song.category,
  };
}

function dbSetlistToTemplate(setlist: Setlist, songIds: string[]): SetlistTemplate {
  return {
    id: setlist.id,
    name: setlist.name,
    songIds,
    version: 1,
    updatedAt: setlist.updated_at || setlist.created_at,
    updatedBy: setlist.created_by || '',
  };
}

const SUGGESTED_TASKS = ["Print runlist", "Bring cables", "Check PA system", "Record session"];
const DEFAULT_CHECKLIST = ["Instrument", "Cables", "Tuner", "Power Supply", "Spare Strings/Sticks", "Earplugs"];

const STEPS = [
  { title: 'TYPE', subtitle: 'DEFINE THE SESSION', skippable: false },
  { title: 'DATE &\nLOCATION', subtitle: 'WHEN & WHERE', skippable: false },
  { title: 'RUNLIST &\nPROPOSALS', subtitle: 'OPTIONAL', skippable: true },
  { title: 'PREPARATION', subtitle: 'OPTIONAL', skippable: true },
  { title: 'REVIEW', subtitle: 'CONFIRM & CREATE', skippable: false },
];

const TYPE_OPTIONS: { value: RehearsalType; label: string; tag: string }[] = [
  { value: 'full_band', label: 'FULL BAND', tag: '4-8 MEMBERS' },
  { value: 'vocals', label: 'VOCALS', tag: 'SINGERS' },
  { value: 'rhythm', label: 'RHYTHM', tag: 'DRUMS & BASS' },
  { value: 'acoustic', label: 'ACOUSTIC', tag: 'UNPLUGGED' },
  { value: 'custom', label: 'OTHER', tag: 'CUSTOM' },
];

interface Props {
  onClose: () => void;
  onCreate: (data: RehearsalState) => void;
}

export const RehearsalCreationWizard: React.FC<Props> = ({ onClose, onCreate }) => {
  const { selectedBand } = useBand();
  const [step, setStep] = useState(0);

  const realMembers: RehearsalMember[] = useMemo(() => {
    if (!selectedBand?.members) return [];
    return selectedBand.members.map(m => ({
      id: m.user_id,
      name: m.profile?.full_name || m.profile?.email?.split('@')[0] || 'Unknown',
      role: m.instrument || m.role || 'Member',
      initials: (m.profile?.full_name || m.profile?.email || 'U')
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
      fee: m.default_fee?.toString() || '0',
      status: 'confirmed' as const,
    }));
  }, [selectedBand?.members]);

  // Modal state
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isSetlistEditorOpen, setIsSetlistEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SetlistTemplate | null>(null);
  const [isEditProposalOpen, setIsEditProposalOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<SongProposal | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RehearsalTask | null>(null);
  const [isReviewSetlistOpen, setIsReviewSetlistOpen] = useState(false);
  const [isReviewTasksOpen, setIsReviewTasksOpen] = useState(false);
  const [isReviewProposalsOpen, setIsReviewProposalsOpen] = useState(false);
  const [isReviewMembersOpen, setIsReviewMembersOpen] = useState(false);

  const [templates, setTemplates] = useState<SetlistTemplate[]>([]);
  const [library, setLibrary] = useState<RehearsalSong[]>([]);
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [taskTemplatesDB, setTaskTemplatesDB] = useState<TaskTemplateDB[]>([]);

  useEffect(() => {
    if (!selectedBand?.id) return;
    const fetchSongData = async () => {
      const [songsRes, setlistsRes, taskTplRes] = await Promise.all([
        getSongs(selectedBand.id),
        getSetlists(selectedBand.id),
        supabase.from('task_templates').select('*').eq('band_id', selectedBand.id).order('created_at', { ascending: false }),
      ]);
      if (songsRes.data) {
        setLibrary(songsRes.data.map(dbSongToRehearsalSong));
      }
      if (setlistsRes.data) {
        const templatePromises = setlistsRes.data.map(async (sl) => {
          const { data: full } = await getSetlist(sl.id);
          const songIds = full?.songs?.map(ss => ss.song_id) || [];
          return dbSetlistToTemplate(sl, songIds);
        });
        const loaded = await Promise.all(templatePromises);
        setTemplates(loaded);
      }
      if (taskTplRes.data) {
        setTaskTemplatesDB(taskTplRes.data);
      }
    };
    fetchSongData();
  }, [selectedBand?.id]);

  // Calendar state
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.getMonth();
  });
  const [calYear, setCalYear] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.getFullYear();
  });

  const [endTime, setEndTime] = useState('22:00');

  const [data, setData] = useState<RehearsalState>({
    type: 'full_band',
    title: '',
    location: '',
    address: '',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: '20:00',
    duration: '2h',
    recurrence: 'once',
    venueType: 'free',
    showCost: false,
    totalCost: '0',
    splitMethod: 'equal',
    audienceIds: [],
    members: [],
    setlist: [],
    setlistSnapshotFinal: undefined,
    selectedTemplateIdsInOrder: [],
    proposals: [],
    tasks: [],
    defaultChecklist: DEFAULT_CHECKLIST,
    personalChecklist: [],
    bandChecklist: ['PA System Check', 'Extension Cords', 'Backup Cables', 'First Aid Kit'],
    reminderTime: '1_day',
    status: 'draft'
  });

  useEffect(() => {
    if (realMembers.length > 0) {
      setData(prev => ({ ...prev, members: realMembers }));
    }
  }, [realMembers]);

  useEffect(() => {
    if (data.time && endTime) {
      const [sh, sm] = data.time.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;
      const diff = endMins >= startMins ? endMins - startMins : (24 * 60 - startMins) + endMins;
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      const duration = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      setData(prev => ({ ...prev, duration }));
    }
  }, [data.time, endTime]);

  // Navigation
  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onCreate(data);
  };
  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else onClose();
  };

  const canProceed = (() => {
    switch (step) {
      case 0: return data.title.trim() !== '';
      case 1: return data.location.trim() !== '';
      default: return true;
    }
  })();

  const totalDuration = useMemo(() => "1h 42m", [data.setlist]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleTypeChange = (newType: RehearsalType) => {
    setData(prev => {
      let newAudienceIds: string[] = [];
      if (newType === 'full_band') {
        newAudienceIds = [];
      } else {
        const roleFilters: Record<string, string[]> = {
          'vocals': ['vocals', 'singer', 'voice', 'lead vocals', 'backing vocals', 'coro'],
          'rhythm': ['drums', 'bass', 'percussion', 'drummer', 'bassist', 'batteria', 'basso'],
          'acoustic': ['guitar', 'acoustic', 'piano', 'keyboard', 'keys', 'chitarra', 'tastiere']
        };
        const filters = roleFilters[newType] || [];
        newAudienceIds = prev.members
          .filter(m => filters.some(f => (m.role || '').toLowerCase().includes(f)))
          .map(m => m.id);
        if (newAudienceIds.length === 0) newAudienceIds = prev.members.map(m => m.id);
      }
      return { ...prev, type: newType, audienceIds: newAudienceIds };
    });
  };

  const toggleAudienceMember = (memberId: string) => {
    setData(prev => {
      const currentIds = prev.audienceIds.length === 0 ? prev.members.map(m => m.id) : prev.audienceIds;
      const newIds = currentIds.includes(memberId)
        ? currentIds.filter(id => id !== memberId)
        : [...currentIds, memberId];
      return { ...prev, audienceIds: newIds };
    });
  };

  // Setlist logic
  const openSetlistEditor = (template: SetlistTemplate | null) => {
    setEditingTemplate(template);
    setIsSetlistEditorOpen(true);
  };

  const handleSaveTemplate = (updatedTemplate: SetlistTemplate) => {
    setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
  };

  const handleCreateTemplate = (newTemplate: SetlistTemplate) => {
    setTemplates(prev => [newTemplate, ...prev]);
  };

  const handleSongPicked = async (picked: PickedSong) => {
    const rehearsalSong: RehearsalSong = {
      id: picked.id,
      title: picked.title,
      artist: picked.artist,
      duration: picked.duration_seconds
        ? `${Math.floor(picked.duration_seconds / 60)}:${String(picked.duration_seconds % 60).padStart(2, '0')}`
        : '0:00',
      priority: 'medium',
      type: 'song',
      category: picked.category,
    };
    if (!library.find(s => s.id === picked.id)) {
      setLibrary(prev => [rehearsalSong, ...prev]);
    }
    setData(prev => ({
      ...prev,
      setlist: [...prev.setlist, rehearsalSong],
    }));
    setSongPickerOpen(false);
  };

  const handleAddToQueue = (templateId: string) => {
    setData(prev => ({
      ...prev,
      selectedTemplateIdsInOrder: [...(prev.selectedTemplateIdsInOrder || []), templateId]
    }));
  };

  const handleRemoveFromQueue = (index: number) => {
    setData(prev => ({
      ...prev,
      selectedTemplateIdsInOrder: (prev.selectedTemplateIdsInOrder || []).filter((_, i) => i !== index)
    }));
  };

  const handleBuildSnapshot = () => {
    const queueIds = data.selectedTemplateIdsInOrder || [];
    if (queueIds.length === 0) return;
    const queueTemplates = queueIds.map(id => templates.find(t => t.id === id)).filter(Boolean) as SetlistTemplate[];
    const mergedSongs: RehearsalSetlistSnapshotFinal['songs'] = [];
    const seenSongIds = new Set<string>();
    const skippedSongIds: string[] = [];
    queueTemplates.forEach(tpl => {
      tpl.songIds.forEach(sid => {
        if (seenSongIds.has(sid)) {
          skippedSongIds.push(sid);
        } else {
          seenSongIds.add(sid);
          const song = library.find(s => s.id === sid);
          if (song) {
            mergedSongs.push({
              songId: sid,
              titleAtSnapshot: song.title,
              artistAtSnapshot: song.artist,
              durationAtSnapshot: song.duration,
              sourceTemplateId: tpl.id
            });
          }
        }
      });
    });
    const snapshot: RehearsalSetlistSnapshotFinal = {
      id: `snap-${Date.now()}`,
      name: "Rehearsal Runlist (Snapshot)",
      createdAt: new Date().toISOString(),
      createdBy: "GB",
      sources: queueTemplates.map(t => ({ templateId: t.id, templateName: t.name, templateVersion: t.version })),
      songs: mergedSongs,
      mergeReport: {
        totalImportedTemplates: queueTemplates.length,
        totalSongsBeforeDedupe: queueTemplates.reduce((acc, t) => acc + t.songIds.length, 0),
        totalDuplicatesSkipped: skippedSongIds.length,
        duplicatesSkippedSongIds: skippedSongIds
      }
    };
    const legacySongs = mergedSongs.map(ms => library.find(s => s.id === ms.songId)).filter(Boolean) as RehearsalSong[];
    setData(prev => ({ ...prev, setlistSnapshotFinal: snapshot, setlist: legacySongs }));
  };

  // Proposal logic
  const openProposalEdit = (proposal: SongProposal) => {
    setEditingProposal(proposal);
    setIsEditProposalOpen(true);
  };

  const handleSaveProposalDetails = (id: string, reason: string, attachments: ProposalAttachment[]) => {
    setData(prev => ({
      ...prev,
      proposals: prev.proposals.map(p => p.id === id ? { ...p, reason, attachments } : p)
    }));
  };

  // Task logic
  const openTaskEdit = (task: RehearsalTask) => {
    setEditingTask(task);
    setIsTaskDetailOpen(true);
  };

  const handleSaveTask = (updatedTask: RehearsalTask) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
    }));
  };

  const handleDeleteTask = (taskId: string) => {
    setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }));
  };

  const handleAddQuickTask = (text: string) => {
    const newTask: RehearsalTask = {
      id: `task-${Date.now()}`,
      text,
      completed: false,
      assignedTo: ['all'],
      type: 'prepare'
    };
    setData(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
  };

  const loadTaskTemplate = (tpl: TaskTemplateDB) => {
    const loaded: RehearsalTask[] = tpl.tasks.map((t, i) => ({
      id: `task-${Date.now()}-${i}`,
      text: t.title,
      completed: false,
      assignedTo: ['all'],
      type: t.required ? 'prepare' as const : 'other' as const,
    }));
    setData(prev => ({ ...prev, tasks: [...prev.tasks, ...loaded] }));
  };

  // Calendar helpers
  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };
  const selectCalendarDay = (day: number) => {
    setData(prev => ({
      ...prev,
      date: `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }));
  };

  // Calendar data
  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const adjustedFirstDay = (firstDayOfMonth + 6) % 7;
  const calDays: (number | null)[] = [];
  for (let i = 0; i < adjustedFirstDay; i++) calDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calDays.push(i);

  const dateParts = data.date.split('-').map(Number);
  const selectedDay = dateParts[2];
  const selectedMonth = dateParts[1] - 1;
  const selectedYear = dateParts[0];
  const calMonthName = new Date(calYear, calMonth, 1).toLocaleDateString('en-US', { month: 'long' }).toUpperCase();

  // ── STEP 0: TYPE ──────────────────────────────────────────

  const renderTypeStep = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div>
        <input
          type="text"
          value={data.title}
          onChange={e => setData(prev => ({ ...prev, title: e.target.value }))}
          className="w-full bg-transparent border-b-2 border-white/30 text-white text-[22px] font-bold placeholder:text-white/30 focus:outline-none focus:border-white transition-colors pb-3"
          placeholder="Rehearsal Title"
        />
      </div>

      <div className="space-y-1">
        {TYPE_OPTIONS.map(opt => {
          const isSelected = data.type === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => handleTypeChange(opt.value)}
              className="w-full flex items-center justify-between py-4 border-b border-white/10 last:border-b-0 transition-all"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className={cn(
                  "px-2.5 py-1 rounded-[6px] text-[12px] font-bold uppercase shrink-0 transition-colors",
                  isSelected ? "bg-white/30 text-white" : "bg-white/10 text-white/30"
                )}>
                  {opt.tag}
                </span>
                <span className={cn(
                  "text-[28px] font-bold uppercase leading-none transition-colors truncate",
                  isSelected ? "text-white" : "text-white/30"
                )}>
                  {opt.label}
                </span>
              </div>
              <DotRadio
                selected={isSelected}
                activeColor="#ffffff"
                inactiveColor="rgba(255,255,255,0.2)"
              />
            </button>
          );
        })}
      </div>

      <div className="h-px bg-white/10" />

      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[12px] font-bold uppercase text-white/50 tracking-wider">MEMBERS</span>
          <span className="text-[12px] font-bold text-white/50">
            {data.audienceIds.length === 0 ? `All (${data.members.length})` : `${data.audienceIds.length}/${data.members.length}`}
          </span>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setData(prev => ({ ...prev, audienceIds: [] }))}
            className={cn(
              "px-4 py-2 rounded-full text-[12px] font-bold uppercase border transition-all",
              data.audienceIds.length === 0
                ? "bg-white text-black border-white"
                : "bg-transparent text-white/60 border-white/20 hover:border-white/40"
            )}
          >
            Select All
          </button>
          <button
            onClick={() => setData(prev => ({ ...prev, audienceIds: prev.members.map(m => m.id) }))}
            className={cn(
              "px-4 py-2 rounded-full text-[12px] font-bold uppercase border transition-all",
              data.audienceIds.length > 0
                ? "bg-white text-black border-white"
                : "bg-transparent text-white/60 border-white/20 hover:border-white/40"
            )}
          >
            Custom
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {data.members.map(m => {
            const isSelected = data.audienceIds.length === 0 || data.audienceIds.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggleAudienceMember(m.id)}
                className="flex items-center gap-3 p-3 rounded-[10px] transition-all hover:bg-white/5 text-left"
              >
                <DotCheckbox
                  checked={isSelected}
                  activeColor="#ffffff"
                  inactiveColor="rgba(255,255,255,0.2)"
                />
                <div className="min-w-0">
                  <span className={cn("text-sm font-bold block truncate", isSelected ? "text-white" : "text-white/30")}>{m.name}</span>
                  <span className="text-[10px] font-bold uppercase text-white/30">{m.role}</span>
                </div>
              </button>
            );
          })}
        </div>

        {data.members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="w-8 h-8 text-white/20 mb-2" />
            <span className="text-sm font-bold text-white/30">No members found</span>
            <span className="text-xs text-white/20 mt-1">Add members to your band first</span>
          </div>
        )}
      </div>
    </div>
  );

  // ── STEP 1: DATE & LOCATION ───────────────────────────────

  const renderDateLocationStep = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div>
        <input
          type="text"
          value={data.location}
          onChange={e => setData(prev => ({ ...prev, location: e.target.value }))}
          className="w-full bg-transparent border-b-2 border-white/30 text-white text-[28px] font-bold placeholder:text-white/30 focus:outline-none focus:border-white transition-colors pb-3"
          placeholder="Venue Name"
        />
      </div>

      <div>
        <input
          type="text"
          value={data.address}
          onChange={e => setData(prev => ({ ...prev, address: e.target.value }))}
          className="w-full bg-transparent border-b-2 border-white/30 text-white text-sm font-bold placeholder:text-white/30 focus:outline-none focus:border-white transition-colors pb-2"
          placeholder="Street, City, ZIP, Country"
        />
        {data.address && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {data.address.split(',').map((tag, i) => (
              <span key={i} className="bg-white/20 text-white/70 rounded-[6px] px-2.5 py-1 text-[12px] font-bold uppercase">
                {tag.trim()}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[12px] font-bold uppercase text-white tracking-wider">{calMonthName} {calYear}</span>
          <div className="flex gap-2">
            <button onClick={prevMonth} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button onClick={nextMonth} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <div key={i} className="text-center text-[11px] font-bold text-white/30 py-2">{d}</div>
          ))}
          {calDays.map((day, i) => {
            const isToday = day && calMonth === selectedMonth && calYear === selectedYear && day === selectedDay;
            return (
              <button
                key={i}
                onClick={() => day && selectCalendarDay(day)}
                disabled={!day}
                className={cn(
                  "h-10 rounded-full text-sm font-bold transition-all",
                  !day && "invisible",
                  isToday
                    ? "bg-white text-[#0147ff]"
                    : day ? "text-white/50 hover:bg-white/10" : ""
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-[12px] font-bold uppercase text-white/30 tracking-wider block mb-2">START TIME</span>
          <input
            type="time"
            value={data.time}
            onChange={e => setData(prev => ({ ...prev, time: e.target.value }))}
            className="w-full bg-transparent border-b-2 border-white/30 text-white text-[20px] font-bold focus:outline-none focus:border-white transition-colors pb-2 [color-scheme:dark]"
          />
        </div>
        <div>
          <span className="text-[12px] font-bold uppercase text-white/30 tracking-wider block mb-2">END TIME</span>
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            className="w-full bg-transparent border-b-2 border-white/30 text-white text-[20px] font-bold focus:outline-none focus:border-white transition-colors pb-2 [color-scheme:dark]"
          />
        </div>
      </div>

      <div>
        <span className="text-[12px] font-bold uppercase text-white/30 tracking-wider block mb-3">RECURRENCE</span>
        <div className="flex flex-wrap gap-2">
          {(['once', 'weekly', 'biweekly', 'monthly'] as const).map(freq => (
            <button
              key={freq}
              onClick={() => setData(prev => ({ ...prev, recurrence: freq }))}
              className={cn(
                "px-4 py-2 rounded-full text-[12px] font-bold uppercase border transition-all",
                data.recurrence === freq
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-white/60 border-white/20 hover:border-white/40"
              )}
            >
              {freq === 'once' ? 'ONE TIME' : freq.toUpperCase()}
            </button>
          ))}
        </div>
        {data.recurrence !== 'once' && (
          <div className="bg-white/10 rounded-[10px] p-4 flex items-start gap-3 mt-4">
            <AlertCircle className="w-5 h-5 text-white shrink-0 mt-0.5" />
            <span className="text-sm font-bold text-white/70">
              This rehearsal will repeat <strong className="text-white">{data.recurrence}</strong>. Future instances can be edited individually.
            </span>
          </div>
        )}
      </div>

      <div>
        <span className="text-[12px] font-bold uppercase text-white/30 tracking-wider block mb-3">VENUE TYPE</span>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setData(prev => ({ ...prev, venueType: 'free' }))}
            className={cn(
              "flex items-center gap-3 p-4 rounded-[10px] border transition-all",
              data.venueType === 'free'
                ? "bg-white text-black border-white"
                : "bg-transparent text-white/60 border-white/20 hover:border-white/40"
            )}
          >
            <Home className="w-5 h-5" />
            <span className="font-bold uppercase text-sm">Free</span>
          </button>
          <button
            onClick={() => setData(prev => ({ ...prev, venueType: 'paid' }))}
            className={cn(
              "flex items-center gap-3 p-4 rounded-[10px] border transition-all",
              data.venueType === 'paid'
                ? "bg-white text-black border-white"
                : "bg-transparent text-white/60 border-white/20 hover:border-white/40"
            )}
          >
            <Euro className="w-5 h-5" />
            <span className="font-bold uppercase text-sm">Paid</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {data.venueType === 'paid' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white/10 rounded-[10px] p-6 space-y-4">
              <div>
                <span className="text-[12px] font-bold uppercase text-white/30 block mb-2">TOTAL COST (€)</span>
                <input
                  type="number"
                  value={data.totalCost}
                  onChange={e => setData(prev => ({ ...prev, totalCost: e.target.value }))}
                  className="w-full bg-transparent border-b-2 border-white/30 text-white text-[32px] font-bold placeholder:text-white/30 focus:outline-none focus:border-white transition-colors pb-2"
                  placeholder="0"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setData(prev => ({ ...prev, splitMethod: 'equal' }))}
                    className={cn(
                      "px-4 py-2 rounded-full text-[12px] font-bold uppercase border transition-all",
                      data.splitMethod === 'equal' ? "bg-white text-black border-white" : "bg-transparent text-white/60 border-white/20"
                    )}
                  >
                    Equal Split
                  </button>
                  <button
                    onClick={() => setData(prev => ({ ...prev, splitMethod: 'custom' }))}
                    className={cn(
                      "px-4 py-2 rounded-full text-[12px] font-bold uppercase border transition-all",
                      data.splitMethod === 'custom' ? "bg-white text-black border-white" : "bg-transparent text-white/60 border-white/20"
                    )}
                  >
                    Custom
                  </button>
                </div>
                {data.splitMethod === 'equal' && (
                  <span className="text-lg font-bold text-white">
                    €{(parseInt(data.totalCost || '0') / Math.max(data.audienceIds.length || data.members.length, 1)).toFixed(2)}
                    <span className="text-white/50 text-sm ml-1">/ person</span>
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // ── STEP 2: RUNLIST + PROPOSALS ───────────────────────────

  const renderRunlistProposalsStep = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500 flex flex-col h-full">
      {/* Runlist Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => openSetlistEditor(null)}
            className="py-4 bg-white text-black rounded-[10px] font-bold text-[12px] uppercase tracking-wider hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Template
          </button>
          <button
            onClick={() => setSongPickerOpen(true)}
            className="py-4 bg-white/20 text-white rounded-[10px] font-bold text-[12px] uppercase tracking-wider hover:bg-white/30 transition-colors flex items-center justify-center gap-2"
          >
            <Music className="w-4 h-4" /> From Library
          </button>
        </div>

        {data.setlistSnapshotFinal ? (
          <div
            className="bg-white/10 border border-white/20 rounded-[10px] p-6 cursor-pointer hover:bg-white/15 transition-all"
            onClick={() => setIsReviewSetlistOpen(true)}
          >
            <div className="flex items-center gap-2 text-white/60 mb-3">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-[12px] font-bold uppercase tracking-wider">Active Snapshot</span>
            </div>
            <div className="text-[40px] font-bold text-white leading-none mb-2">{data.setlistSnapshotFinal.songs.length} Songs</div>
            <div className="flex items-center gap-3 mt-3">
              <span className="px-3 py-1.5 bg-white/20 text-white text-[12px] font-bold uppercase rounded-full">{totalDuration}</span>
              <span className="px-3 py-1.5 bg-white/10 text-white/60 text-[12px] font-bold uppercase rounded-full flex items-center gap-2">
                <Layers className="w-3 h-3" /> {data.setlistSnapshotFinal.sources.length} sources
              </span>
            </div>
            {data.setlistSnapshotFinal.mergeReport.totalDuplicatesSkipped > 0 && (
              <div className="mt-3 text-[12px] font-bold text-white/50 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                {data.setlistSnapshotFinal.mergeReport.totalDuplicatesSkipped} duplicates merged
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-white/10 text-[12px] font-bold uppercase text-white/40 flex items-center gap-2">
              Tap to preview <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        ) : (
          (data.selectedTemplateIdsInOrder || []).length > 0 && (
            <div className="bg-white/10 rounded-[10px] p-5 space-y-3">
              <span className="text-[12px] font-bold uppercase text-white/50 tracking-wider">Queue ({data.selectedTemplateIdsInOrder!.length})</span>
              <div className="space-y-2">
                {data.selectedTemplateIdsInOrder!.map((tid, i) => {
                  const t = templates.find(tp => tp.id === tid);
                  return (
                    <div key={`${tid}-${i}`} className="flex items-center justify-between bg-white/10 p-3 rounded-[10px]">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-white text-[#0147ff] text-xs font-bold flex items-center justify-center">{i + 1}</div>
                        <span className="font-bold text-white text-sm">{t?.name || 'Unknown'}</span>
                      </div>
                      <button onClick={() => handleRemoveFromQueue(i)} className="text-white/40 hover:text-red-300 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={handleBuildSnapshot}
                className="w-full py-3 bg-white text-black rounded-[10px] text-sm font-bold uppercase flex items-center justify-center gap-2 hover:bg-white/90 transition-colors mt-2"
              >
                <Layers className="w-4 h-4" /> Build rehearsal runlist
              </button>
            </div>
          )
        )}
      </div>

      {/* Templates */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
        <span className="text-[12px] font-bold uppercase text-white/40 tracking-wider block mb-3">Available Templates</span>
        <div className="space-y-3">
          {templates.map(template => (
            <div key={template.id} className="bg-white/10 rounded-[10px] p-5 border border-white/10 hover:border-white/20 transition-all">
              <div onClick={() => openSetlistEditor(template)} className="cursor-pointer mb-3">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-lg text-white">{template.name}</h4>
                  <span className="px-2.5 py-1 text-[11px] font-bold uppercase bg-white/20 rounded-full text-white/60">v{template.version}</span>
                </div>
                <div className="flex items-center gap-3 text-[12px] font-bold text-white/40">
                  <span className="flex items-center gap-1"><ListMusic className="w-3 h-3" /> {template.songIds.length} Songs</span>
                  <span className="flex items-center gap-1"><History className="w-3 h-3" /> {new Date(template.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => handleAddToQueue(template.id)}
                className="w-full py-2.5 bg-white/10 border border-white/10 rounded-[10px] text-[12px] font-bold uppercase text-white/60 hover:bg-white/20 hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-3 h-3" /> Add to queue
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-[12px] font-bold uppercase text-white/30">Proposals</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Proposals Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-[32px] font-bold text-white">{data.proposals.length}</span>
            <span className="text-[12px] font-bold uppercase text-white/40">Proposals</span>
          </div>
          <button
            onClick={() => setIsProposeModalOpen(true)}
            className="px-5 py-2.5 rounded-[10px] font-bold text-sm uppercase bg-white text-black hover:bg-white/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Propose New
          </button>
        </div>

        <div className="space-y-3">
          {data.proposals.map(prop => (
            <div key={prop.id} className="bg-white/10 rounded-[10px] p-5 border border-white/10 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-lg text-white">{prop.title}</h4>
                    {prop.status === 'new' && <span className="px-2 py-0.5 bg-white text-[#0147ff] text-[10px] font-bold uppercase rounded-full">NEW</span>}
                  </div>
                  <span className="text-sm font-bold uppercase text-white/40">{prop.artist}</span>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={cn("px-3 py-1 text-[11px] font-bold uppercase rounded-full",
                    prop.status === 'approved' ? "bg-green-500/30 text-green-300" : "bg-white/10 text-white/50"
                  )}>
                    {prop.status === 'approved' ? "Approved" : "Pending"}
                  </span>
                  <button
                    onClick={() => openProposalEdit(prop)}
                    className="px-3 py-1 bg-white/10 rounded-full text-[11px] font-bold uppercase text-white/50 hover:text-white hover:bg-white/20 transition-all"
                  >
                    Edit
                  </button>
                </div>
              </div>

              <div className="bg-white/5 rounded-[8px] p-3">
                <p className="text-sm text-white/60 italic">"{prop.reason}"</p>
                <div className="flex items-center gap-2 mt-2 text-[11px] font-bold text-white/30">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-white/70 text-[9px] font-bold">{prop.proposer}</div>
                  <span>Proposed 2 days ago</span>
                </div>
                {prop.attachments && prop.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {prop.attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-full text-[11px] font-bold text-white/50">
                        {att.type === 'link' ? <Link className="w-3 h-3" /> : <Paperclip className="w-3 h-3" />}
                        <span className="truncate max-w-[100px]">{att.label || 'Attachment'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm font-bold">
                <span className="flex items-center gap-1.5 text-white"><ThumbsUp className="w-3.5 h-3.5" /> {prop.votes.yes}</span>
                <span className="flex items-center gap-1.5 text-white/40"><ThumbsDown className="w-3.5 h-3.5" /> {prop.votes.no}</span>
                <span className="flex items-center gap-1.5 text-white/40"><MessageCircle className="w-3.5 h-3.5" /> {prop.votes.comments}</span>
              </div>

              {prop.status === 'approved' ? (
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
                  <button className="py-2.5 rounded-[10px] border border-white/20 hover:border-white text-white text-[12px] font-bold uppercase transition-all">
                    Add to Repertoire
                  </button>
                  <button className="py-2.5 rounded-[10px] bg-white text-black text-[12px] font-bold uppercase transition-all hover:bg-white/90">
                    Add to Rehearsal
                  </button>
                </div>
              ) : (
                <div className="pt-3 border-t border-white/10 text-center">
                  <span className="text-[12px] font-bold uppercase text-white/30 flex items-center justify-center gap-2">
                    <Clock className="w-3 h-3" /> Awaiting approval
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── STEP 3: PREPARATION ───────────────────────────────────

  const renderPreparationStep = () => {
    const bandTasks = data.tasks.filter(t => t.assignedTo.includes('all'));
    const assignedTasks = data.tasks.filter(t => !t.assignedTo.includes('all'));

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500 pb-4">
        <div>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <span className="text-[40px] font-bold text-white">{data.tasks.length}</span>
              <span className="text-[12px] font-bold uppercase text-white/40">Tasks</span>
            </div>
            <button
              onClick={() => setIsAddTaskModalOpen(true)}
              className="px-5 py-2.5 rounded-[10px] font-bold text-sm uppercase bg-white text-black hover:bg-white/90 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Task
            </button>
          </div>

          {data.tasks.length === 0 && (
            <div className="bg-white/10 rounded-[10px] p-8 text-center border border-white/10 border-dashed mb-6">
              <div className="w-14 h-14 rounded-full bg-white/10 mx-auto flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-white/30" />
              </div>
              <h4 className="font-bold text-lg text-white mb-2">No tasks yet</h4>
              <p className="text-sm text-white/40 mb-5">Add preparation tasks for the band</p>
              <button
                onClick={() => setIsAddTaskModalOpen(true)}
                className="px-5 py-3 bg-white text-black rounded-[10px] text-sm font-bold uppercase"
              >
                Add your first task
              </button>
            </div>
          )}

          {data.tasks.length === 0 && (
            <div className="space-y-4 mb-6">
              {/* Task templates from library */}
              {taskTemplatesDB.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase text-white/30 block mb-2">LOAD FROM TEMPLATE</span>
                  <div className="flex flex-wrap gap-2">
                    {taskTemplatesDB.map(tpl => (
                      <button
                        key={tpl.id}
                        onClick={() => loadTaskTemplate(tpl)}
                        className="px-4 py-2 bg-white/10 hover:bg-white hover:text-black rounded-[10px] text-[12px] font-bold uppercase transition-colors text-white/60 flex items-center gap-2"
                      >
                        <Folder className="w-3.5 h-3.5" />
                        {tpl.name}
                        <span className="text-white/30">{tpl.tasks.length}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick-add suggestions */}
              <div>
                <span className="text-[10px] font-bold uppercase text-white/30 block mb-2">QUICK ADD</span>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_TASKS.map(t => (
                    <button
                      key={t}
                      onClick={() => handleAddQuickTask(t)}
                      className="px-4 py-2 bg-white/10 hover:bg-white hover:text-black rounded-full text-[12px] font-bold uppercase transition-colors text-white/60"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {bandTasks.length > 0 && (
              <div>
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-white/40 mb-3 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" /> Band Tasks ({bandTasks.length})
                </h4>
                <div className="bg-white/10 rounded-[10px] overflow-hidden border border-white/10 divide-y divide-white/10">
                  {bandTasks.map(task => (
                    <div onClick={() => openTaskEdit(task)} key={task.id} className="p-4 flex items-start gap-3 hover:bg-white/5 transition-colors cursor-pointer">
                      <DotCheckbox
                        checked={task.completed}
                        activeColor="#ffffff"
                        inactiveColor="rgba(255,255,255,0.2)"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white leading-tight">{task.text}</p>
                        <div className="flex gap-2 mt-1.5">
                          <span className="px-2 py-0.5 bg-white/10 rounded-full text-[11px] font-bold uppercase text-white/50">Band</span>
                          <span className="text-[11px] font-bold uppercase text-white/30">{task.type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {assignedTasks.length > 0 && (
              <div>
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-white/40 mb-3 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> Assigned Tasks ({assignedTasks.length})
                </h4>
                <div className="bg-white/10 rounded-[10px] overflow-hidden border border-white/10 divide-y divide-white/10">
                  {assignedTasks.map(task => {
                    const assigneeInitials = task.assignedTo.slice(0, 2).map(id => data.members.find(m => m.id === id)?.initials).join('+');
                    return (
                      <div onClick={() => openTaskEdit(task)} key={task.id} className="p-4 flex items-start gap-3 hover:bg-white/5 transition-colors cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-white text-[#0147ff] text-[11px] font-bold flex items-center justify-center shrink-0">{assigneeInitials}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white leading-tight">{task.text}</p>
                          <div className="flex gap-2 mt-1.5">
                            <span className="px-2 py-0.5 bg-white/10 rounded-full text-[11px] font-bold uppercase text-white/50">
                              {task.assignedTo.length > 1 ? `${task.assignedTo.length} members` : data.members.find(m => m.id === task.assignedTo[0])?.name}
                            </span>
                            <span className="text-[11px] font-bold uppercase text-white/30">{task.type}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* My Checklist */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-bold uppercase text-white/40 tracking-wider">My Checklist</span>
            <span className="px-3 py-1 bg-white/10 text-white/50 text-[11px] font-bold rounded-full flex items-center gap-1.5">
              <User className="w-3 h-3" /> Personal
            </span>
          </div>
          <div className="bg-white/10 rounded-[10px] border border-white/10 p-5 grid grid-cols-2 gap-3">
            {data.defaultChecklist.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <DotCheckbox
                  checked={false}
                  activeColor="#ffffff"
                  inactiveColor="rgba(255,255,255,0.2)"
                />
                <span className="text-sm font-bold text-white/60">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Band Essentials */}
        <div className="bg-[#D5FB46] rounded-[10px] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-black">
              <Briefcase className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Band Essentials</h3>
            </div>
            <div className="flex items-center gap-1.5 bg-black/10 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase text-black/50">
              <Lock className="w-3 h-3" /> Admin Only
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {data.bandChecklist?.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm font-bold text-black/60">
                <div className="w-1.5 h-1.5 rounded-full bg-black/30" />
                {item}
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-black/10 text-[11px] font-medium text-black/40 text-center italic">
            These items are required for every rehearsal.
          </div>
        </div>
      </div>
    );
  };

  // ── STEP 4: REVIEW ────────────────────────────────────────

  const renderReviewStep = () => {
    const approvedProposals = data.proposals.filter(p => p.status === 'approved').length;
    const pendingProposals = data.proposals.length - approvedProposals;
    const tasksForMe = data.tasks.filter(t => t.assignedTo.includes('all') || t.assignedTo.includes('1')).length;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 pb-4">
        {/* Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="bg-black text-white rounded-[10px] p-6 relative overflow-hidden"
        >
          <div className="space-y-6 relative z-10">
            <div className="flex justify-between items-start">
              <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D5FB46] text-black text-[11px] font-bold uppercase rounded-full">
                  {data.type === 'full_band' ? <Music className="w-3.5 h-3.5" /> : <Mic2 className="w-3.5 h-3.5" />}
                  {data.type.replace('_', ' ')}
                </div>
                {data.recurrence !== 'once' && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 text-white text-[11px] font-bold uppercase rounded-full">
                    <Repeat className="w-3.5 h-3.5" /> {data.recurrence}
                  </div>
                )}
              </div>
              {data.venueType === 'paid' && (
                <div className="text-2xl font-bold text-white">€{data.totalCost}</div>
              )}
            </div>

            <div>
              <h2 className="text-[28px] font-bold uppercase leading-tight mb-3">{data.title}</h2>
              <div className="flex items-center gap-3 text-white/50 text-sm font-bold">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> {formatDate(data.date)}
                </div>
                <div className="w-1 h-1 rounded-full bg-white/30" />
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> {data.time} ({data.duration})
                </div>
              </div>
            </div>

            <div className="flex justify-between items-end pt-4 border-t border-white/10">
              <div>
                <div className="text-[11px] font-bold uppercase text-white/30 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Location
                </div>
                <div className="font-bold text-white">{data.location || 'Not set'}</div>
              </div>
              <div className="flex -space-x-2">
                {data.members.slice(0, 6).map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ x: 10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 + (i * 0.1) }}
                    className="w-8 h-8 rounded-full border-2 border-black bg-[#D5FB46] flex items-center justify-center text-[10px] font-bold text-black"
                  >
                    {m.initials}
                  </motion.div>
                ))}
                {data.members.length > 6 && (
                  <div className="w-8 h-8 rounded-full border-2 border-black bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">
                    +{data.members.length - 6}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* 2x2 Metric Grid */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => setIsReviewSetlistOpen(true)}
            className="p-5 bg-white/10 rounded-[10px] border border-white/10 hover:border-white/30 cursor-pointer transition-all group h-36 flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <div className="p-2 bg-white/10 rounded-[8px] text-white/60 group-hover:bg-white group-hover:text-[#0147ff] transition-colors">
                <ListMusic className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-white/20 group-hover:translate-x-1 group-hover:text-white transition-all" />
            </div>
            <div>
              <div className="text-[32px] font-bold text-white leading-none mb-1">{data.setlistSnapshotFinal?.songs.length || 0}</div>
              <div className="text-[11px] font-bold uppercase text-white/40">Songs • {totalDuration}</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => setIsReviewTasksOpen(true)}
            className="p-5 bg-white/10 rounded-[10px] border border-white/10 hover:border-white/30 cursor-pointer transition-all group h-36 flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <div className="p-2 bg-white/10 rounded-[8px] text-white/60 group-hover:bg-white group-hover:text-[#0147ff] transition-colors">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-white/20 group-hover:translate-x-1 group-hover:text-white transition-all" />
            </div>
            <div>
              <div className="text-[32px] font-bold text-white leading-none mb-1">{data.tasks.length}</div>
              <div className="text-[11px] font-bold uppercase text-white/40">Tasks</div>
              <div className="text-[11px] font-bold text-white/30 mt-0.5">{tasksForMe} assigned to you</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => setIsReviewProposalsOpen(true)}
            className="p-5 bg-white/10 rounded-[10px] border border-white/10 hover:border-white/30 cursor-pointer transition-all group h-36 flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <div className="p-2 bg-white/10 rounded-[8px] text-white/60 group-hover:bg-white group-hover:text-[#0147ff] transition-colors">
                <MessageCircle className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-white/20 group-hover:translate-x-1 group-hover:text-white transition-all" />
            </div>
            <div>
              <div className="text-[32px] font-bold text-white leading-none mb-1">{approvedProposals}</div>
              <div className="text-[11px] font-bold uppercase text-white/40">Approved</div>
              <div className="text-[11px] font-bold text-white/30 mt-0.5">{pendingProposals} pending</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={() => setIsReviewMembersOpen(true)}
            className="p-5 bg-white/10 rounded-[10px] border border-white/10 hover:border-white/30 cursor-pointer transition-all group h-36 flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <div className="p-2 bg-white/10 rounded-[8px] text-white/60 group-hover:bg-white group-hover:text-[#0147ff] transition-colors">
                <Users className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-white/20 group-hover:translate-x-1 group-hover:text-white transition-all" />
            </div>
            <div>
              <div className="text-[32px] font-bold text-white leading-none mb-1">{data.members.length}</div>
              <div className="text-[11px] font-bold uppercase text-white/40">Members</div>
              <div className="text-[11px] font-bold text-white/30 mt-0.5">All confirmed</div>
            </div>
          </motion.div>
        </div>

        <div className="text-center pt-2">
          <span className="text-sm font-bold text-white/30 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Ready to create. Notifying {data.audienceIds.length > 0 ? data.audienceIds.length : data.members.length} members immediately.
          </span>
        </div>
      </div>
    );
  };

  // ── MAIN RENDER ───────────────────────────────────────────

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed inset-0 z-[100] bg-[#0147ff] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-[env(safe-area-inset-top,12px)] shrink-0">
          <div className="pt-3 flex items-start justify-between mb-5">
            <div className="flex items-center gap-1.5 pt-4">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 rounded-[10px] transition-all duration-300",
                    i === step ? "w-4 bg-white" : i < step ? "w-3 bg-white/60" : "w-2 bg-white/20"
                  )}
                />
              ))}
            </div>
            <button
              onClick={onClose}
              className="w-[50px] h-[50px] rounded-full bg-[rgba(216,216,216,0.3)] border-2 border-white flex items-center justify-center shrink-0"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="mb-4">
            <span className="text-[12px] font-bold uppercase text-white/50 tracking-wider block mb-1">
              STEP {String(step + 1).padStart(2, '0')}
            </span>
            <h2 className="text-[32px] font-bold text-white leading-tight whitespace-pre-line">
              {STEPS[step].title}
            </h2>
            <p className="text-[16px] font-bold text-white/30 mt-1">
              {STEPS[step].subtitle}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {step === 0 && renderTypeStep()}
          {step === 1 && renderDateLocationStep()}
          {step === 2 && renderRunlistProposalsStep()}
          {step === 3 && renderPreparationStep()}
          {step === 4 && renderReviewStep()}
        </div>

        {/* Footer */}
        <div className="px-6 pb-[max(env(safe-area-inset-bottom,12px),12px)] pt-4 shrink-0">
          <div className="grid grid-cols-2 gap-3">
            {step > 0 ? (
              <button
                onClick={handleBack}
                className="bg-white/20 text-white rounded-[10px] py-4 font-bold text-sm uppercase tracking-wider hover:bg-white/30 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                BACK
              </button>
            ) : (
              <button
                onClick={onClose}
                className="bg-white/20 text-white rounded-[10px] py-4 font-bold text-sm uppercase tracking-wider hover:bg-white/30 transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                CANCEL
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={!STEPS[step].skippable && !canProceed}
                className={cn(
                  "rounded-[10px] py-4 font-bold text-sm uppercase tracking-wider transition-all",
                  (STEPS[step].skippable || canProceed)
                    ? "bg-black text-white hover:bg-black/80"
                    : "bg-black/30 text-white/30 cursor-not-allowed"
                )}
              >
                {STEPS[step].skippable ? 'SKIP' : 'NEXT'}
              </button>
            ) : (
              <button
                onClick={() => onCreate(data)}
                className="bg-[#D5FB46] text-black rounded-[10px] py-4 font-bold text-sm uppercase tracking-wider hover:bg-[#c5eb36] transition-colors"
              >
                CREATE REHEARSAL
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Modals */}
      <RehearsalCostModal
        isOpen={isCostModalOpen}
        onClose={() => setIsCostModalOpen(false)}
        data={data}
        onUpdate={(updates) => setData(prev => ({ ...prev, ...updates }))}
      />
      <RehearsalProposeSongModal
        isOpen={isProposeModalOpen}
        onClose={() => setIsProposeModalOpen(false)}
        currentUser={{ initials: 'GB' }}
        onPropose={(proposal) => setData(prev => ({ ...prev, proposals: [...prev.proposals, proposal] }))}
      />
      <RehearsalAddTaskModal
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        members={data.members}
        songs={data.setlist}
        onAdd={(task) => setData(prev => ({ ...prev, tasks: [...prev.tasks, task] }))}
      />
      <RehearsalSetlistEditorModal
        isOpen={isSetlistEditorOpen}
        onClose={() => setIsSetlistEditorOpen(false)}
        initialTemplate={editingTemplate}
        library={library}
        onSave={handleSaveTemplate}
        onCreate={handleCreateTemplate}
        currentUserInitials="GB"
      />
      <RehearsalEditProposalModal
        isOpen={isEditProposalOpen}
        onClose={() => setIsEditProposalOpen(false)}
        proposal={editingProposal}
        onSave={handleSaveProposalDetails}
      />
      <RehearsalTaskDetailModal
        isOpen={isTaskDetailOpen}
        onClose={() => setIsTaskDetailOpen(false)}
        task={editingTask}
        members={data.members}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
      <RehearsalReviewSetlistModal
        isOpen={isReviewSetlistOpen}
        onClose={() => setIsReviewSetlistOpen(false)}
        snapshot={data.setlistSnapshotFinal}
        totalDuration={totalDuration}
      />
      <RehearsalReviewTasksModal
        isOpen={isReviewTasksOpen}
        onClose={() => setIsReviewTasksOpen(false)}
        tasks={data.tasks}
        members={data.members}
      />
      <RehearsalReviewProposalsModal
        isOpen={isReviewProposalsOpen}
        onClose={() => setIsReviewProposalsOpen(false)}
        proposals={data.proposals}
      />
      <RehearsalReviewMembersModal
        isOpen={isReviewMembersOpen}
        onClose={() => setIsReviewMembersOpen(false)}
        members={data.members}
      />
      <AnimatePresence>
        {songPickerOpen && (
          <SongPicker
            isOpen={songPickerOpen}
            onClose={() => setSongPickerOpen(false)}
            onSelect={handleSongPicked}
            selectedIds={data.setlist.map(s => s.id)}
            theme="blue"
          />
        )}
      </AnimatePresence>
    </>
  );
};
