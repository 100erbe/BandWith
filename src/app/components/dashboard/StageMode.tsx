import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Minus, Plus, X } from '@/app/components/icons';
import { LyricsText, useLyricsSize } from '@/app/components/ui/LyricsViewer';
import { durations, easings } from '@/styles/motion';
import { haptic } from '@/lib/haptics';
import { FIT, FitText } from '@/app/components/bw/FitText';
import { HeaderAction } from '@/app/components/bw/Screen';
import { RailCover, useRailTone } from '@/lib/railActions';
import { setStatusBarTone } from '@/lib/systemBars';
import { useT } from '@/lib/i18n';
import { timelineDates } from '@/lib/gigTiming';
import { cn } from '@/app/components/ui/utils';
import type { StageSaveState } from '@/app/components/event/useStageLive';

export interface StageStep {
  label: string;
  /** Raw "HH:MM" (24h) used to work out what comes next. */
  time?: string;
  /** Formatted time shown on screen. */
  display: string;
}

export interface StageSong {
  /** setlist_songs row id (live order and current song follow it). */
  id?: string;
  /** songs.id, needed to save a new order. */
  songId?: string;
  setNumber?: number;
  title: string;
  artist?: string;
  duration?: string;
  key?: string;
  /** songs.lyrics (Markdown / JSON, src/lib/lyrics.ts). */
  lyrics?: string;
}

/**
 * Live Stage mode (useStageLive): the current song, PREV / NEXT, "follow the
 * leader" for members, and reordering for the band admin. Without it Stage
 * mode is the plain read-only view.
 */
export interface StageLiveControls {
  index: number;
  select: (index: number) => void;
  go: (delta: number) => void;
  following: boolean;
  setFollowing: (on: boolean) => void;
  leaderSeen: boolean;
  connected: boolean;
  isLeader: boolean;
  canReorder: boolean;
  move: (from: number, to: number) => void;
  saveState: StageSaveState;
}

interface StageModeProps {
  title: string;
  venue?: string;
  /** Venue city, shown after the venue ("Venue · City"). */
  city?: string;
  dateLabel: string;
  /** ISO date of the event, used with each step's time to find the next step. */
  date?: string;
  steps: StageStep[];
  songs: StageSong[];
  songsLoading?: boolean;
  accentColor?: string;
  live?: StageLiveControls;
  onClose: () => void;
}

// fonts.css forces `font-family: inherit` on every element, which beats the
// Tailwind mono utility class, so the mono face is set inline.
const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

/** Stage mode reads times in 24h ("19:30"). */
const to24h = (time?: string): string => {
  const m = time?.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
};

/**
 * Stage mode: an OLED-black, glanceable view for gig day. Big times, the next
 * step highlighted, the setlist in large type. No decoration and no looping
 * animation; the only motion is the 200ms fade on entry.
 */
