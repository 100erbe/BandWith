import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ChevronDown,
  Music,
  Activity,
  MapPin,
  Calendar as CalendarIcon,
  RotateCw,
  Play,
  ListMusic,
  CheckCircle2,
  Mic2,
  Radio,
  X
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { ExpandedCardWrapper } from './ExpandedCardWrapper';
import { EventItem } from '@/app/data/events';
import { RehearsalViewMode } from '@/app/types';

interface RehearsalDetails {
  setlist: Array<{ id: string; title: string; key?: string; bpm?: number; duration?: string }>;
  tasks: Array<{ label?: string; text?: string; assigned?: string; assignee?: string; done?: boolean; completed?: boolean }>;
  timeline: Array<{ time: string; label: string; icon: any; active?: boolean }>;
}

interface RehearsalExpandedProps {
  upcomingRehearsals: EventItem[];
  currentRehearsal: EventItem;
  currentDetails: RehearsalDetails | null;
  rehearsalIndex: number;
  setRehearsalIndex: (index: number | ((prev: number) => number)) => void;
  rehearsalViewMode: RehearsalViewMode;
  setRehearsalViewMode: (mode: RehearsalViewMode) => void;
  isLive: boolean;
  onClose: () => void;
  onDecline: () => void;
}

export const RehearsalExpanded: React.FC<RehearsalExpandedProps> = ({
  upcomingRehearsals,
  currentRehearsal,
  currentDetails,
  rehearsalIndex,
  setRehearsalIndex,
  rehearsalViewMode,
  setRehearsalViewMode,
  isLive,
  onClose,
  onDecline
}) => {
  const handleBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (rehearsalViewMode === 'index') {
      onClose();
    } else if (rehearsalViewMode === 'overview') {
      if (upcomingRehearsals.length > 1) {
        setRehearsalViewMode('index');
      } else {
        onClose();
      }
    } else if (!isLive) {
      setRehearsalViewMode('overview');
    }
  };

  return (
    <ExpandedCardWrapper
      backgroundColor="var(--accent-rehearsal)"
      onClose={onClose}
      origin={{ top: '30%', left: '3%', right: '3%', bottom: '52%' }}
    >
      {/* Header */}
      <motion.div 
        className="sticky top-0 z-50 p-6 flex items-center justify-between bg-accent-rehearsal/95 backdrop-blur-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <button 
            onClick={handleBack} 
            className="w-10 h-10 rounded-full bg-surface-inverse-foreground/10 flex items-center justify-center text-accent-foreground border border-border hover:bg-muted/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {rehearsalViewMode !== 'overview' && rehearsalViewMode !== 'index' && (
            <span className="text-xl font-black text-accent-foreground uppercase tracking-tight">
              {rehearsalViewMode === 'post' ? 'Summary' : rehearsalViewMode}
            </span>
          )}
          {rehearsalViewMode === 'index' && (
            <span className="text-xl font-black text-accent-foreground uppercase tracking-tight">Rehearsals</span>
          )}
        </div>
        
        {rehearsalViewMode === 'overview' && (
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold tracking-[0.2em] text-accent-foreground/60 uppercase">Rehearsal</span>
            {upcomingRehearsals.length > 1 && (
              <div className="flex items-center gap-2 mt-1">
                <button 
                  onClick={() => setRehearsalIndex(prev => prev > 0 ? prev - 1 : upcomingRehearsals.length - 1)} 
                  className="p-1 hover:bg-surface-inverse-foreground/10 rounded"
                >
                  <ChevronDown className="w-3 h-3 rotate-90 text-accent-foreground" />
                </button>
                <span className="text-xs font-bold text-accent-foreground tabular-nums">{rehearsalIndex + 1}/{upcomingRehearsals.length}</span>
                <button 
                  onClick={() => setRehearsalIndex(prev => prev < upcomingRehearsals.length - 1 ? prev + 1 : 0)} 
                  className="p-1 hover:bg-surface-inverse-foreground/10 rounded"
                >
                  <ChevronDown className="w-3 h-3 -rotate-90 text-accent-foreground" />
                </button>
              </div>
            )}
          </div>
        )}
        <div className="w-10" />
      </motion.div>

      {/* Content Container */}
      <div className="flex-1 px-3 pb-32 max-w-md mx-auto w-full text-accent-foreground relative">
        <AnimatePresence mode="wait">
          {/* INDEX VIEW */}
          {rehearsalViewMode === 'index' && (
            <motion.div
              key="index"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3 pb-24"
            >
              {/* Hero Section */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                transition={{ delay: 0.3 }} 
                className="bg-surface-inverse-foreground/10 rounded-[2.5rem] p-6 mb-6 border border-border relative overflow-hidden"
              >
                <div className="absolute -right-4 -top-4 w-32 h-32 bg-accent-rehearsal rounded-full blur-2xl opacity-20" />
                
                <div className="relative z-10 flex justify-between items-end">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-accent-foreground/60 mb-1 block">Overview</span>
                    <h2 className="text-3xl font-black text-accent-foreground leading-tight mb-4">Rehearsal<br/>Schedule</h2>
                    <div className="flex gap-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase text-accent-foreground/40">Total</span>
                        <span className="text-xl font-bold text-accent-foreground">{upcomingRehearsals.length}</span>
                      </div>
                      <div className="w-px h-8 bg-muted/20" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase text-accent-foreground/40">Next</span>
                        <span className="text-xl font-bold text-accent-rehearsal">{upcomingRehearsals[0]?.time}</span>
                      </div>
                      <div className="w-px h-8 bg-muted/20" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase text-accent-foreground/40">Focus</span>
                        <span className="text-xl font-bold text-accent-foreground">Jazz</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-border flex items-center justify-center animate-spin-slow">
                    <RotateCw className="w-6 h-6 text-accent-foreground/40" />
                  </div>
                </div>
              </motion.div>

              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-accent-foreground/60 mb-4 px-2">Upcoming Sessions</h2>
              {upcomingRehearsals.map((rehearsal, i) => (
                <motion.div
                  key={rehearsal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => {
                    setRehearsalIndex(i);
                    setRehearsalViewMode('overview');
                  }}
                  className="bg-card rounded-4xl p-5 relative overflow-hidden cursor-pointer group hover:scale-[0.98] transition-transform shadow-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      {i === 0 && <span className="w-2 h-2 rounded-full bg-accent-rehearsal animate-pulse" />}
                      <span className="text-xs font-bold uppercase text-accent-rehearsal tracking-widest">
                        {i === 0 ? 'Next Up' : 'Scheduled'}
                      </span>
                    </div>
                    <span className="text-sm font-black text-foreground tabular-nums bg-muted px-2 py-0.5 rounded-lg">
                      {rehearsal.time}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-black text-foreground uppercase leading-tight mb-4 truncate">{rehearsal.title}</h3>
                  
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold uppercase">{rehearsal.date}</span>
                    </div>
                    <div className="w-px h-3 bg-muted" />
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold uppercase truncate max-w-30">{rehearsal.location}</span>
                    </div>
                  </div>
                  
                  <div className="absolute bottom-5 right-5 flex -space-x-2">
                    {rehearsal.members.map((m: string, idx: number) => (
                      <div key={idx} className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-bold text-foreground shadow-sm">
                        {m}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* OVERVIEW VIEW */}
          {rehearsalViewMode === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {/* Swiss Hero Detail */}
              <div className="bg-card rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] transform rotate-12 group-hover:rotate-0 transition-transform duration-700">
                  <Music className="w-40 h-40 text-foreground" />
                </div>

                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="flex flex-col gap-1">
                    <span className="inline-flex items-center gap-1.5 bg-accent-rehearsal/10 text-accent-rehearsal px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide w-fit">
                      <Activity className="w-3 h-3" /> {currentRehearsal.status}
                    </span>
                    <span className="text-xs font-bold uppercase text-muted-foreground tracking-widest pl-1">{currentRehearsal.date}</span>
                  </div>
                  <div className="bg-surface-inverse text-surface-inverse-foreground px-3 py-1.5 rounded-xl">
                    <span className="text-lg font-black tracking-tight">{currentRehearsal.time}</span>
                  </div>
                </div>

                <h2 className="text-4xl font-black text-foreground tracking-tighter uppercase leading-[0.85] mb-6 relative z-10 max-w-70">
                  {currentRehearsal.title}
                </h2>

                <div className="bg-muted rounded-2xl p-4 border border-border flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm text-foreground">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase text-muted-foreground block leading-tight mb-0.5">Location</span>
                      <span className="text-xs font-bold text-foreground uppercase">{currentRehearsal.location}</span>
                    </div>
                  </div>
                  <div className="flex -space-x-2">
                    {currentRehearsal.members.map((m: string, i: number) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-card border-2 border-border flex items-center justify-center text-xs font-bold text-foreground shadow-sm">
                        {m}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Timeline Strip */}
              {currentDetails?.timeline && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: 0.1 }} 
                  className="bg-surface-inverse-foreground/10 rounded-4xl p-5 border border-border backdrop-blur-md"
                >
                  <div className="flex justify-between items-center relative">
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-muted/20 -translate-y-1/2" />
                    {currentDetails.timeline.map((step: any, i: number) => (
                      <div key={i} className="relative z-10 flex flex-col items-center gap-2 group cursor-pointer">
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full border-2 transition-all duration-300", 
                          step.active 
                            ? "bg-accent-rehearsal border-accent-rehearsal scale-125 shadow-[0_0_10px_var(--accent-rehearsal)]" 
                            : "bg-accent-rehearsal border-border/40 group-hover:border-border"
                        )} />
                        <span className={cn(
                          "text-xs font-bold tabular-nums", 
                          step.active ? "text-accent-foreground" : "text-accent-foreground/40"
                        )}>{step.time}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => setRehearsalViewMode('live')}
                className="w-full py-4 bg-accent-rehearsal text-accent-rehearsal-foreground rounded-4xl font-black uppercase text-sm tracking-wider hover:scale-[1.02] transition-transform shadow-lg flex items-center justify-center gap-2 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-muted/20 animate-[pulse_2s_infinite]" />
                <Play className="w-5 h-5 fill-current relative z-10" /> 
                <span className="relative z-10">Enter Live Mode</span>
              </motion.button>

              {/* Action Grid */}
              <div className="grid grid-cols-2 gap-4 mb-24">
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: 0.5 }}
                  onClick={() => setRehearsalViewMode('setlist')}
                  className="bg-surface-inverse-foreground/10 p-6 rounded-4xl border border-border hover:bg-muted/20 transition-colors cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-surface-inverse-foreground/10 flex items-center justify-center text-accent-foreground mb-4 group-hover:scale-110 transition-transform">
                    <ListMusic className="w-5 h-5" />
                  </div>
                  <span className="text-3xl font-black text-accent-foreground block mb-1">{currentDetails?.setlist?.length || 0}</span>
                  <span className="text-xs font-bold uppercase text-accent-foreground/60">Songs to Play</span>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, x: 10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: 0.5 }}
                  onClick={() => setRehearsalViewMode('tasks')}
                  className="bg-surface-inverse-foreground/10 p-6 rounded-4xl border border-border hover:bg-muted/20 transition-colors cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-surface-inverse-foreground/10 flex items-center justify-center text-accent-foreground mb-4 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="text-3xl font-black text-accent-foreground block mb-1">
                    {currentDetails?.tasks?.filter((t: any) => !(t.done || t.completed)).length || 0}
                  </span>
                  <span className="text-xs font-bold uppercase text-accent-foreground/60">Pending Tasks</span>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* SETLIST VIEW */}
          {rehearsalViewMode === 'setlist' && (
            <motion.div 
              key="setlist" 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }} 
              className="space-y-4"
            >
              <div className="bg-surface-inverse-foreground/10 rounded-4xl p-6 border border-border">
                <h3 className="text-xl font-black text-accent-foreground mb-4 flex items-center gap-2">
                  <ListMusic className="w-5 h-5" /> Setlist
                </h3>
                <div className="space-y-2">
                  {currentDetails?.setlist?.map((song: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-surface-inverse/20 rounded-xl hover:bg-surface-inverse/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-accent-foreground/40 w-4">{i + 1}</span>
                        <div>
                          <span className="text-sm font-bold text-accent-foreground block">{song.title}</span>
                          <span className="text-xs font-bold text-accent-foreground/50 uppercase">
                            {song.key || '-'} • {song.bpm || '-'} BPM
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-accent-foreground/60">{song.duration || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* TASKS VIEW */}
          {rehearsalViewMode === 'tasks' && (
            <motion.div 
              key="tasks" 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }} 
              className="space-y-4"
            >
              <div className="bg-surface-inverse-foreground/10 rounded-4xl p-6 border border-border">
                <h3 className="text-xl font-black text-accent-foreground mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Tasks
                </h3>
                <div className="space-y-3">
                  {currentDetails?.tasks?.map((task: any, i: number) => {
                    const isDone = task.done || task.completed;
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 bg-surface-inverse/20 rounded-xl">
                        <DotCheckbox
                          checked={isDone}
                          activeColor="var(--accent-rehearsal)"
                          inactiveColor="var(--dot-inactive)"
                        />
                        <div className="flex-1">
                          <span className={cn(
                            "text-sm font-bold block", 
                            isDone ? "text-accent-foreground/40 line-through" : "text-accent-foreground"
                          )}>
                            {task.label || task.text}
                          </span>
                          <span className="text-xs font-bold text-accent-foreground/40 uppercase">
                            Assigned to: {task.assigned || task.assignee}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* LIVE VIEW (Placeholder) */}
          {rehearsalViewMode === 'live' && (
            <motion.div 
              key="live" 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="h-full flex flex-col items-center justify-center text-center"
            >
              <div className="w-32 h-32 rounded-full border-4 border-accent flex items-center justify-center animate-pulse mb-8 relative">
                <div className="absolute inset-0 bg-accent-rehearsal/20 rounded-full animate-ping" />
                <Mic2 className="w-12 h-12 text-accent-rehearsal" />
              </div>
              <h2 className="text-4xl font-black text-accent-foreground uppercase tracking-tighter mb-2">Live Session</h2>
              <p className="text-accent-foreground/60 font-bold uppercase tracking-widest text-sm mb-12">Recording & Tracking Time</p>
              <div className="text-6xl font-black text-accent-foreground tabular-nums tracking-tighter mb-8">00:00:00</div>
              <button 
                onClick={() => setRehearsalViewMode('overview')} 
                className="px-8 py-3 bg-destructive/100 rounded-full font-black uppercase text-accent-foreground shadow-xl hover:scale-105 transition-transform"
              >
                End Session
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Actions */}
      {rehearsalViewMode === 'overview' && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 p-6 bg-accent-rehearsal/95 backdrop-blur-md border-t border-border z-50 flex gap-4 max-w-md mx-auto"
        >
          <button 
            onClick={() => setRehearsalViewMode('live')}
            className="flex-1 h-14 bg-accent-rehearsal rounded-full flex items-center justify-center gap-2 text-accent-rehearsal-foreground font-black uppercase tracking-wide text-sm hover:scale-105 transition-transform shadow-lg"
          >
            <Radio className="w-5 h-5 animate-pulse" /> Check In / Live
          </button>
          <button 
            onClick={onDecline}
            className="h-14 w-14 rounded-full border border-border/30 flex items-center justify-center text-surface-inverse-foreground/70 hover:text-surface-inverse-foreground hover:border-border transition-colors bg-surface-inverse/20"
          >
            <X className="w-6 h-6" />
          </button>
        </motion.div>
      )}
    </ExpandedCardWrapper>
  );
};
