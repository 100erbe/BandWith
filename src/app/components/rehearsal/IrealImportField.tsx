import React from 'react';
import { Music2, Search, X } from '@/app/components/icons';
import { IconButton, PillButton, PillField } from '@/app/components/bw';
import { chartSummary } from '@/app/components/ui/ChordChart';
import { chartBarCount, parseIrealLink, type SongChart } from '@/lib/ireal';
import { openLyrics } from '@/lib/lyrics';
import { useT } from '@/lib/i18n';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .trim();

const LIST_MAX = 60;

/**
 * Song form: paste an iReal Pro link (one song or a whole playlist) to attach
 * its chord chart. A playlist lists its songs, filtered by the song's title.
 */
export const IrealImportField: React.FC<{
  chart: SongChart | null;
  onChange: (chart: SongChart | null) => void;
  /** The song's title: preselects the matching songs of a pasted playlist. */
  title: string;
}> = ({ chart, onChange, title }) => {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [list, setList] = React.useState<{ name: string | null; songs: SongChart[] } | null>(null);
  const [filter, setFilter] = React.useState('');

  const reset = () => {
    setText('');
    setError(null);
    setList(null);
    setFilter('');
  };

  const pick = (c: SongChart) => {
    onChange(c);
    reset();
    setOpen(false);
  };

  const read = (value: string) => {
    setText(value);
    setList(null);
    if (!value.trim()) return setError(null);
    try {
      const pl = parseIrealLink(value);
      setError(null);
      if (pl.songs.length === 1) pick(pl.songs[0]);
      else {
        setList(pl);
        setFilter(title.trim());
      }
    } catch {
      setError(t('This is not an iReal Pro link.'));
    }
  };

  const matches = React.useMemo(() => {
    if (!list) return [];
    const q = norm(filter);
    const all = q ? list.songs.filter((s) => norm(s.title).includes(q) || norm(s.composer || '').includes(q)) : list.songs;
    return all;
  }, [list, filter]);

  if (chart) {
    const sections = chart.sections.map((s) => s.label).filter(Boolean).join(' ');
    return (
      <div className="flex flex-col gap-3 p-4 rounded-[24px] bg-card text-card-foreground">
        <div className="flex items-start gap-3">
          <Music2 className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
          <span className="flex-1 min-w-0 flex flex-col gap-1">
            <span className="bw-label-sm text-muted-foreground">{t('Chord chart · iReal Pro')}</span>
            <span className="bw-label-md truncate">{chart.title}</span>
            <span className="bw-body-sm text-muted-foreground">
              {[chartSummary(chart), t('{count} bars', { count: chartBarCount(chart) }), sections].filter(Boolean).join(' · ')}
            </span>
          </span>
          <IconButton label={t('Remove chord chart')} size="sm" icon={<X />} onClick={() => onChange(null)} />
        </div>
        <PillButton
          size="sm"
          variant="outline"
          fullWidth={false}
          className="self-start"
          onClick={() => openLyrics({ title: chart.title, artist: chart.composer, lyrics: '', chart, view: 'chords' })}
        >
          {t('Preview chords')}
        </PillButton>
      </div>
    );
  }

  if (!open) {
    return (
      <PillButton size="md" variant="outline" fullWidth={false} className="self-start" icon={<Music2 className="w-4 h-4" />} onClick={() => setOpen(true)}>
        {t('Import chords from iReal Pro')}
      </PillButton>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-[24px] bg-card text-card-foreground">
      <div className="flex items-center gap-3">
        <span className="flex-1 bw-label-md">{t('Import chords from iReal Pro')}</span>
        <IconButton
          label={t('Close')}
          size="sm"
          icon={<X />}
          onClick={() => {
            reset();
            setOpen(false);
          }}
        />
      </div>
      <PillField
        label={t('iReal Pro link')}
        value={text.length > 200 ? `${text.slice(0, 200)}…` : text}
        // A long pasted link shows shortened: editing it starts over.
        onChange={(e) => read(text.length > 200 ? '' : e.target.value)}
        onPaste={(e) => {
          const v = e.clipboardData.getData('text');
          if (v) {
            e.preventDefault();
            read(v);
          }
        }}
        placeholder="irealb://…"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        error={error}
        hint={t('On the iReal Pro forums, press and hold a song or playlist link, choose Copy Link and paste it here. Only chords and form are imported: no melody, no lyrics.')}
      />
      {list && (
        <div className="flex flex-col gap-2">
          <span className="bw-label-sm text-muted-foreground">
            {t('{name} · {count} songs', { name: list.name || t('Playlist'), count: list.songs.length })}
          </span>
          <PillField
            label={t('Find a song')}
            hideLabel
            icon={<Search className="w-5 h-5" />}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('Find a song')}
          />
          {matches.length === 0 ? (
            <p className="bw-body-sm text-muted-foreground">{t('No songs match.')}</p>
          ) : (
            <ul className="flex flex-col max-h-[320px] overflow-y-auto overscroll-contain -mx-2">
              {matches.slice(0, LIST_MAX).map((s, i) => (
                <li key={`${s.title}-${i}`}>
                  <button
                    type="button"
                    onClick={() => pick(s)}
                    className="w-full min-h-11 px-2 py-2 rounded-2xl text-left flex flex-col hover:bg-foreground/5 active:bg-foreground/10"
                  >
                    <span className="bw-label-md truncate">{s.title}</span>
                    <span className="bw-body-sm text-muted-foreground truncate">{[s.composer, chartSummary(s)].filter(Boolean).join(' · ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {matches.length > LIST_MAX && (
            <p className="bw-body-sm text-muted-foreground">{t('Showing {shown} of {count}: type to narrow the list.', { shown: LIST_MAX, count: matches.length })}</p>
          )}
        </div>
      )}
    </div>
  );
};
