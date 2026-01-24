import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ArrowRight, ArrowLeft, Calendar as CalendarIcon, MapPin, 
  Clock, CheckCircle2, Search, Plus, Trash2, 
  ChevronDown, ChevronUp, Mic2, Briefcase, User, Music,
  Building2, HeartHandshake, Lock, ListTodo, StickyNote, Save,
  AlertCircle, Repeat, ThumbsUp, ThumbsDown, MessageCircle, FileText, Link as LinkIcon
} from 'lucide-react';
import { springs } from '@/styles/motion';
import { cn } from '@/app/components/ui/utils';
import { RehearsalCreationWizard } from '@/app/components/rehearsal/RehearsalCreationWizard';

// --- MOCK DATA ---
const MOCK_MEMBERS = [
  { id: '1', name: 'Gianluca Boccia', role: 'Guitar', fee: '0', initials: 'GB' },
  { id: '2', name: 'Centerbe', role: 'Drums', fee: '150', initials: 'CE' },
  { id: '3', name: 'Marco Rossi', role: 'Bass', fee: '150', initials: 'MR' },
  { id: '4', name: 'John Keys', role: 'Keys', fee: '200', initials: 'JK' },
  { id: '5', name: 'Mike Vocals', role: 'Vocals', fee: '250', initials: 'MV' },
];

const MOCK_REPERTOIRE = [
  { id: 's1', title: "Sweet Child O' Mine", artist: "Guns N' Roses", duration: "5:56" },
  { id: 's2', title: "Bohemian Rhapsody", artist: "Queen", duration: "6:07" },
  { id: 's3', title: "Superstition", artist: "Stevie Wonder", duration: "4:05" },
  { id: 's4', title: "Uptown Funk", artist: "Bruno Mars", duration: "4:30" },
  { id: 's5', title: "September", artist: "Earth, Wind & Fire", duration: "3:35" },
  { id: 's6', title: "Billie Jean", artist: "Michael Jackson", duration: "4:54" },
];

const DEFAULT_RUN_OF_SHOW = [
  { time: '18:00', title: 'Load In', type: 'logistics' },
  { time: '19:00', title: 'Soundcheck', type: 'tech' },
  { time: '20:00', title: 'Doors Open', type: 'logistics' },
  { time: '21:00', title: 'Set 1', type: 'performance' },
  { time: '21:45', title: 'Break', type: 'break' },
  { time: '22:15', title: 'Set 2', type: 'performance' },
];

const GIG_STEPS = [
  { id: 'essentials', title: 'Essentials', subtitle: 'Define the Event' },
  { id: 'team', title: 'Team & Pay', subtitle: 'Allocations' },
  { id: 'review', title: 'Overview', subtitle: 'Confirm Details' }
];

const REHEARSAL_STEPS = [
  { id: 'essentials', title: 'Essentials', subtitle: 'Basics & Logistics' },
  { id: 'setlist', title: 'Setlist & Songs', subtitle: 'What to play' },
  { id: 'prep', title: 'Prep & Tasks', subtitle: 'To-Dos' },
  { id: 'review', title: 'Review', subtitle: 'Confirm' }
];

type EventType = 'gig' | 'wedding' | 'corporate' | 'private' | 'rehearsal';
type RehearsalType = 'full_band' | 'vocals' | 'rhythm' | 'acoustic' | 'custom';
type OptionalModule = 'setlist' | 'schedule' | 'tasks' | 'notes' | 'proposals' | null;

