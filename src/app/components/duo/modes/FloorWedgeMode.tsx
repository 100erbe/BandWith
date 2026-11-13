import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, PanelLeft, Plus, X } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { haptic } from '@/lib/haptics';
import { useKeepAwake } from '@/lib/posture';
import { FoldSplit } from '../FoldSplit';
import { DeckButton, clock, durationSeconds } from './shared';
import { LyricsText, useLyricsSize } from '@/app/components/ui/LyricsViewer';
import { useT } from '@/lib/i18n';
import { useRailLayout } from '@/lib/deviceRegions';
import { useStageBarHidden } from '@/lib/stageChrome';

/**
 * Floor wedge (Stage mode in Laptop pose): the phone stands on the stage
 * floor like a wedge monitor. Display (OLED black, largest type): song
 * counter, title, key, BPM, next song and elapsed time. Deck: big PREV /
 * NEXT pads and the set's progress. The screen stays awake while mounted,
 * so mount it only alongside Stage mode.
 *
 * Songs use Stage mode's shape (src/app/components/dashboard/StageMode.tsx
 * `StageSong`), plus an optional BPM. Arrow keys, Page Up/Down and Space
 * also step, so Bluetooth page-turner pedals work.
 */

export interface WedgeSong {
  title: string;
  artist?: string;
  key?: string | null;
  bpm?: number | null;
  /** "3:45" or seconds. */
  duration?: string | number | null;
  /** songs.lyrics: the display can show them instead of the big title. */
  lyrics?: string | null;
}

export interface FloorWedgeModeProps {
  songs: WedgeSong[];
  /** Gig title shown above the counter. */
  title?: string;
  /** e.g. "Set 1". */
  setLabel?: string;
  songsLoading?: boolean;
  initialIndex?: number;
  /** Current song when Stage mode is live (useStageLive); omitted = own counter. */
  index?: number;
  onIndexChange?: (index: number) => void;
  /** Live follow state: members get a "follow leader" switch, the admin a status. */
  follow?: {
    isLeader: boolean;
    following: boolean;
    leaderSeen: boolean;
    connected: boolean;
    /** Bluetooth link (native apps): 'leading' for the admin, 'connected' for a member. */
    bluetooth?: string;
    onToggle: (on: boolean) => void;
  };
  /** When the set started (elapsed time); defaults to when the mode mounted. */
  startedAt?: Date | number;
  /** See FoldSplit. Default 125 (above Stage mode). */
  zIndex?: number;
  /**
   * Leaves Stage mode. Shown on the Deck only while the side bar is hidden
   * (src/lib/stageChrome.ts); otherwise Exit is in the rail.
   */
  onClose?: () => void;
}

