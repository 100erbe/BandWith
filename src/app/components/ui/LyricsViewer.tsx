import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Minus, Pause, Play, Plus, X } from '@/app/components/icons';
import { IconButton } from '@/app/components/bw/Screen';
import { closeLyrics, parseInline, parseLyrics, splitChords, useLyricsDoc } from '@/lib/lyrics';
import { chordLabel } from '@/lib/ireal';
import { togglePlay, usePlayer } from '@/lib/audioPlayer';
import { useSystemBack } from '@/lib/backStack';
import { useT } from '@/lib/i18n';
import { ChordChartView } from '@/app/components/ui/ChordChart';
import { cn } from '@/app/components/ui/utils';

const SIZES = [18, 21, 24, 28, 33, 40];
const SIZE_KEY = 'bw-lyrics-size';

/** Lyrics text size (A− / A+), kept per device and shared with Stage mode. */
export function useLyricsSize() {
  const [size, setSize] = React.useState(() => {
    try {
      const v = Number(localStorage.getItem(SIZE_KEY));
      return SIZES.includes(v) ? v : 24;
    } catch {
      return 24;
    }
  });
  const step = React.useCallback(
    (d: number) => {
      const i = Math.max(0, Math.min(SIZES.length - 1, SIZES.indexOf(size) + d));
      setSize(SIZES[i]);
      try {
        localStorage.setItem(SIZE_KEY, String(SIZES[i]));
      } catch {
        /* per-device preference */
      }
    },
    [size],
  );
  return { size, step, min: size === SIZES[0], max: size === SIZES[SIZES.length - 1] };
}

const Inline: React.FC<{ text: string }> = ({ text }) => (
  <>
    {parseInline(text).map((part, k) => (
      <span key={k} className={part.bold ? 'font-bold' : part.italic ? 'italic' : undefined}>
        {part.text}
      </span>
    ))}
  </>
);

/**
 * One line of lyrics. ChordPro-style chords (`[Am]words`) sit above the word
 * they start on; that word and its chord make one box (never overlapping the
 * next chord), the rest of the words wrap like text on narrow screens.
 */
const LyricsLine: React.FC<{ line: string }> = ({ line }) => {
  const segments = React.useMemo(() => splitChords(line), [line]);
  if (!segments) {
    return (
      <p className="font-medium break-words">
        <Inline text={line} />
      </p>
    );
  }
  return (
    <p className="font-medium break-words">
      {segments.map((seg, k) => {
        if (!seg.chord) return <Inline key={k} text={seg.text} />;
        const [, head, tail] = seg.text.match(/^(\S*)([\s\S]*)$/) || ['', '', seg.text];
        const label = chordLabel(seg.chord);
        return (
          <React.Fragment key={k}>
            {/* Text first in the DOM: the box's baseline is the lyric's, the chord shows above it. */}
            {/* An inline-block's baseline is its last line: the word stays on the line, the chord sits above it. */}
            <span className="inline-block align-baseline">
              <span className="block text-[0.62em] font-bold leading-[1.3] pr-[0.35em] whitespace-nowrap">{label}</span>
              <span className="block whitespace-pre">{head ? <Inline text={head} /> : '\u00a0'}</span>
            </span>
            {/* A chord on a space already holds one: no double gap. */}
            {(head ? tail : tail.replace(/^ /, '')) && <Inline text={head ? tail : tail.replace(/^ /, '')} />}
          </React.Fragment>
        );
      })}
    </p>
  );
};

/**
 * Lyrics as sections of lines (Markdown / JSON, see src/lib/lyrics.ts).
 * `muted` is the class for section names and the empty message.
 */
