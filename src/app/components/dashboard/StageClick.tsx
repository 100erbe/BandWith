import React from 'react';
import { Capacitor } from '@capacitor/core';
import { beatAt, type ClickState } from '@/lib/stageClick';
import { cn } from '@/app/components/ui/utils';
import { useT } from '@/lib/i18n';

const nowMs = () => performance.timeOrigin + performance.now();

/** Screen corner radius, so the glow follows the device's edge. */
const screenRadius = () => {
  if (Capacitor.getPlatform() !== 'ios') return 0;
  return Math.min(window.screen.width, window.screen.height) < 600 ? 52 : 20;
};

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * The visual metronome: a glow around the screen's edge that flashes on each
 * beat, brighter on the first beat of the bar, fading in between (like the
 * edge light of a voice assistant). It never takes a tap: the stage stays
 * usable underneath. Drawn with requestAnimationFrame straight on the
 * element, so React doesn't re-render 60 times a second.
 */
export const StageClickFrame: React.FC<{ state: ClickState; offset: number; accent: string; onDone?: () => void }> = ({ state, offset, accent, onDone }) => {
  const ring = React.useRef<HTMLDivElement>(null);
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;

  React.useEffect(() => {
    const el = ring.current;
    if (!el) return;
    const still = prefersReducedMotion();
    let raf = 0;
    const draw = () => {
      const pos = beatAt(state, nowMs(), offset);
      if (pos.done) {
        el.style.opacity = '0';
        doneRef.current?.();
        return;
      }
      if (pos.beat < 0) {
        el.style.opacity = '0';
      } else {
        // Flash, then fade over the beat; the downbeat flashes brighter.
        const peak = pos.downbeat ? 1 : 0.7;
        const level = Math.min(1, 0.12 + peak * Math.exp(-pos.phase * 5));
        el.style.opacity = level.toFixed(3);
        el.style.setProperty('--bw-click-width', `${pos.downbeat ? 20 : 14}px`);
        if (!still) el.style.setProperty('--bw-click-turn', `${((pos.beat + pos.phase) * 45) % 360}deg`);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [state, offset]);

  const radius = React.useMemo(screenRadius, []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
      <div
        ref={ring}
        className="absolute inset-0 transition-none"
        style={
          {
            opacity: 0,
            borderRadius: radius,
            padding: 'var(--bw-click-width, 14px)',
            background: `conic-gradient(from var(--bw-click-turn, 0deg), ${accent}, #7dd3fc, #f0abfc, ${accent})`,
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            mask: 'linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)',
            filter: 'blur(5px) saturate(1.4)',
            willChange: 'opacity',
          } as React.CSSProperties
        }
      />
    </div>
  );
};

/**
 * Stage mode's click button, between Prev and Next: the song's BPM; tap to
 * start or stop. For the leader it runs on every phone in Stage mode; for
 * the others it hides or shows the leader's click on this phone, or runs one
 * of their own.
 */
export const StageClickButton: React.FC<{
  bpm?: number;
  running: boolean;
  /** The click is the leader's, shown on this phone. */
  following: boolean;
  hidden: boolean;
  onPress: () => void;
  accent: string;
}> = ({ bpm, running, following, hidden, onPress, accent }) => {
  const t = useT();
  const lit = running && !hidden;
  const label = !bpm && !running ? t('No BPM for this song') : following ? (hidden ? t('Show the click') : t('Hide the click on this phone')) : running ? t('Stop the click') : t('Start the click');
  return (
    <button
      type="button"
      disabled={!bpm && !running}
      onClick={onPress}
      aria-pressed={lit}
      aria-label={`${label}${bpm ? ` · ${bpm} BPM` : ''}`}
      className={cn('min-h-14 min-w-16 px-3 rounded-[20px] flex flex-col items-center justify-center leading-none disabled:opacity-40', lit ? 'text-black' : 'bg-white/10 text-white')}
      style={lit ? { backgroundColor: accent } : undefined}
    >
      <span className="bw-num text-[18px] font-semibold">{bpm ?? '—'}</span>
      <span className="bw-label-xs mt-1">{following && hidden ? t('Hidden') : t('Click')}</span>
    </button>
  );
};
