import React from 'react';
import { Activity, Loader2, Minus, Plus } from '@/app/components/icons';
import { PillButton } from '@/app/components/bw';
import { cn } from '@/app/components/ui/utils';
import { detectBpmFromAudio, keepTaps, MAX_BPM, MIN_BPM, tapBpm } from '@/lib/tempo';
import { resolveSongFileUrl, isStoredSongFile } from '@/lib/services/songFiles';
import { semitoneLabel } from '@/lib/transpose';
import { haptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';

/**
 * Song form, under BPM and Key:
 * - Tap: tap along to set the BPM.
 * - From the recording: the BPM worked out on the device from the song's
 *   audio (the file just picked, or the one already uploaded). Half or double
 *   tempo can come out, so ×2 / ÷2 sit next to the result.
 * - Transpose: moves the key, the chord chart and the lyrics' chords for
 *   the whole band (saved with the song).
 */
export const TempoKeyTools: React.FC<{
  bpm: string;
  onBpm: (bpm: string) => void;
  audioFile: File | null;
  /** songs.audio_url (a stored file, or a link we can't analyse). */
  storedAudio?: string;
  /** Something to transpose (a key, a chart or chords in the lyrics). */
  canTranspose: boolean;
  /** Semitones moved in this edit (shown next to the buttons). */
  moved: number;
  onTranspose: (semitones: number) => void;
}> = ({ bpm, onBpm, audioFile, storedAudio, canTranspose, moved, onTranspose }) => {
  const t = useT();
  const [taps, setTaps] = React.useState<number[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [detected, setDetected] = React.useState<number | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const canAnalyse = !!audioFile || isStoredSongFile(storedAudio);

  const tap = () => {
    haptic.tap();
    const next = keepTaps(taps, performance.now());
    setTaps(next);
    setDetected(null);
    setNote(null);
    const value = tapBpm(next);
    if (value) onBpm(String(value));
  };

  const analyse = async () => {
    setBusy(true);
    setNote(null);
    setDetected(null);
    try {
      let data: ArrayBuffer | null = null;
      if (audioFile) data = await audioFile.arrayBuffer();
      else if (storedAudio) {
        const url = await resolveSongFileUrl(storedAudio);
        if (url) data = await (await fetch(url)).arrayBuffer();
      }
      const value = data ? await detectBpmFromAudio(data) : null;
      if (value) {
        setDetected(value);
        onBpm(String(value));
      } else setNote(t('No clear beat found in the recording.'));
    } catch {
      setNote(t('Could not read the recording.'));
    }
    setBusy(false);
  };

  const scale = (f: number) => {
    const n = Math.round(Number(bpm) * f);
    if (n >= MIN_BPM && n <= MAX_BPM) onBpm(String(n));
  };

  const small = 'h-9 min-w-9 px-2 rounded-full border border-border bw-label-xs flex items-center justify-center gap-1';
  const tapsCounted = taps.length;

  return (
    <div className="flex flex-col gap-2 -mt-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={tap}
          aria-label={t('Tap the tempo')}
          className={cn(small, 'px-4 active:bg-foreground active:text-background select-none touch-manipulation')}
        >
          {t('Tap')}
          {tapsCounted > 1 && <span className="text-muted-foreground">· {tapsCounted}</span>}
        </button>
        {canAnalyse && (
          <PillButton size="sm" variant="outline" fullWidth={false} loading={busy} icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />} onClick={() => void analyse()}>
            {t('BPM from the recording')}
          </PillButton>
        )}
        {(detected || tapsCounted > 1) && Number(bpm) > 0 && (
          <span className="flex items-center gap-1" role="group" aria-label={t('Half or double tempo')}>
            <button type="button" className={small} onClick={() => scale(0.5)} aria-label={t('Half tempo')}>
              ÷2
            </button>
            <button type="button" className={small} onClick={() => scale(2)} aria-label={t('Double tempo')}>
              ×2
            </button>
          </span>
        )}
      </div>
      {detected && <p className="bw-body-sm text-muted-foreground">{t('Estimated from the recording: check it by tapping along.')}</p>}
      {note && <p className="bw-body-sm text-muted-foreground">{note}</p>}
      {canTranspose && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="bw-label-sm text-muted-foreground">{t('Transpose for the band')}</span>
          <span className="flex items-center gap-1">
            <button type="button" className={small} onClick={() => onTranspose(-1)} aria-label={t('Transpose down a semitone')}>
              <Minus className="w-4 h-4" />
            </button>
            <span className="bw-label-sm min-w-8 text-center" aria-live="polite">
              {semitoneLabel(moved)}
            </span>
            <button type="button" className={small} onClick={() => onTranspose(1)} aria-label={t('Transpose up a semitone')}>
              <Plus className="w-4 h-4" />
            </button>
          </span>
          <span className="basis-full bw-body-sm text-muted-foreground">{t('Moves the key, the chord chart and the chords in the lyrics.')}</span>
        </div>
      )}
    </div>
  );
};
