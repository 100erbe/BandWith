import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Minus, Pause, Play, Plus, X } from '@/app/components/icons';
import { IconButton } from '@/app/components/bw/Screen';
import { closeLyrics, parseInline, parseLyrics, useLyricsDoc } from '@/lib/lyrics';
import { togglePlay, usePlayer } from '@/lib/audioPlayer';
import { useSystemBack } from '@/lib/backStack';

const SIZES = [18, 21, 24, 28, 33, 40];
const SIZE_KEY = 'bw-lyrics-size';

/**
 * Full-screen lyrics reader (stage-friendly: big text, A−/A+ sizes kept
 * between songs). Mounted once (AuthenticatedApp); opened with openLyrics().
 * When the song is playing in the mini player, play/pause sits in the header.
 */
export const LyricsViewer: React.FC = () => {
  const doc = useLyricsDoc();
  const player = usePlayer();
  const [size, setSize] = React.useState(() => {
    try {
      const v = Number(localStorage.getItem(SIZE_KEY));
      return SIZES.includes(v) ? v : 24;
    } catch {
      return 24;
    }
  });
  const sections = React.useMemo(() => parseLyrics(doc?.lyrics), [doc?.lyrics]);
  useSystemBack(!!doc, () => {
    closeLyrics();
    return true;
  });

  const step = (d: number) => {
    const i = Math.max(0, Math.min(SIZES.length - 1, SIZES.indexOf(size) + d));
    setSize(SIZES[i]);
    try {
      localStorage.setItem(SIZE_KEY, String(SIZES[i]));
    } catch {
      /* per-device preference */
    }
  };

  const isThisTrack = !!doc?.songId && player.track?.id === doc.songId;

  return (
    <AnimatePresence>
      {doc && (
        <motion.div
          key="lyrics"
          role="dialog"
          aria-modal="true"
          aria-label={`Lyrics · ${doc.title}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', damping: 32, stiffness: 340 }}
          className="bw-pane-detail fixed inset-0 z-[150] bg-background text-foreground flex flex-col"
        >
          <div
            className="shrink-0 px-4 pb-3 flex items-center gap-3 bw-status-clear"
            style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}
          >
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="bw-label-sm text-muted-foreground truncate">Lyrics{doc.artist ? ` · ${doc.artist}` : ''}</span>
              <span className="bw-h2 truncate">{doc.title}</span>
            </span>
            {isThisTrack && (
              <IconButton
                label={player.status === 'playing' ? 'Pause' : 'Play'}
                variant="filled"
                size="sm"
                icon={player.status === 'playing' ? <Pause /> : <Play />}
                onClick={togglePlay}
              />
            )}
            <IconButton label="Smaller text" size="sm" icon={<Minus />} onClick={() => step(-1)} disabled={size === SIZES[0]} />
            <IconButton label="Bigger text" size="sm" icon={<Plus />} onClick={() => step(1)} disabled={size === SIZES[SIZES.length - 1]} />
            <IconButton label="Close lyrics" size="sm" icon={<X />} onClick={closeLyrics} />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-16">
            <div
              className="max-w-3xl mx-auto w-full flex flex-col gap-8 pt-4"
              style={{ fontSize: size, lineHeight: 1.45 }}
            >
              {sections.length === 0 ? (
                <p className="bw-body-lg text-muted-foreground">No lyrics for this song yet.</p>
              ) : (
                sections.map((s, i) => (
                  <section key={i} className="flex flex-col gap-1">
                    {s.name && <h3 className="bw-label-md text-muted-foreground uppercase mb-1">{s.name}</h3>}
                    {s.lines.map((line, j) =>
                      line.trim() ? (
                        <p key={j} className="font-medium break-words">
                          {parseInline(line).map((part, k) => (
                            <span key={k} className={part.bold ? 'font-bold' : part.italic ? 'italic' : undefined}>
                              {part.text}
                            </span>
                          ))}
                        </p>
                      ) : (
                        <span key={j} className="block h-[0.8em]" aria-hidden />
                      )
                    )}
                  </section>
                ))
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
