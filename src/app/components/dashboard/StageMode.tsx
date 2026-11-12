import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X } from '@/app/components/icons';
import { durations, easings } from '@/styles/motion';
import { haptic } from '@/lib/haptics';
import { FIT, FitText } from '@/app/components/bw/FitText';
import { HeaderAction } from '@/app/components/bw/Screen';
import { RailCover, useRailTone } from '@/lib/railActions';
import { setStatusBarTone } from '@/lib/systemBars';
import { useT } from '@/lib/i18n';

export interface StageStep {
  label: string;
  /** Raw "HH:MM" (24h) used to work out what comes next. */
  time?: string;
  /** Formatted time shown on screen. */
  display: string;
}

export interface StageSong {
  title: string;
  artist?: string;
  duration?: string;
  key?: string;
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

const toDate = (date?: string, time?: string): Date | null => {
  if (!date || !time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  // Read YYYY-MM-DD as a local calendar day: new Date('2026-12-12') is UTC
  // midnight and lands on the previous day west of Greenwich.
  const ymd = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m || !ymd) return null;
  return new Date(+ymd[1], +ymd[2] - 1, +ymd[3], parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
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
  onClose,
}) => {
  const t = useT();
  const [now, setNow] = useState(() => new Date());

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

  const nextIndex = useMemo(() => {
    const idx = steps.findIndex((s) => {
      const at = toDate(date, s.time);
      return at ? at.getTime() > now.getTime() : false;
    });
    return idx;
  }, [steps, date, now]);

  const isDone = (i: number) => {
    const at = toDate(date, steps[i].time);
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
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-[640px] mx-auto px-4 gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 shrink-0 bw-status-clear-shift">
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

        {/* Run of show */}
        <ol className="grid grid-cols-2 gap-3 shrink-0" aria-label={t('Run of show')}>
          {steps.map((s, i) => {
            const next = i === nextIndex;
            const done = isDone(i);
            return (
              <li
                key={s.label}
                className="flex flex-col gap-1 rounded-[16px] px-4 py-3 border"
                style={{
                  borderColor: next ? accentColor : 'rgba(255,255,255,0.15)',
                  opacity: done && !next ? 0.4 : 1,
                }}
              >
                <span className="bw-label-xs text-white">
                  {next ? t('Next · {label}', { label: s.label }) : s.label}
                </span>
                <span
                  className="bw-num text-[clamp(22px,7vw,32px)] leading-[1.1] whitespace-nowrap"
                  style={{ ...MONO, color: next ? accentColor : '#fff' }}
                >
                  {to24h(s.time) || s.display || t('TBD')}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Setlist */}
        <section className="flex flex-col flex-1 min-h-0 gap-1" aria-label={t('Setlist')}>
          <div className="flex items-baseline justify-between shrink-0 pb-2">
            <span className="bw-label-sm text-white">{t('Setlist')}</span>
            <span className="bw-num text-[14px] font-medium text-white/70" style={MONO}>
              {songsLoading ? '…' : songs.length === 1 ? t('{count} song', { count: songs.length }) : t('{count} songs', { count: songs.length })}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-4 px-4">
            {songs.length === 0 && !songsLoading ? (
              <p className="bw-body-md text-white/70">{t('No setlist attached to this gig.')}</p>
            ) : (
              <ol className="flex flex-col">
                {songs.map((song, i) => (
                  <li
                    key={`${song.title}-${i}`}
                    className="flex items-center gap-4 py-3 border-b border-white/15 last:border-b-0"
                  >
                    <span className="bw-num text-[16px] font-medium text-white/50 w-7 shrink-0" style={MONO}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 min-w-0 bw-h2 normal-case leading-[1.15] truncate">{song.title}</span>
                    {(song.key || song.duration) && (
                      <span className="bw-num text-[14px] font-medium text-white/70 shrink-0" style={MONO}>
                        {[song.key, song.duration].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </motion.div>
  );
};
