import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Play, Pause, SkipBack, SkipForward, MessageSquare,
  CheckCircle2, AlertTriangle, XCircle, RotateCcw, Clock,
  Plus, Minus, FileText
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { Card, IconButton, PillButton } from '@/app/components/bw';
import { RailCover, useRailAction, useRailTone } from '@/lib/railActions';
import { setStatusBarTone } from '@/lib/systemBars';
import { useT } from '@/lib/i18n';
import type { EventItem } from '@/app/data/events';
import { useRehearsalSetlist } from './useRehearsalSetlist';
import {
  elapsedSeconds, endSession, formatClock, scheduledStart, sessionKey, startSession, togglePause, updateSession,
  type RehearsalSession, type SongVerdict,
} from '@/lib/rehearsalSession';

/** A member on the rehearsal's lineup. */
export interface RehearsalLineupMember {
  userId: string;
  name: string;
}

interface Props {
  rehearsal: EventItem;
  lineup: RehearsalLineupMember[];
  onClose: () => void;
  onFinish: () => void;
}

const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const RehearsalLiveView: React.FC<Props> = ({ rehearsal, lineup, onClose, onFinish }) => {
  const t = useT();
  const exitInRail = useRailAction(onClose, { label: t('Exit live mode'), icon: <X /> });
  // Dark canvas: light system icons, and the iPhone Duo rail in dark glass.
  useEffect(() => setStatusBarTone('dark'), []);
  useRailTone('dark');
  // This rehearsal's session: it keeps running when live mode is left and
  // reopened, and the summary reads it after End session.
  const key = sessionKey(rehearsal.eventId ?? rehearsal.id, rehearsal.date);
  const [session, setSession] = useState<RehearsalSession>(() =>
    startSession(key, scheduledStart(rehearsal.date, rehearsal.time)),
  );
  const update = (patch: (s: RehearsalSession) => Partial<RehearsalSession>) => {
    const next = updateSession(key, patch);
    if (next) setSession(next);
  };
  const setlist = useRehearsalSetlist(rehearsal.setlistId);
  const [now, setNow] = useState(() => Date.now());
  const [showMetronome, setShowMetronome] = useState(false);
  const [bpm, setBpm] = useState(120);
  const isPlaying = session.pausedAt === undefined;

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeSongIndex = Math.min(session.current, Math.max(setlist.length - 1, 0));
  const currentSong = setlist[activeSongIndex];
  const goTo = (i: number) => update((s) => ({ current: i, reached: Math.max(s.reached, i) }));
  const verdict = currentSong ? session.verdicts[currentSong.id] : undefined;
  const setVerdict = (v: SongVerdict) => {
    if (!currentSong) return;
    update((s) => {
      const verdicts = { ...s.verdicts };
      if (verdicts[currentSong.id] === v) delete verdicts[currentSong.id];
      else verdicts[currentSong.id] = v;
      return { verdicts };
    });
  };
  const toggleArrival = (userId: string) =>
    update((s) => {
      const arrivals = { ...s.arrivals };
      if (arrivals[userId]) delete arrivals[userId];
      else arrivals[userId] = Date.now();
      return { arrivals };
    });
  const songMeta = currentSong
    ? [currentSong.artist, currentSong.key, currentSong.bpm ? `${currentSong.bpm} BPM` : null].filter(Boolean).join(' · ')
    : '';

  return (
    <div
      className="bw-safe-inline dark fixed inset-0 z-[185] bg-sheet text-foreground flex flex-col"
      style={{
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'var(--safe-bottom)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 min-h-[60px]">
        <span className="flex items-center gap-2 bw-label-sm text-destructive">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive-solid animate-pulse" />
          {t('Live rehearsal')}
        </span>
        {/* iPhone Duo: the exit joins the side rail as a close (X). */}
        <RailCover />
        {!exitInRail && (
          <PillButton variant="outline" size="sm" fullWidth={false} onClick={onClose}>
            {t('Exit live mode')}
          </PillButton>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-4">
        {/* Timer */}
        <div className="flex flex-col items-center gap-2 py-6">
          <span className="bw-value-xl tabular-nums">{formatClock(elapsedSeconds(session, now))}</span>
          <span className="bw-label-sm text-muted-foreground">{t('Total elapsed time')}</span>
        </div>

        {/* Now Playing: the rehearsal's own setlist */}
        {currentSong ? (
          <Card className="p-5 gap-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="bw-label-sm text-accent">{t('Now playing')}</span>
                <h2 className="bw-h1 [overflow-wrap:anywhere]">{currentSong.title}</h2>
                {songMeta && <p className="bw-body-lg text-muted-foreground">{songMeta}</p>}
              </div>
              <span className="w-14 h-14 rounded-full bg-accent text-accent-foreground bw-value-md flex items-center justify-center shrink-0">
                {activeSongIndex + 1}
              </span>
            </div>

            <div className="relative h-12 rounded-full bg-foreground/[0.08] overflow-hidden flex items-center px-4">
              <div
                className="absolute inset-y-0 left-0 bg-accent/25"
                style={{ width: `${((activeSongIndex + 1) / setlist.length) * 100}%` }}
                aria-hidden="true"
              />
              <div className="relative w-full flex justify-between gap-3 bw-label-md">
                <span>{t('Song {index} of {count}', { index: activeSongIndex + 1, count: setlist.length })}</span>
                {currentSong.duration && <span>{currentSong.duration}</span>}
              </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                aria-label={t('Previous song')}
                disabled={activeSongIndex === 0}
                onClick={() => goTo(activeSongIndex - 1)}
                className="h-16 rounded-full bg-foreground/[0.08] flex items-center justify-center active:scale-[0.97] transition-transform disabled:opacity-40"
              >
                <SkipBack className="w-7 h-7 fill-current" />
              </button>
              <button
                type="button"
                aria-label={isPlaying ? t('Pause') : t('Play')}
                onClick={() => {
                  const next = togglePause(key);
                  if (next) setSession(next);
                }}
                className="h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center active:scale-[0.97] transition-transform"
              >
                {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current" />}
              </button>
              <button
                type="button"
                aria-label={t('Next song')}
                disabled={activeSongIndex >= setlist.length - 1}
                onClick={() => goTo(activeSongIndex + 1)}
                className="h-16 rounded-full bg-foreground/[0.08] flex items-center justify-center active:scale-[0.97] transition-transform disabled:opacity-40"
              >
                <SkipForward className="w-7 h-7 fill-current" />
              </button>
            </div>
          </Card>
        ) : (
          <Card className="p-5 gap-2">
            <h2 className="bw-h3">{t('No setlist yet')}</h2>
            <p className="bw-body-sm text-muted-foreground">{t('No songs picked for this rehearsal yet.')}</p>
          </Card>
        )}

        {/* Quick Feedback on the song on screen */}
        {currentSong && (
          <div className="grid grid-cols-4 gap-2">
            {([
              { id: 'nailed', label: t('Nailed it'), icon: CheckCircle2, color: 'text-success' },
              { id: 'work', label: t('Needs work'), icon: AlertTriangle, color: 'text-warning' },
              { id: 'problem', label: t('Problems'), icon: XCircle, color: 'text-destructive' },
              { id: 'redo', label: t('Redo'), icon: RotateCcw, color: 'text-[var(--accent-rehearsal-ink)]' },
            ] as const).map((fb) => (
              <button
                key={fb.id}
                type="button"
                aria-pressed={verdict === fb.id}
                onClick={() => setVerdict(fb.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-3 rounded-[16px] bg-card active:scale-[0.97] transition-transform',
                  verdict === fb.id && 'ring-2 ring-foreground',
                )}
              >
                <fb.icon className={cn('w-6 h-6', fb.color)} />
                <span className="bw-label-xs text-muted-foreground text-center">{fb.label}</span>
              </button>
            ))}
          </div>
        )}

        {rehearsal.notes?.trim() && (
          <Card>
            <h3 className="bw-label-sm text-muted-foreground">{t('Notes')}</h3>
            <p className="bw-body-md whitespace-pre-line [overflow-wrap:anywhere]">{rehearsal.notes}</p>
          </Card>
        )}

        {/* Attendance & Tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h3 className="bw-label-sm text-muted-foreground">{t('Check-in')}</h3>
            {lineup.length === 0 ? (
              <p className="bw-body-sm text-muted-foreground">{t('No one invited yet')}</p>
            ) : (
              <div className="flex flex-col">
                {lineup.map((m) => {
                  const arrived = session.arrivals[m.userId];
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      role="checkbox"
                      aria-checked={!!arrived}
                      onClick={() => toggleArrival(m.userId)}
                      className="min-h-11 flex items-center justify-between gap-3 text-left"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span
                          className={cn('w-2 h-2 rounded-full shrink-0', arrived ? 'bg-success' : 'bg-warning')}
                          aria-hidden="true"
                        />
                        <span className="bw-label-md truncate">{m.name}</span>
                      </span>
                      <span className="bw-label-sm text-muted-foreground shrink-0">{arrived ? hhmm(arrived) : t('Not yet')}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="bw-label-sm text-muted-foreground">{t('Tools')}</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: t('Metronome'), icon: Clock, cls: 'text-accent', onClick: () => setShowMetronome(true) },
                { label: t('Scores'), icon: FileText, cls: '', onClick: undefined },
                { label: t('Chat'), icon: MessageSquare, cls: '', onClick: undefined },
              ].map((tool) => (
                <button
                  key={tool.label}
                  type="button"
                  onClick={tool.onClick}
                  className="aspect-square rounded-[16px] bg-foreground/[0.08] flex flex-col items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
                >
                  <tool.icon className={cn('w-5 h-5', tool.cls)} />
                  <span className="bw-label-xs">{tool.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <PillButton
          variant="outline"
          onClick={() => {
            endSession(key);
            onFinish();
          }}
          className="mt-2 border-destructive text-destructive"
        >
          {t('End session')}
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
            aria-label={t('Metronome')}
            className="absolute left-4 right-4 z-50 bg-card rounded-[24px] p-5 shadow-2xl flex flex-col gap-6"
            style={{ bottom: 'calc(var(--safe-bottom) + 16px)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="bw-h2">{t('Metronome')}</h3>
              <IconButton label={t('Close metronome')} icon={<X />} size="sm" onClick={() => setShowMetronome(false)} />
            </div>

            <div className="flex items-center justify-center gap-8">
              <IconButton label={t('Slower')} icon={<Minus />} onClick={() => setBpm((b) => b - 5)} />
              <div className="flex flex-col items-center gap-1">
                <span className="bw-value-xl text-accent">{bpm}</span>
                <span className="bw-label-sm text-muted-foreground">BPM</span>
              </div>
              <IconButton label={t('Faster')} icon={<Plus />} onClick={() => setBpm((b) => b + 5)} />
            </div>

            <PillButton icon={<Play className="w-5 h-5 fill-current" />}>{t('Start')}</PillButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
