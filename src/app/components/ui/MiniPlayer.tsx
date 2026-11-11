import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, Loader2, Music, Pause, Play, Square } from '@/app/components/icons';
import { openLyrics } from '@/lib/lyrics';
import { IconButton } from '@/app/components/bw/Screen';
import { openSongResource } from '@/lib/services/songFiles';
import { seekTo, stopPlayer, togglePlay, usePlayer } from '@/lib/audioPlayer';

const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * In-app player for song recordings: title, play/pause, stop and a seek bar,
 * floating above the tab bar. Mounted once (AuthenticatedApp).
 */
export const MiniPlayer: React.FC = () => {
  const p = usePlayer();
  // Signing out (the app unmounts) stops the music.
  React.useEffect(() => () => stopPlayer(), []);
  const busy = p.status === 'loading';
  const pct = p.duration > 0 ? Math.min(100, (p.position / p.duration) * 100) : 0;

  return (
    <AnimatePresence>
      {p.track && (
        <motion.div
          key="mini-player"
          role="region"
          aria-label="Now playing"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 340 }}
          className="bw-rail-clear dark fixed left-3 right-3 z-[96] mx-auto max-w-[460px] rounded-[24px] bg-sheet text-sheet-foreground shadow-[0_8px_32px_rgba(0,0,0,0.35)] px-3 py-2.5 flex flex-col gap-2"
          style={{ bottom: 'calc(var(--safe-bottom) + 92px)' }}
          data-keep-keyboard=""
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0" aria-hidden>
              <Music className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="bw-label-md truncate">{p.track.title}</span>
              <span className="bw-body-sm text-sheet-foreground/70 truncate">
                {p.status === 'error'
                  ? p.error
                  : busy
                    ? 'Loading…'
                    : [p.track.artist, p.duration ? `${clock(p.position)} / ${clock(p.duration)}` : null].filter(Boolean).join(' · ')}
              </span>
            </span>
            {p.status === 'error' && p.sourceUrl ? (
              <IconButton
                label="Open the link"
                variant="sheet"
                size="sm"
                icon={<Play />}
                onClick={() => void openSongResource(p.sourceUrl)}
              />
            ) : (
              <IconButton
                label={p.status === 'playing' ? 'Pause' : 'Play'}
                variant="filled"
                size="sm"
                disabled={busy || p.status === 'error'}
                icon={busy ? <Loader2 className="animate-spin" /> : p.status === 'playing' ? <Pause /> : <Play />}
                onClick={togglePlay}
              />
            )}
            {p.track.lyrics?.trim() && (
              <IconButton
                label="Lyrics"
                variant="sheet"
                size="sm"
                icon={<BookOpen />}
                onClick={() =>
                  openLyrics({ songId: p.track!.id, title: p.track!.title, artist: p.track!.artist, lyrics: p.track!.lyrics || '' })
                }
              />
            )}
            <IconButton label="Stop" variant="sheet" size="sm" icon={<Square />} onClick={stopPlayer} />
          </div>
          {p.duration > 0 && p.status !== 'error' && (
            <input
              type="range"
              aria-label="Position"
              min={0}
              max={Math.round(p.duration)}
              step={1}
              value={Math.round(p.position)}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="w-full h-1 accent-[var(--accent)]"
              style={{ background: `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.2) ${pct}%)` }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
