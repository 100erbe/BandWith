import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Play, Pause, Square, SkipForward, Mic2, MessageSquare, 
  CheckCircle2, AlertTriangle, XCircle, RotateCcw, Clock, 
  Music, ChevronRight, User, Settings, Volume2, Plus, FileText
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { RehearsalSong } from './types';

// Mock Data for Live Session
const LIVE_SETLIST: RehearsalSong[] = [
  { id: 's1', title: "Sweet Child O' Mine", artist: "Guns N' Roses", duration: "5:56", priority: 'high', type: 'song', status: 'played' },
  { id: 's2', title: "Bohemian Rhapsody", artist: "Queen", duration: "6:07", priority: 'medium', type: 'song', status: 'playing' },
  { id: 's3', title: "Purple Rain", artist: "Prince", duration: "8:41", priority: 'high', type: 'song', status: 'pending' },
  { id: 'b1', title: "Set Break", artist: "", duration: "15:00", priority: 'low', type: 'break', status: 'pending' },
  { id: 's4', title: "Hotel California", artist: "Eagles", duration: "6:30", priority: 'low', type: 'song', status: 'pending' },
];

const ATTENDANCE = [
  { id: '1', initials: 'GB', status: 'arrived', time: '21:00' },
  { id: '2', initials: 'CE', status: 'arrived', time: '21:05' },
  { id: '3', initials: 'MR', status: 'arrived', time: '21:02' },
  { id: '4', initials: 'LB', status: 'late', time: '' },
];

interface Props {
  onClose: () => void;
  onFinish: () => void;
}

