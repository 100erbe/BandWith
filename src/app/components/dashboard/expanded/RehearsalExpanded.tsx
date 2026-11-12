import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Mic2,
  Play,
  Radio,
  X
} from '@/app/components/icons';
import { Card, IconButton, Tag } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';
import { DotText, EventMark, Metric } from '@/app/components/bw';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { ExpandedCardWrapper, ExpandedTopBar } from './ExpandedCardWrapper';
import { EventItem } from '@/app/data/events';
import { RehearsalViewMode } from '@/app/types';
import { useEventTasks } from '@/lib/services/eventTasks';
import { getSetlist } from '@/lib/services/songs';
import { MapsLink } from '@/app/components/ui/MapsLink';
import { useT } from '@/lib/i18n';

type RehearsalSong = { id: string; title: string; key?: string; bpm?: number; duration?: string };

const hhmm = (time?: string) => (time ? time.slice(0, 5) : '');

interface RehearsalExpandedProps {
  upcomingRehearsals: EventItem[];
  currentRehearsal: EventItem;
  rehearsalIndex: number;
  setRehearsalIndex: (index: number | ((prev: number) => number)) => void;
  rehearsalViewMode: RehearsalViewMode;
  setRehearsalViewMode: (mode: RehearsalViewMode) => void;
  isLive: boolean;
  onClose: () => void;
  onDecline: () => void;
}

/** Member initials disc (Figma Event detail lineup avatar, small). */
const Initials: React.FC<{ value: string }> = ({ value }) => (
  <span className="w-8 h-8 rounded-full bg-white text-black border-[1.5px] border-black/15 flex items-center justify-center bw-label-sm shrink-0">
    {value}
  </span>
);