export const FloorWedgeMode: React.FC<FloorWedgeModeProps> = ({
  songs,
  title,
  setLabel,
  songsLoading,
  initialIndex = 0,
  index: controlledIndex,
  onIndexChange,
  follow,
  startedAt,
  zIndex,
  onClose,
}) => {
  const t = useT();
  // Stage mode full screen hides the rail, which holds Exit and the toggle:
  // the Deck shows them instead.
  const { rail, twoPane } = useRailLayout();
  const [barHidden, setBarHidden] = useStageBarHidden();
  const ownChrome = !!onClose && barHidden && (rail || twoPane);
  useKeepAwake(true);
  const count = songs.length;
  const [ownIndex, setIndex] = useState(() => Math.min(Math.max(0, initialIndex), Math.max(0, count - 1)));
  const index = controlledIndex ?? ownIndex;
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // A shorter setlist (reload) must not leave the counter past its end.
  useEffect(() => {
    if (controlledIndex === undefined && count > 0 && ownIndex > count - 1) setIndex(count - 1);
  }, [count, ownIndex, controlledIndex]);

  const go = useCallback(
    (delta: number) => {
      const next = Math.min(Math.max(0, index + delta), Math.max(0, count - 1));
      if (next === index) return;
      haptic.tap();
      setIndex(next);
      onIndexChange?.(next);
    },
    [index, count, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const song = count > 0 ? songs[index] : null;
  const hasLyrics = songs.some((s) => !!s.lyrics?.trim());
  const [lyricsOn, setLyricsOn] = useState(false);
  const showLyrics = lyricsOn && hasLyrics && !!song;
  const lyricsSize = useLyricsSize();
  const lyricsRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    lyricsRef.current?.scrollTo?.({ top: 0 });
  }, [index, showLyrics]);
  const next = index + 1 < count ? songs[index + 1] : null;
  const start = startedAt !== undefined ? new Date(startedAt).getTime() : mountedAt;
  const elapsed = clock(Math.max(0, (now - start) / 1000));

  // Time left in the set, when every remaining song has a duration.
  const remaining = songs.slice(index).map((s) => durationSeconds(s.duration ?? null));
  const left = remaining.length > 0 && remaining.every((s) => s !== null)
    ? remaining.reduce<number>((sum, s) => sum + (s ?? 0), 0)
    : null;

  const display = (
    <div className={cn('bw-fold-pad flex flex-col gap-3 pt-3 pb-4 bg-black text-white select-none', showLyrics ? 'h-full' : 'min-h-full')}>
      <div className="flex items-baseline justify-between gap-4 bw-label-md uppercase text-white/60">
        <span className="truncate">{[setLabel, title].filter(Boolean).join(' · ') || t('Stage')}</span>
        <span className="shrink-0 tabular-nums" aria-label={t('Elapsed {time}', { time: elapsed })}>{elapsed}</span>
      </div>
      {!song ? (
        <p className="bw-display-lg text-white/70">{songsLoading ? t('Loading setlist…') : t('No setlist')}</p>
      ) : showLyrics ? (
        <>
          <div className="flex items-center gap-3 min-w-0">
            <p className="bw-value-lg tabular-nums shrink-0" aria-live="polite">
              {index + 1}
              <span className="text-white/40"> / {count}</span>
            </p>
            <h1 className="flex-1 min-w-0 bw-h2 truncate text-accent">{song.title}</h1>
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
          <div ref={lyricsRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain" aria-label={t('Lyrics · {title}', { title: song.title })}>
            <LyricsText lyrics={song.lyrics} size={lyricsSize.size} muted="text-white/60" className="w-full flex flex-col gap-6 pb-4 text-white" />
          </div>
        </>
      ) : (
        <>
          <p className="bw-value-lg tabular-nums" aria-live="polite">
            {index + 1}
            <span className="text-white/40"> / {count}</span>
          </p>
          <h1 className="bw-display-xl line-clamp-2 [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(44px, 9vw, 88px)' }}>
            {song.title}
          </h1>
          {(song.key || song.bpm) && (
            <dl className="flex gap-8">
              {song.key && (
                <div>
                  <dt className="bw-label-sm uppercase text-white/50">{t('Key')}</dt>
                  <dd className="bw-value-lg">{song.key}</dd>
                </div>
              )}
              {song.bpm ? (
                <div>
                  <dt className="bw-label-sm uppercase text-white/50">BPM</dt>
                  <dd className="bw-value-lg tabular-nums">{song.bpm}</dd>
                </div>
              ) : null}
            </dl>
          )}
          <p className="mt-auto bw-h3 text-white/70 truncate">
            {next ? (
              <>
                <span className="bw-label-sm uppercase text-white/45 mr-2">{t('Next')}</span>
                {next.title}
                {next.key ? ` · ${next.key}` : ''}
              </>
            ) : (
              <span className="bw-label-sm uppercase text-white/45">{t('Last song')}</span>
            )}
          </p>
        </>
      )}
    </div>
  );

  const deck = (
    <div className="min-h-full flex flex-col gap-3 px-4 pt-3 pb-3 text-white">
      {(follow || hasLyrics || ownChrome) && (
        <div className="flex items-center justify-between gap-3 min-h-11 shrink-0">
          {hasLyrics ? (
            <button
              type="button"
              aria-pressed={lyricsOn}
              onClick={() => {
                haptic.tap();
                setLyricsOn((v) => !v);
              }}
              className={cn(
                'flex items-center gap-2 min-h-11 px-4 rounded-full bw-label-md uppercase border',
                lyricsOn ? 'bg-white text-black border-white' : 'border-white/40 text-white',
              )}
            >
              {t('Lyrics')}
            </button>
          ) : (
            <span />
          )}
          {!follow ? null : follow.isLeader ? (
            <span className="flex items-center gap-2 bw-label-md uppercase text-white/70" role="status">
              <span
                aria-hidden
                className={cn('w-2 h-2 rounded-full', follow.connected || follow.bluetooth === 'leading' ? 'bg-accent' : 'border border-white/60')}
              />
              {follow.connected ? t('Band follows you') : follow.bluetooth === 'leading' ? 'Bluetooth' : t('Offline')}
              {follow.connected && follow.bluetooth === 'leading' ? ' · BT' : ''}
            </span>
          ) : (
            <button
              type="button"
              aria-pressed={follow.following}
              onClick={() => {
                haptic.tap();
                follow.onToggle(!follow.following);
              }}
              className={cn(
                'flex items-center gap-2 min-h-11 px-4 rounded-full bw-label-md uppercase border',
                follow.following ? 'bg-accent text-accent-foreground border-transparent' : 'border-white/40 text-white',
              )}
            >
              <span aria-hidden className={cn('w-2 h-2 rounded-full', follow.following ? 'bg-accent-foreground' : 'border border-white')} />
              {follow.following ? (follow.leaderSeen ? t('Following leader') : t('Waiting for leader')) : t('Follow leader')}
              {follow.bluetooth === 'connected' ? ' · BT' : ''}
            </button>
          )}
          {ownChrome && (
            <span className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                aria-label={t('Show sidebar')}
                title={t('Show sidebar')}
                onClick={() => {
                  haptic.tap();
                  setBarHidden(false);
                }}
                className="w-11 h-11 flex items-center justify-center rounded-full border border-white/40 text-white [&_svg]:w-5 [&_svg]:h-5"
              >
                <PanelLeft />
              </button>
              <button
                type="button"
                aria-label={t('Exit stage mode')}
                title={t('Exit stage mode')}
                onClick={() => {
                  haptic.tap();
                  onClose?.();
                }}
                className="w-11 h-11 flex items-center justify-center rounded-full border border-white text-white [&_svg]:w-5 [&_svg]:h-5"
              >
                <X />
              </button>
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-[88px]">
        <DeckButton
          size="pad"
          tone="muted"
          className="h-full bg-white/10 text-white"
          disabled={!song || index === 0}
          onClick={() => go(-1)}
          aria-label={t('Previous song')}
        >
          <ChevronLeft className="w-7 h-7" /> {t('Prev')}
        </DeckButton>
        <DeckButton
          size="pad"
          tone="accent"
          className="h-full"
          disabled={!song || index >= count - 1}
          onClick={() => go(1)}
          aria-label={t('Next song')}
        >
          {t('Next')} <ChevronRight className="w-7 h-7" />
        </DeckButton>
      </div>
      {count > 0 && (
        <div className="flex flex-col gap-1.5" aria-label={t('Song {index} of {count}', { index: index + 1, count })}>
          <div className="flex gap-1" aria-hidden>
            {songs.map((_, i) => (
              <span
                key={i}
                className={cn('h-1.5 flex-1 rounded-full', i < index ? 'bg-white/60' : i === index ? 'bg-accent' : 'bg-white/15')}
              />
            ))}
          </div>
          <p className="bw-label-md uppercase text-white/60 flex justify-between">
            <span>{t('Song {index} of {count}', { index: index + 1, count })}</span>
            {left !== null && <span className="tabular-nums">{t('{time} left', { time: clock(left) })}</span>}
          </p>
        </div>
      )}
    </div>
  );

  return <FoldSplit zIndex={zIndex} variant="stage" displayLabel={t('Now playing')} deckLabel={t('Song controls')} display={display} deck={deck} />;
};

export default FloorWedgeMode;