export const RehearsalLiveView: React.FC<Props> = ({ onClose, onFinish }) => {
  const [elapsed, setElapsed] = useState(2843); // 47m 23s
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeSongIndex, setActiveSongIndex] = useState(1);
  const [showMetronome, setShowMetronome] = useState(false);
  const [bpm, setBpm] = useState(120);

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(e => e + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentSong = LIVE_SETLIST[activeSongIndex];

  return (
    <div 
      className="fixed inset-0 z-[200] bg-background text-accent-foreground flex flex-col font-sans"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-destructive/100 animate-pulse" />
                <span className="font-black text-destructive uppercase tracking-widest text-xs">Live Rehearsal</span>
            </div>
            <button onClick={onClose} className="px-4 py-2 rounded-full bg-surface-inverse-foreground/10 hover:bg-muted/20 text-xs font-bold uppercase transition-colors">
                Exit Live Mode
            </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            
            {/* Timer Big */}
            <div className="text-center py-6">
                <div className="text-6xl font-black tabular-nums tracking-tighter mb-2">{formatTime(elapsed)}</div>
                <div className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Total Elapsed Time</div>
            </div>

            {/* Now Playing Card */}
            <div className="bg-surface-inverse rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl border border-border/5">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Music className="w-48 h-48" />
                </div>
                
                <div className="relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                           <span className="text-accent text-xs font-bold uppercase tracking-widest mb-2 block">Now Playing</span>
                           <h2 className="text-4xl font-black leading-tight mb-1">{currentSong.title}</h2>
                           <p className="text-xl font-bold text-muted-foreground uppercase">{currentSong.artist}</p>
                        </div>
                        <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground font-black text-2xl">
                           {activeSongIndex + 1}
                        </div>
                    </div>

                    {/* Progress Bar Mock */}
                    <div className="bg-surface-inverse/50 h-16 rounded-2xl mb-8 relative overflow-hidden flex items-center px-4 border border-border/5">
                        <div className="absolute left-0 top-0 bottom-0 bg-accent/20 w-[60%]" />
                        <div className="relative z-10 w-full flex justify-between font-mono font-bold text-sm">
                            <span>3:42</span>
                            <span>{currentSong.duration}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="grid grid-cols-4 gap-4">
                        <button 
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="h-20 rounded-2xl bg-accent text-accent-foreground flex items-center justify-center hover:scale-[1.02] transition-transform shadow-lg"
                        >
                            {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current" />}
                        </button>
                        <button className="h-20 rounded-2xl bg-surface-inverse text-accent-foreground flex items-center justify-center hover:bg-surface-inverse">
                            <Square className="w-6 h-6 fill-current" />
                        </button>
                         <button onClick={() => setActiveSongIndex(i => Math.min(i+1, LIVE_SETLIST.length-1))} className="h-20 rounded-2xl bg-surface-inverse text-accent-foreground flex items-center justify-center hover:bg-surface-inverse">
                            <SkipForward className="w-8 h-8 fill-current" />
                        </button>
                        <button className="h-20 rounded-2xl bg-surface-inverse text-destructive flex items-center justify-center hover:bg-surface-inverse">
                            <Mic2 className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Feedback */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: 'Nailed It', icon: CheckCircle2, color: 'text-success' },
                    { label: 'Needs Work', icon: AlertTriangle, color: 'text-warning' },
                    { label: 'Problems', icon: XCircle, color: 'text-destructive' },
                    { label: 'Redo', icon: RotateCcw, color: 'text-accent-quote' },
                ].map((fb, i) => (
                    <button key={i} className="bg-surface-inverse p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-surface-inverse transition-colors border border-border/5">
                        <fb.icon className={cn("w-6 h-6", fb.color)} />
                        <span className="text-xs font-bold uppercase text-muted-foreground">{fb.label}</span>
                    </button>
                ))}
            </div>

            {/* Attendance & Tools */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-surface-inverse p-4 rounded-3xl border border-border/5">
                     <h3 className="text-xs font-bold uppercase text-muted-foreground mb-3">Check-In</h3>
                     <div className="space-y-2">
                         {ATTENDANCE.map(m => (
                             <div key={m.id} className="flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                     <div className={cn("w-2 h-2 rounded-full", m.status === 'arrived' ? "bg-success/100" : "bg-warning/100 animate-pulse")} />
                                     <span className="font-bold">{m.initials}</span>
                                 </div>
                                 <span className="text-xs font-mono text-muted-foreground">{m.time || 'Not yet'}</span>
                             </div>
                         ))}
                     </div>
                 </div>

                 <div className="bg-surface-inverse p-4 rounded-3xl border border-border/5">
                     <h3 className="text-xs font-bold uppercase text-muted-foreground mb-3">Tools</h3>
                     <div className="grid grid-cols-3 gap-2">
                         <button onClick={() => setShowMetronome(true)} className="aspect-square bg-surface-inverse rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-surface-inverse">
                             <Clock className="w-5 h-5 text-accent" />
                             <span className="text-xs font-bold uppercase">Metronome</span>
                         </button>
                          <button className="aspect-square bg-surface-inverse rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-surface-inverse">
                             <FileText className="w-5 h-5 text-accent-foreground" />
                             <span className="text-xs font-bold uppercase">Scores</span>
                         </button>
                          <button className="aspect-square bg-surface-inverse rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-surface-inverse">
                             <MessageSquare className="w-5 h-5 text-accent-foreground" />
                             <span className="text-xs font-bold uppercase">Chat</span>
                         </button>
                     </div>
                 </div>
            </div>
            
            <button 
                onClick={onFinish}
                className="w-full py-4 bg-destructive/100/10 text-destructive rounded-2xl font-bold uppercase tracking-widest border border-destructive/20 hover:bg-destructive/20 mt-4"
            >
                End Session
            </button>
        </div>

        {/* Metronome Modal */}
        <AnimatePresence>
            {showMetronome && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute bottom-6 left-6 right-6 bg-surface-inverse rounded-4xl p-6 shadow-2xl border border-border z-50"
                >
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="text-xl font-black uppercase">Metronome</h3>
                        <button onClick={() => setShowMetronome(false)}><X className="w-6 h-6" /></button>
                    </div>
                    
                    <div className="flex items-center justify-center gap-8 mb-8">
                        <button onClick={() => setBpm(b => b-5)} className="w-12 h-12 rounded-full bg-surface-inverse/20 flex items-center justify-center text-2xl font-black hover:bg-overlay/40">-</button>
                        <div className="text-center">
                            <div className="text-6xl font-black text-accent tabular-nums">{bpm}</div>
                            <div className="text-xs font-bold uppercase text-muted-foreground">BPM</div>
                        </div>
                        <button onClick={() => setBpm(b => b+5)} className="w-12 h-12 rounded-full bg-surface-inverse/20 flex items-center justify-center text-2xl font-black hover:bg-overlay/40">+</button>
                    </div>

                    <button className="w-full py-4 bg-accent text-accent-foreground rounded-xl font-black uppercase flex items-center justify-center gap-2">
                        <Play className="w-5 h-5 fill-current" /> Start
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
};
