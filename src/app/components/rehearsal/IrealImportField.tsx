import React from 'react';
import { Music2, X } from '@/app/components/icons';
import { IconButton, PillButton } from '@/app/components/bw';
import { chartSource, chartSummary } from '@/app/components/ui/ChordChart';
import { chartBarCount, type SongChart } from '@/lib/ireal';
import { openLyrics } from '@/lib/lyrics';
import { useT } from '@/lib/i18n';
import { ChordImportSheet } from './ChordImportSheet';

/**
 * Song form: the song's chord chart, or "Import chords from iReal Pro", which
 * opens the import sheet (iReal Pro forum or a MusicXML file).
 */
export const IrealImportField: React.FC<{
  chart: SongChart | null;
  onChange: (chart: SongChart | null) => void;
  /** The song's title: preselects the matching songs of a playlist. */
  title: string;
}> = ({ chart, onChange, title }) => {
  const t = useT();
  const [open, setOpen] = React.useState(false);

  const sheet = <ChordImportSheet open={open} onClose={() => setOpen(false)} onPick={onChange} title={title} />;

  if (chart) {
    const sections = chart.sections.map((s) => s.label).filter(Boolean).join(' ');
    return (
      <div className="flex flex-col gap-3 p-4 rounded-[24px] bg-card text-card-foreground">
        <div className="flex items-start gap-3">
          <Music2 className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
          <span className="flex-1 min-w-0 flex flex-col gap-1">
            <span className="bw-label-sm text-muted-foreground">{t('Chord chart')}</span>
            <span className="bw-label-md truncate">{chart.title}</span>
            <span className="bw-body-sm text-muted-foreground">
              {[chartSummary(chart), t('{count} bars', { count: chartBarCount(chart) }), sections].filter(Boolean).join(' · ')}
            </span>
            <span className="bw-body-sm text-muted-foreground truncate">{chartSource(chart, t)}</span>
          </span>
          <IconButton label={t('Remove chord chart')} size="sm" icon={<X />} onClick={() => onChange(null)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <PillButton
            size="sm"
            variant="outline"
            fullWidth={false}
            onClick={() => openLyrics({ title: chart.title, artist: chart.composer, lyrics: '', chart, view: 'chords' })}
          >
            {t('Preview chords')}
          </PillButton>
          <PillButton size="sm" variant="ghost" fullWidth={false} onClick={() => setOpen(true)}>
            {t('Replace')}
          </PillButton>
        </div>
        {sheet}
      </div>
    );
  }

  return (
    <>
      <PillButton size="md" variant="outline" fullWidth={false} className="self-start" icon={<Music2 className="w-4 h-4" />} onClick={() => setOpen(true)}>
        {t('Import chords from iReal Pro')}
      </PillButton>
      {sheet}
    </>
  );
};