export const LyricsText: React.FC<{ lyrics?: string | null; size: number; muted?: string; className?: string }> = ({
  lyrics,
  size,
  muted = 'text-muted-foreground',
  className,
}) => {
  const tr = useT();
  const sections = React.useMemo(() => parseLyrics(lyrics), [lyrics]);
  return (
    <div className={className ?? 'max-w-3xl mx-auto w-full flex flex-col gap-8 pt-4'} style={{ fontSize: size, lineHeight: 1.45 }}>
      {sections.length === 0 ? (
        <p className={`bw-body-lg ${muted}`}>{tr('No lyrics for this song yet.')}</p>
      ) : (
        sections.map((s, i) => (
          <section key={i} className="flex flex-col gap-1">
            {s.name && <h3 className={`bw-label-md ${muted} uppercase mb-1`}>{s.name}</h3>}
            {s.lines.map((line, j) =>
              line.trim() ? (
                <LyricsLine key={j} line={line} />
              ) : (
                <span key={j} className="block h-[0.8em]" aria-hidden />
              )
            )}
          </section>
        ))
      )}
    </div>
  );
};

/** Lyrics / Chords switch, shown when a song has both. */
export const LyricsChordsTabs: React.FC<{
  view: 'lyrics' | 'chords';
  onChange: (v: 'lyrics' | 'chords') => void;
  className?: string;
  /** Classes of the selected and the other tab (Stage mode is always dark). */
  on?: string;
  off?: string;
}> = ({ view, onChange, className, on = 'bg-foreground text-background', off = 'text-muted-foreground' }) => {
  const tr = useT();
  return (
    <div role="tablist" className={cn('flex items-center gap-1', className)}>
      {(['lyrics', 'chords'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={view === v}
          onClick={() => onChange(v)}
          className={cn('min-h-9 px-3 rounded-full bw-label-sm transition-colors', view === v ? on : off)}
        >
          {v === 'lyrics' ? tr('Lyrics') : tr('Chords')}
        </button>
      ))}
    </div>
  );
};

/**
 * Full-screen lyrics reader (stage-friendly: big text, A−/A+ sizes kept
 * between songs). Mounted once (AuthenticatedApp); opened with openLyrics().
 * When the song is playing in the mini player, play/pause sits in the header.
 * Songs with a chord chart (songs.chord_chart) can switch to it.
 */
export const LyricsViewer: React.FC = () => {
  const doc = useLyricsDoc();
  const player = usePlayer();
  const tr = useT();
  const { size, step, min, max } = useLyricsSize();
  useSystemBack(!!doc, () => {
    closeLyrics();
    return true;
  });

  const isThisTrack = !!doc?.songId && player.track?.id === doc.songId;
  const hasLyrics = !!doc?.lyrics?.trim();
  const hasChart = !!doc?.chart;
  const [view, setView] = React.useState<'lyrics' | 'chords'>('lyrics');
  React.useEffect(() => {
    if (doc) setView(doc.view ?? (hasLyrics || !hasChart ? 'lyrics' : 'chords'));
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps
  const showChords = view === 'chords' && hasChart;
  const kind = showChords ? tr('Chords') : tr('Lyrics');

  return (
    <AnimatePresence>
      {doc && (
        <motion.div
          key="lyrics"
          role="dialog"
          aria-modal="true"
          aria-label={`${kind} · ${doc.title}`}
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
              <span className="bw-label-sm text-muted-foreground truncate">{doc.artist ? `${kind} · ${doc.artist}` : kind}</span>
              <span className="bw-h2 truncate">{doc.title}</span>
            </span>
            {isThisTrack && (
              <IconButton
                label={player.status === 'playing' ? tr('Pause') : tr('Play')}
                variant="filled"
                size="sm"
                icon={player.status === 'playing' ? <Pause /> : <Play />}
                onClick={togglePlay}
              />
            )}
            <IconButton label={tr('Smaller text')} size="sm" icon={<Minus />} onClick={() => step(-1)} disabled={min} />
            <IconButton label={tr('Bigger text')} size="sm" icon={<Plus />} onClick={() => step(1)} disabled={max} />
            <IconButton label={showChords ? tr('Close') : tr('Close lyrics')} size="sm" icon={<X />} onClick={closeLyrics} />
          </div>
          {hasLyrics && hasChart && <LyricsChordsTabs view={view} onChange={setView} className="shrink-0 px-4 pb-2" />}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-16">
            {showChords && doc.chart ? <ChordChartView chart={doc.chart} size={size} /> : <LyricsText lyrics={doc.lyrics} size={size} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
