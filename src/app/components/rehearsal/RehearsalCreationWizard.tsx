import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Music, Mic2, Calendar, MapPin, Clock, Repeat, DollarSign, Users, 
  ArrowRight, ArrowLeft, ArrowUpRight, Plus, Trash2, FileText, Link, ThumbsUp, 
  ThumbsDown, MessageCircle, CheckCircle2, AlertCircle, Briefcase,
  Wrench, BookOpen, ChevronDown, Play, Search, X, Folder, ListMusic, History, Edit, Layers, ChevronUp, Copy, Paperclip, User, LayoutGrid,
  Euro, Home, Lock, Unlock, Guitar, Check, Loader2
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { DotRadio } from '@/app/components/ui/DotRadio';
import { SongPicker, type PickedSong } from '@/app/components/ui/SongPicker';
import { WizardAccentRail, getRehearsalAccentColor } from '@/app/components/ui/WizardAccentRail';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { TimePicker } from '@/app/components/ui/TimePicker';
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
  { title: 'SETLIST &\nPROPOSALS', subtitle: 'OPTIONAL', skippable: true },
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

interface EditingEvent {
  id: number;
  eventId?: string;
  title: string;
  status: string;
  date: string;
  time: string;
  location: string;
  price: string;
  endTime?: string;
  notes?: string;
  venueAddress?: string;
  venueCity?: string;
  eventType?: string;
  memberUserIds?: string[];
  memberFeeMap?: Record<string, string>;
}

interface Props {
  onClose: () => void;
  onCreate: (data: any) => void;
  editingEvent?: EditingEvent | null;
}

// --- Interactive Step Indicator for Rehearsal ---
const InteractiveRehearsalStepIndicator: React.FC<{
  current: number;
  total: number;
  steps: { title: string; subtitle: string; skippable: boolean }[];
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
              STEP 0{i + 1}
            </span>
          </div>
        </button>
      );
    })}
  </div>
);