export const StageMode: React.FC<StageModeProps> = ({
  title,
  venue,
  city,
  dateLabel,
  date,
  steps,
  songs,
  songsLoading,
  accentColor = 'var(--accent-gig, #D5FB46)',
  live,
  onClose,
}) => {
  const t = useT();
  const [now, setNow] = useState(() => new Date());
  const [reordering, setReordering] = useState(false);
  const current = live && songs.length > 0 ? live.index : -1;
  const editing = reordering && !!live?.canReorder;
  const currentRef = useRef<HTMLLIElement | null>(null);
  // Lyrics view: the current song's lyrics, following it (also when the leader moves).
  const hasLyrics = songs.some((s) => !!s.lyrics?.trim());
  const [view, setView] = useState<'setlist' | 'lyrics'>('setlist');
  const showLyrics = view === 'lyrics' && hasLyrics && !editing;
  const lyricsSong = songs[Math.max(0, current)];
  const lyricsSize = useLyricsSize();
  const lyricsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    lyricsRef.current?.scrollTo?.({ top: 0 });
  }, [lyricsSong?.id, lyricsSong?.title, showLyrics]);

  // Keep the current song in view when it changes (also when the leader moves).
  useEffect(() => {
    if (editing) return;
    currentRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [current, editing]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Steps in order on the gig day; an end after midnight lands on the next day.
  const stepDates = useMemo(() => timelineDates(date, steps.map((s) => s.time)), [date, steps]);

  const nextIndex = useMemo(
    () => stepDates.findIndex((at) => (at ? at.getTime() > now.getTime() : false)),
    [stepDates, now],
  );

  const isDone = (i: number) => {
    const at = stepDates[i];
    return at ? at.getTime() <= now.getTime() : false;
  };

  const handleClose = () => {
    haptic.tap();
    onClose();
  };

  // Black canvas: light system icons, and the iPhone Duo rail in dark glass.
  useEffect(() => setStatusBarTone('dark'), []);
  useRailTone('dark');

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={t('Stage mode: {title}', { title })}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: durations.normal, ease: easings.standard }}
      className="bw-pane-detail fixed inset-0 z-[120] flex flex-col bg-black text-white select-none"
      style={{
        paddingTop: 'calc(var(--safe-top) + 12px)',
        paddingBottom: 'calc(var(--safe-bottom) + 16px)',
      }}
    >
      {/* Short and wide (phone or closed Duo on its side): times and steps on
          the left, the setlist on the right. */}
      <div
        className={cn(
          'flex flex-col flex-1 min-h-0 w-full max-w-[640px] mx-auto px-4 gap-6',
          '[@media(max-height:520px)_and_(min-width:600px)]:grid [@media(max-height:520px)_and_(min-width:600px)]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] [@media(max-height:520px)_and_(min-width:600px)]:grid-rows-[auto_auto_1fr] [@media(max-height:520px)_and_(min-width:600px)]:max-w-[1100px] [@media(max-height:520px)_and_(min-width:600px)]:gap-x-6 [@media(max-height:520px)_and_(min-width:600px)]:gap-y-3',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 shrink-0 bw-status-clear-shift [@media(max-height:520px)_and_(min-width:600px)]:col-start-1 [@media(max-height:520px)_and_(min-width:600px)]:row-start-1">
          <div className="flex flex-col gap-2 min-w-0">
            <span className="flex items-center gap-2 bw-label-sm text-white">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
              {t('Stage mode · {date}', { date: dateLabel })}
            </span>
            <FitText as="h1" text={title} sizes={FIT.stage} maxLines={2} className="bw-display-lg text-white" />
            {(venue || city) && (
              <span className="bw-label-md text-white truncate">
                {[venue, city && city !== venue ? city : ''].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          <RailCover pane />
          <HeaderAction pane label={t('Exit stage mode')} variant="sheet" icon={<X />} onClick={handleClose} className="border-white text-white" />
        </div>

        {/* Run of show (its own container: one row of four when short and wide enough) */}
        {/* Hidden while reading lyrics: the song needs the room more than the times. */}
        <div
          className={cn(
            '@container shrink-0 [@media(max-height:520px)_and_(min-width:600px)]:col-start-1 [@media(max-height:520px)_and_(min-width:600px)]:row-start-2',
            showLyrics && 'hidden',
          )}
        >
        <ol
          className="grid grid-cols-2 gap-3 shrink-0 [@media(max-height:760px)]:@min-[330px]:grid-cols-[repeat(4,minmax(min-content,1fr))] [@media(max-height:760px)]:@min-[330px]:gap-2"
          aria-label={t('Run of show')}
        >
          {steps.map((s, i) => {
            const next = i === nextIndex;
            const done = isDone(i);
            return (
              <li
                key={s.label}
                className="flex flex-col gap-1 min-w-0 rounded-[16px] px-4 py-3 border @max-[260px]:px-3 [@media(max-height:760px)]:@min-[330px]:px-2 [@media(max-height:760px)]:@min-[330px]:py-2"
                style={{
                  borderColor: next ? accentColor : 'rgba(255,255,255,0.15)',
                  opacity: done && !next ? 0.4 : 1,
                }}
              >
                <span className="bw-label-xs text-white">
                  {next ? t('Next · {label}', { label: s.label }) : s.label}
                </span>
                <span
                  className="bw-num text-[clamp(20px,9cqw,32px)] [@media(max-height:760px)]:@min-[330px]:text-[clamp(18px,5.2cqw,28px)] leading-[1.1] whitespace-nowrap"
                  style={{ ...MONO, color: next ? accentColor : '#fff' }}
                >
                  {to24h(s.time) || s.display || t('TBD')}
                </span>
              </li>
            );
          })}
        </ol>
        </div>

        {/* Setlist */}
        <section className="flex flex-col flex-1 min-h-0 gap-1 [@media(max-height:520px)_and_(min-width:600px)]:col-start-2 [@media(max-height:520px)_and_(min-width:600px)]:row-start-1 [@media(max-height:520px)_and_(min-width:600px)]:row-span-3" aria-label={t('Setlist')}>
          <div className="flex items-center justify-between gap-3 shrink-0 pb-2 min-h-11">
            {hasLyrics && !editing ? (
              <span className="flex items-center gap-1 min-w-0" role="tablist" aria-label={t('Setlist')}>
                {(['setlist', 'lyrics'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={view === v}
                    onClick={() => {
                      haptic.tap();
                      setView(v);
                    }}
                    className={cn(
                      'min-h-11 px-2 bw-label-sm whitespace-nowrap border-b-2',
                      view === v ? 'text-white border-white' : 'text-white/50 border-transparent',
                    )}
                  >
                    {v === 'setlist' ? t('Setlist') : t('Lyrics')}
                  </button>
                ))}
              </span>
            ) : (
              <span className="flex items-baseline gap-3 min-w-0">
                <span className="bw-label-sm text-white shrink-0">{t('Setlist')}</span>
                <span className="bw-num text-[14px] font-medium text-white/70 whitespace-nowrap truncate" style={MONO}>
                  {songsLoading ? '…' : songs.length === 1 ? t('{count} song', { count: songs.length }) : t('{count} songs', { count: songs.length })}
                </span>
              </span>
            )}
            {live && songs.length > 0 && (
              <span className="flex items-center gap-2 min-w-0 shrink-0 max-w-[70%]">
                {live.isLeader ? (
                  <LiveStatus
                    on={live.connected}
                    label={editing ? saveLabel(live.saveState, t) : live.connected ? t('Live') : t('Offline')}
                    hint={live.connected ? t('Band follows you') : undefined}
                    accentColor={accentColor}
                  />
                ) : (
                  <button
                    type="button"
                    aria-pressed={live.following}
                    onClick={() => {
                      haptic.tap();
                      live.setFollowing(!live.following);
                    }}
                    className={cn(
                      'flex items-center gap-2 min-h-11 px-3 rounded-full border bw-label-xs whitespace-nowrap min-w-0',
                      live.following ? 'border-transparent text-black' : 'border-white/40 text-white',
                    )}
                    style={live.following ? { backgroundColor: accentColor } : undefined}
                  >
                    <span
                      aria-hidden
                      className={cn('w-2 h-2 rounded-full shrink-0', live.following ? 'bg-black' : 'border border-white')}
                    />
                    <span className="truncate">
                      {live.following ? (live.leaderSeen ? t('Following leader') : t('Waiting for leader')) : t('Follow leader')}
                    </span>
                  </button>
                )}
                {live.canReorder && (
                  <button
                    type="button"
                    aria-pressed={editing}
                    onClick={() => {
                      haptic.tap();
                      setReordering((v) => !v);
                    }}
                    className={cn(
                      'flex items-center gap-1.5 min-h-11 px-3 rounded-full border bw-label-xs whitespace-nowrap shrink-0',
                      editing ? 'bg-white text-black border-white' : 'border-white/40 text-white',
                    )}
                  >
                    {editing && <Check className="w-4 h-4" />}
                    {editing ? t('Done') : t('Reorder')}
                  </button>
                )}
              </span>
            )}
          </div>
          {showLyrics && lyricsSong ? (
            <div className="flex flex-col flex-1 min-h-0" role="tabpanel" aria-label={t('Lyrics · {title}', { title: lyricsSong.title })}>
              <div className="flex items-center gap-3 shrink-0 pb-2">
                <span className="bw-num text-[16px] font-medium shrink-0" style={{ ...MONO, color: accentColor }}>
                  {String(Math.max(0, current) + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 min-w-0 bw-h2 normal-case leading-[1.15] truncate" style={{ color: accentColor }} aria-live="polite">
                  {lyricsSong.title}
                </span>
                <button
                  type="button"
                  disabled={lyricsSize.min}
                  onClick={() => lyricsSize.step(-1)}
                  aria-label={t('Smaller text')}
                  className="w-11 h-11 flex items-center justify-center rounded-full border border-white/30 shrink-0 disabled:opacity-30"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  disabled={lyricsSize.max}
                  onClick={() => lyricsSize.step(1)}
                  aria-label={t('Bigger text')}
                  className="w-11 h-11 flex items-center justify-center rounded-full border border-white/30 shrink-0 disabled:opacity-30"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div ref={lyricsRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-4 px-4 pb-6">
                <LyricsText
                  lyrics={lyricsSong.lyrics}
                  size={lyricsSize.size}
                  muted="text-white/60"
                  className="w-full flex flex-col gap-6 pt-1 text-white"
                />
              </div>
            </div>
          ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-4 px-4">
            {songs.length === 0 && !songsLoading ? (
              <p className="bw-body-md text-white/70">{t('No setlist attached to this gig.')}</p>
            ) : (
              <ol className="flex flex-col">
                {songs.map((song, i) => {
                  const isCurrent = i === current;
                  const meta = [song.key, song.duration].filter(Boolean).join(' · ');
                  const body = (
                    <>
                      <span
                        className="bw-num text-[16px] font-medium w-7 shrink-0"
                        style={{ ...MONO, color: isCurrent ? accentColor : 'rgba(255,255,255,0.5)' }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        className="flex-1 min-w-0 bw-h2 normal-case leading-[1.15] truncate"
                        style={isCurrent ? { color: accentColor } : undefined}
                      >
                        {song.title}
                      </span>
                      {!editing && meta && (
                        <span className="bw-num text-[14px] font-medium text-white/70 shrink-0" style={MONO}>
                          {meta}
                        </span>
                      )}
                    </>
                  );
                  return (
                    <li
                      key={song.id ?? `${song.title}-${i}`}
                      ref={isCurrent ? currentRef : undefined}
                      aria-current={isCurrent ? 'true' : undefined}
                      className="flex items-center gap-2 border-b border-white/15 last:border-b-0"
                    >
                      {live && !editing ? (
                        <button
                          type="button"
                          onClick={() => {
                            haptic.tap();
                            live.select(i);
                          }}
                          aria-label={isCurrent ? t('Now playing: {title}', { title: song.title }) : t('Go to {title}', { title: song.title })}
                          className="flex flex-1 min-w-0 items-center gap-4 py-3 text-left"
                        >
                          {body}
                        </button>
                      ) : (
                        <span className="flex flex-1 min-w-0 items-center gap-4 py-3">{body}</span>
                      )}
                      {editing && live && (
                        <span className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={i === 0}
                            onClick={() => {
                              haptic.tap();
                              live.move(i, i - 1);
                            }}
                            aria-label={t('Move {title} up', { title: song.title })}
                            className="w-11 h-11 flex items-center justify-center rounded-full border border-white/30 disabled:opacity-30"
                          >
                            <ChevronUp className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            disabled={i === songs.length - 1}
                            onClick={() => {
                              haptic.tap();
                              live.move(i, i + 1);
                            }}
                            aria-label={t('Move {title} down', { title: song.title })}
                            className="w-11 h-11 flex items-center justify-center rounded-full border border-white/30 disabled:opacity-30"
                          >
                            <ChevronDown className="w-5 h-5" />
                          </button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          )}
        </section>

        {/* Song steps: the leader's reach the whole band. */}
        {live && songs.length > 0 && !editing && (
          <div className="grid grid-cols-2 gap-3 shrink-0 [@media(max-height:520px)_and_(min-width:600px)]:col-start-1 [@media(max-height:520px)_and_(min-width:600px)]:row-start-3 [@media(max-height:520px)_and_(min-width:600px)]:self-end">
            <button
              type="button"
              disabled={current <= 0}
              onClick={() => {
                haptic.tap();
                live.go(-1);
              }}
              aria-label={t('Previous song')}
              className="flex items-center justify-center gap-2 min-h-14 rounded-[20px] bg-white/10 text-white bw-button-sm disabled:opacity-40"
            >
              <ChevronLeft className="w-6 h-6" /> {t('Prev')}
            </button>
            <button
              type="button"
              disabled={current >= songs.length - 1}
              onClick={() => {
                haptic.tap();
                live.go(1);
              }}
              aria-label={t('Next song')}
              className="flex items-center justify-center gap-2 min-h-14 rounded-[20px] text-black bw-button-sm disabled:opacity-40"
              style={{ backgroundColor: accentColor }}
            >
              {t('Next')} <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const saveLabel = (state: StageSaveState, t: ReturnType<typeof useT>) =>
  state === 'saving' ? t('Saving…') : state === 'error' ? t('Not saved') : state === 'saved' ? t('Saved') : t('Live');

/** Leader's live dot and status. */
const LiveStatus: React.FC<{ on: boolean; label: string; hint?: string; accentColor: string }> = ({ on, label, hint, accentColor }) => (
  <span className="flex items-center gap-2 bw-label-xs text-white/80 whitespace-nowrap min-w-0" role="status" title={hint}>
    <span
      aria-hidden
      className="w-2 h-2 rounded-full shrink-0"
      style={on ? { backgroundColor: accentColor } : { border: '1px solid rgba(255,255,255,0.6)' }}
    />
    <span className="truncate">{label}</span>
    {hint && <span className="sr-only">{` · ${hint}`}</span>}
  </span>
);