export const RehearsalExpanded: React.FC<RehearsalExpandedProps> = ({
  upcomingRehearsals,
  currentRehearsal,
  rehearsalIndex,
  setRehearsalIndex,
  rehearsalViewMode,
  setRehearsalViewMode,
  isLive,
  onClose,
  onDecline
}) => {
  const t = useT();
  const VIEW_TITLE: Partial<Record<RehearsalViewMode, string>> = {
    index: t('Rehearsals'),
    overview: t('Rehearsal'),
    setlist: t('Setlist'),
    tasks: t('Tasks'),
    live: t('Live'),
    post: t('Summary'),
  };
  // Shown names of the event status (the value stays as it is).
  const statusLabel: Record<string, string> = {
    CONFIRMED: t('CONFIRMED'),
    TENTATIVE: t('TENTATIVE'),
    DRAFT: t('DRAFT'),
    QUOTE: t('QUOTE'),
    REHEARSAL: t('REHEARSAL'),
  };
  const handleBack = (e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  // Real data of the rehearsal shown: its saved tasks and setlist.
  const { tasks, toggle: toggleTask, error: tasksError } = useEventTasks(currentRehearsal?.eventId);
  const setlistId = currentRehearsal?.setlistId;
  const [setlist, setSetlist] = useState<RehearsalSong[]>([]);
  useEffect(() => {
    if (!setlistId) {
      setSetlist([]);
      return;
    }
    let cancelled = false;
    getSetlist(setlistId).then(({ data }) => {
      if (cancelled) return;
      setSetlist(
        (data?.songs || []).map((row: any) => {
          const secs = row.song?.duration_seconds;
          return {
            id: row.id,
            title: row.song?.title || t('Untitled song'),
            key: row.song?.key || undefined,
            bpm: row.song?.bpm || undefined,
            duration: typeof secs === 'number' && secs > 0 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : undefined,
          };
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [setlistId, t]);

  const timeline = useMemo(() => {
    const steps: { time: string; label: string; active?: boolean }[] = [];
    if (currentRehearsal?.loadInTime) steps.push({ time: hhmm(currentRehearsal.loadInTime), label: t('Load-in') });
    if (currentRehearsal?.soundcheckTime) steps.push({ time: hhmm(currentRehearsal.soundcheckTime), label: t('Soundcheck') });
    if (currentRehearsal?.time) steps.push({ time: hhmm(currentRehearsal.time), label: t('Start'), active: true });
    if (currentRehearsal?.endTime) steps.push({ time: hhmm(currentRehearsal.endTime), label: t('End') });
    return steps;
  }, [currentRehearsal?.loadInTime, currentRehearsal?.soundcheckTime, currentRehearsal?.time, currentRehearsal?.endTime, t]);

  const pendingTasks = tasks.filter((task) => !task.is_completed).length;
  const songCount = setlist.length;

  return (
    <ExpandedCardWrapper
      backgroundColor="var(--bg)"
      onClose={onClose}
      origin={{ top: '30%', left: '3%', right: '3%', bottom: '52%' }}
    >
      {/* Header (Figma Top Bar) */}
      <ExpandedTopBar
        title={VIEW_TITLE[rehearsalViewMode] ?? String(rehearsalViewMode)}
        onBack={() => handleBack()}
        meta={
          rehearsalViewMode === 'overview' && upcomingRehearsals.length > 1 ? (
            <span className="flex items-center gap-1">
              <IconButton
                label={t('Previous rehearsal')}
                size="sm"
                variant="ghost"
                icon={<ChevronLeft />}
                onClick={() => setRehearsalIndex(prev => prev > 0 ? prev - 1 : upcomingRehearsals.length - 1)}
              />
              <span className="bw-label-sm tabular-nums">{rehearsalIndex + 1}/{upcomingRehearsals.length}</span>
              <IconButton
                label={t('Next rehearsal')}
                size="sm"
                variant="ghost"
                icon={<ChevronRight />}
                onClick={() => setRehearsalIndex(prev => prev < upcomingRehearsals.length - 1 ? prev + 1 : 0)}
              />
            </span>
          ) : rehearsalViewMode === 'index' ? (
            <span className="bw-label-sm text-muted-foreground">{upcomingRehearsals.length}</span>
          ) : undefined
        }
      />

      {/* Content */}
      <div
        className="flex-1 flex flex-col px-4 pt-2 max-w-[700px] w-full mx-auto bg-background text-foreground"
        style={{ paddingBottom: rehearsalViewMode === 'overview' ? 'calc(var(--safe-bottom) + 112px)' : 'calc(var(--safe-bottom) + 40px)' }}
      >
        <AnimatePresence mode="wait">
          {/* INDEX VIEW */}
          {rehearsalViewMode === 'index' && (
            <motion.div
              key="index"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-8"
            >
              {/* Metrics */}
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8">
                <Metric label={t('Sessions')} value={upcomingRehearsals.length} fill={upcomingRehearsals.length / 48} />
                <Metric label={t('Next')} value={upcomingRehearsals[0]?.time || '--'} fill={upcomingRehearsals.length > 0 ? 1 / 48 : 0} />
              </div>

              <section className="flex flex-col gap-4">
                <h2 className="bw-label-md text-foreground">{t('Upcoming sessions')}</h2>
                {upcomingRehearsals.length === 0 ? (
                  <Card className="items-center text-center py-8">
                    <h3 className="bw-h3">{t('No rehearsals scheduled')}</h3>
                  </Card>
                ) : (
                  upcomingRehearsals.map((rehearsal, i) => (
                    <motion.button
                      type="button"
                      key={rehearsal.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => {
                        setRehearsalIndex(i);
                        setRehearsalViewMode('overview');
                      }}
                      className="w-full flex items-center gap-4 p-3 pr-4 rounded-[24px] bg-card text-card-foreground text-left active:scale-[0.99] transition-transform"
                    >
                      <EventMark kind="rehearsal" size={32} />
                      <span className="flex-1 min-w-0 flex flex-col gap-1">
                        {i === 0 && <Tag variant="rehearsal" className="self-start">{t('Next up')}</Tag>}
                        <span className="bw-h3 truncate">{rehearsal.title}</span>
                        <span className="bw-body-sm text-muted-foreground truncate">
                          {[rehearsal.date, rehearsal.location].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {rehearsal.time && <span className="bw-label-md shrink-0 whitespace-nowrap">{rehearsal.time}</span>}
                    </motion.button>
                  ))
                )}
              </section>
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
              className="flex flex-col gap-4"
            >
              {/* Hero (event colour, Figma Event detail header) */}
              <div className="rounded-[24px] p-5 flex flex-col gap-4 bg-accent-rehearsal text-accent-rehearsal-foreground">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <EventMark kind="rehearsal" size={20} bare />
                    <span className="bw-label-xs">{t('Rehearsal')}</span>
                    {currentRehearsal.status && (
                      <span
                        className="bw-label-xs h-4 px-1.5 rounded-full inline-flex items-center"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--accent-rehearsal-fg) 12%, transparent)' }}
                      >
                        {statusLabel[currentRehearsal.status] ?? currentRehearsal.status}
                      </span>
                    )}
                  </span>
                  {currentRehearsal.time && <span className="bw-num shrink-0">{currentRehearsal.time}</span>}
                </div>
                <h2 className="bw-h1 [overflow-wrap:anywhere]">{currentRehearsal.title}</h2>
                <div className="flex items-end justify-between gap-3">
                  <span className="flex flex-col gap-1 min-w-0">
                    {currentRehearsal.location && (
                      <MapsLink
                        pin
                        query={[
                          currentRehearsal.location,
                          currentRehearsal.venueAddress && currentRehearsal.venueAddress !== currentRehearsal.location
                            ? currentRehearsal.venueAddress
                            : currentRehearsal.venueCity,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                        className="bw-label-md"
                      >
                        {currentRehearsal.location}
                      </MapsLink>
                    )}
                    {currentRehearsal.date && <span className="bw-label-xs opacity-70">{currentRehearsal.date}</span>}
                  </span>
                  {currentRehearsal.members?.length > 0 && (
                    <span className="flex -space-x-2 shrink-0">
                      {currentRehearsal.members.map((m: string, i: number) => (
                        <Initials key={i} value={m} />
                      ))}
                    </span>
                  )}
                </div>
              </div>

              {/* Timeline strip */}
              {timeline.length > 1 && (
                <Card>
                  <span className="bw-label-sm text-muted-foreground">{t('Timeline')}</span>
                  <div className="relative flex justify-between items-start">
                    <span className="absolute top-[5px] left-1 right-1 h-px bg-border" aria-hidden="true" />
                    {timeline.map((step, i) => (
                      <span key={i} className="relative flex flex-col items-center gap-2 min-w-0">
                        <span
                          className={cn('w-2.5 h-2.5 rounded-full', step.active ? 'bg-accent-rehearsal' : 'bg-foreground/25')}
                          aria-hidden="true"
                        />
                        <span className={cn('bw-label-xs tabular-nums', !step.active && 'text-muted-foreground')}>{step.time}</span>
                        <span className="bw-label-xs text-muted-foreground">{step.label}</span>
                      </span>
                    ))}
                  </div>
                </Card>
              )}

              <PillButton
                variant="dark"
                icon={<Play className="w-[18px] h-[18px]" />}
                onClick={() => setRehearsalViewMode('live')}
              >
                {t('Enter live mode')}
              </PillButton>

              {/* Setlist / tasks tiles */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRehearsalViewMode('setlist')}
                  className="rounded-[24px] p-4 flex flex-col gap-2 bg-card text-card-foreground text-left active:scale-[0.98] transition-transform"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="bw-label-md">{t('Songs to play')}</span>
                    <ArrowUpRight className="w-4 h-4 shrink-0" />
                  </span>
                  <DotText text={songCount} size={24} label={t('{count} songs', { count: songCount })} />
                </button>
                <button
                  type="button"
                  onClick={() => setRehearsalViewMode('tasks')}
                  className="rounded-[24px] p-4 flex flex-col gap-2 bg-card text-card-foreground text-left active:scale-[0.98] transition-transform"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="bw-label-md">{t('Pending tasks')}</span>
                    <ArrowUpRight className="w-4 h-4 shrink-0" />
                  </span>
                  <DotText text={pendingTasks} size={24} label={t('{count} pending tasks', { count: pendingTasks })} />
                </button>
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
              className="flex flex-col gap-4"
            >
              <span className="bw-label-sm text-muted-foreground">
                {songCount === 1 ? t('{count} song', { count: songCount }) : t('{count} songs', { count: songCount })}
              </span>
              {songCount === 0 ? (
                <Card className="items-center text-center py-8">
                  <h3 className="bw-h3">{t('No setlist yet')}</h3>
                </Card>
              ) : (
                <Card className="gap-0 py-2">
                  {setlist.map((song, i) => {
                    const meta = [song.key, song.bpm ? `${song.bpm} BPM` : null].filter(Boolean).join(' · ');
                    return (
                      <div key={song.id} className={cn('flex items-center gap-3 py-3', i > 0 && 'border-t border-border')}>
                        <span className="bw-label-sm text-muted-foreground w-6 shrink-0 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                        <span className="flex-1 min-w-0 flex flex-col gap-1">
                          <span className="bw-body-lg truncate">{song.title}</span>
                          {meta && <span className="bw-label-xs text-muted-foreground">{meta}</span>}
                        </span>
                        {song.duration && <span className="bw-label-md shrink-0">{song.duration}</span>}
                      </div>
                    );
                  })}
                </Card>
              )}
            </motion.div>
          )}

          {/* TASKS VIEW */}
          {rehearsalViewMode === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4"
            >
              <span className="bw-label-sm text-muted-foreground">{t('{count} pending', { count: pendingTasks })}</span>
              {tasksError && <p role="alert" className="bw-body-sm text-destructive">{tasksError}</p>}
              {tasks.length === 0 ? (
                <Card className="items-center text-center py-8">
                  <h3 className="bw-h3">{t('No tasks')}</h3>
                  <p className="bw-body-sm text-muted-foreground">{t('Add them when you create or edit the rehearsal.')}</p>
                </Card>
              ) : (
                <div className="flex flex-col gap-2">
                  {tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      role="checkbox"
                      aria-checked={task.is_completed}
                      onClick={() => toggleTask(task.id)}
                      className="flex items-center gap-3 p-4 rounded-[16px] bg-card text-card-foreground text-left active:scale-[0.99] transition-transform"
                    >
                      <DotCheckbox checked={task.is_completed} activeColor="var(--accent-rehearsal)" inactiveColor="var(--border)" />
                      <span className="flex-1 min-w-0 flex flex-col gap-1">
                        <span className={cn('bw-body-lg [overflow-wrap:anywhere]', task.is_completed && 'text-muted-foreground line-through')}>
                          {task.title}
                        </span>
                        {task.notes && <span className="bw-body-sm text-muted-foreground truncate">{task.notes}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* LIVE VIEW (Placeholder) */}
          {rehearsalViewMode === 'live' && (
            <motion.div
              key="live"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center gap-6 py-10"
            >
              <span className="relative w-28 h-28 rounded-full bg-accent-rehearsal text-accent-rehearsal-foreground flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-accent-rehearsal/30 animate-ping" aria-hidden="true" />
                <Mic2 className="relative w-10 h-10" />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="bw-display-lg">{t('Live session')}</h2>
                <p className="bw-label-sm text-muted-foreground">{t('Recording & tracking time')}</p>
              </div>
              <DotText text="00:00:00" size={34} label={t('Elapsed {time}', { time: '00:00:00' })} />
              <PillButton variant="outline" fullWidth={false} className="text-destructive border-destructive" onClick={() => setRehearsalViewMode('overview')}>
                {t('End session')}
              </PillButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer actions */}
      {rehearsalViewMode === 'overview' && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="bw-rail-clear fixed bottom-0 left-0 right-0 z-50 bg-background px-4 pt-3"
          style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
        >
          <div className="flex items-center gap-3 max-w-[700px] mx-auto">
            <PillButton
              className="flex-1 min-w-0"
              icon={<Radio className="w-[18px] h-[18px]" />}
              onClick={() => setRehearsalViewMode('live')}
            >
              {t('Check in / live')}
            </PillButton>
            <IconButton label={t('Decline rehearsal')} icon={<X />} onClick={onDecline} className="w-14 h-14" />
          </div>
        </motion.div>
      )}
    </ExpandedCardWrapper>
  );
};
