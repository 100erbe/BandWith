import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Play, Pause, Square, SkipForward, Mic2, MessageSquare,
  CheckCircle2, AlertTriangle, XCircle, RotateCcw, Clock,
  Plus, Minus, FileText
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { Card, IconButton, PillButton } from '@/app/components/bw';
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
      className="dark fixed inset-0 z-[200] bg-sheet text-foreground flex flex-col"
      style={{
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'var(--safe-bottom)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 min-h-[60px]">
        <span className="flex items-center gap-2 bw-label-sm text-destructive">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive-solid animate-pulse" />
          Live rehearsal
        </span>
        <PillButton variant="outline" size="sm" fullWidth={false} onClick={onClose}>
          Exit live mode
        </PillButton>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-4">
        {/* Timer */}
        <div className="flex flex-col items-center gap-2 py-6">
          <span className="bw-value-xl">{formatTime(elapsed)}</span>
          <span className="bw-label-sm text-muted-foreground">Total elapsed time</span>
        </div>

        {/* Now Playing */}
        <Card className="p-5 gap-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="bw-label-sm text-accent">Now playing</span>
              <h2 className="bw-h1 [overflow-wrap:anywhere]">{currentSong.title}</h2>
              <p className="bw-body-lg text-muted-foreground">{currentSong.artist}</p>
            </div>
            <span className="w-14 h-14 rounded-full bg-accent text-accent-foreground bw-value-md flex items-center justify-center shrink-0">
              {activeSongIndex + 1}
            </span>
          </div>

          {/* Progress (mock) */}
          <div className="relative h-12 rounded-full bg-foreground/[0.08] overflow-hidden flex items-center px-4">
            <div className="absolute inset-y-0 left-0 w-[60%] bg-accent/25" />
            <div className="relative w-full flex justify-between bw-label-md">
              <span>3:42</span>
              <span>{currentSong.duration}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={() => setIsPlaying(!isPlaying)}
              className="h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center active:scale-[0.97] transition-transform"
            >
              {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current" />}
            </button>
            <button
              type="button"
              aria-label="Stop"
              className="h-16 rounded-full bg-foreground/[0.08] flex items-center justify-center active:scale-[0.97] transition-transform"
            >
              <Square className="w-6 h-6 fill-current" />
            </button>
            <button
              type="button"
              aria-label="Next song"
              onClick={() => setActiveSongIndex((i) => Math.min(i + 1, LIVE_SETLIST.length - 1))}
              className="h-16 rounded-full bg-foreground/[0.08] flex items-center justify-center active:scale-[0.97] transition-transform"
            >
              <SkipForward className="w-7 h-7 fill-current" />
            </button>
            <button
              type="button"
              aria-label="Record"
              className="h-16 rounded-full bg-foreground/[0.08] text-destructive flex items-center justify-center active:scale-[0.97] transition-transform"
            >
              <Mic2 className="w-6 h-6" />
            </button>
          </div>
        </Card>

        {/* Quick Feedback */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Nailed it', icon: CheckCircle2, color: 'text-success' },
            { label: 'Needs work', icon: AlertTriangle, color: 'text-warning' },
            { label: 'Problems', icon: XCircle, color: 'text-destructive' },
            { label: 'Redo', icon: RotateCcw, color: 'text-[var(--accent-rehearsal-ink)]' },
          ].map((fb) => (
            <button
              key={fb.label}
              type="button"
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-[16px] bg-card active:scale-[0.97] transition-transform"
            >
              <fb.icon className={cn('w-6 h-6', fb.color)} />
              <span className="bw-label-xs text-muted-foreground text-center">{fb.label}</span>
            </button>
          ))}
        </div>

        {/* Attendance & Tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h3 className="bw-label-sm text-muted-foreground">Check-in</h3>
            <div className="flex flex-col gap-2">
              {ATTENDANCE.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full',
                        m.status === 'arrived' ? 'bg-success' : 'bg-warning animate-pulse'
                      )}
                    />
                    <span className="bw-label-md">{m.initials}</span>
                  </span>
                  <span className="bw-label-sm text-muted-foreground">{m.time || 'Not yet'}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="bw-label-sm text-muted-foreground">Tools</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Metronome', icon: Clock, cls: 'text-accent', onClick: () => setShowMetronome(true) },
                { label: 'Scores', icon: FileText, cls: '', onClick: undefined },
                { label: 'Chat', icon: MessageSquare, cls: '', onClick: undefined },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={t.onClick}
                  className="aspect-square rounded-[16px] bg-foreground/[0.08] flex flex-col items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
                >
                  <t.icon className={cn('w-5 h-5', t.cls)} />
                  <span className="bw-label-xs">{t.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <PillButton
          variant="outline"
          onClick={onFinish}
          className="mt-2 border-destructive text-destructive"
        >
          End session
        </PillButton>
      </div>

      {/* Metronome */}
      <AnimatePresence>
        {showMetronome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            role="dialog"
            aria-label="Metronome"
            className="absolute left-4 right-4 z-50 bg-card rounded-[24px] p-5 shadow-2xl flex flex-col gap-6"
            style={{ bottom: 'calc(var(--safe-bottom) + 16px)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="bw-h2">Metronome</h3>
              <IconButton label="Close metronome" icon={<X />} size="sm" onClick={() => setShowMetronome(false)} />
            </div>

            <div className="flex items-center justify-center gap-8">
              <IconButton label="Slower" icon={<Minus />} onClick={() => setBpm((b) => b - 5)} />
              <div className="flex flex-col items-center gap-1">
                <span className="bw-value-xl text-accent">{bpm}</span>
                <span className="bw-label-sm text-muted-foreground">BPM</span>
              </div>
              <IconButton label="Faster" icon={<Plus />} onClick={() => setBpm((b) => b + 5)} />
            </div>

            <PillButton icon={<Play className="w-5 h-5 fill-current" />}>Start</PillButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
