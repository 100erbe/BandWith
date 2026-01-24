import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Music, Mic2, Calendar, MapPin, Clock, Repeat, DollarSign, Users, 
  ArrowRight, ArrowLeft, Plus, Trash2, FileText, Link, ThumbsUp, 
  ThumbsDown, MessageCircle, CheckCircle2, AlertCircle, Briefcase,
  Wrench, BookOpen, ChevronDown, Play, Search, X, Folder, ListMusic, History, Edit, Layers, ChevronUp, Copy, Paperclip, User, LayoutGrid,
  Euro, Home, Lock, Unlock, Guitar, Check
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { RehearsalState, RehearsalType, RehearsalSong, SongProposal, RehearsalTask, RehearsalMember, SetlistTemplate, RehearsalSetlistSnapshotFinal, ProposalAttachment, RecurrenceType } from './types';

// Modals
import { RehearsalCostModal } from './RehearsalCostModal';
import { RehearsalProposeSongModal } from './RehearsalProposeSongModal';
import { RehearsalAddTaskModal } from './RehearsalAddTaskModal';
import { RehearsalSetlistEditorModal } from './RehearsalSetlistEditorModal';
import { RehearsalEditProposalModal } from './RehearsalEditProposalModal';
import { RehearsalTaskDetailModal } from './RehearsalTaskDetailModal';

// Review Modals
import { RehearsalReviewSetlistModal } from './RehearsalReviewSetlistModal';
import { RehearsalReviewTasksModal } from './RehearsalReviewTasksModal';
import { RehearsalReviewProposalsModal } from './RehearsalReviewProposalsModal';
import { RehearsalReviewMembersModal } from './RehearsalReviewMembersModal';

// Mock Data
const ALL_MEMBERS: RehearsalMember[] = [
  { id: '1', name: 'Gianluca', role: 'Guitar', initials: 'GB', fee: '15', status: 'confirmed' },
  { id: '2', name: 'Centerbe', role: 'Drums', initials: 'CE', fee: '15', status: 'confirmed' },
  { id: '3', name: 'Marco', role: 'Bass', initials: 'MR', fee: '15', status: 'confirmed' },
  { id: '4', name: 'Luca', role: 'Vocals', initials: 'LB', fee: '15', status: 'confirmed' },
];

const MOCK_PROPOSALS: SongProposal[] = [
  { id: 'p1', title: 'Superstition', artist: 'Stevie Wonder', proposer: 'CE', reason: 'Great for funk set', votes: { yes: 3, no: 0, comments: 2 }, status: 'approved' },
  { id: 'p2', title: 'Cissy Strut', artist: 'The Meters', proposer: 'GB', reason: 'Classic instrumental', votes: { yes: 2, no: 1, comments: 4 }, status: 'pending' },
];

