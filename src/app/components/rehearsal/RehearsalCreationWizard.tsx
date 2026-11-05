import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, MapPin, ArrowRight, ArrowLeft, Plus, AlertCircle,
  ChevronDown, X, Layers, Euro, Home, Guitar, Check, Loader2,
  Drum, Sliders, Mic, Edit3, Music2, CheckSquare, Sparkles, Users
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { DotRadio } from '@/app/components/ui/DotRadio';
import { SongPicker, type PickedSong } from '@/app/components/ui/SongPicker';
import { WizardAccentRail, getRehearsalAccentColor } from '@/app/components/ui/WizardAccentRail';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { TimePicker } from '@/app/components/ui/TimePicker';
import { DatePicker } from '@/app/components/ui/DatePicker';
import {
  RehearsalState,
  RehearsalType,
  RehearsalSong,
  SongProposal,
  RehearsalTask,
  RehearsalMember,
  SetlistTemplate,
  RehearsalSetlistSnapshotFinal,
  ProposalAttachment,
  RecurrenceType,
} from './types';
import { useBand } from '@/lib/BandContext';
import { getSongs, getSetlists, getSetlist, type Song, type Setlist } from '@/lib/services/songs';
import { supabase } from '@/lib/supabase';

import { RehearsalProposeSongModal } from './RehearsalProposeSongModal';
import { RehearsalAddTaskModal } from './RehearsalAddTaskModal';
import { RehearsalSetlistEditorModal } from './RehearsalSetlistEditorModal';
import { RehearsalEditProposalModal } from './RehearsalEditProposalModal';
import { RehearsalTaskDetailModal } from './RehearsalTaskDetailModal';
import { RehearsalReviewSetlistModal } from './RehearsalReviewSetlistModal';

interface TaskTemplateDB {
  id: string;
  name: string;
  category: string;
  tasks: { id: string; title: string; dueOffset: number; required: boolean }[];
}

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

const DEFAULT_CHECKLIST = ['Instrument', 'Cables', 'Tuner', 'Power Supply', 'Spare Strings/Sticks', 'Earplugs'];

const STEPS = [
  { id: 'session', title: 'SESSION & ROSTER' },
  { id: 'datetime', title: 'DATE & LOCATION' },
  { id: 'review', title: 'REVIEW & CONFIRM' },
];

const TYPE_OPTIONS: {
  value: RehearsalType;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'full_band', label: 'Full Band', subtitle: 'All members (4–8)', icon: Users },
  { value: 'vocals', label: 'Vocals', subtitle: 'Singers & harmonies', icon: Mic },
  { value: 'rhythm', label: 'Rhythm', subtitle: 'Drums & bass section', icon: Drum },
  { value: 'acoustic', label: 'Acoustic', subtitle: 'Unplugged & strings', icon: Guitar },
  { value: 'custom', label: 'Other', subtitle: 'Custom musician lineup', icon: Sliders },
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
  onOpenPollBuilder?: () => void;
}

