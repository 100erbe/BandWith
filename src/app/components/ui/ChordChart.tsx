import React from 'react';
import { chordLabel, keyLabel, type ChartBar, type SongChart } from '@/lib/ireal';
import { cn } from '@/app/components/ui/utils';
import { useT } from '@/lib/i18n';
import { transposeChart } from '@/lib/transpose';
import { useTranspose } from './Transpose';

/** Where a chart came from, shown under it: "Source: iReal Pro forum" or the file's name. */
export const chartSource = (chart: SongChart, tr: (s: string, v?: Record<string, string | number>) => string) =>
  chart.source === 'musicxml'
    ? tr('Source: {file}', { file: chart.file || tr('MusicXML file') })
    : tr('Source: iReal Pro forum');

/** "Eb · Medium Swing · 120 BPM · 4/4" */
export const chartSummary = (chart: SongChart) =>
  [keyLabel(chart.key), chart.style, chart.bpm ? `${chart.bpm} BPM` : null, chart.time].filter(Boolean).join(' · ');

/**
 * Chords shrink to fit their bar (a quarter of the row, `cqw` of the grid),
 * so long ones (A♭m(maj7)/G) and narrow screens (closed Duo) never cut them.
 * About 0.62em per character; the bar's padding and repeat signs take the rest.
 */
const chordFontSize = (label: string, bar: ChartBar) => {
  const reserved = 1 + 0.5 * (Number(!!bar.repeatStart) + Number(!!bar.repeatEnd));
  return `clamp(0.5em, calc((25cqw - ${reserved}em) / ${(Math.max(label.length, 2) * 0.62).toFixed(2)}), 1em)`;
};

const Bar: React.FC<{ bar: ChartBar; muted: string; line: string }> = ({ bar, muted, line }) => (
  <div
    className={cn(
      'relative min-w-0 overflow-hidden min-h-[2.4em] flex items-center gap-[0.35em] px-[0.4em] pt-[0.7em] pb-[0.25em] border-l',
      bar.repeatStart ? 'border-l-4 border-double border-current' : line,
      bar.final && 'border-r-4 border-r-current',
    )}
  >
    {(bar.ending || bar.segno || bar.coda) && (
      <span className={cn('absolute left-[0.4em] top-0 text-[0.5em] leading-none font-semibold uppercase tracking-wide', muted)}>
        {[bar.ending ? `${bar.ending}.` : null, bar.segno ? 'Segno' : null, bar.coda ? 'Coda' : null].filter(Boolean).join(' ')}
      </span>
    )}
    {bar.repeatStart && <span className="text-[0.6em] font-bold" aria-hidden>:</span>}
    <span className={cn('flex-1 min-w-0 flex flex-wrap items-baseline gap-x-[0.5em]', bar.chords.length > 1 && 'justify-between')}>
      {bar.chords.map((c, i) => {
        const label = chordLabel(c);
        return (
          <span key={i} className={cn('font-semibold whitespace-nowrap', (c === '%' || c === 'N.C.') && muted)} style={{ fontSize: chordFontSize(label, bar) }}>
            {label}
          </span>
        );
      })}
    </span>
    {bar.repeatEnd && <span className="text-[0.6em] font-bold" aria-hidden>:</span>}
    {bar.repeatEnd && <span className="absolute right-0 inset-y-[0.5em] border-r-4 border-double border-current" aria-hidden />}
    {bar.text && (
      <span className={cn('absolute right-[0.3em] bottom-[-0.15em] text-[0.45em] leading-none italic truncate max-w-full', muted)}>
        {bar.text}
      </span>
    )}
  </div>
);

/**
 * Chord chart imported from iReal Pro: sections with four bars per row
 * (chords, repeats, endings, segno/coda). `size` is the chord size in px,
 * shared with the lyrics A−/A+ setting; `muted` styles labels on dark stages.
 */
export const ChordChartView: React.FC<{
  chart: SongChart;
  size: number;
  muted?: string;
  /** Bar line colour (Stage mode is always dark). */
  line?: string;
  className?: string;
  showSummary?: boolean;
}> = ({ chart: original, size, muted = 'text-muted-foreground', line = 'border-border', className, showSummary = true }) => {
  const tr = useT();
  // Transposed for this reader (TransposeProvider), otherwise as saved.
  const { semitones } = useTranspose();
  const chart = React.useMemo(() => transposeChart(original, semitones), [original, semitones]);
  const summary = chartSummary(chart);
  return (
    <div className={className ?? 'max-w-3xl mx-auto w-full flex flex-col gap-6 pt-4'} style={{ fontSize: size, lineHeight: 1.2 }}>
      {showSummary && summary && <p className={cn('bw-label-sm normal-case', muted)}>{summary}</p>}
      {chart.sections.map((s, i) => (
        <section key={i} className="flex flex-col gap-2" aria-label={s.label ? tr('Section {name}', { name: s.label }) : undefined}>
          {s.label && <h3 className={cn('bw-label-md uppercase', muted)}>{s.label}</h3>}
          <div className="grid grid-cols-4 gap-y-[0.5em]" style={{ containerType: 'inline-size' }}>
            {s.bars.map((b, j) => (
              <Bar key={j} bar={b} muted={muted} line={line} />
            ))}
          </div>
        </section>
      ))}
      <p className={cn('bw-body-sm', muted)}>{chartSource(chart, tr)}</p>
    </div>
  );
};
