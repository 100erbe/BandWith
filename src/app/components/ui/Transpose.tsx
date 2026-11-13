import React from 'react';
import { Minus, Plus } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { foldSemitones, prefersFlats, semitoneLabel, transposeKey } from '@/lib/transpose';
import { useT } from '@/lib/i18n';

/**
 * Transposing what a reader shows (lyrics viewer, Stage mode) on this device
 * only: the song itself stays in its key. Changing the song's key for the
 * whole band is in the song form (Transpose next to Key).
 */
interface TransposeValue {
  semitones: number;
  /** Spell moved chords with flats (from the song's key). */
  flats: boolean;
}

const TransposeContext = React.createContext<TransposeValue>({ semitones: 0, flats: true });

export const TransposeProvider: React.FC<{ semitones: number; songKey?: string | null; children: React.ReactNode }> = ({ semitones, songKey, children }) => {
  const value = React.useMemo(() => ({ semitones, flats: prefersFlats(songKey, semitones) }), [semitones, songKey]);
  return <TransposeContext.Provider value={value}>{children}</TransposeContext.Provider>;
};

export const useTranspose = () => React.useContext(TransposeContext);

const storeKey = (songId: string) => `bw-transpose:${songId}`;

/** A song's transposition on this device (kept per song, between sessions). */
export function useSongTranspose(songId: string | null | undefined): [number, (n: number) => void] {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    if (!songId) return setValue(0);
    try {
      setValue(foldSemitones(parseInt(localStorage.getItem(storeKey(songId)) || '0', 10) || 0));
    } catch {
      setValue(0);
    }
  }, [songId]);
  const set = React.useCallback(
    (n: number) => {
      const next = foldSemitones(n);
      setValue(next);
      if (!songId) return;
      try {
        if (next) localStorage.setItem(storeKey(songId), String(next));
        else localStorage.removeItem(storeKey(songId));
      } catch {
        /* private mode: only for this session */
      }
    },
    [songId],
  );
  return [value, set];
}

/** − Key +: the key the reader shows, moved a semitone at a time; tap the key to go back. */
export const TransposeControl: React.FC<{
  semitones: number;
  onChange: (n: number) => void;
  songKey?: string | null;
  /** Classes for dark stages. */
  tone?: 'default' | 'stage';
  className?: string;
}> = ({ semitones, onChange, songKey, tone = 'default', className }) => {
  const t = useT();
  const stage = tone === 'stage';
  const btn = cn(
    'w-11 h-11 flex items-center justify-center rounded-full border shrink-0',
    stage ? 'border-white/30 text-white' : 'border-border text-foreground',
  );
  // "Ab" → "A♭": the label style is upper case, so a plain "b" would read as "AB".
  const key = songKey ? transposeKey(songKey, semitones).replace(/^([A-G])b/, '$1♭').replace(/^([A-G])#/, '$1♯') : null;
  return (
    <div role="group" aria-label={t('Transpose')} className={cn('flex items-center gap-1', className)}>
      <button type="button" className={btn} onClick={() => onChange(semitones - 1)} aria-label={t('Transpose down a semitone')}>
        <Minus className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={() => onChange(0)}
        disabled={!semitones}
        aria-label={semitones ? t('Back to the original key') : t('Original key')}
        className={cn('min-w-[4.5rem] h-11 px-2 flex flex-col items-center justify-center rounded-full leading-none', semitones && (stage ? 'bg-white/10' : 'bg-muted'))}
      >
        <span className="bw-label-sm normal-case whitespace-nowrap">{key ?? t('Key')}</span>
        <span className={cn('bw-label-xs mt-0.5', stage ? 'text-white/60' : 'text-muted-foreground')}>{semitoneLabel(semitones)}</span>
      </button>
      <button type="button" className={btn} onClick={() => onChange(semitones + 1)} aria-label={t('Transpose up a semitone')}>
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
};