// --- Interactive Step Indicator for Rehearsal ---
const InteractiveRehearsalStepIndicator: React.FC<{
  current: number;
  total: number;
  steps: { id?: string; title: string; subtitle?: string; skippable?: boolean }[];
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
                ? (activeColor || 'var(--wizard-accent)')
                : isAccessible
                  ? (activeColor || 'var(--wizard-accent)')
                  : (inactiveColor || 'var(--border)'),
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
      'rounded-2xl border transition-all overflow-hidden',
      hasWarning
        ? 'border-[var(--warning)]/50 bg-[var(--warning)]/5'
        : isOpen
          ? 'border-border/60 bg-card/60'
          : 'border-border/40 bg-card hover:border-border/60'
    )}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors cursor-pointer"
      >
        <div className="flex flex-col gap-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{stepNumber}</span>
            <span className="text-base font-bold uppercase text-[var(--fg)]">{title}</span>
            {hasWarning && (
              <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-[var(--warning)]/15 text-[var(--warning)] flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {warningLabel}
              </span>
            )}
          </div>
          <span className="text-xs font-medium uppercase text-muted-foreground truncate">
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
            <div className="px-5 pb-5 pt-2 border-t border-border/40 flex flex-col gap-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const RehearsalCreationWizard: React.FC<Props> = ({ onClose, onCreate, editingEvent, onOpenPollBuilder }) => {
  const { selectedBand, isAdmin } = useBand();
  const isEditing = !!editingEvent;
  const [step, setStep] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: authData }) => {
      if (authData?.user?.id) {
        setCurrentUserId(authData.user.id);
      }
    });
  }, []);

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

  const currentUserInitials = useMemo(() => {
    if (currentUserId) {
      const found = realMembers.find(m => m.id === currentUserId);
      if (found?.initials) return found.initials;
    }
    return realMembers[0]?.initials || 'ME';
  }, [currentUserId, realMembers]);

  // Modal state
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isSetlistEditorOpen, setIsSetlistEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SetlistTemplate | null>(null);
  const [isEditProposalOpen, setIsEditProposalOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<SongProposal | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RehearsalTask | null>(null);
  const [isReviewSetlistOpen, setIsReviewSetlistOpen] = useState(false);
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

  const [endTime, setEndTime] = useState(editingEvent?.endTime || '22:00');
  const [checklistChecked, setChecklistChecked] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRosterExpanded, setIsRosterExpanded] = useState(false);
  const [isSetlistExpanded, setIsSetlistExpanded] = useState(false);
  const [isTasksExpanded, setIsTasksExpanded] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

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
    venueType: editingEvent?.price && parseFloat(editingEvent.price) > 0 ? 'paid' : 'free',
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
    status: 'scheduled',
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

  // Smart default title helper
  const getEffectiveTitle = useCallback(() => {
    if (data.title && data.title.trim()) return data.title.trim();
    const opt = TYPE_OPTIONS.find(o => o.value === data.type);
    return opt ? `${opt.label} Rehearsal` : 'Rehearsal';
  }, [data.title, data.type]);

  // Navigation
  const handleSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const finalTitle = getEffectiveTitle();
    const submitData = {
      ...data,
      title: finalTitle,
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
    if (!data.title && !getEffectiveTitle()) w.push('title');
    return w;
  }, [editingEvent, data.location, data.date, data.title, getEffectiveTitle]);

  const maxAccessibleStep = useMemo(() => {
    if (isEditing) return 2;
    if (!data.location.trim() || !data.date) return 1;
    return 2;
  }, [isEditing, data.location, data.date]);

  const [expandedEditSections, setExpandedEditSections] = useState<Record<string, boolean>>(() => {
    return {
      basics: false,
      when_where: true,
      roster: false,
      setlist_proposals: false,
      prep_tasks: false,
    };
  });

  const toggleEditSection = (key: string) => {
    setExpandedEditSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const canProceed = (() => {
    switch (step) {
      case 0: return true;
      case 1: return data.location.trim() !== '' && !!data.date;
      case 2: return true;
      default: return true;
    }
  })();

  const totalDuration = useMemo(() => {
    const durations = data.setlistSnapshotFinal
      ? data.setlistSnapshotFinal.songs.map(s => s.durationAtSnapshot)
      : data.setlist.map(s => s.duration);

    let totalSecs = 0;
    durations.forEach(d => {
      if (!d) return;
      const parts = d.split(':').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        totalSecs += parts[0] * 60 + parts[1];
      }
    });

    if (totalSecs === 0) return '0m';
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.round((totalSecs % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }, [data.setlist, data.setlistSnapshotFinal]);

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
      name: 'Rehearsal Setlist',
      createdAt: existingSnapshot?.createdAt || new Date().toISOString(),
      createdBy: existingSnapshot?.createdBy || currentUserInitials,
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

  const handleAddNewTask = () => {
    if (!newTaskText.trim()) return;
    handleAddQuickTask(newTaskText.trim());
    setNewTaskText('');
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

  // ── STEP 0: SESSION & ROSTER ──────────────────────────────

  const renderSessionRosterStep = () => {
    const selectedCount = data.audienceIds.length === 0 ? data.members.length : data.audienceIds.length;
    const totalAvailable = data.members.length;

    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
        {/* Scheduling Mode Toggle */}
        {!isEditing && onOpenPollBuilder && isAdmin && (
          <div className="flex rounded-xl bg-card border border-border/40 p-1 gap-1 shadow-2xs">
            <button
              type="button"
              className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-[var(--wizard-accent)] text-white shadow-xs transition-colors cursor-pointer"
            >
              Schedule Directly
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPollBuilder();
              }}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-[var(--fg)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[var(--wizard-accent)]" />
              <span>Poll Band Availability</span>
            </button>
          </div>
        )}

        {/* Rehearsal Title */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            REHEARSAL TITLE <span className="text-xs font-normal text-muted-foreground/60 lowercase">(optional)</span>
          </label>
          <input
            type="text"
            value={data.title}
            onChange={e => setData(prev => ({ ...prev, title: e.target.value }))}
            placeholder={getEffectiveTitle()}
            className="w-full bg-transparent border-b border-border/40 pb-2 text-base font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:border-[var(--wizard-accent)] focus:outline-none transition-colors"
          />
        </div>

        {/* Compact Session Type 2-Column Grid */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2.5">
            SESSION TYPE
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            {TYPE_OPTIONS.map((opt, idx) => {
              const isSelected = data.type === opt.value;
              const Icon = opt.icon;
              const isLastOdd = idx === TYPE_OPTIONS.length - 1 && TYPE_OPTIONS.length % 2 !== 0;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    handleTypeChange(opt.value);
                    if (opt.value === 'custom') {
                      setIsRosterExpanded(true);
                    }
                  }}
                  className={cn(
                    'p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2',
                    isLastOdd && 'col-span-2 p-3',
                    isSelected
                      ? 'bg-[var(--wizard-accent)]/10 border-[var(--wizard-accent)] shadow-xs'
                      : 'bg-card/60 border-border/40 hover:border-border hover:bg-card'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                      isSelected ? 'bg-[var(--wizard-accent)] text-white' : 'bg-muted/60 text-muted-foreground'
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[var(--fg)] leading-tight">{opt.label}</div>
                      <div className="text-xs text-muted-foreground truncate leading-snug mt-0.5">{opt.subtitle}</div>
                    </div>
                  </div>
                  {isLastOdd && (
                    <DotRadio
                      selected={isSelected}
                      activeColor="var(--wizard-accent)"
                      inactiveColor="var(--border)"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Collapsible Roster Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              BAND ROSTER
            </span>
            {isRosterExpanded && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setData(prev => ({ ...prev, audienceIds: [] }))}
                  className="text-xs font-bold text-[var(--wizard-accent)] hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-muted-foreground text-xs">•</span>
                <button
                  type="button"
                  onClick={() => {
                    if (data.audienceIds.length === 0) {
                      setData(prev => ({ ...prev, audienceIds: prev.members.map(m => m.id) }));
                    }
                  }}
                  className="text-xs font-bold text-muted-foreground hover:text-[var(--fg)] cursor-pointer"
                >
                  Custom
                </button>
              </div>
            )}
          </div>

          {/* Compact Interactive Bar */}
          <div className="bg-card border border-border/40 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                {data.members.slice(0, 5).map(m => {
                  const isSelected = data.audienceIds.length === 0 || data.audienceIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center border-2 border-card transition-opacity',
                        isSelected
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground opacity-40'
                      )}
                      title={m.name}
                    >
                      {m.initials}
                    </div>
                  );
                })}
                {data.members.length > 5 && (
                  <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center border-2 border-card">
                    +{data.members.length - 5}
                  </div>
                )}
              </div>

              <span className="text-sm font-semibold text-[var(--fg)] truncate">
                {selectedCount} of {totalAvailable} Members Selected
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsRosterExpanded(!isRosterExpanded)}
              className="text-xs font-bold text-[var(--wizard-accent)] hover:opacity-80 flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
            >
              <span>{isRosterExpanded ? 'Collapse' : 'Customize'}</span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isRosterExpanded && 'rotate-180')} />
            </button>
          </div>

          {/* Expanded 1-Column Member List */}
          <AnimatePresence>
            {isRosterExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-1 pt-1"
              >
                <div className="divide-y divide-border/30 border-y border-border/30">
                  {data.members.map(member => {
                    const isSelected = data.audienceIds.length === 0 || data.audienceIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleAudienceMember(member.id)}
                        className="w-full flex items-center justify-between py-2.5 px-2 hover:bg-card/60 transition-colors text-left rounded-lg cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-3">
                          <DotCheckbox
                            checked={isSelected}
                            activeColor="var(--wizard-accent)"
                            inactiveColor="var(--border)"
                          />
                          <div className="min-w-0">
                            <span className={cn(
                              'text-sm font-medium truncate block leading-normal',
                              isSelected ? 'text-[var(--fg)] font-semibold' : 'text-muted-foreground'
                            )}>
                              {member.name}
                            </span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider block leading-normal">
                              {member.role || 'Member'}
                            </span>
                          </div>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-muted/60 text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0">
                          {member.initials}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  // ── STEP 1: DATE & LOCATION ───────────────────────────────

  const renderDateLocationStep = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
      {/* Unified Location Input */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
          LOCATION / STUDIO
        </label>
        <div className="relative">
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
            placeholder="Search venue or studio..."
            className="w-full bg-transparent border-b border-border/40 focus:border-[var(--wizard-accent)] pb-2 text-base font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:outline-none transition-colors pl-7"
          />
          <MapPin className="w-4 h-4 text-muted-foreground absolute left-0 bottom-3" />
        </div>

        {/* Quick-select chips */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {['Band HQ', 'Studio A', 'Home Studio', 'TBD'].map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setData(prev => ({ ...prev, location: loc }))}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer border',
                data.location === loc
                  ? 'bg-[var(--wizard-accent)] text-white border-[var(--wizard-accent)]'
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
            REHEARSAL DATE
          </label>
          <DatePicker
            value={data.date}
            onChange={d => setData(prev => ({ ...prev, date: d }))}
            accentColor={activeAccentColor}
            placeholder="Select rehearsal date..."
          />
        </div>

        {/* 2-Column Start Time and End Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
              START TIME
            </label>
            <TimePicker
              value={data.time}
              onChange={val => setData(prev => ({ ...prev, time: val }))}
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
                {data.duration}
              </span>
            </div>
            <TimePicker
              value={endTime}
              onChange={val => setEndTime(val)}
              textSize="text-base"
              showIcon
              className="border-b border-border/40 text-[var(--fg)] focus-within:border-[var(--wizard-accent)] transition-colors pb-1.5"
            />
          </div>
        </div>
      </div>

      {/* Single-Row 4-Column Recurrence */}
      <div>
        <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-2">
          RECURRENCE
        </label>
        <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
          {(['once', 'weekly', 'biweekly', 'monthly'] as const).map(freq => (
            <button
              key={freq}
              type="button"
              onClick={() => setData(prev => ({ ...prev, recurrence: freq }))}
              className={cn(
                'py-2 rounded-xl border transition-all text-center cursor-pointer',
                data.recurrence === freq
                  ? 'bg-[var(--wizard-accent)] text-white border-[var(--wizard-accent)] shadow-xs'
                  : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)] hover:border-border'
              )}
            >
              {freq === 'once' ? 'One Time' : freq.charAt(0).toUpperCase() + freq.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Venue Cost: 2-Column Toggle & Smooth Inline Input (Admin Only) */}
      {isAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
              VENUE COST
            </label>
            <div className="flex p-0.5 bg-card rounded-lg border border-border/40">
              <button
                type="button"
                onClick={() => setData(prev => ({ ...prev, venueType: 'free', totalCost: '0' }))}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-bold uppercase transition-all cursor-pointer',
                  data.venueType === 'free'
                    ? 'bg-[var(--wizard-accent)] text-white shadow-xs'
                    : 'text-muted-foreground hover:text-[var(--fg)]'
                )}
              >
                Free
              </button>
              <button
                type="button"
                onClick={() => setData(prev => ({ ...prev, venueType: 'paid' }))}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-bold uppercase transition-all cursor-pointer',
                  data.venueType === 'paid'
                    ? 'bg-[var(--wizard-accent)] text-white shadow-xs'
                    : 'text-muted-foreground hover:text-[var(--fg)]'
                )}
              >
                Paid
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
                <div className="bg-card rounded-xl border border-border/40 p-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Total Studio Cost</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-muted-foreground">€</span>
                    <input
                      type="number"
                      min="0"
                      value={data.totalCost}
                      onChange={e => setData(prev => ({ ...prev, totalCost: e.target.value }))}
                      className="w-24 bg-transparent border-b border-border/40 focus:border-[var(--wizard-accent)] pb-1 text-base font-bold text-[var(--fg)] text-right focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  // ── STEP 2: REVIEW & CONFIRM ──────────────────────────────

  const renderReviewExtrasStep = () => {
    const selectedCount = data.audienceIds.length === 0 ? data.members.length : data.audienceIds.length;
    const totalAvailable = data.members.length;
    const recurrenceLabel = data.recurrence === 'once' ? 'One-time' : data.recurrence.charAt(0).toUpperCase() + data.recurrence.slice(1);
    const typeLabel = TYPE_OPTIONS.find(o => o.value === data.type)?.label || 'Full Band';

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
        {/* Complete Logistics Summary Card */}
        <div className="bg-card rounded-2xl p-4 sm:p-5 border border-border/40 space-y-4 shadow-2xs">
          {/* Title & Badges */}
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--wizard-accent)]/15 text-[var(--wizard-accent)]">
                {typeLabel}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-muted text-muted-foreground">
                {recurrenceLabel}
              </span>
              {isAdmin && data.venueType === 'paid' && parseFloat(data.totalCost || '0') > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground flex items-center gap-1">
                  <Euro className="w-3 h-3" />
                  {data.totalCost}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                  Free Studio
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-[var(--fg)] tracking-tight">
              {getEffectiveTitle()}
            </h3>
          </div>

          {/* Date, Time, Duration */}
          <div className="flex items-start gap-3 text-sm text-[var(--fg)]">
            <Calendar className="w-4 h-4 text-[var(--wizard-accent)] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-semibold block leading-normal">
                {data.date ? formatDate(data.date) : 'Date TBD'}
              </span>
              <span className="text-xs text-muted-foreground font-medium block leading-normal">
                {data.time || '19:00'} – {endTime || '21:00'} ({data.duration || '2h'})
              </span>
            </div>
          </div>

          {/* Studio / Location */}
          <div className="flex items-start gap-3 text-sm text-[var(--fg)]">
            <MapPin className="w-4 h-4 text-[var(--wizard-accent)] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-semibold block truncate leading-normal">
                {data.location || 'Studio TBD'}
              </span>
            </div>
          </div>

          {/* Members Roster */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <Users className="w-4 h-4 text-[var(--wizard-accent)] shrink-0" />
              <span className="text-sm font-semibold text-[var(--fg)] truncate">
                {selectedCount} of {totalAvailable} Members Confirmed
              </span>
            </div>
            <div className="flex -space-x-1.5 overflow-hidden shrink-0 ml-2">
              {data.members
                .filter(m => data.audienceIds.length === 0 || data.audienceIds.includes(m.id))
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
              {selectedCount > 6 && (
                <div className="w-6 h-6 rounded-full bg-muted border-2 border-card text-xs font-bold flex items-center justify-center text-muted-foreground">
                  +{selectedCount - 6}
                </div>
              )}
            </div>
          </div>

          {/* Edit Jump Actions */}
          <div className="pt-3 border-t border-border/30 flex items-center justify-between text-xs font-bold text-[var(--wizard-accent)]">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Session & Roster</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Date & Studio</span>
            </button>
          </div>
        </div>

        {/* Optional Collapsible Section: Setlist & Song Proposals */}
        <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setIsSetlistExpanded(!isSetlistExpanded)}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[var(--wizard-accent)]/10 text-[var(--wizard-accent)] flex items-center justify-center shrink-0">
                <Music2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--fg)]">Setlist & Song Proposals</span>
                  <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Optional</span>
                </div>
                <span className="text-xs text-muted-foreground block truncate mt-0.5">
                  {data.setlist.length + data.proposals.length === 0
                    ? '0 Songs / No Setlist'
                    : `${data.setlist.length} song${data.setlist.length === 1 ? '' : 's'}${data.proposals.length > 0 ? `, ${data.proposals.length} proposed` : ''}`}
                </span>
              </div>
            </div>
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2', isSetlistExpanded && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {isSetlistExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 pb-4 border-t border-border/30 pt-3 space-y-3 overflow-hidden"
              >
                {/* Action Buttons Row */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSongPickerOpen(true)}
                    className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-xs font-bold text-[var(--fg)] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[var(--wizard-accent)]" />
                    <span>+ Add Songs</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (data.setlistSnapshotFinal) {
                        setIsReviewSetlistOpen(true);
                      } else {
                        openSetlistEditor(null);
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-xs font-bold text-[var(--fg)] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-[var(--wizard-accent)]" />
                    <span>Setlist Template</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsProposeModalOpen(true)}
                    className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-xs font-bold text-[var(--fg)] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[var(--wizard-accent)]" />
                    <span>+ Propose Song</span>
                  </button>
                </div>

                {/* Selected Songs List */}
                {data.setlist.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Selected Songs ({data.setlist.length})
                    </span>
                    <div className="divide-y divide-border/20 rounded-lg border border-border/30 bg-background/50 overflow-hidden">
                      {data.setlist.map((song, idx) => (
                        <div key={`${song.id}-${idx}`} className="flex items-center justify-between py-2 px-3 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className="text-xs font-bold text-muted-foreground w-4">{idx + 1}</span>
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-[var(--fg)] truncate block">{song.title}</span>
                              {song.artist && <span className="text-xs text-muted-foreground truncate block">{song.artist}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground font-medium">{song.duration}</span>
                            <button
                              type="button"
                              onClick={() => setData(prev => ({ ...prev, setlist: prev.setlist.filter((_, i) => i !== idx) }))}
                              className="p-1 text-muted-foreground hover:text-[var(--danger)] transition-colors cursor-pointer"
                              aria-label="Remove song"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Proposals List */}
                {data.proposals.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Proposed Songs ({data.proposals.length})
                    </span>
                    <div className="divide-y divide-border/20 rounded-lg border border-border/30 bg-background/50 overflow-hidden">
                      {data.proposals.map((prop, idx) => (
                        <div key={`${prop.id}-${idx}`} className="flex items-center justify-between py-2 px-3 hover:bg-muted/30 transition-colors">
                          <div className="min-w-0 pr-2">
                            <span className="text-sm font-medium text-[var(--fg)] truncate block">{prop.title}</span>
                            <span className="text-xs text-muted-foreground truncate block">{prop.artist} • By {prop.proposer}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setData(prev => ({ ...prev, proposals: prev.proposals.filter(p => p.id !== prop.id) }))}
                            className="p-1 text-muted-foreground hover:text-[var(--danger)] transition-colors cursor-pointer"
                            aria-label="Remove proposal"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.setlist.length === 0 && data.proposals.length === 0 && (
                  <div className="py-4 text-center">
                    <span className="text-xs text-muted-foreground">
                      No songs added yet. Add songs from your catalog or propose new tracks to rehearse.
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Optional Collapsible Section: Band Preparation Tasks */}
        <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setIsTasksExpanded(!isTasksExpanded)}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[var(--wizard-accent)]/10 text-[var(--wizard-accent)] flex items-center justify-center shrink-0">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--fg)]">Band Preparation Tasks</span>
                  <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Optional</span>
                </div>
                <span className="text-xs text-muted-foreground block truncate mt-0.5">
                  {data.tasks.length === 0 ? '0 Tasks' : `${data.tasks.length} task${data.tasks.length === 1 ? '' : 's'} assigned`}
                </span>
              </div>
            </div>
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2', isTasksExpanded && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {isTasksExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 pb-4 border-t border-border/30 pt-3 space-y-3 overflow-hidden"
              >
                {/* Quick Add Suggestion Chips */}
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                    Quick Add Suggestions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Bring chord charts',
                      'Set up PA early',
                      'Record audio',
                      'Review bridge vocal harmonies',
                      'Bring spare cables'
                    ].map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleAddQuickTask(suggestion)}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 text-[var(--fg)] border border-border/40 transition-colors cursor-pointer"
                      >
                        + {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Task Input */}
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
                        ? 'bg-[var(--wizard-accent)] text-white hover:opacity-90'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    )}
                  >
                    Add
                  </button>
                </div>

                {/* Tasks List */}
                {data.tasks.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Band Tasks ({data.tasks.length})
                    </span>
                    <div className="divide-y divide-border/20 rounded-lg border border-border/30 bg-background/50 overflow-hidden">
                      {data.tasks.map(task => (
                        <div key={task.id} className="flex items-center justify-between py-2 px-3 hover:bg-muted/30 transition-colors">
                          <span className="text-sm font-medium text-[var(--fg)] truncate pr-2">
                            {task.text}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 text-muted-foreground hover:text-[var(--danger)] transition-colors cursor-pointer shrink-0"
                            aria-label="Delete task"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center">
                    <span className="text-xs text-muted-foreground">
                      No tasks added. Add action items for the band to prepare ahead of time.
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  // ── ACCORDION EDIT VIEW (FOR isEditing === true) ───────────

  const renderEditAccordionView = () => {
    const queueIds = data.selectedTemplateIdsInOrder || [];
    const hasQueue = queueIds.length > 0;
    const selectedCount = data.audienceIds.length === 0 ? data.members.length : data.audienceIds.length;
    const totalAvailable = data.members.length;
    const isAllSelected = data.audienceIds.length === 0 || data.audienceIds.length === data.members.length;

    return (
      <div className="flex flex-col gap-5">
        {/* Warnings Banner */}
        {editingWarnings.length > 0 && (
          <div className="p-4 rounded-2xl bg-[var(--warning)]/10 border border-[var(--warning)]/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--warning)] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-[var(--warning)] uppercase tracking-wider">
                {editingWarnings.length} {editingWarnings.length === 1 ? 'FIELD NEEDS' : 'FIELDS NEED'} ATTENTION
              </span>
              <span className="text-xs font-medium text-muted-foreground">
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
          summary={`${data.type.replace('_', ' ').toUpperCase()} • ${data.recurrence === 'once' ? 'ONE TIME' : data.recurrence.toUpperCase()}`}
          hasWarning={!data.title.trim()}
          warningLabel="MISSING TITLE"
        >
          {/* Title */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5 text-muted-foreground">SESSION TITLE</label>
            <input
              type="text"
              value={data.title}
              onChange={e => setData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full bg-card border border-border/40 focus:border-[var(--wizard-accent)] rounded-xl px-4 py-3 text-base font-bold text-[var(--fg)] placeholder:text-muted-foreground/50 focus:outline-none transition-colors"
              placeholder={getEffectiveTitle()}
            />
          </div>

          {/* Type Selection */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider block mb-2.5 text-muted-foreground">SESSION TYPE</span>
            <div className="flex flex-col gap-2">
              {TYPE_OPTIONS.map(opt => {
                const isSelected = data.type === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleTypeChange(opt.value)}
                    className={cn(
                      'flex items-center justify-between p-3.5 rounded-xl border transition-colors text-left cursor-pointer',
                      isSelected
                        ? 'border-[var(--wizard-accent)] bg-[var(--wizard-accent)]/10'
                        : 'border-border/40 bg-card hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                        isSelected
                          ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)]'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-[var(--fg)] leading-snug">{opt.label}</span>
                        <span className="text-xs text-muted-foreground truncate">{opt.subtitle}</span>
                      </div>
                    </div>
                    <DotRadio
                      selected={isSelected}
                      activeColor="var(--wizard-accent)"
                      inactiveColor="var(--border)"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider block mb-2 text-muted-foreground">RECURRENCE</span>
            <div className="flex flex-wrap gap-2">
              {(['once', 'weekly', 'biweekly', 'monthly'] as const).map(freq => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setData(prev => ({ ...prev, recurrence: freq }))}
                  className={cn(
                    'px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase border transition-all cursor-pointer',
                    data.recurrence === freq
                      ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)] shadow-xs'
                      : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)] hover:border-border'
                  )}
                >
                  {freq === 'once' ? 'ONE TIME' : freq.toUpperCase()}
                </button>
              ))}
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
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5 text-muted-foreground">LOCATION / STUDIO</label>
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
              className="w-full bg-card border border-border/40 focus:border-[var(--wizard-accent)] rounded-xl px-4 py-3 text-base font-bold text-[var(--fg)] placeholder:text-muted-foreground/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Address */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5 text-muted-foreground">ADDRESS</label>
            <input
              type="text"
              value={data.address}
              onChange={e => setData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full bg-card border border-border/40 focus:border-[var(--wizard-accent)] rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--fg)] placeholder:text-muted-foreground/50 focus:outline-none transition-colors"
              placeholder="Street, City, ZIP, Country"
            />
            {data.address && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {data.address.split(',').map((tag, i) => (
                  <span key={i} className="bg-muted text-muted-foreground rounded-lg px-2.5 py-1 text-xs font-bold uppercase">
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Date & Time Group */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
                REHEARSAL DATE
              </label>
              <DatePicker
                value={data.date}
                onChange={d => setData(prev => ({ ...prev, date: d }))}
                accentColor={activeAccentColor}
                placeholder="Select rehearsal date..."
              />
            </div>

            {/* Start & End Times */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
                  START TIME
                </label>
                <TimePicker
                  value={data.time}
                  onChange={val => setData(prev => ({ ...prev, time: val }))}
                  textSize="text-base"
                  showIcon
                  className="border-b border-border/40 text-[var(--fg)] focus-within:border-[var(--wizard-accent)] transition-colors pb-1.5"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
                  END TIME
                </label>
                <TimePicker
                  value={endTime}
                  onChange={val => setEndTime(val)}
                  textSize="text-base"
                  showIcon
                  className="border-b border-border/40 text-[var(--fg)] focus-within:border-[var(--wizard-accent)] transition-colors pb-1.5"
                />
              </div>
            </div>
          </div>

          {/* Studio Cost & Split */}
          <div className="pt-2 border-t border-border/40">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-2">STUDIO COST</label>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <button
                type="button"
                onClick={() => setData(prev => ({ ...prev, venueType: 'free' }))}
                className={cn(
                  'flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-xs uppercase transition-all cursor-pointer',
                  data.venueType === 'free'
                    ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)] shadow-xs'
                    : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
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
                    'flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-xs uppercase transition-all cursor-pointer',
                    data.venueType === 'paid'
                      ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)] shadow-xs'
                      : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                  )}
                >
                  <Euro className="w-4 h-4" />
                  Paid
                </button>
              )}
            </div>

            {data.venueType === 'paid' && isAdmin && (
              <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase text-muted-foreground block">TOTAL COST (€)</span>
                    <input
                      type="number"
                      value={data.totalCost}
                      onChange={e => setData(prev => ({ ...prev, totalCost: e.target.value }))}
                      className="bg-transparent text-2xl font-bold focus:outline-none w-32 border-b border-border/40 focus:border-[var(--wizard-accent)] text-[var(--fg)]"
                      placeholder="0"
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold uppercase text-muted-foreground block">PER PERSON</span>
                    <span className="text-lg font-bold text-[var(--fg)]">
                      €{(parseInt(data.totalCost || '0') / Math.max(data.audienceIds.length || data.members.length, 1)).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setData(prev => ({ ...prev, splitMethod: 'equal' }))}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-bold uppercase border transition-all cursor-pointer',
                      data.splitMethod === 'equal'
                        ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                        : 'bg-card text-muted-foreground border-border/40'
                    )}
                  >
                    Equal Split
                  </button>
                  <button
                    type="button"
                    onClick={() => setData(prev => ({ ...prev, splitMethod: 'custom' }))}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-bold uppercase border transition-all cursor-pointer',
                      data.splitMethod === 'custom'
                        ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                        : 'bg-card text-muted-foreground border-border/40'
                    )}
                  >
                    Custom
                  </button>
                </div>
              </div>
            )}
          </div>
        </RehearsalAccordionCard>

        {/* Section 3: Band Roster (1-Column Vertical List) */}
        <RehearsalAccordionCard
          isOpen={!!expandedEditSections.roster}
          onToggle={() => toggleEditSection('roster')}
          stepNumber="03"
          title="BAND ROSTER"
          summary={`${selectedCount} OF ${totalAvailable} MUSICIANS SELECTED`}
        >
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setData(prev => ({ ...prev, audienceIds: [] }))}
              className={cn(
                'flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer',
                isAllSelected
                  ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)] shadow-xs'
                  : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
              )}
            >
              Select All ({totalAvailable})
            </button>
            <button
              type="button"
              onClick={() => {
                if (data.audienceIds.length === 0) {
                  setData(prev => ({ ...prev, audienceIds: prev.members.map(m => m.id) }));
                }
              }}
              className={cn(
                'flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer',
                !isAllSelected
                  ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)] shadow-xs'
                  : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
              )}
            >
              Custom
            </button>
          </div>

          <div className="flex flex-col divide-y divide-border/40 border-y border-border/40">
            {data.members.map(m => {
              const isSelected = data.audienceIds.length === 0 || data.audienceIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleAudienceMember(m.id)}
                  className="flex items-center justify-between py-3 px-1 hover:bg-card/60 transition-colors text-left rounded-xl cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    <DotCheckbox
                      checked={isSelected}
                      activeColor="var(--wizard-accent)"
                      inactiveColor="var(--border)"
                    />
                    <div className="min-w-0 flex-1">
                      <span className={cn('text-sm font-semibold block truncate leading-normal', isSelected ? 'text-[var(--fg)]' : 'text-muted-foreground')}>{m.name}</span>
                      <span className="text-xs font-medium uppercase text-muted-foreground leading-normal">{m.role || 'Member'}</span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0">
                    {m.initials}
                  </div>
                </button>
              );
            })}
          </div>
        </RehearsalAccordionCard>

        {/* Section 4: Setlist & Proposals */}
        <RehearsalAccordionCard
          isOpen={!!expandedEditSections.setlist_proposals}
          onToggle={() => toggleEditSection('setlist_proposals')}
          stepNumber="04"
          title="SETLIST & PROPOSALS"
          summary={`${data.setlistSnapshotFinal?.songs.length || data.setlist.length} SONGS • ${data.proposals.length} PROPOSALS`}
        >
          {/* Active Setlist Card */}
          {data.setlistSnapshotFinal ? (
            <div
              className={cn(
                'rounded-xl p-4 cursor-pointer transition-all border',
                isSetlistConfirmed
                  ? 'bg-[var(--wizard-accent)]/15 border-[var(--wizard-accent)]/40'
                  : 'bg-card border-border/40 hover:border-border/60'
              )}
              onClick={() => setIsReviewSetlistOpen(true)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Active Setlist</span>
                <span className="text-xs font-bold uppercase text-muted-foreground">Tap to edit</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[var(--fg)] leading-none">{data.setlistSnapshotFinal.songs.length}</span>
                <span className="text-xs font-bold text-muted-foreground uppercase">Songs</span>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="px-2 py-0.5 bg-muted text-[var(--fg)] text-xs font-bold uppercase rounded-full">{totalDuration}</span>
                <span className="px-2 py-0.5 bg-muted/60 text-muted-foreground text-xs font-bold uppercase rounded-full">
                  {data.setlistSnapshotFinal.sources.length} sources
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-card">
              <span className="text-xs font-bold uppercase text-muted-foreground">No setlist attached</span>
              <button
                type="button"
                onClick={() => setSongPickerOpen(true)}
                className="px-3 py-1.5 bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] rounded-lg text-xs font-bold uppercase hover:opacity-95 transition-opacity cursor-pointer"
              >
                + Add Songs
              </button>
            </div>
          )}

          {/* Pending queue if any */}
          {hasQueue && (
            <div className="bg-card rounded-xl p-3 border border-border/40 space-y-2">
              <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider block">
                Queue ({queueIds.length})
              </span>
              <div className="space-y-1">
                {queueIds.map((tid, i) => {
                  const t = templates.find(tp => tp.id === tid);
                  return (
                    <div key={`${tid}-${i}`} className="flex items-center justify-between bg-muted/40 px-2.5 py-1.5 rounded-lg text-xs">
                      <span className="font-bold text-[var(--fg)] truncate">{t?.name || 'Unknown'}</span>
                      <button type="button" onClick={() => handleRemoveFromQueue(i)} className="text-muted-foreground hover:text-[var(--destructive)]">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={handleBuildSnapshot}
                className="w-full py-2 bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] rounded-lg text-xs font-bold uppercase cursor-pointer"
              >
                Merge into Setlist
              </button>
            </div>
          )}

          {/* Available setlists */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Available Setlists</span>
              <button
                type="button"
                onClick={() => openSetlistEditor(null)}
                className="text-xs font-bold uppercase text-muted-foreground hover:text-[var(--fg)] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> New Setlist
              </button>
            </div>
            <div className="space-y-1.5">
              {templates.slice(0, 4).map(template => {
                const inQueue = queueIds.includes(template.id);
                return (
                  <div key={template.id} className="p-2.5 rounded-lg border border-border/40 bg-card flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--fg)] truncate">{template.name} ({template.songIds.length})</span>
                    <button
                      type="button"
                      onClick={() => handleAddToQueue(template.id)}
                      className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-xs font-bold uppercase text-[var(--fg)] cursor-pointer"
                    >
                      {inQueue ? 'Queued' : '+ Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Proposals */}
          <div className="pt-2 border-t border-border/40 flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-muted-foreground">
              {data.proposals.length} Song Proposals
            </span>
            <button
              type="button"
              onClick={() => setIsProposeModalOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-border/40 text-xs font-bold uppercase text-[var(--fg)] hover:bg-muted cursor-pointer"
            >
              + Propose Song
            </button>
          </div>
        </RehearsalAccordionCard>

        {/* Section 5: Gear, Checklists & Tasks */}
        <RehearsalAccordionCard
          isOpen={!!expandedEditSections.prep_tasks}
          onToggle={() => toggleEditSection('prep_tasks')}
          stepNumber="05"
          title="GEAR, CHECKLISTS & TASKS"
          summary={`${data.tasks.length} TASKS • ${checklistChecked.size} OF ${data.defaultChecklist.length} GEAR CHECKED`}
        >
          {/* Personal Checklist */}
          <div>
            <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-2">MY GEAR CHECKLIST</span>
            <div className="grid grid-cols-2 gap-2">
              {data.defaultChecklist.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  className="flex items-center gap-2 p-2 rounded-xl border border-border/40 text-left hover:bg-muted/40 transition-colors cursor-pointer"
                  onClick={() => setChecklistChecked(prev => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i); else next.add(i);
                    return next;
                  })}
                >
                  <DotCheckbox
                    checked={checklistChecked.has(i)}
                    activeColor="var(--wizard-accent)"
                    inactiveColor="var(--border)"
                  />
                  <span className={cn('text-xs font-semibold truncate', checklistChecked.has(i) ? 'text-[var(--fg)]' : 'text-muted-foreground')}>{item}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tasks List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">TASKS ({data.tasks.length})</span>
              <button
                type="button"
                onClick={() => setIsAddTaskModalOpen(true)}
                className="text-xs font-bold uppercase text-muted-foreground hover:text-[var(--fg)] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Task
              </button>
            </div>

            {taskTemplatesDB.length > 0 && data.tasks.length === 0 && (
              <div className="mb-2">
                <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1">LOAD TEMPLATE</span>
                <div className="flex flex-wrap gap-1.5">
                  {taskTemplatesDB.map(tpl => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => loadTaskTemplate(tpl)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-muted text-[var(--fg)] hover:bg-muted/80 cursor-pointer"
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
                  className="p-2.5 rounded-xl border border-border/40 bg-card flex items-center justify-between cursor-pointer hover:bg-muted/40"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-[var(--fg)] truncate">{task.text}</p>
                    <span className="text-xs font-medium uppercase text-muted-foreground">{task.type}</span>
                  </div>
                  <DotCheckbox
                    checked={task.completed}
                    activeColor="var(--wizard-accent)"
                    inactiveColor="var(--border)"
                  />
                </div>
              ))}
              {data.tasks.length === 0 && (
                <span className="text-xs text-muted-foreground italic block py-1">No tasks assigned yet.</span>
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
          data-wizard-type="rehearsal"
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
                  {data.type.replace('_', ' ').toUpperCase()}
                </span>
                {data.recurrence !== 'once' && (
                  <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-md bg-muted text-muted-foreground">
                    {data.recurrence.toUpperCase()}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold uppercase leading-tight text-[var(--fg)] truncate mt-1">
                {getEffectiveTitle()}
              </h1>
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                {formatDate(data.date)} @ {data.time} – {endTime} • {data.location || 'LOCATION TBD'}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close edit rehearsal modal"
              className="w-11 h-11 rounded-full border border-border/40 bg-card hover:bg-muted flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-[var(--fg)]" />
            </button>
          </div>

          {/* Scrollable Body Zone */}
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {renderEditAccordionView()}
          </div>

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
                onClick={handleSubmit}
                disabled={isSubmitting || !data.location.trim()}
                className={cn(
                  'rounded-xl py-4 font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2',
                  !data.location.trim()
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : isSubmitting
                      ? 'opacity-60 cursor-not-allowed bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)]'
                      : 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] hover:opacity-95 shadow-lg shadow-black/20 cursor-pointer'
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
        <RehearsalProposeSongModal
          isOpen={isProposeModalOpen}
          onClose={() => setIsProposeModalOpen(false)}
          currentUser={{ initials: currentUserInitials }}
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
          currentUserInitials={currentUserInitials}
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
        data-wizard-type="rehearsal"
        style={{ '--wizard-accent': activeAccentColor } as React.CSSProperties}
        className="fixed inset-0 z-[100] bg-[var(--bg)] flex flex-col h-full overflow-hidden"
      >
        <WizardAccentRail color={activeAccentColor} />

        {/* Top Header Zone (shrink-0) */}
        <div className="shrink-0 px-6 pb-3 border-b border-border/40 bg-[var(--bg)] z-10 flex flex-col gap-3" style={{ paddingTop: 'var(--wizard-header-pt, max(env(safe-area-inset-top, 0px), 56px))' }}>
          {/* Step indicator bar */}
          <div className="pt-1">
            <InteractiveRehearsalStepIndicator
              current={step}
              total={STEPS.length}
              steps={STEPS}
              maxAccessibleStep={maxAccessibleStep}
              onSelectStep={(s) => setStep(s)}
              activeColor="var(--wizard-accent)"
              inactiveColor="var(--border)"
            />
          </div>

          {/* Eyebrow + Title and Close button */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                NEW REHEARSAL
              </span>
              <h2 className="text-2xl font-bold tracking-tight leading-tight text-[var(--fg)] mt-0.5 truncate">
                {STEPS[step].title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close rehearsal wizard"
              className="w-10 h-10 rounded-full border border-border/40 bg-card hover:bg-muted flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-[var(--fg)]" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Zone */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 min-h-0">
          {step === 0 && renderSessionRosterStep()}
          {step === 1 && renderDateLocationStep()}
          {step === 2 && renderReviewExtrasStep()}
        </div>

        {/* Bottom Action Bar */}
        <div className="shrink-0 border-t border-border/40 px-6 pb-[max(env(safe-area-inset-bottom,16px),16px)] pt-4 bg-[var(--bg)]/95 backdrop-blur-md">
          <div className="grid grid-cols-2 gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={handleBack}
                className="bg-card text-[var(--fg)] border border-border/40 rounded-xl py-3.5 font-bold text-sm uppercase tracking-wider hover:bg-muted transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-[var(--fg)]" />
                BACK
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="bg-card text-[var(--fg)] border border-border/40 rounded-xl py-3.5 font-bold text-sm uppercase tracking-wider hover:bg-muted transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <X className="w-4 h-4 text-[var(--fg)]" />
                CANCEL
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed}
                className={cn(
                  'rounded-xl py-3.5 font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2',
                  canProceed
                    ? 'bg-[var(--wizard-accent)] text-white shadow-lg shadow-black/20 hover:opacity-95 cursor-pointer'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                NEXT
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  'rounded-xl py-3.5 font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-[var(--wizard-accent)] text-white shadow-lg shadow-black/20',
                  isSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-95 cursor-pointer'
                )}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                CREATE REHEARSAL
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Modals */}
      <RehearsalProposeSongModal
        isOpen={isProposeModalOpen}
        onClose={() => setIsProposeModalOpen(false)}
        currentUser={{ initials: currentUserInitials }}
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
        currentUserInitials={currentUserInitials}
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