const SONG_LIBRARY: RehearsalSong[] = [
  { id: 's1', title: "Sweet Child O' Mine", artist: "Guns N' Roses", duration: "5:56", priority: 'high', type: 'song', category: 'Rock 80s' },
  { id: 's2', title: "Bohemian Rhapsody", artist: "Queen", duration: "6:07", priority: 'medium', type: 'song', category: 'Rock 70s' },
  { id: 's3', title: "Purple Rain", artist: "Prince", duration: "8:41", priority: 'high', type: 'song', category: 'Rock 80s' },
  { id: 's4', title: "Hotel California", artist: "Eagles", duration: "6:30", priority: 'low', type: 'song', category: 'Rock 70s' },
  { id: 's5', title: "Uptown Funk", artist: "Bruno Mars", duration: "4:30", priority: 'medium', type: 'song', category: 'Pop' },
  { id: 's6', title: "Billie Jean", artist: "Michael Jackson", duration: "4:54", priority: 'medium', type: 'song', category: 'Pop' },
  // Expanded Library for UX Testing
  { id: 's7', title: "Back in Black", artist: "AC/DC", duration: "4:15", priority: 'high', type: 'song', category: 'Rock 80s' },
  { id: 's8', title: "Thunderstruck", artist: "AC/DC", duration: "4:52", priority: 'high', type: 'song', category: 'Rock 80s' },
  { id: 's9', title: "Smells Like Teen Spirit", artist: "Nirvana", duration: "5:01", priority: 'high', type: 'song', category: 'Grunge' },
  { id: 's10', title: "Come as You Are", artist: "Nirvana", duration: "3:39", priority: 'medium', type: 'song', category: 'Grunge' },
  { id: 's11', title: "Enter Sandman", artist: "Metallica", duration: "5:31", priority: 'high', type: 'song', category: 'Metal' },
  { id: 's12', title: "Nothing Else Matters", artist: "Metallica", duration: "6:28", priority: 'medium', type: 'song', category: 'Metal' },
  { id: 's13', title: "Livin' on a Prayer", artist: "Bon Jovi", duration: "4:09", priority: 'high', type: 'song', category: 'Rock 80s' },
  { id: 's14', title: "You Give Love a Bad Name", artist: "Bon Jovi", duration: "3:42", priority: 'medium', type: 'song', category: 'Rock 80s' },
  { id: 's15', title: "Don't Stop Believin'", artist: "Journey", duration: "4:11", priority: 'high', type: 'song', category: 'Rock 80s' },
  { id: 's16', title: "Africa", artist: "Toto", duration: "4:55", priority: 'medium', type: 'song', category: 'Pop' },
  { id: 's17', title: "Take on Me", artist: "a-ha", duration: "3:45", priority: 'medium', type: 'song', category: 'Pop' },
  { id: 's18', title: "Every Breath You Take", artist: "The Police", duration: "4:13", priority: 'medium', type: 'song', category: 'Rock 80s' },
  { id: 's19', title: "Another One Bites the Dust", artist: "Queen", duration: "3:35", priority: 'high', type: 'song', category: 'Rock 80s' },
  { id: 's20', title: "Under Pressure", artist: "Queen & David Bowie", duration: "4:08", priority: 'medium', type: 'song', category: 'Rock 80s' },
  { id: 's21', title: "Comfortably Numb", artist: "Pink Floyd", duration: "6:21", priority: 'high', type: 'song', category: 'Rock 70s' },
  { id: 's22', title: "Wish You Were Here", artist: "Pink Floyd", duration: "5:34", priority: 'medium', type: 'song', category: 'Rock 70s' },
  { id: 's23', title: "Sultans of Swing", artist: "Dire Straits", duration: "5:47", priority: 'high', type: 'song', category: 'Rock 70s' },
  { id: 's24', title: "Money for Nothing", artist: "Dire Straits", duration: "8:26", priority: 'medium', type: 'song', category: 'Rock 80s' },
  { id: 's25', title: "Stairway to Heaven", artist: "Led Zeppelin", duration: "8:02", priority: 'high', type: 'song', category: 'Rock 70s' },
  { id: 's26', title: "Kashmir", artist: "Led Zeppelin", duration: "8:32", priority: 'medium', type: 'song', category: 'Rock 70s' },
  { id: 's27', title: "Whole Lotta Love", artist: "Led Zeppelin", duration: "5:34", priority: 'high', type: 'song', category: 'Rock 70s' },
  { id: 's28', title: "Black Dog", artist: "Led Zeppelin", duration: "4:54", priority: 'medium', type: 'song', category: 'Rock 70s' },
  { id: 's29', title: "Smoke on the Water", artist: "Deep Purple", duration: "5:40", priority: 'high', type: 'song', category: 'Rock 70s' },
  { id: 's30', title: "Highway Star", artist: "Deep Purple", duration: "6:05", priority: 'medium', type: 'song', category: 'Rock 70s' },
  { id: 's31', title: "Paranoid", artist: "Black Sabbath", duration: "2:48", priority: 'high', type: 'song', category: 'Metal' },
  { id: 's32', title: "Iron Man", artist: "Black Sabbath", duration: "5:56", priority: 'medium', type: 'song', category: 'Metal' },
  { id: 's33', title: "War Pigs", artist: "Black Sabbath", duration: "7:57", priority: 'medium', type: 'song', category: 'Metal' },
  { id: 's34', title: "Ace of Spades", artist: "Motörhead", duration: "2:49", priority: 'high', type: 'song', category: 'Metal' },
  { id: 's35', title: "Breaking the Law", artist: "Judas Priest", duration: "2:35", priority: 'high', type: 'song', category: 'Metal' },
  { id: 's36', title: "Painkiller", artist: "Judas Priest", duration: "6:06", priority: 'medium', type: 'song', category: 'Metal' },
  { id: 's37', title: "The Number of the Beast", artist: "Iron Maiden", duration: "4:51", priority: 'high', type: 'song', category: 'Metal' },
  { id: 's38', title: "Run to the Hills", artist: "Iron Maiden", duration: "3:53", priority: 'medium', type: 'song', category: 'Metal' },
  { id: 's39', title: "Fear of the Dark", artist: "Iron Maiden", duration: "7:18", priority: 'high', type: 'song', category: 'Metal' },
  { id: 's40', title: "Master of Puppets", artist: "Metallica", duration: "8:35", priority: 'high', type: 'song', category: 'Metal' },
  { id: 's41', title: "One", artist: "Metallica", duration: "7:27", priority: 'medium', type: 'song', category: 'Metal' },
  { id: 's42', title: "For Whom the Bell Tolls", artist: "Metallica", duration: "5:09", priority: 'medium', type: 'song', category: 'Metal' },
  { id: 's43', title: "Fade to Black", artist: "Metallica", duration: "6:57", priority: 'medium', type: 'song', category: 'Metal' },
  { id: 's44', title: "Welcome to the Jungle", artist: "Guns N' Roses", duration: "4:31", priority: 'high', type: 'song', category: 'Rock 80s' },
  { id: 's45', title: "Paradise City", artist: "Guns N' Roses", duration: "6:46", priority: 'medium', type: 'song', category: 'Rock 80s' },
  { id: 's46', title: "November Rain", artist: "Guns N' Roses", duration: "8:57", priority: 'medium', type: 'song', category: 'Rock 90s' },
  { id: 's47', title: "Jeremy", artist: "Pearl Jam", duration: "5:18", priority: 'medium', type: 'song', category: 'Grunge' },
  { id: 's48', title: "Alive", artist: "Pearl Jam", duration: "5:40", priority: 'medium', type: 'song', category: 'Grunge' },
  { id: 's49', title: "Black", artist: "Pearl Jam", duration: "5:44", priority: 'medium', type: 'song', category: 'Grunge' },
  { id: 's50', title: "Even Flow", artist: "Pearl Jam", duration: "4:53", priority: 'medium', type: 'song', category: 'Grunge' },
];

const MOCK_TEMPLATES: SetlistTemplate[] = [
    { 
        id: 't1', 
        name: 'Summer Tour 2025', 
        songIds: ['s1', 's2', 's5'], 
        version: 3, 
        updatedAt: '2025-08-15T10:00:00Z', 
        updatedBy: 'GB',
        lastChangeSummary: { added: 1, removed: 0 }
    },
    { 
        id: 't2', 
        name: 'Acoustic Set', 
        songIds: ['s4', 's3'], 
        version: 1, 
        updatedAt: '2025-09-01T14:30:00Z', 
        updatedBy: 'CE'
    }
];

const SUGGESTED_TASKS = ["Print runlist", "Bring cables", "Check PA system", "Record session"];
const DEFAULT_CHECKLIST = ["Instrument", "Cables", "Tuner", "Power Supply", "Spare Strings/Sticks", "Earplugs"];

interface Props {
  onClose: () => void;
  onCreate: (data: RehearsalState) => void;
}