interface CreateEventModalProps {
  onClose: () => void;
  onCreate: (eventData: any) => void;
  initialType?: EventType | null;
  layoutId?: string;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({ onClose, onCreate, initialType, layoutId }) => {
  const [step, setStep] = useState(0);
  const [activeModule, setActiveModule] = useState<OptionalModule>(null);
  
  // --- FORM STATE ---
  const [eventType, setEventType] = useState<EventType>(initialType || 'gig');
  const [rehearsalType, setRehearsalType] = useState<RehearsalType>('full_band');
  const [template, setTemplate] = useState<string>('none');
  
  const [details, setDetails] = useState({
    title: '',
    venue: '',
    address: '',
    date: new Date().toISOString().split('T')[0],
    time: '20:00',
    duration: '2h',
    pay: '', // Used as Cost for rehearsals
    recurrence: 'once'
  });

  const [selectedMembers, setSelectedMembers] = useState<string[]>(['1']); 
  const [memberFees, setMemberFees] = useState<Record<string, string>>({ '1': '0' }); // For rehearsal: split cost

  const [setlist, setSetlist] = useState<any[]>([]);
  const [songSearch, setSongSearch] = useState('');
  const [tasks, setTasks] = useState<{ text: string, type: 'todo'|'bring'|'fix'|'prepare', assignee: string }[]>([]);
  const [newTask, setNewTask] = useState({ text: '', type: 'todo' as 'todo'|'bring'|'fix'|'prepare', assignee: '' });
  const [notes, setNotes] = useState('');
  
  // Rehearsal Specific
  const [proposals, setProposals] = useState([
    { id: 'p1', title: 'Superstition', artist: 'Stevie Wonder', proposer: 'CE', votes: { yes: 3, no: 0 }, status: 'approved' },
    { id: 'p2', title: 'Cissy Strut', artist: 'The Meters', proposer: 'GB', votes: { yes: 2, no: 1 }, status: 'pending' }
  ]);
  const [activeTab, setActiveTab] = useState<'setlist'|'proposals'>('setlist');

  // --- COMPUTED ---
  const currentSteps = eventType === 'rehearsal' ? REHEARSAL_STEPS : GIG_STEPS;
  
  const totalPayout = useMemo(() => {
    return Object.values(memberFees).reduce((acc, fee) => acc + (parseFloat(fee) || 0), 0);
  }, [memberFees]);

  const totalBudget = parseFloat(details.pay) || 0;
  // For gigs: remaining = budget - payouts. For rehearsals: remaining to split = total cost - contributions? 
  // Let's stick to standard logic: 'pay' is Total Cost for rehearsal.
  const remainingBudget = totalBudget - totalPayout;
  const myShare = parseFloat(memberFees['1']) || 0;

  const totalDuration = useMemo(() => {
    let minutes = 0;
    setlist.forEach(item => {
      if (item.type === 'break') minutes += 15;
      else {
        const [m, s] = item.duration.split(':').map(Number);
        minutes += m + (s/60);
      }
    });
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  }, [setlist]);

  // --- HANDLERS ---
  const handleNext = () => {
    if (activeModule) {
        setActiveModule(null);
        return;
    }
    if (step < currentSteps.length - 1) setStep(step + 1);
    else handleCreate();
  };

  const handleBack = () => {
    if (activeModule) {
        setActiveModule(null);
        return;
    }
    if (step > 0) setStep(step - 1);
  };

  const toggleMember = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      if (memberId === '1') return;
      setSelectedMembers(prev => prev.filter(id => id !== memberId));
      const newFees = { ...memberFees };
      delete newFees[memberId];
      setMemberFees(newFees);
    } else {
      setSelectedMembers(prev => [...prev, memberId]);
      setMemberFees(prev => ({ ...prev, [memberId]: '0' }));
    }
  };

  const updateFee = (memberId: string, amount: string) => {
    setMemberFees(prev => ({ ...prev, [memberId]: amount }));
  };

  const splitEqually = () => {
    if (totalBudget <= 0 || selectedMembers.length === 0) return;
    const share = Math.floor(totalBudget / selectedMembers.length);
    const newFees: Record<string, string> = {};
    selectedMembers.forEach(id => {
        newFees[id] = share.toString();
    });
    setMemberFees(newFees);
  };

  const toggleSong = (song: any) => {
    const exists = setlist.find(s => s.id === song.id && s.type === 'song');
    if (exists) {
        setSetlist(prev => prev.filter(s => s.uid !== exists.uid));
    } else {
        setSetlist(prev => [...prev, { ...song, type: 'song', uid: Date.now() }]);
    }
  };

  const addBreak = () => {
    setSetlist(prev => [...prev, { id: 'break', title: 'Set Break', type: 'break', duration: '15:00', uid: Date.now() }]);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newSetlist = [...setlist];
    if (direction === 'up' && index > 0) {
      [newSetlist[index], newSetlist[index - 1]] = [newSetlist[index - 1], newSetlist[index]];
    } else if (direction === 'down' && index < newSetlist.length - 1) {
      [newSetlist[index], newSetlist[index + 1]] = [newSetlist[index + 1], newSetlist[index]];
    }
    setSetlist(newSetlist);
  };

  const addTask = () => {
    if (!newTask.text) return;
    setTasks(prev => [...prev, newTask]);
    setNewTask({ text: '', type: 'todo', assignee: '' });
  };

  const handleCreate = () => {
    const eventData = {
        details,
        eventType,
        template,
        members: selectedMembers.map(id => ({ id, fee: memberFees[id] })),
        setlist,
        tasks,
        notes,
        status: 'tentative'
    };
    onCreate(eventData);
  };

  // --- RENDER HELPERS ---
  const renderEventTypeCard = (type: EventType, icon: any, label: string) => (
      <button 
          onClick={() => setEventType(type)}
          className={cn(
              "group relative overflow-hidden p-6 rounded-3xl border transition-all duration-300 flex flex-col items-start gap-4",
              eventType === type 
                ? "bg-black border-black text-white" 
                : "bg-black/5 border-black/5 hover:bg-black/10 text-stone-500"
          )}
      >
          <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
              eventType === type ? "bg-[#D4FB46] text-black" : "bg-white text-stone-400 group-hover:text-black"
          )}>
              {React.createElement(icon, { className: "w-6 h-6" })}
          </div>
          <span className={cn(
              "text-lg font-black uppercase tracking-tight",
              eventType === type ? "text-white" : "text-stone-500 group-hover:text-black"
          )}>
              {label}
          </span>
      </button>
  );

  const renderRehearsalTypeCard = (type: RehearsalType, icon: any, label: string) => (
    <button 
        onClick={() => setRehearsalType(type)}
        className={cn(
            "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all",
            rehearsalType === type 
              ? "bg-black text-[#D4FB46] border-black shadow-lg" 
              : "bg-transparent text-black/40 border-black/10 hover:border-black/30"
        )}
    >
        {React.createElement(icon, { className: "w-5 h-5 mb-2" })}
        <span className="text-[10px] font-bold uppercase tracking-wide leading-none text-center">{label}</span>
        {rehearsalType === type && <div className="mt-2 w-1.5 h-1.5 rounded-full bg-[#D4FB46]" />}
    </button>
  );

  // --- REHEARSAL FLOW RENDERER ---
  const renderRehearsalStep = () => {
    switch(step) {
      case 0: // ESSENTIALS
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
             {/* Type Selection */}
             <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Rehearsal Type</label>
               <div className="grid grid-cols-4 gap-2">
                  {renderRehearsalTypeCard('full_band', Music, 'Full Band')}
                  {renderRehearsalTypeCard('vocals', Mic2, 'Vocals')}
                  {renderRehearsalTypeCard('rhythm', Music, 'Rhythm')}
                  {renderRehearsalTypeCard('acoustic', Music, 'Acoustic')}
               </div>
             </div>

             <div className="h-[1px] bg-black/10" />

             {/* Form */}
             <div className="space-y-6">
                <div className="group relative">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Title</label>
                    <input 
                        type="text" 
                        value={details.title}
                        onChange={(e) => setDetails({...details, title: e.target.value})}
                        placeholder="e.g. Weekly Band Practice"
                        className="w-full bg-transparent border-b-2 border-black/10 py-2 text-3xl font-black text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                    />
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="group relative">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Location</label>
                      <div className="flex items-center gap-2 border-b-2 border-black/10 py-2">
                        <MapPin className="w-5 h-5 text-black/40" />
                        <input 
                            type="text"
                            value={details.venue}
                            onChange={(e) => setDetails({...details, venue: e.target.value})}
                            placeholder="Studio Name / Address"
                            className="w-full bg-transparent text-xl font-bold text-black placeholder:text-black/20 focus:outline-none"
                        />
                      </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="group">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Date</label>
                      <input 
                          type="date"
                          value={details.date}
                          onChange={(e) => setDetails({...details, date: e.target.value})}
                          className="w-full bg-transparent border-b-2 border-black/10 py-2 text-xl font-bold text-black focus:outline-none focus:border-black"
                      />
                   </div>
                   <div className="group">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Time</label>
                      <input 
                          type="time"
                          value={details.time}
                          onChange={(e) => setDetails({...details, time: e.target.value})}
                          className="w-full bg-transparent border-b-2 border-black/10 py-2 text-xl font-bold text-black focus:outline-none focus:border-black"
                      />
                   </div>
                </div>

                {/* Duration Pills */}
                <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Duration</label>
                   <div className="flex gap-2">
                      {['1h', '1.5h', '2h', '2.5h', '3h'].map(d => (
                        <button
                          key={d}
                          onClick={() => setDetails({...details, duration: d})}
                          className={cn(
                            "px-4 py-2 rounded-full text-xs font-bold border transition-all",
                            details.duration === d 
                              ? "bg-black text-[#D4FB46] border-black" 
                              : "bg-transparent text-black/60 border-black/10 hover:border-black/30"
                          )}
                        >
                          {d}
                        </button>
                      ))}
                   </div>
                </div>

                {/* Recurrence */}
                <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 flex items-center gap-2">
                     <Repeat className="w-3 h-3" /> Recurrence
                   </label>
                   <div className="flex gap-2">
                      {['once', 'weekly', 'biweekly'].map(r => (
                        <button
                          key={r}
                          onClick={() => setDetails({...details, recurrence: r})}
                          className={cn(
                            "px-4 py-2 rounded-full text-xs font-bold uppercase border transition-all",
                            details.recurrence === r 
                              ? "bg-black text-[#D4FB46] border-black" 
                              : "bg-transparent text-black/60 border-black/10 hover:border-black/30"
                          )}
                        >
                          {r}
                        </button>
                      ))}
                   </div>
                </div>
                
                {/* Cost Section Minimal */}
                <div className="flex items-center gap-4 bg-black/5 p-4 rounded-2xl border border-black/5">
                    <div className="flex-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Total Cost</label>
                        <div className="flex items-center gap-1">
                          <span className="text-xl font-black text-black">€</span>
                          <input 
                            type="number" 
                            value={details.pay}
                            onChange={(e) => setDetails({...details, pay: e.target.value})}
                            placeholder="0"
                            className="bg-transparent text-xl font-black text-black w-24 focus:outline-none placeholder:text-black/20"
                          />
                        </div>
                    </div>
                    <div className="h-8 w-[1px] bg-black/10" />
                    <div className="flex-1">
                         <span className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-1">Per Person</span>
                         <span className="text-xl font-black text-black">
                           €{selectedMembers.length > 0 ? (parseFloat(details.pay || '0') / selectedMembers.length).toFixed(0) : 0}
                         </span>
                    </div>
                </div>

                {/* Team Mini-view */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Team ({selectedMembers.length})</label>
                    <div className="flex -space-x-2 overflow-hidden py-1">
                        {MOCK_MEMBERS.map(m => (
                          <div 
                            key={m.id}
                            onClick={() => toggleMember(m.id)}
                            className={cn(
                              "w-10 h-10 rounded-full border-2 border-[#D4FB46] flex items-center justify-center font-bold text-xs cursor-pointer transition-transform hover:scale-110 relative z-10",
                              selectedMembers.includes(m.id) ? "bg-black text-[#D4FB46]" : "bg-black/10 text-black/40 opacity-50"
                            )}
                          >
                            {m.initials}
                          </div>
                        ))}
                    </div>
                </div>
             </div>
          </div>
        );

      case 1: // SETLIST & SONGS
        return (
          <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
             {/* Tabs */}
             <div className="flex p-1 bg-black/5 rounded-xl">
               <button 
                  onClick={() => setActiveTab('setlist')}
                  className={cn("flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all", activeTab === 'setlist' ? "bg-black text-[#D4FB46] shadow-md" : "text-black/50")}
               >
                 Setlist
               </button>
               <button 
                  onClick={() => setActiveTab('proposals')}
                  className={cn("flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all", activeTab === 'proposals' ? "bg-black text-[#D4FB46] shadow-md" : "text-black/50")}
               >
                 Song Proposals
               </button>
             </div>

             {activeTab === 'setlist' ? (
                <>
                  <div className="flex items-center justify-between">
                     <h3 className="text-xl font-black uppercase text-black">Songs to Practice</h3>
                     <span className="text-xs font-bold text-black/50">{totalDuration}</span>
                  </div>
                  
                  {/* Setlist Items */}
                  <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar -mr-2 pr-2">
                     {setlist.length === 0 && (
                        <div className="text-center py-8 opacity-40">
                          <Music className="w-12 h-12 mx-auto mb-2" />
                          <p className="font-bold text-sm">No songs added yet</p>
                        </div>
                     )}
                     {setlist.map((item, i) => (
                       <div key={item.uid} className={cn("p-4 rounded-2xl border border-transparent hover:border-black/10 transition-all group", item.type === 'break' ? "bg-black/5" : "bg-white/40")}>
                          <div className="flex justify-between items-start">
                             <div className="flex gap-3">
                                <span className="text-xs font-mono font-bold text-black/30 mt-1">{i+1}</span>
                                <div>
                                   <h4 className={cn("font-bold text-lg leading-none", item.type === 'break' ? "italic text-black/50" : "text-black")}>{item.title}</h4>
                                   {item.artist && <p className="text-xs font-bold text-black/50 uppercase">{item.artist}</p>}
                                </div>
                             </div>
                             <span className="text-xs font-bold text-black/40">{item.duration}</span>
                          </div>
                          {/* Expanded Details (Mock) */}
                          {item.type !== 'break' && (
                             <div className="mt-3 pt-3 border-t border-black/5 flex gap-4 text-[10px] font-bold uppercase text-black/40">
                                <span className="flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Tabs</span>
                                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Score</span>
                                <span className="ml-auto text-red-600 flex items-center gap-1">High Priority</span>
                             </div>
                          )}
                       </div>
                     ))}
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2 mt-auto pt-4">
                     <button onClick={() => setActiveModule('setlist')} className="py-3 bg-black text-[#D4FB46] rounded-xl font-bold text-xs uppercase hover:scale-[1.02] transition-transform">+ Add Song</button>
                     <button onClick={addBreak} className="py-3 bg-black/5 text-black rounded-xl font-bold text-xs uppercase hover:bg-black/10">+ Add Break</button>
                  </div>
                </>
             ) : (
                <>
                   <div className="flex items-center justify-between">
                     <h3 className="text-xl font-black uppercase text-black">Voting</h3>
                     <span className="text-xs font-bold text-black/50">{proposals.length} Pending</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                     {proposals.map(prop => (
                        <div key={prop.id} className="p-4 bg-white/40 rounded-2xl border border-transparent hover:border-black/5 transition-all">
                           <div className="flex justify-between mb-2">
                              <span className="px-2 py-0.5 bg-black/10 rounded text-[9px] font-bold uppercase text-black/60">Proposed by {prop.proposer}</span>
                              <span className={cn("text-[9px] font-bold uppercase", prop.status === 'approved' ? "text-green-600" : "text-orange-500")}>{prop.status}</span>
                           </div>
                           <h4 className="font-bold text-lg text-black leading-none">{prop.title}</h4>
                           <p className="text-xs font-bold text-black/50 uppercase mb-3">{prop.artist}</p>
                           
                           <div className="flex items-center gap-4 bg-black/5 p-2 rounded-xl">
                              <div className="flex items-center gap-1">
                                 <ThumbsUp className="w-4 h-4 text-black" />
                                 <span className="font-black text-sm">{prop.votes.yes}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                 <ThumbsDown className="w-4 h-4 text-black/30" />
                                 <span className="font-black text-sm text-black/30">{prop.votes.no}</span>
                              </div>
                              <div className="ml-auto flex items-center gap-1 text-black/40">
                                 <MessageCircle className="w-3 h-3" />
                                 <span className="text-[10px] font-bold">Comments</span>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
                  <button className="w-full py-3 bg-black/5 border-2 border-dashed border-black/10 rounded-xl text-black/50 font-bold text-xs uppercase hover:border-black/30 hover:text-black transition-all">
                     + Propose New Song
                  </button>
                </>
             )}
          </div>
        );

      case 2: // PREP & TASKS
        return (
          <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
             
             {/* To-Do Section */}
             <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-2">To-Do Before Rehearsal</h3>
                <div className="bg-white/40 rounded-2xl overflow-hidden">
                   {/* Task List */}
                   <div className="divide-y divide-black/5">
                      {tasks.length === 0 && <div className="p-4 text-center text-xs font-bold text-black/30">No tasks yet</div>}
                      {tasks.map((t, i) => (
                         <div key={i} className="p-3 flex items-start gap-3">
                            <div className="mt-0.5 w-4 h-4 rounded border border-black/20" />
                            <div className="flex-1">
                               <p className="text-sm font-bold text-black leading-tight">{t.text}</p>
                               <div className="flex gap-2 mt-1">
                                  <span className="text-[9px] font-bold uppercase bg-black/10 px-1.5 rounded text-black/60">{t.assignee === '1' ? 'Me' : 'Member'}</span>
                                  <span className="text-[9px] font-bold uppercase text-black/40">{t.type}</span>
                               </div>
                            </div>
                         </div>
                      ))}
                   </div>
                   {/* Quick Add */}
                   <div className="p-3 bg-black/5 flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Add task..." 
                        className="flex-1 bg-transparent text-sm font-bold placeholder:text-black/30 focus:outline-none"
                        value={newTask.text}
                        onChange={(e) => setNewTask({...newTask, text: e.target.value})}
                      />
                      <button onClick={addTask} className="text-black/50 hover:text-black font-bold text-xs uppercase">Add</button>
                   </div>
                </div>
             </div>

             {/* Personal Checklist */}
             <div>
                <div className="flex justify-between items-end mb-2">
                   <h3 className="text-xs font-bold uppercase tracking-widest text-black/40">My Checklist (What to Bring)</h3>
                   <button className="text-[9px] font-bold uppercase text-black/40 underline">Edit Default</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                   {['Guitar (Main)', 'Pedalboard', 'Cables x3', 'Tuner', 'Picks', 'Setlist (iPad)'].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-black/5 rounded-lg opacity-60">
                         <div className="w-3 h-3 border border-black/30 rounded-sm" />
                         <span className="text-xs font-bold text-black/70">{item}</span>
                      </div>
                   ))}
                </div>
             </div>

             {/* Reminders */}
             <div className="mt-auto">
                <h3 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-2">Reminders</h3>
                <div className="flex gap-2">
                   {['1 day before', '3 hours before', '1 hour before'].map((r, i) => (
                      <button key={i} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border", i < 2 ? "bg-black text-[#D4FB46] border-black" : "bg-transparent text-black/40 border-black/10")}>
                         {r}
                      </button>
                   ))}
                </div>
             </div>
          </div>
        );

      case 3: // REVIEW
        return (
          <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
             
             {/* Summary Card */}
             <div className="bg-white/40 rounded-3xl p-6 relative overflow-hidden">
                 <div className="relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-black text-[#D4FB46] px-2 py-1 rounded mb-4 inline-block">{rehearsalType.replace('_', ' ')}</span>
                    <h2 className="text-3xl font-black text-black leading-none uppercase mb-2">{details.title || 'Untitled Rehearsal'}</h2>
                    
                    <div className="space-y-1 mb-6">
                       <p className="text-lg font-bold text-black flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4" /> {details.date} <span className="text-black/30">|</span> {details.time} ({details.duration})
                       </p>
                       <p className="text-sm font-bold text-black/60 flex items-center gap-2">
                          <MapPin className="w-4 h-4" /> {details.venue || 'No Location'}
                       </p>
                    </div>

                    <div className="h-[1px] bg-black/10 mb-4" />

                    <div className="grid grid-cols-3 gap-4">
                       <div>
                          <span className="text-[9px] font-bold uppercase text-black/40 block">Cost</span>
                          <span className="text-xl font-black text-black">€{details.pay}</span>
                          <span className="text-[9px] font-bold block text-black/40">€{(parseFloat(details.pay)/selectedMembers.length).toFixed(0)}/pp</span>
                       </div>
                       <div>
                          <span className="text-[9px] font-bold uppercase text-black/40 block">Team</span>
                          <div className="flex -space-x-2 mt-1">
                             {selectedMembers.map(id => (
                                <div key={id} className="w-6 h-6 rounded-full bg-black border border-[#D4FB46] text-[#D4FB46] flex items-center justify-center text-[8px] font-bold">
                                   {MOCK_MEMBERS.find(m => m.id === id)?.initials}
                                </div>
                             ))}
                          </div>
                       </div>
                       <div>
                          <span className="text-[9px] font-bold uppercase text-black/40 block">Recurrence</span>
                          <span className="text-xs font-bold text-black uppercase">{details.recurrence}</span>
                       </div>
                    </div>
                 </div>
             </div>

             {/* Stats Summary */}
             <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-black/5 rounded-2xl flex flex-col items-center justify-center text-center">
                   <Music className="w-5 h-5 text-black mb-1" />
                   <span className="text-xl font-black text-black leading-none">{setlist.length}</span>
                   <span className="text-[9px] font-bold uppercase text-black/40">Songs</span>
                </div>
                <div className="p-4 bg-black/5 rounded-2xl flex flex-col items-center justify-center text-center">
                   <ListTodo className="w-5 h-5 text-black mb-1" />
                   <span className="text-xl font-black text-black leading-none">{tasks.length}</span>
                   <span className="text-[9px] font-bold uppercase text-black/40">Tasks</span>
                </div>
                <div className="p-4 bg-black/5 rounded-2xl flex flex-col items-center justify-center text-center">
                   <AlertCircle className="w-5 h-5 text-black mb-1" />
                   <span className="text-xl font-black text-black leading-none">{proposals.filter(p => p.status === 'pending').length}</span>
                   <span className="text-[9px] font-bold uppercase text-black/40">Proposals</span>
                </div>
             </div>

             <div className="mt-auto">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-black/40 mb-2">Notifications</h3>
                 <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-black">
                       <CheckCircle2 className="w-4 h-4 text-black" /> Push Notification to all members
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-black">
                       <CheckCircle2 className="w-4 h-4 text-black" /> Email Summary with Setlist & Tasks
                    </div>
                 </div>
             </div>
          </div>
        );
      
      default: return null;
    }
  };

  const renderContent = () => {
    // If active module, render standard module editor (reused from Gig flow for consistency, or customized)
    if (activeModule) {
        return renderOptionalModule(); 
    }

    if (eventType === 'rehearsal') {
        return <RehearsalCreationWizard onClose={onClose} onCreate={onCreate} />;
    }
    
    // GIG FLOW (Existing) - Keeping Step 0, 1, 2 logic
    switch (step) {
      case 0: // ESSENTIALS (Gig)
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
             
             {/* Event Type Grid */}
             <div className="space-y-4">
                 <label className="text-xs font-bold uppercase tracking-[0.2em] text-black/50 ml-1">Select Type</label>
                 <div className="grid grid-cols-2 gap-4">
                     {renderEventTypeCard('gig', Mic2, 'Gig')}
                     {renderEventTypeCard('wedding', HeartHandshake, 'Wedding')}
                     {renderEventTypeCard('corporate', Building2, 'Corporate')}
                     {renderEventTypeCard('private', Lock, 'Private')}
                 </div>
             </div>

             {/* Minimalist Form */}
             <div className="space-y-8">
                <div className="group relative">
                    <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-black/40 transition-colors group-focus-within:text-black">Event Title</label>
                    <input 
                        type="text" 
                        value={details.title}
                        onChange={(e) => setDetails({...details, title: e.target.value})}
                        placeholder="e.g. Summer Festival"
                        className="w-full bg-transparent border-b-2 border-black/10 py-2 text-4xl font-black text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                    />
                </div>
                
                {/* ... Rest of Gig Form ... */}
                <div className="group relative">
                    <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-black/40 transition-colors group-focus-within:text-black">Venue</label>
                    <div className="flex items-center gap-3 border-b-2 border-black/10 focus-within:border-black transition-colors py-2">
                        <MapPin className="w-5 h-5 text-black/40 group-focus-within:text-black transition-colors" />
                        <input 
                            type="text"
                            value={details.venue}
                            onChange={(e) => setDetails({...details, venue: e.target.value})}
                            placeholder="Venue Name"
                            className="w-full bg-transparent text-2xl font-bold text-black placeholder:text-black/20 focus:outline-none"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-8">
                    <div className="group relative">
                        <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-black/40 transition-colors group-focus-within:text-black">Date</label>
                        <input 
                            type="date"
                            value={details.date}
                            onChange={(e) => setDetails({...details, date: e.target.value})}
                            className="w-full bg-transparent border-b-2 border-black/10 py-2 text-xl font-bold text-black focus:outline-none focus:border-black transition-all"
                        />
                    </div>
                    <div className="group relative">
                         <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-black/40 transition-colors group-focus-within:text-black">Time</label>
                         <input 
                            type="time"
                            value={details.time}
                            onChange={(e) => setDetails({...details, time: e.target.value})}
                            className="w-full bg-transparent border-b-2 border-black/10 py-2 text-xl font-bold text-black focus:outline-none focus:border-black transition-all"
                        />
                    </div>
                    <div className="group relative">
                        <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-black/40 transition-colors group-focus-within:text-black">Fee (€)</label>
                        <input 
                            type="number"
                            value={details.pay}
                            onChange={(e) => setDetails({...details, pay: e.target.value})}
                            placeholder="0"
                            className="w-full bg-transparent border-b-2 border-black/10 py-2 text-xl font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                        />
                    </div>
                </div>
             </div>
          </div>
        );

      case 1: // TEAM & PAY (Gig)
        return (
          <div className="space-y-8 h-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
             <div className="flex items-center justify-between py-6 border-b border-black/10">
                 <div>
                     <span className="block text-[10px] font-bold uppercase tracking-widest text-black/50 mb-1">Total Fee</span>
                     <span className="text-3xl font-black text-black">€{totalBudget}</span>
                 </div>
                 <div className="h-10 w-[1px] bg-black/10" />
                 <div>
                     <span className="block text-[10px] font-bold uppercase tracking-widest text-black/50 mb-1">My Share</span>
                     <span className="text-3xl font-black text-black">€{myShare}</span>
                 </div>
                 <div className="h-10 w-[1px] bg-black/10" />
                 <div className="text-right">
                     <span className="block text-[10px] font-bold uppercase tracking-widest text-black/50 mb-1">Left</span>
                     <span className={cn("text-3xl font-black transition-colors", remainingBudget < 0 ? "text-red-600" : "text-black")}>
                        €{remainingBudget}
                     </span>
                 </div>
             </div>

             <div className="flex justify-end">
                 <button onClick={splitEqually} className="text-xs font-bold uppercase tracking-wide text-black/60 hover:text-black transition-colors flex items-center gap-2">
                     <div className="w-6 h-6 rounded-full border border-black/20 flex items-center justify-center">
                         <span className="text-[10px]">%</span>
                     </div>
                     Split Equally
                 </button>
             </div>

             <div className="flex-1 overflow-y-auto -mr-4 pr-4 custom-scrollbar space-y-4">
                 {MOCK_MEMBERS.map(member => {
                     const isSelected = selectedMembers.includes(member.id);
                     return (
                         <div 
                            key={member.id}
                            className="flex items-center justify-between group"
                         >
                             <div className="flex items-center gap-4 cursor-pointer" onClick={() => toggleMember(member.id)}>
                                 <div className={cn(
                                     "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300",
                                     isSelected ? "bg-black text-[#D4FB46] border-black" : "bg-transparent text-black/40 border-black/10 group-hover:border-black/30"
                                 )}>
                                     {isSelected ? <CheckCircle2 className="w-6 h-6" /> : member.initials}
                                 </div>
                                 <div>
                                     <h4 className={cn("text-xl font-bold transition-colors", isSelected ? "text-black" : "text-black/40")}>{member.name}</h4>
                                     <p className="text-xs font-bold uppercase tracking-wider text-black/50">{member.role}</p>
                                 </div>
                             </div>

                             {isSelected ? (
                                 <div className="relative group/input">
                                     <span className="absolute left-0 top-1/2 -translate-y-1/2 text-black/40 font-bold text-lg">€</span>
                                     <input 
                                         type="number"
                                         value={memberFees[member.id] || ''}
                                         onChange={(e) => updateFee(member.id, e.target.value)}
                                         className="w-32 bg-transparent border-b-2 border-black/10 pb-1 pl-6 text-2xl font-black text-black focus:outline-none focus:border-black text-right transition-colors"
                                         placeholder="0"
                                     />
                                 </div>
                             ) : (
                                 <button onClick={() => toggleMember(member.id)} className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 text-black/30 opacity-0 group-hover:opacity-100 transition-all hover:bg-black/10 hover:text-black">
                                     <Plus className="w-5 h-5" />
                                 </button>
                             )}
                         </div>
                     )
                 })}
             </div>
          </div>
        );

      case 2: // REVIEW (Gig)
        return (
          <div className="space-y-8 h-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
             
             <div className="space-y-2">
                 <div className="flex items-center gap-3">
                     <span className="px-3 py-1 bg-black text-[#D4FB46] text-[10px] font-black uppercase tracking-widest rounded-full">{eventType}</span>
                     <span className="text-black/50 text-xs font-bold uppercase tracking-widest">{details.date} @ {details.time}</span>
                 </div>
                 <h2 className="text-5xl font-black text-black tracking-tighter leading-[0.9] uppercase">{details.title || 'Untitled'}</h2>
                 <p className="text-xl text-black/60 font-medium">{details.venue}</p>
             </div>

             <div className="h-[1px] bg-black/10" />

             <div className="grid grid-cols-2 gap-4">
                 <button 
                    onClick={() => setActiveModule('setlist')}
                    className="group p-6 bg-black/[0.03] rounded-3xl border border-black/5 hover:border-black/20 transition-all flex flex-col gap-4 text-left"
                 >
                     <Music className="w-8 h-8 text-black/30 group-hover:text-black transition-colors" />
                     <div>
                         <span className="block text-2xl font-black text-black">{setlist.length}</span>
                         <span className="text-xs font-bold uppercase tracking-wider text-black/40 group-hover:text-black transition-colors">Songs</span>
                     </div>
                 </button>
                 
                 <button 
                    onClick={() => setActiveModule('schedule')}
                    className="group p-6 bg-black/[0.03] rounded-3xl border border-black/5 hover:border-black/20 transition-all flex flex-col gap-4 text-left"
                 >
                     <Clock className="w-8 h-8 text-black/30 group-hover:text-black transition-colors" />
                     <div>
                         <span className="block text-2xl font-black text-black">RoS</span>
                         <span className="text-xs font-bold uppercase tracking-wider text-black/40 group-hover:text-black transition-colors">Schedule</span>
                     </div>
                 </button>
                 
                 <button 
                    onClick={() => setActiveModule('tasks')}
                    className="group p-6 bg-black/[0.03] rounded-3xl border border-black/5 hover:border-black/20 transition-all flex flex-col gap-4 text-left"
                 >
                     <Briefcase className="w-8 h-8 text-black/30 group-hover:text-black transition-colors" />
                     <div>
                         <span className="block text-2xl font-black text-black">{tasks.length}</span>
                         <span className="text-xs font-bold uppercase tracking-wider text-black/40 group-hover:text-black transition-colors">Tasks</span>
                     </div>
                 </button>
                 
                 <button 
                    onClick={() => setActiveModule('notes')}
                    className="group p-6 bg-black/[0.03] rounded-3xl border border-black/5 hover:border-black/20 transition-all flex flex-col gap-4 text-left"
                 >
                     <StickyNote className="w-8 h-8 text-black/30 group-hover:text-black transition-colors" />
                     <div>
                         <span className="block text-2xl font-black text-black">{notes ? 'Yes' : 'No'}</span>
                         <span className="text-xs font-bold uppercase tracking-wider text-black/40 group-hover:text-black transition-colors">Notes</span>
                     </div>
                 </button>
             </div>
          </div>
        );
      
      default: return null;
    }
  };

  const renderOptionalModule = () => {
      // Reusing the same module wrapper logic, customized for light theme (Rehearsal style) if needed
      const ModuleWrapper = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <div className="space-y-6 h-full flex flex-col animate-in fade-in zoom-in-95 duration-300">
             <h3 className="text-3xl font-black text-black tracking-tight uppercase">{title}</h3>
             {children}
        </div>
      );

      switch(activeModule) {
          case 'setlist':
              return (
                <ModuleWrapper title="Setlist Builder">
                     {/* ... Same Setlist Editor ... */}
                     <div className="flex gap-4 border-b border-black/10 pb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-black/30" />
                            <input 
                                type="text" 
                                placeholder="Search library..."
                                value={songSearch}
                                onChange={(e) => setSongSearch(e.target.value)}
                                className="w-full bg-transparent h-12 pl-8 text-xl font-bold text-black placeholder:text-black/30 focus:outline-none"
                            />
                        </div>
                        <button onClick={addBreak} className="px-6 rounded-full bg-black/5 hover:bg-black/10 text-xs font-bold text-black uppercase tracking-wider transition-colors">
                            + Break
                        </button>
                    </div>

                    {songSearch && (
                        <div className="max-h-60 overflow-y-auto space-y-2">
                             {MOCK_REPERTOIRE.filter(s => s.title.toLowerCase().includes(songSearch.toLowerCase())).map(song => (
                                <button key={song.id} onClick={() => toggleSong(song)} className="w-full flex items-center justify-between p-4 bg-white/50 rounded-2xl border border-transparent hover:border-black/20 group transition-all">
                                    <span className="text-lg font-bold text-black group-hover:text-black">{song.title}</span>
                                    <Plus className="w-5 h-5 text-black/30 group-hover:text-black" />
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                        {setlist.map((item, index) => (
                            <div key={item.uid} className="flex items-center gap-4 p-4 bg-white/40 rounded-2xl group border border-transparent hover:border-black/5">
                                <span className="text-xs font-mono text-black/40 w-6">{(index + 1).toString().padStart(2, '0')}</span>
                                <div className="flex-1">
                                    <p className={cn("text-lg font-bold", item.type === 'break' ? "italic text-black/50" : "text-black")}>{item.title}</p>
                                </div>
                                <span className="text-sm font-bold text-black/40">{item.duration}</span>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => moveItem(index, 'up')} disabled={index === 0}><ChevronUp className="w-5 h-5 text-black/30 hover:text-black" /></button>
                                    <button onClick={() => moveItem(index, 'down')} disabled={index === setlist.length - 1}><ChevronDown className="w-5 h-5 text-black/30 hover:text-black" /></button>
                                    <button onClick={() => setSetlist(prev => prev.filter(i => i.uid !== item.uid))}><Trash2 className="w-5 h-5 text-black/30 hover:text-red-600" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </ModuleWrapper>
              );
          
          case 'schedule': // Reused
              return (
                  <ModuleWrapper title="Run of Show">
                       <div className="space-y-1">
                        {DEFAULT_RUN_OF_SHOW.map((item, i) => (
                            <div key={i} className="flex items-center gap-8 py-4 border-b border-black/5 last:border-0 group hover:pl-4 transition-all duration-300">
                                <span className="text-2xl font-black text-black group-hover:text-black/60 transition-colors">{item.time}</span>
                                <span className={cn(
                                    "text-lg font-bold uppercase tracking-wider",
                                    item.type === 'performance' ? "text-black bg-[#D4FB46]/0 px-2 rounded" : "text-black/40 group-hover:text-black"
                                )}>
                                    {item.title}
                                </span>
                            </div>
                        ))}
                    </div>
                  </ModuleWrapper>
              );

          case 'tasks': // Reused
              return (
                  <ModuleWrapper title="Logistics">
                      <div className="flex gap-4 border-b border-black/10 pb-4">
                         <input 
                            type="text"
                            placeholder="Add task..."
                            value={newTask.text}
                            onChange={(e) => setNewTask({...newTask, text: e.target.value})}
                            className="flex-1 bg-transparent text-xl font-bold text-black placeholder:text-black/30 focus:outline-none"
                         />
                         <select 
                            value={newTask.assignee}
                            onChange={(e) => setNewTask({...newTask, assignee: e.target.value})}
                            className="bg-transparent text-sm font-bold text-black outline-none cursor-pointer"
                         >
                             <option value="" className="text-stone-500">Assign...</option>
                             {selectedMembers.map(id => {
                                 const m = MOCK_MEMBERS.find(mem => mem.id === id);
                                 return <option key={id} value={id} className="text-black">{m?.name}</option>
                             })}
                         </select>
                         <button onClick={addTask} disabled={!newTask.text || !newTask.assignee} className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-[#D4FB46] disabled:opacity-20 disabled:cursor-not-allowed">
                             <Plus className="w-5 h-5" />
                         </button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                          {tasks.map((task, i) => {
                              const assignee = MOCK_MEMBERS.find(m => m.id === task.assignee);
                              return (
                                  <div key={i} className="flex items-center justify-between p-4 bg-white/40 rounded-2xl group hover:bg-white/60 transition-colors border border-transparent hover:border-black/5">
                                      <span className="text-lg font-bold text-black">{task.text}</span>
                                      {assignee && (
                                         <div className="flex items-center gap-2">
                                             <span className="text-[10px] text-black/40 font-bold uppercase tracking-wider">Assigned to</span>
                                             <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center text-[10px] font-black text-[#D4FB46]">{assignee.initials}</div>
                                         </div>
                                     )}
                                  </div>
                              )
                          })}
                      </div>
                  </ModuleWrapper>
              );

          case 'notes': // Reused
              return (
                  <ModuleWrapper title="Notes">
                      <textarea 
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Type something..."
                          className="flex-1 w-full bg-transparent text-xl text-black font-medium leading-relaxed resize-none focus:outline-none placeholder:text-black/30"
                      />
                  </ModuleWrapper>
              );
          
          default: return null;
      }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "fixed inset-0 z-[100] flex flex-col overflow-hidden",
        eventType === 'rehearsal' ? "bg-[#0047FF]" : "bg-[#D4FB46]"
      )}
    >
      {eventType === 'rehearsal' ? (
        <RehearsalCreationWizard onClose={onClose} onCreate={onCreate} />
      ) : (
        <>
          {/* Top Navigation */}
          <div className="px-6 pt-8 pb-4 flex justify-between items-start shrink-0 relative z-20 max-w-4xl mx-auto w-full">
            {activeModule ? (
              <button onClick={() => setActiveModule(null)} className="flex items-center gap-3 text-black/50 hover:text-black transition-colors group">
                <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black/10">
                  <ArrowLeft className="w-5 h-5" />
                </div>
                <span className="text-sm font-black uppercase tracking-widest">Back</span>
              </button>
            ) : (
              <div>
                <span className="text-black/40 text-xs font-black uppercase tracking-[0.3em] mb-2 block">
                  Step 0{step + 1}
                </span>
                <h2 className="text-4xl font-black text-black tracking-tighter uppercase leading-none">
                  {currentSteps[step].title}
                </h2>
                <p className="text-black/50 font-bold text-sm mt-1 tracking-tight">{currentSteps[step].subtitle}</p>
              </div>
            )}
            
            <button 
              onClick={onClose}
              className="w-12 h-12 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-black/50 hover:text-black transition-all hover:rotate-90"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden relative px-6 py-4 max-w-4xl mx-auto w-full">
            {renderContent()}
          </div>

          {/* Footer */}
          <div className="p-6 pt-4 flex justify-between items-center mt-auto shrink-0 relative z-20 border-t border-black/5 max-w-4xl mx-auto w-full">
            {(step > 0 && !activeModule) ? (
              <button 
                onClick={handleBack}
                className="px-6 py-4 rounded-full text-xs font-bold uppercase text-black/40 hover:text-black flex items-center gap-3 transition-colors group hover:bg-black/5"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back
              </button>
            ) : <div />}

            <button 
              onClick={handleNext}
              disabled={step === 0 && (!details.title)}
              className={cn(
                "h-16 px-10 rounded-full text-sm font-black uppercase tracking-widest flex items-center gap-4 transition-all shadow-xl hover:shadow-black/10",
                (step === 0 && !details.title)
                  ? "bg-black/5 text-black/20 cursor-not-allowed" 
                  : "bg-black text-[#D4FB46] hover:scale-105 active:scale-95"
              )}
            >
              {activeModule ? 'Save Changes' : (step === currentSteps.length - 1 ? 'Create Event' : 'Next Step')}
              {!activeModule && step !== currentSteps.length - 1 && <ArrowRight className="w-5 h-5" />}
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
};