// --- Accordion Card for Editing Rehearsal ---
const RehearsalAccordionCard: React.FC<{
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

export const RehearsalCreationWizard: React.FC<Props> = ({ onClose, onCreate, editingEvent }) => {
  const { selectedBand, isAdmin } = useBand();
  const isEditing = !!editingEvent;
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
  const [reviewExpanded, setReviewExpanded] = useState<string | null>(null);
  const [isSetlistConfirmed, setIsSetlistConfirmed] = useState(false);

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

  const [endTime, setEndTime] = useState(editingEvent?.endTime || '22:00');
  const [checklistChecked, setChecklistChecked] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialRecurrence: RecurrenceType = (
    (editingEvent as any)?.recurrence_rule?.freq ||
    (editingEvent as any)?.recurrence_rule?.frequency ||
    (editingEvent as any)?.recurrence ||
    ((editingEvent as any)?.is_recurring ? 'weekly' : 'once')
  ) as RecurrenceType;

  const [data, setData] = useState<RehearsalState>({
    type: 'full_band',
    title: editingEvent?.title || '',
    location: editingEvent?.location || '',
    address: editingEvent?.venueAddress || '',
    date: editingEvent?.date || new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: editingEvent?.time || '20:00',
    duration: '2h',
    recurrence: initialRecurrence,
    venueType: 'free',
    showCost: false,
    totalCost: editingEvent?.price || '0',
    splitMethod: 'equal',
    audienceIds: editingEvent?.memberUserIds || [],
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
    status: 'scheduled'
  });

  const activeAccentColor = useMemo(() => getRehearsalAccentColor(data.type), [data.type]);

  useEffect(() => {
    if (realMembers.length > 0) {
      let members = realMembers;
      if (isEditing && editingEvent?.memberFeeMap) {
        members = realMembers.map(m => ({
          ...m,
          fee: editingEvent.memberFeeMap?.[m.id] || m.fee,
        }));
      }
      setData(prev => ({ ...prev, members }));
    }
  }, [realMembers, isEditing, editingEvent]);

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
  const handleSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const submitData = {
      ...data,
      endTime,
      ...(isEditing && editingEvent ? {
        _editing: true,
        _editingEventId: editingEvent.eventId,
        _editingLocalId: editingEvent.id,
        _originalEventType: editingEvent.eventType || 'rehearsal',
      } : {}),
    };
    onCreate(submitData);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleSubmit();
  };
  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else onClose();
  };

  const editingWarnings = useMemo(() => {
    if (!editingEvent) return [];
    const w: string[] = [];
    if (!data.location || data.location === 'TBD') w.push('location');
    if (!data.date) w.push('date');
    if (!data.title) w.push('title');
    return w;
  }, [editingEvent, data.location, data.date, data.title]);

  const maxAccessibleStep = useMemo(() => {
    if (isEditing) return STEPS.length - 1;
    if (!data.title.trim()) return 0;
    if (!data.location.trim() || !data.date) return 1;
    return STEPS.length - 1;
  }, [isEditing, data.title, data.location, data.date]);

  const canQuickSave = useMemo(() => {
    return !isEditing && data.title.trim() !== '' && data.location.trim() !== '' && !!data.date;
  }, [isEditing, data.title, data.location, data.date]);

  const [expandedEditSections, setExpandedEditSections] = useState<Record<string, boolean>>(() => {
    return {
      basics: false,
      when_where: true,
      setlist_proposals: false,
      prep_tasks: false,
    };
  });

  const toggleEditSection = (key: string) => {
    setExpandedEditSections(prev => ({ ...prev, [key]: !prev[key] }));
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

    const existingSnapshot = data.setlistSnapshotFinal;
    const queueTemplates = queueIds.map(id => templates.find(t => t.id === id)).filter(Boolean) as SetlistTemplate[];

    const mergedSongs: RehearsalSetlistSnapshotFinal['songs'] = existingSnapshot ? [...existingSnapshot.songs] : [];
    const seenSongIds = new Set<string>(mergedSongs.map(s => s.songId));
    const skippedSongIds: string[] = [];
    const existingSources = existingSnapshot ? [...existingSnapshot.sources] : [];
    const existingSkipped = existingSnapshot?.mergeReport.duplicatesSkippedSongIds || [];

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

    const allSources = [
      ...existingSources,
      ...queueTemplates
        .filter(t => !existingSources.some(s => s.templateId === t.id))
        .map(t => ({ templateId: t.id, templateName: t.name, templateVersion: t.version }))
    ];

    const allSkipped = [...existingSkipped, ...skippedSongIds];
    const totalBeforeDedupe = (existingSnapshot?.mergeReport.totalSongsBeforeDedupe || 0)
      + queueTemplates.reduce((acc, t) => acc + t.songIds.length, 0);

    const snapshot: RehearsalSetlistSnapshotFinal = {
      id: existingSnapshot?.id || `snap-${Date.now()}`,
      name: "Rehearsal Setlist",
      createdAt: existingSnapshot?.createdAt || new Date().toISOString(),
      createdBy: existingSnapshot?.createdBy || "GB",
      sources: allSources,
      songs: mergedSongs,
      mergeReport: {
        totalImportedTemplates: allSources.length,
        totalSongsBeforeDedupe: totalBeforeDedupe,
        totalDuplicatesSkipped: allSkipped.length,
        duplicatesSkippedSongIds: allSkipped
      }
    };
    const legacySongs = mergedSongs.map(ms => library.find(s => s.id === ms.songId)).filter(Boolean) as RehearsalSong[];
    setData(prev => ({ ...prev, setlistSnapshotFinal: snapshot, setlist: legacySongs, selectedTemplateIdsInOrder: [] }));
    setIsSetlistConfirmed(false);
  };

  const handleUpdateSnapshot = (updatedSnapshot: RehearsalSetlistSnapshotFinal) => {
    const legacySongs = updatedSnapshot.songs
      .map(ms => library.find(s => s.id === ms.songId))
      .filter(Boolean) as RehearsalSong[];
    setData(prev => ({ ...prev, setlistSnapshotFinal: updatedSnapshot, setlist: legacySongs }));
  };

  const handleConfirmSetlist = () => {
    setIsSetlistConfirmed(true);
    setIsReviewSetlistOpen(false);
  };

  const handleDeselectSetlist = () => {
    setIsSetlistConfirmed(false);
    setData(prev => ({
      ...prev,
      setlistSnapshotFinal: undefined,
      setlist: [],
      selectedTemplateIdsInOrder: [],
    }));
    setIsReviewSetlistOpen(false);
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
          className="w-full bg-transparent border-b-2 border-foreground/20 text-foreground text-[22px] font-bold placeholder:text-foreground/30 focus:outline-none focus:border-foreground transition-colors pb-3"
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
              className="w-full flex items-center justify-between py-4 border-b border-foreground/10 last:border-b-0 transition-all"
            >
              <div className="flex flex-col items-start justify-start gap-3 flex-1 min-w-0">
                <span className={cn(
                  "px-2.5 py-1 rounded-[6px] text-[12px] font-bold uppercase shrink-0 transition-colors",
                  isSelected ? "bg-foreground text-background" : "bg-foreground/10 text-foreground/50"
                )}>
                  {opt.tag}
                </span>
                <span className={cn(
                  "text-[28px] font-bold uppercase leading-none transition-colors truncate",
                  isSelected ? "text-foreground" : "text-foreground/30"
                )}>
                  {opt.label}
                </span>
              </div>
              <DotRadio
                selected={isSelected}
                activeColor="var(--accent-rehearsal)"
                inactiveColor="var(--border)"
              />
            </button>
          );
        })}
      </div>

      <div className="h-px bg-foreground/10" />

      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[12px] font-bold uppercase text-foreground/50 tracking-wider">MEMBERS</span>
          <span className="text-[12px] font-bold text-foreground/50">
            {data.audienceIds.length === 0 ? `All (${data.members.length})` : `${data.audienceIds.length}/${data.members.length}`}
          </span>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setData(prev => ({ ...prev, audienceIds: [] }))}
            className={cn(
              "px-4 py-2 rounded-full text-[12px] font-bold uppercase border transition-all",
              data.audienceIds.length === 0
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-foreground/70 border-foreground/20 hover:border-foreground/40"
            )}
          >
            Select All
          </button>
          <button
            onClick={() => setData(prev => ({ ...prev, audienceIds: prev.members.map(m => m.id) }))}
            className={cn(
              "px-4 py-2 rounded-full text-[12px] font-bold uppercase border transition-all",
              data.audienceIds.length > 0
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-foreground/70 border-foreground/20 hover:border-foreground/40"
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
                className="flex flex-col items-start justify-start gap-3 p-3 rounded-[10px] transition-all hover:bg-foreground/5 text-left"
              >
                <DotCheckbox
                  checked={isSelected}
                  activeColor="var(--accent-rehearsal)"
                  inactiveColor="var(--border)"
                />
                <div className="min-w-0">
                  <span className={cn("text-sm font-bold block truncate", isSelected ? "text-foreground" : "text-foreground/30")}>{m.name}</span>
                  <span className="text-[10px] font-bold uppercase text-foreground/40">{m.role}</span>
                </div>
              </button>
            );
          })}
        </div>

        {data.members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="w-8 h-8 text-foreground/20 mb-2" />
            <span className="text-sm font-bold text-foreground/30">No members found</span>
            <span className="text-xs text-foreground/20 mt-1">Add members to your band first</span>
          </div>
        )}
      </div>
    </div>
  );

  // ── STEP 1: DATE & LOCATION ───────────────────────────────

  const renderDateLocationStep = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div>
        <VenueAutocomplete
          value={data.location}
          onChange={val => setData(prev => ({ ...prev, location: val }))}
          onSelect={place => {
            const formatted = place.fullAddress || [place.address, place.city, place.postcode, place.country].filter(Boolean).join(', ');
            setData(prev => ({
              ...prev,
              location: place.name,
              ...(formatted ? { address: formatted } : {}),
            }));
          }}
          placeholder="Venue Name"
          className="w-full bg-transparent border-b-2 border-foreground/20 text-foreground text-[28px] font-bold placeholder:text-foreground/30 focus:outline-none focus:border-foreground transition-colors pb-3"
        />
      </div>

      <div>
        <input
          type="text"
          value={data.address}
          onChange={e => setData(prev => ({ ...prev, address: e.target.value }))}
          className="w-full bg-transparent border-b-2 border-foreground/20 text-foreground text-sm font-bold placeholder:text-foreground/30 focus:outline-none focus:border-foreground transition-colors pb-2"
          placeholder="Street, City, ZIP, Country"
        />
        {data.address && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {data.address.split(',').map((tag, i) => (
              <span key={i} className="bg-foreground/10 text-foreground/70 rounded-[6px] px-2.5 py-1 text-[12px] font-bold uppercase">
                {tag.trim()}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[12px] font-bold uppercase text-foreground tracking-wider">{calMonthName} {calYear}</span>
          <div className="flex gap-2">
            <button onClick={prevMonth} className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center text-foreground hover:bg-foreground/20 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button onClick={nextMonth} className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center text-foreground hover:bg-foreground/20 transition-colors">
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <div key={i} className="text-center text-[11px] font-bold text-foreground/30 py-2">{d}</div>
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
                    ? "bg-foreground text-background"
                    : day ? "text-foreground/70 hover:bg-foreground/10" : ""
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
          <span className="text-[12px] font-bold uppercase text-foreground/40 tracking-wider block mb-2">START TIME</span>
          <TimePicker
            value={data.time}
            onChange={val => setData(prev => ({ ...prev, time: val }))}
            textSize="text-[20px]"
            showIcon
            className="border-b-2 border-foreground/20 text-foreground focus-within:border-foreground transition-colors pb-2"
          />
        </div>
        <div>
          <span className="text-[12px] font-bold uppercase text-foreground/40 tracking-wider block mb-2">END TIME</span>
          <TimePicker
            value={endTime}
            onChange={val => setEndTime(val)}
            textSize="text-[20px]"
            showIcon
            className="border-b-2 border-foreground/20 text-foreground focus-within:border-foreground transition-colors pb-2"
          />
        </div>
      </div>

      <div>
        <span className="text-[12px] font-bold uppercase text-foreground/40 tracking-wider block mb-3">RECURRENCE</span>
        <div className="flex flex-wrap gap-2">
          {(['once', 'weekly', 'biweekly', 'monthly'] as const).map(freq => (
            <button
              key={freq}
              type="button"
              onClick={() => setData(prev => ({ ...prev, recurrence: freq }))}
              className={cn(
                "px-4 py-2 rounded-full text-[12px] font-bold uppercase border transition-all",
                data.recurrence === freq
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-foreground/70 border-foreground/20 hover:border-foreground/40"
              )}
            >
              {freq === 'once' ? 'ONE TIME' : freq.toUpperCase()}
            </button>
          ))}
        </div>
        {data.recurrence !== 'once' && (
          <div className="bg-foreground/10 rounded-[10px] p-4 flex items-start gap-3 mt-4">
            <AlertCircle className="w-5 h-5 text-foreground shrink-0 mt-0.5" />
            <span className="text-sm font-bold text-foreground/70">
              This rehearsal will repeat <strong className="text-foreground">{data.recurrence}</strong>. Future instances can be edited individually.
            </span>
          </div>
        )}
      </div>

      <div>
        <span className="text-[12px] font-bold uppercase text-foreground/40 tracking-wider block mb-3">VENUE TYPE</span>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setData(prev => ({ ...prev, venueType: 'free' }))}
            className={cn(
              "flex items-center gap-3 p-4 rounded-[10px] border transition-all",
              data.venueType === 'free'
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-foreground/70 border-foreground/20 hover:border-foreground/40"
            )}
          >
            <Home className="w-5 h-5" />
            <span className="font-bold uppercase text-sm">Free</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setData(prev => ({ ...prev, venueType: 'paid' }))}
              className={cn(
                "flex items-center gap-3 p-4 rounded-[10px] border transition-all",
                data.venueType === 'paid'
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-foreground/70 border-foreground/20 hover:border-foreground/40"
              )}
            >
              <Euro className="w-5 h-5" />
              <span className="font-bold uppercase text-sm">Paid</span>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {data.venueType === 'paid' && isAdmin && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-foreground/10 rounded-[10px] p-6 space-y-4">
              <div>
                <span className="text-[12px] font-bold uppercase text-foreground/40 block mb-2">TOTAL COST (€)</span>
                <input
                  type="number"
                  value={data.totalCost}
                  onChange={e => setData(prev => ({ ...prev, totalCost: e.target.value }))}
                  className="w-full bg-transparent border-b-2 border-foreground/30 text-foreground text-[32px] font-bold placeholder:text-foreground/30 focus:outline-none focus:border-foreground transition-colors pb-2"
                  placeholder="0"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setData(prev => ({ ...prev, splitMethod: 'equal' }))}
                    className={cn(
                      "px-4 py-2 rounded-full text-[12px] font-bold uppercase border transition-all",
                      data.splitMethod === 'equal' ? "bg-foreground text-background border-foreground" : "bg-transparent text-foreground/70 border-foreground/20"
                    )}
                  >
                    Equal Split
                  </button>
                  <button
                    onClick={() => setData(prev => ({ ...prev, splitMethod: 'custom' }))}
                    className={cn(
                      "px-4 py-2 rounded-full text-[12px] font-bold uppercase border transition-all",
                      data.splitMethod === 'custom' ? "bg-foreground text-background border-foreground" : "bg-transparent text-foreground/70 border-foreground/20"
                    )}
                  >
                    Custom
                  </button>
                </div>
                {data.splitMethod === 'equal' && (
                  <span className="text-lg font-bold text-foreground">
                    €{(parseInt(data.totalCost || '0') / Math.max(data.audienceIds.length || data.members.length, 1)).toFixed(2)}
                    <span className="text-foreground/50 text-sm ml-1">/ person</span>
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // ── STEP 2: SETLIST + PROPOSALS ───────────────────────────

  const renderRunlistProposalsStep = () => {
    const queueIds = data.selectedTemplateIdsInOrder || [];
    const hasQueue = queueIds.length > 0;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">

        {/* ── Active Setlist Card ── */}
        {data.setlistSnapshotFinal && (
          <div
            className={cn(
              "rounded-[10px] p-5 cursor-pointer transition-all",
              isSetlistConfirmed
                ? "bg-accent/15 border border-accent/40"
                : "bg-foreground/10 border border-foreground/15 hover:bg-foreground/15"
            )}
            onClick={() => setIsReviewSetlistOpen(true)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-foreground/50" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">Active Setlist</span>
              </div>
              {isSetlistConfirmed ? (
                <span className="px-2.5 py-1 bg-accent text-accent-foreground text-[10px] font-bold uppercase rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> Confirmed
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase text-foreground/40">Tap to edit</span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold text-foreground leading-none">{data.setlistSnapshotFinal.songs.length}</span>
              <span className="text-sm font-bold text-foreground/40 uppercase">Songs</span>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="px-2.5 py-1 bg-foreground/15 text-foreground text-[10px] font-bold uppercase rounded-full">{totalDuration}</span>
              <span className="px-2.5 py-1 bg-foreground/10 text-foreground/60 text-[10px] font-bold uppercase rounded-full flex items-center gap-1">
                <Layers className="w-3 h-3" /> {data.setlistSnapshotFinal.sources.length} sources
              </span>
              {data.setlistSnapshotFinal.mergeReport.totalDuplicatesSkipped > 0 && (
                <span className="px-2.5 py-1 bg-foreground/10 text-foreground/50 text-[10px] font-bold uppercase rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {data.setlistSnapshotFinal.mergeReport.totalDuplicatesSkipped} merged
                </span>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              {!isSetlistConfirmed ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleConfirmSetlist(); }}
                  className="flex-1 py-2.5 bg-accent text-accent-foreground rounded-[10px] text-[11px] font-bold uppercase tracking-wider hover:bg-accent/90 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Confirm
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeselectSetlist(); }}
                  className="flex-1 py-2.5 bg-foreground/10 border border-foreground/20 text-foreground/60 rounded-[10px] text-[11px] font-bold uppercase tracking-wider hover:bg-foreground/20 hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Deselect
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Queue (pending merge) ── */}
        {hasQueue && (
          <div className="bg-foreground/10 rounded-[10px] p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase text-foreground/50 tracking-wider">
              Queue ({queueIds.length})
            </span>
            <div className="space-y-1.5">
              {queueIds.map((tid, i) => {
                const t = templates.find(tp => tp.id === tid);
                return (
                  <div key={`${tid}-${i}`} className="flex items-center justify-between bg-foreground/10 px-3 py-2 rounded-lg">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="font-bold text-foreground text-sm truncate">{t?.name || 'Unknown'}</span>
                      <span className="text-[10px] font-bold text-foreground/40 shrink-0">{t?.songIds.length || 0}</span>
                    </div>
                    <button onClick={() => handleRemoveFromQueue(i)} className="text-foreground/40 hover:text-red-500 transition-colors shrink-0 ml-2">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleBuildSnapshot}
              className="w-full py-2.5 bg-foreground text-background rounded-[10px] text-[12px] font-bold uppercase flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Layers className="w-3.5 h-3.5" /> {data.setlistSnapshotFinal ? 'Merge into Setlist' : 'Build Setlist'}
            </button>
          </div>
        )}

        {/* ── Available Setlists ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase text-foreground/50 tracking-wider">Available Setlists</span>
            <button
              onClick={() => openSetlistEditor(null)}
              className="px-4 py-2 rounded-[10px] font-bold text-[12px] uppercase bg-foreground text-background hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> New
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="bg-foreground/5 rounded-[10px] p-8 text-center border border-foreground/15 border-dashed">
              <ListMusic className="w-8 h-8 text-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-bold text-foreground/40">No setlists yet</p>
              <p className="text-[11px] text-foreground/30 mt-1">Create one to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map(template => {
                const inQueue = queueIds.includes(template.id);
                const alreadyInSnapshot = data.setlistSnapshotFinal?.sources.some(s => s.templateId === template.id) || false;
                return (
                  <div
                    key={template.id}
                    className={cn(
                      "rounded-[10px] p-3 flex items-center gap-3 transition-all border",
                      alreadyInSnapshot
                        ? "bg-foreground/5 border-foreground/10 opacity-60"
                        : inQueue
                          ? "bg-foreground/15 border-foreground/20"
                          : "bg-foreground/10 border-foreground/10 hover:border-foreground/20"
                    )}
                  >
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => openSetlistEditor(template)}
                    >
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-foreground truncate">{template.name}</h4>
                        <span className="text-[9px] font-bold text-foreground/40 uppercase shrink-0">v{template.version}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] font-bold text-foreground/40">
                        <span className="flex items-center gap-1"><ListMusic className="w-3 h-3" /> {template.songIds.length}</span>
                        <span>{new Date(template.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {alreadyInSnapshot ? (
                      <span className="text-[10px] font-bold text-foreground/40 uppercase shrink-0 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Added
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddToQueue(template.id)}
                        className={cn(
                          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                          inQueue
                            ? "bg-foreground text-background"
                            : "bg-foreground/15 text-foreground/60 hover:bg-foreground/25 hover:text-foreground"
                        )}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Add Songs from Library ── */}
        <div>
          <button
            onClick={() => setSongPickerOpen(true)}
            className="w-full py-3 rounded-[10px] border border-foreground/20 hover:border-foreground/40 text-foreground text-[12px] font-bold uppercase flex items-center justify-center gap-2 transition-all hover:bg-foreground/10"
          >
            <Music className="w-4 h-4" /> Browse Song Library
          </button>
        </div>

        {/* ── Proposals ── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-foreground/15" />
          <span className="text-[11px] font-bold uppercase text-foreground/40">Proposal Songs</span>
          <div className="flex-1 h-px bg-foreground/15" />
        </div>

        <div className="space-y-4 pb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-[28px] font-bold text-foreground leading-none">{data.proposals.length}</span>
              <span className="text-[11px] font-bold uppercase text-foreground/50">Proposals</span>
            </div>
            <button
              onClick={() => setIsProposeModalOpen(true)}
              className="px-4 py-2 rounded-[10px] font-bold text-[12px] uppercase bg-foreground text-background hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Propose
            </button>
          </div>

          <div className="space-y-2">
            {data.proposals.map(prop => (
              <div key={prop.id} className="bg-foreground/10 rounded-[10px] p-4 border border-foreground/15 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-3 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-bold text-sm text-foreground truncate">{prop.title}</h4>
                      {prop.status === 'new' && <span className="px-1.5 py-0.5 bg-foreground text-background text-[9px] font-bold uppercase rounded-full shrink-0">NEW</span>}
                    </div>
                    <span className="text-[11px] font-bold uppercase text-foreground/50">{prop.artist}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("px-2.5 py-1 text-[10px] font-bold uppercase rounded-full",
                      prop.status === 'approved' ? "bg-green-500/20 text-green-600 dark:text-green-400" : "bg-foreground/10 text-foreground/60"
                    )}>
                      {prop.status === 'approved' ? "Approved" : "Pending"}
                    </span>
                    <button
                      onClick={() => openProposalEdit(prop)}
                      className="px-2.5 py-1 bg-foreground/10 rounded-full text-[10px] font-bold uppercase text-foreground/60 hover:text-foreground hover:bg-foreground/20 transition-all"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {prop.reason && (
                  <div className="bg-foreground/5 rounded-lg p-2.5">
                    <p className="text-[12px] text-foreground/60 italic">"{prop.reason}"</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold text-foreground/40">
                      <div className="w-4 h-4 rounded-full bg-foreground/15 flex items-center justify-center text-foreground text-[8px] font-bold">{prop.proposer}</div>
                      <span>Proposed 2 days ago</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 text-[12px] font-bold">
                  <span className="flex items-center gap-1 text-foreground"><ThumbsUp className="w-3 h-3" /> {prop.votes.yes}</span>
                  <span className="flex items-center gap-1 text-foreground/50"><ThumbsDown className="w-3 h-3" /> {prop.votes.no}</span>
                  <span className="flex items-center gap-1 text-foreground/50"><MessageCircle className="w-3 h-3" /> {prop.votes.comments}</span>
                </div>

                {prop.status === 'approved' && (
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-foreground/15">
                    <button
                      onClick={() => {
                        if (selectedBand?.id) {
                          createSong({ band_id: selectedBand.id, title: prop.title, artist: prop.artist, status: 'ready', priority: 'medium' });
                        }
                      }}
                      className="py-2 rounded-lg border border-foreground/20 hover:border-foreground text-foreground text-[11px] font-bold uppercase transition-all"
                    >
                      Add to Repertoire
                    </button>
                    <button
                      onClick={() => {
                        const song: RehearsalSong = {
                          id: `prop-${prop.id}`,
                          title: prop.title,
                          artist: prop.artist,
                          duration: '4:00',
                          notes: prop.reason || '',
                          status: 'ready' as any,
                          priority: 'medium' as const,
                          type: 'song' as const,
                        };
                        setData(prev => ({ ...prev, setlist: [...prev.setlist, song] }));
                      }}
                      className="py-2 rounded-lg bg-foreground text-background text-[11px] font-bold uppercase transition-all hover:opacity-90"
                    >
                      Add to Rehearsal
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── STEP 3: PREPARATION ───────────────────────────────────

  const renderPreparationStep = () => {
    const bandTasks = data.tasks.filter(t => t.assignedTo.includes('all'));
    const assignedTasks = data.tasks.filter(t => !t.assignedTo.includes('all'));

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500 pb-4">
        <div>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <span className="text-[40px] font-bold text-foreground">{data.tasks.length}</span>
              <span className="text-[12px] font-bold uppercase text-foreground/40">Tasks</span>
            </div>
            <button
              onClick={() => setIsAddTaskModalOpen(true)}
              className="px-5 py-2.5 rounded-[10px] font-bold text-sm uppercase bg-foreground text-background hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Task
            </button>
          </div>

          {data.tasks.length === 0 && (
            <div className="bg-foreground/10 rounded-[10px] p-8 text-center border border-foreground/15 border-dashed mb-6">
              <div className="w-14 h-14 rounded-full bg-foreground/10 mx-auto flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-foreground/30" />
              </div>
              <h4 className="font-bold text-lg text-foreground mb-2">No tasks yet</h4>
              <p className="text-sm text-foreground/40 mb-5">Add preparation tasks for the band</p>
              <button
                onClick={() => setIsAddTaskModalOpen(true)}
                className="px-5 py-3 bg-foreground text-background rounded-[10px] text-sm font-bold uppercase hover:opacity-90 transition-opacity"
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
                  <span className="text-[10px] font-bold uppercase text-foreground/40 block mb-2">LOAD FROM TEMPLATE</span>
                  <div className="flex flex-wrap gap-2">
                    {taskTemplatesDB.map(tpl => (
                      <button
                        key={tpl.id}
                        onClick={() => loadTaskTemplate(tpl)}
                        className="px-4 py-2 bg-foreground/10 hover:bg-foreground hover:text-background rounded-[10px] text-[12px] font-bold uppercase transition-colors text-foreground/60 flex items-center gap-2"
                      >
                        <Folder className="w-3.5 h-3.5" />
                        {tpl.name}
                        <span className="text-foreground/40">{tpl.tasks.length}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick-add suggestions */}
              <div>
                <span className="text-[10px] font-bold uppercase text-foreground/40 block mb-2">QUICK ADD</span>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_TASKS.map(t => (
                    <button
                      key={t}
                      onClick={() => handleAddQuickTask(t)}
                      className="px-4 py-2 bg-foreground/10 hover:bg-foreground hover:text-background rounded-full text-[12px] font-bold uppercase transition-colors text-foreground/60"
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
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-foreground/40 mb-3 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" /> Band Tasks ({bandTasks.length})
                </h4>
                <div className="bg-foreground/10 rounded-[10px] overflow-hidden border border-foreground/15 divide-y divide-foreground/10">
                  {bandTasks.map(task => (
                    <div onClick={() => openTaskEdit(task)} key={task.id} className="p-4 flex items-start gap-3 hover:bg-foreground/5 transition-colors cursor-pointer">
                      <DotCheckbox
                        checked={task.completed}
                        activeColor="var(--accent-rehearsal)"
                        inactiveColor="var(--border)"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground leading-tight">{task.text}</p>
                        <div className="flex gap-2 mt-1.5">
                          <span className="px-2 py-0.5 bg-foreground/10 rounded-full text-[11px] font-bold uppercase text-foreground/60">Band</span>
                          <span className="text-[11px] font-bold uppercase text-foreground/40">{task.type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {assignedTasks.length > 0 && (
              <div>
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-foreground/40 mb-3 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> Assigned Tasks ({assignedTasks.length})
                </h4>
                <div className="bg-foreground/10 rounded-[10px] overflow-hidden border border-foreground/15 divide-y divide-foreground/10">
                  {assignedTasks.map(task => {
                    const assigneeInitials = task.assignedTo.slice(0, 2).map(id => data.members.find(m => m.id === id)?.initials).join('+');
                    return (
                      <div onClick={() => openTaskEdit(task)} key={task.id} className="p-4 flex items-start gap-3 hover:bg-foreground/5 transition-colors cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-foreground text-background text-[11px] font-bold flex items-center justify-center shrink-0">{assigneeInitials}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground leading-tight">{task.text}</p>
                          <div className="flex gap-2 mt-1.5">
                            <span className="px-2 py-0.5 bg-foreground/10 rounded-full text-[11px] font-bold uppercase text-foreground/60">
                              {task.assignedTo.length > 1 ? `${task.assignedTo.length} members` : data.members.find(m => m.id === task.assignedTo[0])?.name}
                            </span>
                            <span className="text-[11px] font-bold uppercase text-foreground/40">{task.type}</span>
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
            <span className="text-[12px] font-bold uppercase text-foreground/40 tracking-wider">My Checklist</span>
            <span className="px-3 py-1 bg-foreground/10 text-foreground/60 text-[11px] font-bold rounded-full flex items-center gap-1.5">
              <User className="w-3 h-3" /> Personal
            </span>
          </div>
          <div className="bg-foreground/10 rounded-[10px] border border-foreground/15 p-5 grid grid-cols-2 gap-3">
            {data.defaultChecklist.map((item, i) => (
              <button
                key={i}
                className="flex flex-col justify-start items-start gap-3 text-left"
                onClick={() => setChecklistChecked(prev => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i); else next.add(i);
                  return next;
                })}
              >
                <DotCheckbox
                  checked={checklistChecked.has(i)}
                  activeColor="var(--accent-rehearsal)"
                  inactiveColor="var(--border)"
                />
                <span className={cn("text-sm font-bold", checklistChecked.has(i) ? "text-foreground" : "text-foreground/40")}>{item}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Band Essentials */}
        {isAdmin && (
          <div className="bg-accent rounded-[10px] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-foreground">
                <Briefcase className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Band Essentials</h3>
              </div>
              <div className="flex items-center gap-1.5 bg-black/10 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase text-foreground/50">
                <Lock className="w-3 h-3" /> Admin Only
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {data.bandChecklist?.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm font-bold text-foreground/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-black/30" />
                  {item}
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-black/10 text-[11px] font-medium text-foreground/40 text-center italic">
              These items are required for every rehearsal.
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── STEP 4: REVIEW ────────────────────────────────────────

  const renderReviewStep = () => {
    const approvedProposals = data.proposals.filter(p => p.status === 'approved').length;
    const pendingProposals = data.proposals.length - approvedProposals;
    const songCount = data.setlistSnapshotFinal?.songs.length || 0;
    const memberCount = data.audienceIds.length > 0 ? data.audienceIds.length : data.members.length;
    const toggleReview = (key: string) => setReviewExpanded(prev => prev === key ? null : key);

    const rehearsalTime = endTime
      ? `${data.time} – ${endTime}`
      : data.time;

    return (
      <div className="flex flex-col gap-[40px] animate-in fade-in slide-in-from-right-8 duration-500 pb-4">
        {/* Header */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex gap-[4px] flex-wrap">
            <div className="rounded-[6px] px-[10px] py-[4px] bg-foreground/10">
              <span className="text-[12px] font-bold text-foreground uppercase">REHEARSAL</span>
            </div>
            <div className="rounded-[6px] px-[10px] py-[4px] bg-foreground/10">
              <span className="text-[12px] font-bold text-foreground uppercase">{data.type.replace('_', ' ')}</span>
            </div>
            {data.recurrence !== 'once' && (
              <div className="rounded-[6px] px-[10px] py-[4px] bg-foreground/10">
                <span className="text-[12px] font-bold text-foreground uppercase">{data.recurrence}</span>
              </div>
            )}
          </div>
          <h2 className="text-[32px] font-bold text-foreground uppercase leading-none">{data.title}</h2>
          <span className="text-[14px] font-medium text-foreground/50 uppercase">{data.location || 'TBD'}</span>
        </div>

        {/* Rehearsal Time */}
        <div className="flex flex-col gap-[20px]">
          <div className="flex flex-col">
            <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => toggleReview('time')}>
              <span className="text-[12px] font-bold uppercase text-foreground">REHEARSAL TIME</span>
              <motion.div animate={{ rotate: reviewExpanded === 'time' ? 90 : 0 }} transition={{ duration: 0.2 }}>
                <ArrowUpRight className="w-[14px] h-[14px] text-foreground" />
              </motion.div>
            </button>
            <span className="text-[42px] font-bold leading-none text-foreground">{rehearsalTime}</span>
          </div>
          <AnimatePresence>
            {reviewExpanded === 'time' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                <div className="pt-[12px] flex flex-col gap-[8px]">
                  <div className="flex items-center justify-between py-[8px] border-b border-foreground/15">
                    <span className="text-[12px] font-medium uppercase text-foreground/50">Start</span>
                    <span className="text-[14px] font-bold text-foreground">{data.time}</span>
                  </div>
                  {endTime && (
                    <div className="flex items-center justify-between py-[8px] border-b border-foreground/15">
                      <span className="text-[12px] font-medium uppercase text-foreground/50">End</span>
                      <span className="text-[14px] font-bold text-foreground">{endTime}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-[8px] border-b border-foreground/15">
                    <span className="text-[12px] font-medium uppercase text-foreground/50">Duration</span>
                    <span className="text-[14px] font-bold text-foreground">{data.duration}</span>
                  </div>
                  <div className="flex items-center justify-between py-[8px] border-b border-foreground/15">
                    <span className="text-[12px] font-medium uppercase text-foreground/50">Date</span>
                    <span className="text-[14px] font-bold text-foreground">{formatDate(data.date)}</span>
                  </div>
                  <div className="flex items-center justify-between py-[8px] border-b border-foreground/15">
                    <span className="text-[12px] font-medium uppercase text-foreground/50">Location</span>
                    <span className="text-[14px] font-bold text-foreground">{data.location || 'TBD'}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Setlist */}
        <div className="flex flex-col gap-[20px]">
          <div className="flex flex-col">
            <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => setIsReviewSetlistOpen(true)}>
              <span className="text-[12px] font-bold uppercase text-foreground">SONGS TO PLAY</span>
              <ArrowUpRight className="w-[14px] h-[14px] text-foreground" />
            </button>
            <span className="text-[42px] font-bold leading-none text-foreground">{songCount}</span>
          </div>
          <div className="flex items-center gap-[8px]">
            <span className="text-[12px] font-medium text-foreground/50 uppercase">{totalDuration}</span>
            <button onClick={() => setStep(2)} className="text-[12px] font-bold text-foreground/40 uppercase hover:text-foreground transition-colors ml-auto">Edit</button>
          </div>
        </div>

        {/* Tasks */}
        <div className="flex flex-col gap-[20px]">
          <div className="flex flex-col">
            <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => setIsReviewTasksOpen(true)}>
              <span className="text-[12px] font-bold uppercase text-foreground">TASKS</span>
              <ArrowUpRight className="w-[14px] h-[14px] text-foreground" />
            </button>
            <span className="text-[42px] font-bold leading-none text-foreground">{data.tasks.length}</span>
          </div>
          <div className="flex items-center gap-[8px]">
            <span className="text-[12px] font-medium text-foreground/50 uppercase">{data.tasks.filter(t => t.assignedTo.includes('all') || t.assignedTo.includes('1')).length} assigned to you</span>
            <button onClick={() => setStep(3)} className="text-[12px] font-bold text-foreground/40 uppercase hover:text-foreground transition-colors ml-auto">Edit</button>
          </div>
        </div>

        {/* Proposals */}
        {data.proposals.length > 0 && (
          <div className="flex flex-col gap-[20px]">
            <div className="flex flex-col">
              <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => setIsReviewProposalsOpen(true)}>
                <span className="text-[12px] font-bold uppercase text-foreground">PROPOSALS</span>
                <ArrowUpRight className="w-[14px] h-[14px] text-foreground" />
              </button>
              <span className="text-[42px] font-bold leading-none text-foreground">{approvedProposals}</span>
            </div>
            <span className="text-[12px] font-medium text-foreground/50 uppercase">{approvedProposals} approved · {pendingProposals} pending</span>
          </div>
        )}

        {/* Members */}
        <div className="flex flex-col gap-[20px]">
          <div className="flex flex-col">
            <button className="flex items-center gap-[6px] bg-transparent border-none p-0 m-0 cursor-pointer" onClick={() => setIsReviewMembersOpen(true)}>
              <span className="text-[12px] font-bold uppercase text-foreground">CONFIRMED MEMBERS</span>
              <ArrowUpRight className="w-[14px] h-[14px] text-foreground" />
            </button>
            <span className="text-[42px] font-bold leading-none text-foreground">{memberCount}</span>
          </div>
          <div className="flex -space-x-2">
            {data.members.slice(0, 8).map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ x: 10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 + (i * 0.05) }}
                className="w-8 h-8 rounded-full border-2 border-accent-rehearsal bg-foreground flex items-center justify-center text-[10px] font-bold text-background"
              >
                {m.initials}
              </motion.div>
            ))}
            {data.members.length > 8 && (
              <div className="w-8 h-8 rounded-full border-2 border-accent-rehearsal bg-foreground/15 flex items-center justify-center text-[10px] font-bold text-foreground">
                +{data.members.length - 8}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-2">
          <span className="text-sm font-bold text-foreground/40 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {isEditing
              ? `Ready to save. ${memberCount} members assigned.`
              : `Ready to create. Notifying ${memberCount} members immediately.`}
          </span>
        </div>
      </div>
    );
  };

  // ── ACCORDION EDIT VIEW (FOR isEditing === true) ───────────

  const renderEditAccordionView = () => {
    const queueIds = data.selectedTemplateIdsInOrder || [];
    const hasQueue = queueIds.length > 0;
    const bandTasks = data.tasks.filter(t => t.assignedTo.includes('all') || t.assignedTo.length === 0);
    const assignedTasks = data.tasks.filter(t => !t.assignedTo.includes('all') && t.assignedTo.length > 0);

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
                {data.type.replace('_', ' ').toUpperCase()}
              </span>
              {data.recurrence !== 'once' && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-foreground/10 text-foreground/60">
                  {data.recurrence.toUpperCase()}
                </span>
              )}
            </div>
            <h1 className="text-[28px] font-bold uppercase leading-tight text-foreground truncate mt-1">
              {data.title || 'UNTITLED REHEARSAL'}
            </h1>
            <span className="text-[13px] font-bold uppercase text-foreground/50">
              {formatDate(data.date)} @ {data.time} – {endTime} • {data.location || 'LOCATION TBD'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[50px] h-[50px] rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Warnings Banner */}
        {editingWarnings.length > 0 && (
          <div className="p-4 rounded-[14px] bg-[var(--warning)]/10 border border-[var(--warning)]/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--warning)] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-bold text-[var(--warning)] uppercase tracking-wider">
                {editingWarnings.length} {editingWarnings.length === 1 ? 'FIELD NEEDS' : 'FIELDS NEED'} ATTENTION
              </span>
              <span className="text-[11px] font-medium text-foreground/70">
                Please complete missing details: {editingWarnings.join(', ')}.
              </span>
            </div>
          </div>
        )}

        {/* Section 1: Session Type & Recurrence */}
        <RehearsalAccordionCard
          isOpen={!!expandedEditSections.basics}
          onToggle={() => toggleEditSection('basics')}
          stepNumber="01"
          title="SESSION TYPE & RECURRENCE"
          summary={`${data.type.replace('_', ' ').toUpperCase()} • ${data.audienceIds.length === 0 ? 'ALL MEMBERS' : `${data.audienceIds.length} MEMBERS`} • ${data.recurrence === 'once' ? 'ONE TIME' : data.recurrence.toUpperCase()}`}
          hasWarning={!data.title.trim()}
          warningLabel="MISSING TITLE"
        >
          {/* Title */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-foreground/50">SESSION TITLE</span>
            <input
              type="text"
              value={data.title}
              onChange={e => setData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full bg-transparent border-b pb-2 text-[20px] font-bold uppercase focus:outline-none border-foreground/15 focus:border-foreground"
              placeholder="Rehearsal Title"
            />
          </div>

          {/* Type Selection */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider block mb-2 text-foreground/50">SESSION TYPE</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(opt => {
                const isSelected = data.type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleTypeChange(opt.value)}
                    className={cn(
                      "p-3 rounded-[10px] border text-left transition-all flex items-center justify-between",
                      isSelected
                        ? "bg-foreground text-background border-foreground shadow-sm"
                        : "bg-foreground/5 text-foreground/70 border-foreground/10 hover:bg-foreground/10"
                    )}
                  >
                    <div className="flex flex-col min-w-0 pr-1">
                      <span className="text-[12px] font-bold uppercase truncate">{opt.label}</span>
                      <span className={cn("text-[9px] font-bold uppercase", isSelected ? "text-background/70" : "text-foreground/40")}>{opt.tag}</span>
                    </div>
                    <DotRadio
                      selected={isSelected}
                      activeColor={isSelected ? "var(--background)" : "var(--accent-rehearsal)"}
                      inactiveColor="var(--border)"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider block mb-2 text-foreground/50">RECURRENCE</span>
            <div className="flex flex-wrap gap-2">
              {(['once', 'weekly', 'biweekly', 'monthly'] as const).map(freq => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setData(prev => ({ ...prev, recurrence: freq }))}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase border transition-all",
                    data.recurrence === freq
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-foreground/70 border-foreground/20 hover:border-foreground/40"
                  )}
                >
                  {freq === 'once' ? 'ONE TIME' : freq.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Members / Audience */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase text-foreground/50 tracking-wider">ATTENDING MEMBERS</span>
              <span className="text-[11px] font-bold text-foreground/50">
                {data.audienceIds.length === 0 ? `All (${data.members.length})` : `${data.audienceIds.length}/${data.members.length}`}
              </span>
            </div>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setData(prev => ({ ...prev, audienceIds: [] }))}
                className={cn(
                  "px-3 py-1 rounded-full text-[11px] font-bold uppercase border transition-all",
                  data.audienceIds.length === 0
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-foreground/70 border-foreground/20"
                )}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setData(prev => ({ ...prev, audienceIds: prev.members.map(m => m.id) }))}
                className={cn(
                  "px-3 py-1 rounded-full text-[11px] font-bold uppercase border transition-all",
                  data.audienceIds.length > 0
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-foreground/70 border-foreground/20"
                )}
              >
                Custom
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {data.members.map(m => {
                const isSelected = data.audienceIds.length === 0 || data.audienceIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleAudienceMember(m.id)}
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-foreground/10 hover:bg-foreground/5 text-left transition-colors"
                  >
                    <DotCheckbox
                      checked={isSelected}
                      activeColor="var(--accent-rehearsal)"
                      inactiveColor="var(--border)"
                    />
                    <div className="min-w-0 flex-1">
                      <span className={cn("text-xs font-bold block truncate", isSelected ? "text-foreground" : "text-foreground/40")}>{m.name}</span>
                      <span className="text-[9px] font-bold uppercase text-foreground/40">{m.role}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </RehearsalAccordionCard>

        {/* Section 2: Date, Time & Studio */}
        <RehearsalAccordionCard
          isOpen={!!expandedEditSections.when_where}
          onToggle={() => toggleEditSection('when_where')}
          stepNumber="02"
          title="DATE, TIME & STUDIO"
          summary={`${formatDate(data.date)} @ ${data.time} – ${endTime} • ${data.location || 'LOCATION TBD'}`}
          hasWarning={!data.location.trim() || data.location === 'TBD' || !data.date}
          warningLabel="NEEDS ATTENTION"
        >
          {/* Venue Location */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-foreground/50">LOCATION / STUDIO</span>
            <VenueAutocomplete
              value={data.location}
              onChange={val => setData(prev => ({ ...prev, location: val }))}
              onSelect={place => {
                const formatted = place.fullAddress || [place.address, place.city, place.postcode, place.country].filter(Boolean).join(', ');
                setData(prev => ({
                  ...prev,
                  location: place.name,
                  ...(formatted ? { address: formatted } : {}),
                }));
              }}
              placeholder="Venue or Studio Name"
              className="w-full bg-transparent border-b pb-2 text-[20px] font-bold uppercase focus:outline-none border-foreground/15 focus:border-foreground"
            />
          </div>

          {/* Address */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-foreground/50">ADDRESS</span>
            <input
              type="text"
              value={data.address}
              onChange={e => setData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full bg-transparent border-b pb-1.5 text-sm font-bold uppercase focus:outline-none border-foreground/15 focus:border-foreground"
              placeholder="Street, City, ZIP, Country"
            />
            {data.address && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {data.address.split(',').map((tag, i) => (
                  <span key={i} className="bg-foreground/10 text-foreground/70 rounded-[6px] px-2 py-0.5 text-[11px] font-bold uppercase">
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Calendar Picker */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-bold uppercase text-foreground tracking-wider">{calMonthName} {calYear}</span>
              <div className="flex gap-2">
                <button type="button" onClick={prevMonth} className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center text-foreground hover:bg-foreground/20 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button type="button" onClick={nextMonth} className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center text-foreground hover:bg-foreground/20 transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <div key={i} className="text-center text-[11px] font-bold text-foreground/30 py-1">{d}</div>
              ))}
              {calDays.map((day, i) => {
                const isSelected = day && calMonth === selectedMonth && calYear === selectedYear && day === selectedDay;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => day && selectCalendarDay(day)}
                    disabled={!day}
                    className={cn(
                      "h-9 rounded-full text-sm font-bold transition-all",
                      !day && "invisible",
                      isSelected
                        ? "bg-foreground text-background"
                        : day ? "text-foreground/70 hover:bg-foreground/10" : ""
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start & End Times */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase text-foreground/50 tracking-wider block mb-1">START TIME</span>
              <TimePicker
                value={data.time}
                onChange={val => setData(prev => ({ ...prev, time: val }))}
                textSize="text-[20px]"
                showIcon
                className="border-b pb-1.5 border-foreground/15 focus-within:border-foreground"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-foreground/50 tracking-wider block mb-1">END TIME</span>
              <TimePicker
                value={endTime}
                onChange={val => setEndTime(val)}
                textSize="text-[20px]"
                showIcon
                className="border-b pb-1.5 border-foreground/15 focus-within:border-foreground"
              />
            </div>
          </div>

          {/* Studio Cost & Split */}
          <div className="pt-2 border-t border-foreground/10">
            <span className="text-[10px] font-bold uppercase text-foreground/50 tracking-wider block mb-2">STUDIO COST</span>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setData(prev => ({ ...prev, venueType: 'free' }))}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 rounded-lg border font-bold text-xs uppercase transition-all",
                  data.venueType === 'free'
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-foreground/70 border-foreground/20"
                )}
              >
                <Home className="w-4 h-4" />
                Free
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setData(prev => ({ ...prev, venueType: 'paid' }))}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2.5 rounded-lg border font-bold text-xs uppercase transition-all",
                    data.venueType === 'paid'
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-foreground/70 border-foreground/20"
                  )}
                >
                  <Euro className="w-4 h-4" />
                  Paid
                </button>
              )}
            </div>

            {data.venueType === 'paid' && isAdmin && (
              <div className="p-4 rounded-xl bg-foreground/5 border border-foreground/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-foreground/40 block">TOTAL COST (€)</span>
                    <input
                      type="number"
                      value={data.totalCost}
                      onChange={e => setData(prev => ({ ...prev, totalCost: e.target.value }))}
                      className="bg-transparent text-[24px] font-bold focus:outline-none w-32 border-b border-foreground/20"
                      placeholder="0"
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-foreground/40 block">PER PERSON</span>
                    <span className="text-[18px] font-bold text-foreground">
                      €{(parseInt(data.totalCost || '0') / Math.max(data.audienceIds.length || data.members.length, 1)).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setData(prev => ({ ...prev, splitMethod: 'equal' }))}
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase border transition-all",
                      data.splitMethod === 'equal' ? "bg-foreground text-background border-foreground" : "bg-transparent text-foreground/70 border-foreground/20"
                    )}
                  >
                    Equal Split
                  </button>
                  <button
                    type="button"
                    onClick={() => setData(prev => ({ ...prev, splitMethod: 'custom' }))}
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase border transition-all",
                      data.splitMethod === 'custom' ? "bg-foreground text-background border-foreground" : "bg-transparent text-foreground/70 border-foreground/20"
                    )}
                  >
                    Custom
                  </button>
                </div>
              </div>
            )}
          </div>
        </RehearsalAccordionCard>

        {/* Section 3: Setlist & Proposals */}
        <RehearsalAccordionCard
          isOpen={!!expandedEditSections.setlist_proposals}
          onToggle={() => toggleEditSection('setlist_proposals')}
          stepNumber="03"
          title="SETLIST & PROPOSALS"
          summary={`${data.setlistSnapshotFinal?.songs.length || data.setlist.length} SONGS • ${data.proposals.length} PROPOSALS`}
        >
          {/* Active Setlist Card */}
          {data.setlistSnapshotFinal ? (
            <div
              className={cn(
                "rounded-[10px] p-4 cursor-pointer transition-all border",
                isSetlistConfirmed
                  ? "bg-accent/15 border-accent/40"
                  : "bg-foreground/5 border-foreground/15 hover:bg-foreground/10"
              )}
              onClick={() => setIsReviewSetlistOpen(true)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase text-foreground/50 tracking-wider">Active Setlist</span>
                <span className="text-[10px] font-bold uppercase text-foreground/40">Tap to edit</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-bold text-foreground leading-none">{data.setlistSnapshotFinal.songs.length}</span>
                <span className="text-xs font-bold text-foreground/40 uppercase">Songs</span>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="px-2 py-0.5 bg-foreground/10 text-foreground text-[10px] font-bold uppercase rounded-full">{totalDuration}</span>
                <span className="px-2 py-0.5 bg-foreground/10 text-foreground/60 text-[10px] font-bold uppercase rounded-full">
                  {data.setlistSnapshotFinal.sources.length} sources
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-xl border border-foreground/10 bg-foreground/5">
              <span className="text-xs font-bold uppercase text-foreground/50">No setlist attached</span>
              <button
                type="button"
                onClick={() => setSongPickerOpen(true)}
                className="px-3 py-1.5 bg-foreground text-background rounded-lg text-xs font-bold uppercase hover:opacity-90 transition-opacity"
              >
                + Add Songs
              </button>
            </div>
          )}

          {/* Pending queue if any */}
          {hasQueue && (
            <div className="bg-foreground/5 rounded-xl p-3 border border-foreground/10 space-y-2">
              <span className="text-[10px] font-bold uppercase text-foreground/50 tracking-wider block">
                Queue ({queueIds.length})
              </span>
              <div className="space-y-1">
                {queueIds.map((tid, i) => {
                  const t = templates.find(tp => tp.id === tid);
                  return (
                    <div key={`${tid}-${i}`} className="flex items-center justify-between bg-foreground/5 px-2.5 py-1.5 rounded-lg text-xs">
                      <span className="font-bold text-foreground truncate">{t?.name || 'Unknown'}</span>
                      <button type="button" onClick={() => handleRemoveFromQueue(i)} className="text-foreground/40 hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={handleBuildSnapshot}
                className="w-full py-2 bg-foreground text-background rounded-lg text-xs font-bold uppercase"
              >
                Merge into Setlist
              </button>
            </div>
          )}

          {/* Available setlists */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase text-foreground/50 tracking-wider">Available Setlists</span>
              <button
                type="button"
                onClick={() => openSetlistEditor(null)}
                className="text-[11px] font-bold uppercase text-foreground/60 hover:text-foreground flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> New Setlist
              </button>
            </div>
            <div className="space-y-1.5">
              {templates.slice(0, 4).map(template => {
                const inQueue = queueIds.includes(template.id);
                return (
                  <div key={template.id} className="p-2.5 rounded-lg border border-foreground/10 bg-foreground/[0.02] flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground truncate">{template.name} ({template.songIds.length})</span>
                    <button
                      type="button"
                      onClick={() => handleAddToQueue(template.id)}
                      className="px-2 py-1 rounded bg-foreground/10 hover:bg-foreground/15 text-[10px] font-bold uppercase text-foreground"
                    >
                      {inQueue ? 'Queued' : '+ Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Proposals */}
          <div className="pt-2 border-t border-foreground/10 flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-foreground/60">
              {data.proposals.length} Song Proposals
            </span>
            <button
              type="button"
              onClick={() => setIsProposeModalOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-foreground/20 text-xs font-bold uppercase text-foreground hover:bg-foreground/5"
            >
              + Propose Song
            </button>
          </div>
        </RehearsalAccordionCard>

        {/* Section 4: Gear, Checklists & Tasks */}
        <RehearsalAccordionCard
          isOpen={!!expandedEditSections.prep_tasks}
          onToggle={() => toggleEditSection('prep_tasks')}
          stepNumber="04"
          title="GEAR, CHECKLISTS & TASKS"
          summary={`${data.tasks.length} TASKS • ${checklistChecked.size} OF ${data.defaultChecklist.length} GEAR CHECKED`}
        >
          {/* Personal Checklist */}
          <div>
            <span className="text-[10px] font-bold uppercase text-foreground/50 tracking-wider block mb-2">MY GEAR CHECKLIST</span>
            <div className="grid grid-cols-2 gap-2">
              {data.defaultChecklist.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  className="flex items-center gap-2 p-2 rounded-lg border border-foreground/10 text-left hover:bg-foreground/5 transition-colors"
                  onClick={() => setChecklistChecked(prev => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i); else next.add(i);
                    return next;
                  })}
                >
                  <DotCheckbox
                    checked={checklistChecked.has(i)}
                    activeColor="var(--accent-rehearsal)"
                    inactiveColor="var(--border)"
                  />
                  <span className={cn("text-xs font-bold truncate", checklistChecked.has(i) ? "text-foreground" : "text-foreground/40")}>{item}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tasks List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase text-foreground/50 tracking-wider">TASKS ({data.tasks.length})</span>
              <button
                type="button"
                onClick={() => setIsAddTaskModalOpen(true)}
                className="text-[11px] font-bold uppercase text-foreground/60 hover:text-foreground flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Task
              </button>
            </div>

            {taskTemplatesDB.length > 0 && data.tasks.length === 0 && (
              <div className="mb-2">
                <span className="text-[9px] font-bold uppercase text-foreground/40 block mb-1">LOAD TEMPLATE</span>
                <div className="flex flex-wrap gap-1.5">
                  {taskTemplatesDB.map(tpl => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => loadTaskTemplate(tpl)}
                      className="px-2.5 py-1 rounded text-[10px] font-bold uppercase bg-foreground/10 text-foreground hover:bg-foreground/15"
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {data.tasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => openTaskEdit(task)}
                  className="p-2.5 rounded-lg border border-foreground/10 bg-foreground/[0.02] flex items-center justify-between cursor-pointer hover:bg-foreground/5"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-foreground truncate">{task.text}</p>
                    <span className="text-[9px] font-bold uppercase text-foreground/40">{task.type}</span>
                  </div>
                  <DotCheckbox
                    checked={task.completed}
                    activeColor="var(--accent-rehearsal)"
                    inactiveColor="var(--border)"
                  />
                </div>
              ))}
              {data.tasks.length === 0 && (
                <span className="text-xs text-foreground/40 italic block py-1">No tasks assigned yet.</span>
              )}
            </div>
          </div>
        </RehearsalAccordionCard>
      </div>
    );
  };

  // ── MAIN RENDER ───────────────────────────────────────────

  if (isEditing) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden"
        >
          <WizardAccentRail color={activeAccentColor} />

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-6 min-h-0">
            {renderEditAccordionView()}
          </div>

          {/* Sticky Footer for Edit */}
          <div className="px-4 pb-[max(env(safe-area-inset-bottom,12px),12px)] pt-4 shrink-0 border-t border-foreground/15 bg-background/95 backdrop-blur-md">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="bg-foreground/10 text-foreground rounded-[10px] py-4 font-bold text-sm uppercase tracking-wider hover:bg-foreground/15 transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4 text-foreground" />
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !data.title.trim() || !data.location.trim()}
                style={{
                  backgroundColor: (!data.title.trim() || !data.location.trim()) ? undefined : activeAccentColor,
                  color: (!data.title.trim() || !data.location.trim()) ? undefined : 'var(--accent-rehearsal-fg)',
                }}
                className={cn(
                  "rounded-[10px] py-4 font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                  (!data.title.trim() || !data.location.trim())
                    ? "bg-foreground/10 text-foreground/30 cursor-not-allowed"
                    : isSubmitting
                      ? "opacity-60 cursor-not-allowed"
                      : "hover:opacity-95 shadow-lg shadow-black/20 cursor-pointer"
                )}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <Check className="w-4 h-4" />
                SAVE REHEARSAL
              </button>
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
          bandId={selectedBand?.id}
          onSongCreated={(song) => {
            if (!library.find(s => s.id === song.id)) {
              setLibrary(prev => [song, ...prev]);
            }
          }}
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
          onUpdateSnapshot={handleUpdateSnapshot}
          onConfirmSetlist={handleConfirmSetlist}
          onDeselectSetlist={handleDeselectSetlist}
          isConfirmed={isSetlistConfirmed}
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
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden"
      >
        <WizardAccentRail color={activeAccentColor} />
        {/* Header */}
        <div className="px-4 pt-[env(safe-area-inset-top,12px)] shrink-0">
          {/* Interactive Step Indicator */}
          <div className="pt-2 mb-4">
            <InteractiveRehearsalStepIndicator
              current={step}
              total={STEPS.length}
              steps={STEPS}
              maxAccessibleStep={maxAccessibleStep}
              onSelectStep={(s) => setStep(s)}
              activeColor={activeAccentColor}
              inactiveColor="var(--border)"
            />
          </div>

          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-[12px] font-bold text-foreground/60 uppercase">
                NEW REHEARSAL
              </span>
              <h2 className="text-[32px] font-bold text-foreground leading-tight whitespace-pre-line">
                {STEPS[step].title}
              </h2>
              <p className="text-[16px] font-bold text-foreground/40 mt-0.5">
                {STEPS[step].subtitle}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canQuickSave && step < STEPS.length - 1 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  style={{
                    backgroundColor: activeAccentColor,
                    color: 'var(--accent-rehearsal-fg)',
                  }}
                  className="px-3.5 py-2 rounded-full text-[11px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 shadow-sm hover:opacity-95 cursor-pointer"
                  title="Create rehearsal now with current details"
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
                <X className="w-5 h-5 text-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          {step === 0 && renderTypeStep()}
          {step === 1 && renderDateLocationStep()}
          {step === 2 && renderRunlistProposalsStep()}
          {step === 3 && renderPreparationStep()}
          {step === 4 && renderReviewStep()}
        </div>

        {/* Footer */}
        <div className="px-4 pb-[max(env(safe-area-inset-bottom,12px),12px)] pt-4 shrink-0 border-t border-foreground/15 bg-background/95 backdrop-blur-md">
          <div className="grid grid-cols-2 gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={handleBack}
                className="bg-foreground/10 text-foreground rounded-[10px] py-4 font-bold text-sm uppercase tracking-wider hover:bg-foreground/15 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4 text-foreground" />
                BACK
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="bg-foreground/10 text-foreground rounded-[10px] py-4 font-bold text-sm uppercase tracking-wider hover:bg-foreground/15 transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4 text-foreground" />
                CANCEL
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!STEPS[step].skippable && !canProceed}
                style={{
                  backgroundColor: (STEPS[step].skippable || canProceed) ? activeAccentColor : undefined,
                  color: (STEPS[step].skippable || canProceed) ? 'var(--accent-rehearsal-fg)' : undefined,
                }}
                className={cn(
                  "rounded-[10px] py-4 font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                  (STEPS[step].skippable || canProceed)
                    ? "shadow-lg shadow-black/20 hover:opacity-95 cursor-pointer"
                    : "bg-foreground/10 text-foreground/30 cursor-not-allowed"
                )}
              >
                {STEPS[step].skippable ? (
                  (step === 2 && (data.setlist.length > 0 || data.proposals.length > 0)) ||
                  (step === 3 && data.tasks.length > 0) ? 'NEXT' : 'SKIP'
                ) : 'NEXT'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  backgroundColor: activeAccentColor,
                  color: 'var(--accent-rehearsal-fg)',
                }}
                className={cn(
                  "rounded-[10px] py-4 font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                  isSubmitting ? "opacity-60 cursor-not-allowed" : "hover:opacity-95 cursor-pointer"
                )}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                CREATE REHEARSAL
              </button>
            )}
          </div>

          {/* Secondary Quick Save option in footer on Steps 1, 2, 3 */}
          {canQuickSave && step < STEPS.length - 1 && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground/50 hover:text-foreground transition-colors py-1 cursor-pointer"
              >
                <span>⚡ Quick Save (Skip remaining steps)</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
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
        bandId={selectedBand?.id}
        onSongCreated={(song) => {
          if (!library.find(s => s.id === song.id)) {
            setLibrary(prev => [song, ...prev]);
          }
        }}
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
        onUpdateSnapshot={handleUpdateSnapshot}
        onConfirmSetlist={handleConfirmSetlist}
        onDeselectSetlist={handleDeselectSetlist}
        isConfirmed={isSetlistConfirmed}
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