export const RehearsalCreationWizard: React.FC<Props> = ({ onClose, onCreate }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  // Modals State
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  
  // New Setlist Editor Modal
  const [isSetlistEditorOpen, setIsSetlistEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SetlistTemplate | null>(null);

  // Proposal Edit Modal
  const [isEditProposalOpen, setIsEditProposalOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<SongProposal | null>(null);

  // Task Detail Modal
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RehearsalTask | null>(null);

  // Review Modals
  const [isReviewSetlistOpen, setIsReviewSetlistOpen] = useState(false);
  const [isReviewTasksOpen, setIsReviewTasksOpen] = useState(false);
  const [isReviewProposalsOpen, setIsReviewProposalsOpen] = useState(false);
  const [isReviewMembersOpen, setIsReviewMembersOpen] = useState(false);
  
  // Data State
  const [templates, setTemplates] = useState<SetlistTemplate[]>(MOCK_TEMPLATES);
  const [library, setLibrary] = useState<RehearsalSong[]>(SONG_LIBRARY);

  // Main State
  const [data, setData] = useState<RehearsalState>({
    type: 'full_band',
    title: 'Weekly Band Practice',
    location: 'Rehearsal Studios XYZ',
    address: 'Via Roma 123, Milano',
    date: '2026-01-27',
    time: '21:00',
    duration: '2h',
    recurrence: 'once',
    venueType: 'paid',
    showCost: false,
    totalCost: '60',
    splitMethod: 'equal',
    audienceIds: [], // Empty = All
    members: ALL_MEMBERS,
    setlist: [], // Legacy sync
    setlistSnapshotFinal: undefined,
    selectedTemplateIdsInOrder: [],
    proposals: MOCK_PROPOSALS,
    tasks: [],
    defaultChecklist: DEFAULT_CHECKLIST,
    personalChecklist: [],
    bandChecklist: ['PA System Check', 'Extension Cords', 'Backup Cables', 'First Aid Kit'],
    reminderTime: '1_day',
    status: 'draft'
  });

  // Helpers
  const nextStep = () => {
    if (step < totalSteps) setStep(s => s + 1);
    else onCreate(data);
  };
  
  const prevStep = () => {
    if (step > 1) setStep(s => s - 1);
    else onClose();
  };

  const totalDuration = useMemo(() => {
     // Mock calc
     return "1h 42m";
  }, [data.setlist]);

  const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleTypeChange = (newType: RehearsalType) => {
      setData(prev => ({ ...prev, type: newType }));
      // Pre-select logic
      if (newType !== 'full_band') {
          // Logic to pre-select relevant members could go here
      } else {
          setData(prev => ({ ...prev, audienceIds: [] })); // Reset to all
      }
  };

  const toggleAudienceMember = (memberId: string) => {
      setData(prev => {
          const currentIds = prev.audienceIds.length === 0 ? ALL_MEMBERS.map(m => m.id) : prev.audienceIds;
          const newIds = currentIds.includes(memberId) 
              ? currentIds.filter(id => id !== memberId)
              : [...currentIds, memberId];
          return { ...prev, audienceIds: newIds };
      });
  };

  // --- SETLIST LOGIC ---

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

      // Sync legacy list
      const legacySongs = mergedSongs.map(ms => library.find(s => s.id === ms.songId)).filter(Boolean) as RehearsalSong[];

      setData(prev => ({
          ...prev,
          setlistSnapshotFinal: snapshot,
          setlist: legacySongs
      }));
  };

  // --- PROPOSAL LOGIC ---
  
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

  // --- TASK LOGIC ---

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
      setData(prev => ({
          ...prev,
          tasks: prev.tasks.filter(t => t.id !== taskId)
      }));
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


  // --- RENDERERS ---

  const renderStepIndicator = () => (
    <div className="flex gap-1.5">
       {[1, 2, 3, 4, 5].map(s => (
           <div key={s} className={cn("w-2 h-2 rounded-full transition-colors", s === step ? "bg-black" : s < step ? "bg-black" : "bg-black/20")} />
       ))}
       <span className="ml-2 text-xs font-bold text-black/50">{step}/{totalSteps}</span>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-500 px-0.5 pb-4">
        {/* Rehearsal Type Selector - Swiss Editorial Cards */}
        <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 ml-1">Rehearsal Type</label>
            <div className="grid grid-cols-2 gap-4">
                {(['full_band', 'vocals', 'rhythm', 'acoustic'] as const).map(t => (
                    <button 
                        key={t}
                        onClick={() => handleTypeChange(t)}
                        className={cn(
                            "group relative overflow-hidden p-6 rounded-3xl border transition-all duration-300 flex flex-col items-start gap-4",
                            data.type === t ? "bg-black border-black text-white" : "bg-white/10 border-white/10 hover:bg-white/20 text-white/60"
                        )}
                    >
                        <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                            data.type === t ? "bg-[#D4FB46] text-black" : "bg-white/20 text-white/60 group-hover:text-white"
                        )}>
                            {t === 'full_band' ? <Music className="w-6 h-6" /> : 
                             t === 'vocals' ? <Mic2 className="w-6 h-6" /> : 
                             t === 'rhythm' ? <Guitar className="w-6 h-6" /> :
                             <Music className="w-6 h-6" />}
                        </div>
                        <span className={cn(
                            "text-lg font-black uppercase tracking-tight",
                            data.type === t ? "text-white" : "text-white/60 group-hover:text-white"
                        )}>{t.replace('_', ' ')}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* Title Input - Swiss Editorial Style */}
        <div className="group relative">
            <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Rehearsal Title</label>
            <input 
                type="text" 
                value={data.title}
                onChange={(e) => setData(prev => ({...prev, title: e.target.value}))}
                className="w-full bg-transparent border-b-2 border-white/20 py-2 text-3xl font-black text-white placeholder:text-white/20 focus:outline-none focus:border-white transition-all"
                placeholder="e.g. Weekly Practice"
            />
        </div>

        {/* Dynamic Members Display - Swiss Editorial Style */}
        <div className="space-y-4">
             <div className="flex justify-between items-center">
                 <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Who's Invited</label>
                 <span className="text-xs font-bold bg-black/30 px-3 py-1 rounded-full text-white/80">
                     {data.audienceIds.length === 0 ? 'All Members' : `${data.audienceIds.length} Selected`}
                 </span>
             </div>
             
             {data.type === 'full_band' ? (
                 <div className="flex items-center gap-4 bg-black/20 p-4 rounded-2xl border border-white/10">
                     <div className="flex -space-x-2">
                         {ALL_MEMBERS.map(m => (
                             <div key={m.id} className="w-10 h-10 rounded-full border-2 border-black bg-[#D4FB46] text-black flex items-center justify-center text-xs font-bold z-0 relative">
                                 {m.initials}
                             </div>
                         ))}
                     </div>
                     <span className="text-sm font-bold text-white">Entire Band Included</span>
                 </div>
             ) : (
                 <div className="grid grid-cols-2 gap-3">
                     {ALL_MEMBERS.map(m => {
                         const isSelected = data.audienceIds.length === 0 || data.audienceIds.includes(m.id);
                         return (
                             <button 
                                key={m.id}
                                onClick={() => toggleAudienceMember(m.id)}
                                className={cn(
                                    "group relative overflow-hidden p-4 rounded-2xl border transition-all duration-300 flex items-center gap-3",
                                    isSelected ? "bg-black border-black text-white" : "bg-white/10 border-white/10 hover:bg-white/20 text-white/60"
                                )}
                             >
                                 <div className={cn(
                                     "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                                     isSelected ? "bg-[#D4FB46] text-black" : "bg-white/20 text-white/60"
                                 )}>{m.initials}</div>
                                 <div className="text-left">
                                     <span className={cn("text-sm font-black block", isSelected ? "text-white" : "text-white/60 group-hover:text-white")}>{m.name}</span>
                                     <span className="text-[10px] font-bold uppercase text-white/40">{m.role}</span>
                                 </div>
                             </button>
                         );
                     })}
                 </div>
             )}
        </div>

        {/* Schedule & Location - Swiss Editorial Style */}
        <div className="space-y-8">
             {/* Date/Time Row */}
             <div className="grid grid-cols-2 gap-8">
                 <div className="group relative">
                    <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Date</label>
                    <input 
                        type="date" 
                        value={data.date} 
                        onChange={e => setData(prev => ({...prev, date: e.target.value}))} 
                        className="w-full bg-transparent border-b-2 border-white/20 py-2 text-xl font-bold text-white focus:outline-none focus:border-white transition-all" 
                    />
                </div>
                <div className="group relative">
                    <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Time</label>
                    <input 
                        type="time" 
                        value={data.time} 
                        onChange={e => setData(prev => ({...prev, time: e.target.value}))} 
                        className="w-full bg-transparent border-b-2 border-white/20 py-2 text-xl font-bold text-white focus:outline-none focus:border-white transition-all" 
                    />
                </div>
            </div>

            {/* Location */}
            <div className="group relative">
                <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Location</label>
                <div className="flex items-center gap-3 border-b-2 border-white/20 focus-within:border-white transition-colors py-2">
                    <MapPin className="w-5 h-5 text-white/40" />
                    <input 
                        value={data.location} 
                        onChange={e => setData(prev => ({...prev, location: e.target.value}))} 
                        placeholder="Venue Name / Address"
                        className="w-full bg-transparent text-xl font-bold text-white placeholder:text-white/20 focus:outline-none" 
                    />
                </div>
            </div>

            {/* Recurrence Selector */}
            <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Recurrence</label>
                <div className="flex gap-3">
                    {(['once', 'weekly', 'biweekly', 'monthly'] as const).map(freq => (
                        <button 
                            key={freq}
                            onClick={() => setData(prev => ({ ...prev, recurrence: freq as RecurrenceType }))}
                            className={cn(
                                "px-4 py-2 rounded-full text-xs font-bold uppercase transition-all",
                                data.recurrence === freq ? "bg-black text-[#D4FB46]" : "bg-white/10 text-white/60 hover:bg-white/20"
                            )}
                        >
                            {freq === 'once' ? 'One-time' : freq}
                        </button>
                    ))}
                </div>
                
                {data.recurrence !== 'once' && (
                     <div className="bg-black/20 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 border border-white/10">
                         <AlertCircle className="w-5 h-5 text-[#D4FB46] shrink-0 mt-0.5" />
                         <div className="text-sm font-medium text-white/80 leading-tight">
                             This event will repeat <strong className="text-white">{data.recurrence}</strong>. Future instances can be edited individually.
                         </div>
                     </div>
                )}
            </div>

            {/* Venue Type Toggle */}
            <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Venue Type</label>
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => setData(prev => ({ ...prev, venueType: 'free' }))}
                        className={cn(
                            "group relative overflow-hidden p-5 rounded-2xl border transition-all duration-300 flex items-center gap-3",
                            data.venueType === 'free' ? "bg-black border-black text-white" : "bg-white/10 border-white/10 hover:bg-white/20 text-white/60"
                        )}
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                            data.venueType === 'free' ? "bg-[#D4FB46] text-black" : "bg-white/20 text-white/60"
                        )}>
                            <Home className="w-5 h-5" />
                        </div>
                        <span className={cn("font-black uppercase", data.venueType === 'free' ? "text-white" : "text-white/60 group-hover:text-white")}>Free</span>
                    </button>
                    <button 
                        onClick={() => setData(prev => ({ ...prev, venueType: 'paid' }))}
                        className={cn(
                            "group relative overflow-hidden p-5 rounded-2xl border transition-all duration-300 flex items-center gap-3",
                            data.venueType === 'paid' ? "bg-black border-black text-white" : "bg-white/10 border-white/10 hover:bg-white/20 text-white/60"
                        )}
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                            data.venueType === 'paid' ? "bg-[#D4FB46] text-black" : "bg-white/20 text-white/60"
                        )}>
                            <Euro className="w-5 h-5" />
                        </div>
                        <span className={cn("font-black uppercase", data.venueType === 'paid' ? "text-white" : "text-white/60 group-hover:text-white")}>Paid</span>
                    </button>
                </div>
            </div>

            {/* Cost Calculator (if Paid) */}
            <AnimatePresence>
            {data.venueType === 'paid' && (
                <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                >
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-6 space-y-6">
                        <div className="group relative">
                            <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Total Cost (€)</label>
                            <input 
                                type="number"
                                value={data.totalCost}
                                onChange={e => setData(prev => ({...prev, totalCost: e.target.value}))}
                                placeholder="0"
                                className="w-full bg-transparent border-b-2 border-white/20 py-2 text-3xl font-black text-white placeholder:text-white/20 focus:outline-none focus:border-white transition-all"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                                 <button onClick={() => setData(prev => ({...prev, splitMethod: 'equal'}))} className={cn("px-4 py-2 rounded-full text-xs font-bold uppercase transition-all", data.splitMethod === 'equal' ? "bg-[#D4FB46] text-black" : "bg-white/10 text-white/60 hover:bg-white/20")}>Equal Split</button>
                                 <button onClick={() => setData(prev => ({...prev, splitMethod: 'custom'}))} className={cn("px-4 py-2 rounded-full text-xs font-bold uppercase transition-all", data.splitMethod === 'custom' ? "bg-[#D4FB46] text-black" : "bg-white/10 text-white/60 hover:bg-white/20")}>Custom</button>
                            </div>
                            {data.splitMethod === 'equal' && (
                                <div className="text-lg font-black text-white">
                                    €{(parseInt(data.totalCost || '0') / (data.audienceIds.length || data.members.length)).toFixed(2)} <span className="text-white/50 text-sm font-bold">/ person</span>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col px-0.5">
        
        {/* Main CTA - Swiss Editorial Style */}
        <button 
            onClick={() => openSetlistEditor(null)}
            className="w-full h-16 bg-black text-[#D4FB46] rounded-full font-black text-sm uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl flex items-center justify-center gap-3 flex-shrink-0"
        >
            <Plus className="w-5 h-5" /> Build new runlist template
        </button>

        {/* Selected Snapshot Display - Swiss Editorial Style */}
        {data.setlistSnapshotFinal ? (
            <div 
                className="bg-black border border-white/10 rounded-3xl p-8 flex flex-col gap-6 flex-shrink-0 shadow-2xl cursor-pointer hover:scale-[1.01] transition-all group relative overflow-hidden" 
                onClick={() => setIsReviewSetlistOpen(true)}
            >
                {/* Glow Effects */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-[#D4FB46] opacity-30 blur-[60px] rounded-full -mr-12 -mt-12 pointer-events-none" />

                <div className="relative z-10 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-[#D4FB46] mb-4">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="text-xs font-black uppercase tracking-widest">Active Snapshot</span>
                        </div>
                        <div className="text-5xl font-black text-white leading-none mb-3">{data.setlistSnapshotFinal.songs.length} Songs</div>
                        <div className="flex items-center gap-3 mt-4">
                             <span className="px-4 py-2 bg-[#D4FB46] text-black text-xs font-black uppercase rounded-full">
                                {totalDuration}
                             </span>
                             <span className="px-4 py-2 bg-white/10 text-white/80 text-xs font-bold uppercase rounded-full flex items-center gap-2">
                                <Layers className="w-4 h-4" /> {data.setlistSnapshotFinal.sources.length} sources
                             </span>
                        </div>
                    </div>
                    <div className="p-4 bg-white/10 rounded-2xl text-white group-hover:bg-[#D4FB46] group-hover:text-black transition-colors">
                        <ListMusic className="w-8 h-8" />
                    </div>
                </div>
                
                <div className="relative z-10 flex items-center justify-between pt-6 border-t border-white/10">
                     <span className="text-xs font-bold uppercase text-white/50 group-hover:text-white transition-colors flex items-center gap-2">
                         Tap to preview snapshot <ArrowRight className="w-4 h-4" />
                     </span>
                     {data.setlistSnapshotFinal.mergeReport.totalDuplicatesSkipped > 0 && (
                         <span className="text-xs font-bold text-[#D4FB46] flex items-center gap-2">
                             <AlertCircle className="w-4 h-4" />
                             {data.setlistSnapshotFinal.mergeReport.totalDuplicatesSkipped} duplicates merged
                         </span>
                     )}
                </div>
            </div>
        ) : (
            // Queue Display - Swiss Editorial Style
            (data.selectedTemplateIdsInOrder || []).length > 0 && (
                <div className="bg-black/30 border border-white/10 rounded-3xl p-6 flex-shrink-0">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 mb-4">Runlist Templates (in order)</h3>
                    <div className="space-y-3 mb-6">
                        {data.selectedTemplateIdsInOrder!.map((tid, i) => {
                            const t = templates.find(tp => tp.id === tid);
                            return (
                                <div key={`${tid}-${i}`} className="flex items-center justify-between bg-white/10 p-4 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-full bg-[#D4FB46] text-black text-sm font-black flex items-center justify-center">{i+1}</div>
                                        <span className="font-bold text-white">{t?.name || 'Unknown'}</span>
                                    </div>
                                    <button onClick={() => handleRemoveFromQueue(i)} className="text-white/40 hover:text-red-400 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <button 
                        onClick={handleBuildSnapshot}
                        className="w-full h-14 bg-[#D4FB46] text-black rounded-full text-sm font-black uppercase flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform shadow-lg"
                    >
                        <Layers className="w-5 h-5" /> Build rehearsal runlist
                    </button>
                </div>
            )
        )}

        {/* Templates List - Swiss Editorial Style */}
        <div className="flex-1 overflow-y-auto custom-scrollbar -mr-2 pr-2 min-h-0">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 mb-4 sticky top-0 bg-[#0047FF] z-10 py-3">Available Templates</h3>
            <div className="space-y-4">
                {templates.map(template => (
                    <div 
                        key={template.id}
                        className="w-full text-left p-6 bg-white/10 rounded-3xl border border-white/10 hover:border-white/30 hover:bg-white/15 transition-all group relative overflow-hidden"
                    >
                        <div onClick={() => openSetlistEditor(template)} className="cursor-pointer">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-black text-xl text-white group-hover:translate-x-1 transition-transform">{template.name}</h4>
                                <span className="px-3 py-1 text-xs font-bold uppercase bg-white/20 rounded-full text-white/70">v{template.version}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-bold text-white/50 mb-4">
                                <span className="flex items-center gap-2"><ListMusic className="w-4 h-4" /> {template.songIds.length} Songs</span>
                                <span className="flex items-center gap-2"><History className="w-4 h-4" /> {new Date(template.updatedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                        
                        {/* Action: Add to Rehearsal Setlist */}
                        <button 
                            onClick={() => handleAddToQueue(template.id)}
                            className="w-full py-3 bg-black/30 border border-white/10 rounded-full text-xs font-bold uppercase text-white hover:bg-black hover:text-[#D4FB46] transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add to runlist queue
                        </button>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );

  const renderStep3 = () => (
    // PROPOSALS - Swiss Editorial Style
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col px-0.5">
        <div className="flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-3">
                <span className="text-4xl font-black text-white">{data.proposals.length}</span>
                <span className="text-sm font-bold uppercase text-white/50">Proposals</span>
            </div>
            <button 
                onClick={() => setIsProposeModalOpen(true)}
                className="px-6 py-3 rounded-full font-black text-sm uppercase bg-black text-[#D4FB46] hover:scale-105 transition-transform shadow-lg flex items-center gap-2"
            >
                <Plus className="w-4 h-4" /> Propose New
            </button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar -mr-2 pr-2">
            {data.proposals.map(prop => (
                <div key={prop.id} className="p-6 bg-black/30 rounded-3xl border border-white/10 hover:border-white/30 transition-all flex flex-col gap-4 relative">
                    
                    {/* Header Row: Title/Artist + Status Badge + Edit Action */}
                    <div className="flex justify-between items-start">
                        <div className="flex-1 pr-4">
                            <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-black text-xl text-white leading-none">{prop.title}</h4>
                                {prop.status === 'new' && <span className="px-2 py-1 bg-[#D4FB46] text-black text-[10px] font-black uppercase rounded-full">NEW</span>}
                            </div>
                            <span className="text-sm font-bold uppercase text-white/40">{prop.artist}</span>
                        </div>
                        
                        <div className="flex flex-col items-end gap-3 shrink-0">
                             <span className={cn("px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-full", prop.status === 'approved' ? "bg-green-500/30 text-green-300" : "bg-white/10 text-white/50")}>
                                {prop.status === 'approved' ? "Approved" : "Pending"}
                            </span>
                            <button 
                                onClick={() => openProposalEdit(prop)}
                                className="px-3 py-1.5 bg-white/10 rounded-full text-xs font-bold uppercase text-white/60 hover:text-white hover:bg-white/20 transition-all"
                            >
                                Edit Details
                            </button>
                        </div>
                    </div>

                    {/* Reason Box + Attachments */}
                    <div className="bg-white/10 rounded-2xl p-4 border border-white/5">
                        <p className="text-sm font-medium text-white/70 italic mb-3">"{prop.reason}"</p>
                        
                        <div className="flex items-center gap-3 text-xs font-bold text-white/40 mb-3 border-b border-white/10 pb-3">
                            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white/80 text-[10px] font-bold">{prop.proposer}</div>
                            <span>Proposed 2 days ago</span>
                        </div>

                        {/* Attachments Preview */}
                        <div className="flex flex-wrap gap-2">
                             {(!prop.attachments || prop.attachments.length === 0) && (
                                 <span className="text-xs font-bold text-white/30 italic">No attachments</span>
                             )}
                             {prop.attachments?.map((att, i) => (
                                <div key={i} className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-full hover:bg-white/20 text-xs font-bold text-white/60 transition-colors">
                                    {att.type === 'link' ? <Link className="w-4 h-4 shrink-0" /> : <Paperclip className="w-4 h-4 shrink-0" />}
                                    <span className="truncate max-w-[120px]">{att.label || 'Attachment'}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                         {/* Votes */}
                        <div className="flex gap-4 text-sm font-bold">
                            <span className="flex items-center gap-2 text-white"><ThumbsUp className="w-4 h-4" /> {prop.votes.yes}</span>
                            <span className="flex items-center gap-2 text-white/40"><ThumbsDown className="w-4 h-4" /> {prop.votes.no}</span>
                            <span className="flex items-center gap-2 text-white/40"><MessageCircle className="w-4 h-4" /> {prop.votes.comments}</span>
                        </div>
                    </div>

                    {/* Gated Actions */}
                    {prop.status === 'approved' ? (
                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                            <button className="py-3 rounded-full border-2 border-white/20 hover:border-white text-white text-xs font-black uppercase transition-all">
                                Add to Repertoire
                            </button>
                            <button className="py-3 rounded-full bg-[#D4FB46] text-black text-xs font-black uppercase transition-all shadow-md hover:scale-[1.02]">
                                Add to Rehearsal
                            </button>
                        </div>
                    ) : (
                        <div className="pt-4 border-t border-white/10 text-center">
                            <span className="text-xs font-bold uppercase text-white/40 flex items-center justify-center gap-2">
                                <Clock className="w-4 h-4" /> Awaiting approval to be added
                            </span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
  );

  const renderStep4 = () => {
    // PREP (Tasks) - Swiss Editorial Style
    const bandTasks = data.tasks.filter(t => t.assignedTo.includes('all'));
    const assignedTasks = data.tasks.filter(t => !t.assignedTo.includes('all'));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col px-0.5 pb-4">
            <div>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <span className="text-4xl font-black text-white">{data.tasks.length}</span>
                        <span className="text-sm font-bold uppercase text-white/50">Tasks</span>
                    </div>
                    <button 
                        onClick={() => setIsAddTaskModalOpen(true)}
                        className="px-6 py-3 rounded-full font-black text-sm uppercase bg-black text-[#D4FB46] hover:scale-105 transition-transform shadow-lg flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Add Task
                    </button>
                </div>
                
                {/* Empty State */}
                {data.tasks.length === 0 && (
                     <div className="bg-black/30 rounded-3xl p-8 text-center border border-white/10 border-dashed mb-6">
                         <div className="w-16 h-16 rounded-full bg-white/10 mx-auto flex items-center justify-center mb-4">
                             <CheckCircle2 className="w-8 h-8 text-white/30" />
                         </div>
                         <h4 className="font-bold text-lg text-white mb-2">No tasks yet</h4>
                         <p className="text-sm text-white/50 mb-6">Add preparation tasks for the band</p>
                         <button 
                             onClick={() => setIsAddTaskModalOpen(true)}
                             className="px-6 py-3 bg-[#D4FB46] text-black rounded-full text-sm font-black uppercase"
                         >
                             Add your first task
                         </button>
                     </div>
                )}

                {/* Suggested Tasks Chips */}
                {data.tasks.length === 0 && (
                     <div className="flex flex-wrap gap-3 mb-6">
                         {SUGGESTED_TASKS.map(t => (
                             <button 
                                key={t} 
                                onClick={() => handleAddQuickTask(t)}
                                className="px-4 py-2 bg-white/10 hover:bg-black hover:text-[#D4FB46] rounded-full text-xs font-bold uppercase transition-colors text-white/70"
                             >
                                 + {t}
                             </button>
                         ))}
                     </div>
                )}
                
                <div className="space-y-6">
                    {/* Band Tasks */}
                    {bandTasks.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 mb-4 flex items-center gap-2"><Users className="w-4 h-4" /> Band Tasks ({bandTasks.length})</h4>
                            <div className="bg-black/30 rounded-3xl overflow-hidden border border-white/10 divide-y divide-white/10">
                                {bandTasks.map(task => (
                                    <div onClick={() => openTaskEdit(task)} key={task.id} className="p-5 flex items-start gap-4 hover:bg-white/5 transition-colors cursor-pointer group">
                                        <div className="mt-1 w-5 h-5 rounded-full border-2 border-white/30" />
                                        <div className="flex-1">
                                            <p className="text-base font-bold text-white leading-tight">{task.text}</p>
                                            <div className="flex gap-3 mt-2">
                                                <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold uppercase text-white/60">Band</span>
                                                <span className="text-xs font-bold uppercase text-white/40">{task.type}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Assigned Tasks */}
                    {assignedTasks.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 mb-4 flex items-center gap-2"><User className="w-4 h-4" /> Assigned Tasks ({assignedTasks.length})</h4>
                            <div className="bg-black/30 rounded-3xl overflow-hidden border border-white/10 divide-y divide-white/10">
                                {assignedTasks.map(task => {
                                    const assigneeInitials = task.assignedTo.slice(0, 2).map(id => data.members.find(m => m.id === id)?.initials).join('+');
                                    
                                    return (
                                        <div onClick={() => openTaskEdit(task)} key={task.id} className="p-5 flex items-start gap-4 hover:bg-white/5 transition-colors cursor-pointer group">
                                            <div className="w-8 h-8 rounded-full bg-[#D4FB46] text-black text-xs font-bold flex items-center justify-center shrink-0">{assigneeInitials}</div>
                                            <div className="flex-1">
                                                <p className="text-base font-bold text-white leading-tight">{task.text}</p>
                                                <div className="flex gap-3 mt-2">
                                                    <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold uppercase text-white/60">
                                                        {task.assignedTo.length > 1 ? `${task.assignedTo.length} members` : data.members.find(m => m.id === task.assignedTo[0])?.name}
                                                    </span>
                                                    <span className="text-xs font-bold uppercase text-white/40">{task.type}</span>
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
            
            {/* My Checklist - Swiss Editorial Style */}
            <div className="space-y-4">
                 <div className="flex items-center justify-between">
                     <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">My Checklist</h3>
                     <span className="px-3 py-1 bg-black/30 text-white/70 text-xs font-bold rounded-full flex items-center gap-2"><User className="w-3 h-3" /> Personal</span>
                 </div>
                 <div className="bg-black/30 rounded-3xl border border-white/10 p-6 grid grid-cols-2 gap-4">
                    {data.defaultChecklist.map((item, i) => (
                        <label key={i} className="flex items-center gap-3 cursor-pointer group">
                            <div className="w-5 h-5 rounded-full border-2 border-white/30 group-hover:border-white group-hover:bg-white/10 transition-all flex items-center justify-center">
                                <Check className="w-3 h-3 opacity-0 group-hover:opacity-50 text-white" />
                            </div>
                            <span className="text-sm font-bold text-white/70 group-hover:text-white transition-colors">{item}</span>
                        </label>
                    ))}
                 </div>
            </div>

            {/* Band Essentials - Swiss Editorial Style */}
            <div className="relative">
                <div className="bg-[#D4FB46] rounded-3xl p-6 space-y-4 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-black">
                            <Briefcase className="w-5 h-5" />
                            <h3 className="text-sm font-black uppercase tracking-wider">Band Essentials</h3>
                        </div>
                        <div className="flex items-center gap-2 bg-black/10 px-3 py-1.5 rounded-full text-xs font-bold uppercase text-black/60">
                            <Lock className="w-3 h-3" /> Admin Only
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        {data.bandChecklist?.map((item, i) => (
                             <div key={i} className="flex items-center gap-3 text-sm font-bold text-black/70">
                                 <div className="w-2 h-2 rounded-full bg-black/30" />
                                 {item}
                             </div>
                        ))}
                    </div>
                    
                    <div className="pt-4 border-t border-black/10 text-xs font-medium text-black/50 text-center italic">
                        These items are required for every rehearsal.
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderStep5 = () => {
    // REVIEW - Swiss Editorial Style
    const approvedProposals = data.proposals.filter(p => p.status === 'approved').length;
    const pendingProposals = data.proposals.length - approvedProposals;
    const confirmedMembers = data.members.filter(m => m.status === 'confirmed').length;
    const tasksForMe = data.tasks.filter(t => t.assignedTo.includes('all') || t.assignedTo.includes('1')).length; 
    
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 h-full flex flex-col custom-scrollbar -mr-4 pr-4 px-0.5 pb-4">
            
            {/* HERO CARD - Swiss Editorial Style */}
            <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="bg-black text-white rounded-3xl p-8 relative overflow-hidden group shrink-0 shadow-2xl"
            >
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4FB46] opacity-30 blur-[80px] rounded-full -mr-20 -mt-20 pointer-events-none" />
                
                <div className="relative z-10 space-y-8">
                    {/* Top Badges */}
                    <div className="flex justify-between items-start">
                        <div className="flex gap-3">
                             <div className="flex items-center gap-2 px-4 py-2 bg-[#D4FB46] text-black text-xs font-black uppercase rounded-full tracking-widest">
                                {data.type === 'full_band' ? <Music className="w-4 h-4" /> : <Mic2 className="w-4 h-4" />}
                                {data.type.replace('_', ' ')}
                            </div>
                            {data.recurrence !== 'once' && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white text-xs font-black uppercase rounded-full tracking-widest">
                                    <Repeat className="w-4 h-4" /> {data.recurrence}
                                </div>
                            )}
                        </div>
                        {data.venueType === 'paid' && (
                            <div className="text-3xl font-black text-white tabular-nums">€{data.totalCost}</div>
                        )}
                    </div>

                    {/* Title */}
                    <div>
                         <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-[0.9] max-w-[90%] mb-4">{data.title}</h2>
                         <div className="flex items-center gap-4 text-white/60">
                             <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                                 <Calendar className="w-4 h-4" /> {formatDate(data.date)}
                             </div>
                             <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                             <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                                 <Clock className="w-4 h-4" /> {data.time} ({data.duration})
                             </div>
                         </div>
                    </div>

                    {/* Footer Info */}
                    <div className="flex justify-between items-end pt-6 border-t border-white/10">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase text-white/40 tracking-widest">
                                <MapPin className="w-4 h-4" /> Location
                            </div>
                            <div className="font-bold text-lg text-white">{data.location}</div>
                        </div>

                        {/* Staggered Avatars */}
                        <div className="flex -space-x-3">
                             {ALL_MEMBERS.map((m, i) => (
                                 <motion.div 
                                    key={m.id}
                                    initial={{ x: 10, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 + (i * 0.1) }}
                                    className="w-10 h-10 rounded-full border-2 border-black bg-[#D4FB46] flex items-center justify-center text-xs font-black text-black"
                                 >
                                     {m.initials}
                                 </motion.div>
                             ))}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* 2x2 Metric Grid - Swiss Editorial Style */}
            <div className="grid grid-cols-2 gap-4">
                {/* Runlist Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onClick={() => setIsReviewSetlistOpen(true)} 
                    className="p-6 bg-black/30 rounded-3xl border border-white/10 hover:border-[#D4FB46] cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden h-44 flex flex-col justify-between"
                >
                    <div className="flex justify-between items-start">
                        <div className="p-3 bg-white/10 rounded-2xl text-white/60 group-hover:bg-[#D4FB46] group-hover:text-black transition-colors">
                            <ListMusic className="w-6 h-6" />
                        </div>
                        <ArrowRight className="w-5 h-5 text-white/30 group-hover:translate-x-1 group-hover:text-white transition-all" />
                    </div>
                    <div>
                        <div className="text-4xl font-black text-white leading-none mb-2">{data.setlistSnapshotFinal?.songs.length || 0}</div>
                        <div className="text-xs font-bold uppercase text-white/50">Songs • {totalDuration}</div>
                        {data.setlistSnapshotFinal && <div className="text-xs text-white/40 mt-1">From {data.setlistSnapshotFinal.sources.length} templates</div>}
                    </div>
                </motion.div>

                {/* Tasks Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    onClick={() => setIsReviewTasksOpen(true)} 
                    className="p-6 bg-black/30 rounded-3xl border border-white/10 hover:border-purple-400 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden h-44 flex flex-col justify-between"
                >
                     <div className="flex justify-between items-start">
                        <div className="p-3 bg-white/10 rounded-2xl text-white/60 group-hover:bg-purple-400 group-hover:text-black transition-colors">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <ArrowRight className="w-5 h-5 text-white/30 group-hover:translate-x-1 group-hover:text-white transition-all" />
                    </div>
                    <div>
                        <div className="text-4xl font-black text-white leading-none mb-2">{data.tasks.length}</div>
                        <div className="text-xs font-bold uppercase text-white/50">Tasks</div>
                        <div className="text-xs font-bold text-white/40 mt-1">{tasksForMe} assigned to you</div>
                    </div>
                </motion.div>

                {/* Proposals Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    onClick={() => setIsReviewProposalsOpen(true)} 
                    className="p-6 bg-black/30 rounded-3xl border border-white/10 hover:border-blue-400 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden h-44 flex flex-col justify-between"
                >
                     <div className="flex justify-between items-start">
                        <div className="p-3 bg-white/10 rounded-2xl text-white/60 group-hover:bg-blue-400 group-hover:text-black transition-colors">
                            <MessageCircle className="w-6 h-6" />
                        </div>
                        <ArrowRight className="w-5 h-5 text-white/30 group-hover:translate-x-1 group-hover:text-white transition-all" />
                    </div>
                     <div>
                         <div className="text-4xl font-black text-white leading-none mb-2">{approvedProposals}</div>
                         <div className="text-xs font-bold uppercase text-white/50">Approved</div>
                         <div className="text-xs text-white/40 mt-1">{pendingProposals} pending decision</div>
                    </div>
                </motion.div>

                {/* Team Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    onClick={() => setIsReviewMembersOpen(true)} 
                    className="p-6 bg-black/30 rounded-3xl border border-white/10 hover:border-pink-400 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden h-44 flex flex-col justify-between"
                >
                     <div className="flex justify-between items-start">
                        <div className="p-3 bg-white/10 rounded-2xl text-white/60 group-hover:bg-pink-400 group-hover:text-black transition-colors">
                            <Users className="w-6 h-6" />
                        </div>
                        <ArrowRight className="w-5 h-5 text-white/30 group-hover:translate-x-1 group-hover:text-white transition-all" />
                    </div>
                     <div>
                         <div className="text-4xl font-black text-white leading-none mb-2">{data.members.length}</div>
                         <div className="text-xs font-bold uppercase text-white/50">Members</div>
                         <div className="text-xs text-white/40 mt-1">All confirmed</div>
                    </div>
                </motion.div>
            </div>
            
            {/* Notification Preview Hint */}
            <div className="text-center mt-6 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-500">
                <span className="text-sm font-bold text-white/40 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Ready to create. Notifying {data.audienceIds.length > 0 ? data.audienceIds.length : ALL_MEMBERS.length} members immediately.
                </span>
            </div>
        </div>
    );
  };

  const STEP_TITLES = ['Essentials', 'Runlist', 'Proposals', 'Preparation', 'Review'];
  const STEP_SUBTITLES = ['Define the session', 'Build your setlist', 'Song suggestions', 'Tasks & checklist', 'Confirm & notify'];

  return (
    <>
        <div className="h-full flex flex-col max-w-4xl mx-auto w-full">
            {/* Header - Swiss Elegant Style */}
            <div className="px-6 pt-8 pb-4 flex justify-between items-start shrink-0 relative z-20">
                <div>
                    <span className="text-white/50 text-xs font-black uppercase tracking-[0.3em] mb-2 block">
                        Step 0{step} / 0{totalSteps}
                    </span>
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
                        {STEP_TITLES[step - 1]}
                    </h2>
                    <p className="text-white/60 font-bold text-sm mt-1 tracking-tight">
                        {STEP_SUBTITLES[step - 1]}
                    </p>
                </div>

                <button 
                    onClick={onClose}
                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all hover:rotate-90"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="px-6 pb-4">
                <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-[#D4FB46]"
                        initial={{ width: 0 }}
                        animate={{ width: `${(step / totalSteps) * 100}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
                {step === 5 && renderStep5()}
            </div>

            {/* Footer Actions - Swiss Elegant Style */}
            <div className="p-6 pt-4 flex justify-between items-center mt-auto shrink-0 relative z-20 border-t border-white/10">
                {step > 1 ? (
                    <button 
                        onClick={prevStep}
                        className="px-6 py-4 rounded-full text-xs font-bold uppercase text-white/50 hover:text-white flex items-center gap-3 transition-colors group hover:bg-white/10"
                    >
                        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back
                    </button>
                ) : (
                    <div />
                )}

                {step < totalSteps ? (
                    <button 
                        onClick={nextStep} 
                        disabled={step === 2 && !data.setlistSnapshotFinal}
                        className={cn(
                            "h-14 px-8 rounded-full text-sm font-black uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl",
                            (step === 2 && !data.setlistSnapshotFinal) 
                                ? "bg-white/10 text-white/30 cursor-not-allowed" 
                                : "bg-black text-[#D4FB46] hover:scale-105 active:scale-95"
                        )}
                    >
                        {step === 2 && !data.setlistSnapshotFinal ? "Build Snapshot" : "Next Step"} 
                        {!(step === 2 && !data.setlistSnapshotFinal) && <ArrowRight className="w-5 h-5" />}
                    </button>
                ) : (
                    <button 
                        onClick={() => onCreate(data)}
                        className="h-14 px-8 rounded-full text-sm font-black uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl bg-[#D4FB46] text-black hover:scale-105 active:scale-95"
                    >
                        <CheckCircle2 className="w-5 h-5" /> Create Rehearsal
                    </button>
                )}
            </div>
        </div>

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

        {/* Review Modals */}
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
    </>
  );
};
