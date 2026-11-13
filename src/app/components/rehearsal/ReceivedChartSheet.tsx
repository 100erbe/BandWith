import React from 'react';
import { Check, FileMusic, Loader2, Search, X } from '@/app/components/icons';
import { BwSheet, PillButton, PillField } from '@/app/components/bw';
import { chartSource, chartSummary } from '@/app/components/ui/ChordChart';
import { chartBarCount, type SongChart } from '@/lib/ireal';
import { onReceivedChart, peekReceivedChart, takeReceivedChart } from '@/lib/chartInbox';
import { getSongs, updateSong, type Song } from '@/lib/services/songs';
import { useBand } from '@/lib/BandContext';
import { openLyrics } from '@/lib/lyrics';
import { useT } from '@/lib/i18n';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .trim();

const LIST_MAX = 80;

/**
 * A MusicXML file opened with BandWith from another app: attach its chord
 * chart to a song of the current band. For a new song, the chart waits in
 * the song form (Import chords › From file › Received file).
 */
export const ReceivedChartSheet: React.FC = () => {
  const t = useT();
  const { selectedBand } = useBand();
  const [chart, setChart] = React.useState<SongChart | null>(() => peekReceivedChart());
  const [songs, setSongs] = React.useState<Song[] | null>(null);
  const [search, setSearch] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ song: Song; chart: SongChart } | null>(null);

  React.useEffect(() => onReceivedChart(() => setChart(peekReceivedChart())), []);

  const open = !!selectedBand && (!!chart || !!done);

  React.useEffect(() => {
    if (!open || !selectedBand || songs) return;
    let alive = true;
    void getSongs(selectedBand.id).then(({ data, error: e }) => {
      if (!alive) return;
      if (e) setError(t('Could not load the songs. Try again.'));
      setSongs((data || []).filter((s) => s.status !== 'archived'));
    });
    return () => {
      alive = false;
    };
  }, [open, selectedBand, songs, t]);

  React.useEffect(() => {
    if (chart) setSearch(chart.title === 'Untitled' ? '' : chart.title);
  }, [chart]);

  const close = () => {
    // Keep the chart for a song form: "Received file" there.
    setChart(null);
    setDone(null);
    setError(null);
    setSongs(null);
  };

  const discard = () => {
    takeReceivedChart();
    close();
  };

  const attach = async (song: Song) => {
    if (!chart) return;
    setBusy(song.id);
    setError(null);
    const { data, error: e } = await updateSong(song.id, { chord_chart: chart } as Partial<Song>);
    setBusy(null);
    if (e || !data) return setError(t('Could not save the chord chart. Try again.'));
    takeReceivedChart();
    setDone({ song: data, chart });
    setChart(null);
  };

  const matches = React.useMemo(() => {
    const q = norm(search);
    const list = songs || [];
    const hits = q ? list.filter((s) => norm(s.title).includes(q) || norm(s.artist || '').includes(q)) : list;
    // Typed title found nothing: show the whole list rather than nothing.
    return hits.length || !q ? hits : list;
  }, [songs, search]);

  if (!open) return null;

  if (done) {
    return (
      <BwSheet open onClose={close} overline={t('Chord chart')} title={t('Attached to {title}', { title: done.song.title })} zIndex={130} portal>
        <div className="flex flex-col gap-4 pb-2">
          <p className="bw-body-md text-sheet-foreground/85 flex items-center gap-2">
            <Check className="w-5 h-5 shrink-0" aria-hidden />
            {chartSource(done.chart, t)}
          </p>
          <div className="flex flex-wrap gap-2">
            <PillButton
              variant="white"
              size="md"
              fullWidth={false}
              onClick={() => {
                openLyrics({ songId: done.song.id, title: done.song.title, artist: done.song.artist, lyrics: done.song.lyrics || '', chart: done.chart, view: 'chords' });
                close();
              }}
            >
              {t('Open chords')}
            </PillButton>
            <PillButton variant="ghost" size="md" fullWidth={false} className="text-sheet-foreground" onClick={close}>
              {t('Done')}
            </PillButton>
          </div>
        </div>
      </BwSheet>
    );
  }

  const c = chart!;
  return (
    <BwSheet open onClose={close} overline={t('Received file')} title={t('Attach the chord chart')} zIndex={130} portal>
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex items-start gap-3 p-3 rounded-[16px] bg-sheet-foreground/[0.08]">
          <FileMusic className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
          <span className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="bw-label-md truncate">{c.title}</span>
            <span className="bw-body-sm text-sheet-foreground/70">
              {[chartSummary(c), t('{count} bars', { count: chartBarCount(c) })].filter(Boolean).join(' · ')}
            </span>
            <span className="bw-body-sm text-sheet-foreground/70 truncate">{chartSource(c, t)}</span>
          </span>
        </div>
        <p className="bw-body-sm text-sheet-foreground/80">
          {t('Choose the song it belongs to. For a new song, add the song first: the file waits in Import chords › From file.')}
        </p>
        <PillField
          tone="sheet"
          label={t('Find a song')}
          hideLabel
          icon={<Search className="w-5 h-5" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('Find a song')}
          trailing={
            search ? (
              <button type="button" onClick={() => setSearch('')} aria-label={t('Clear search')} className="-m-2 p-2 shrink-0 text-sheet-foreground/70">
                <X className="w-4 h-4" />
              </button>
            ) : undefined
          }
        />
        {error && (
          <p role="alert" className="bw-body-sm text-destructive">
            {error}
          </p>
        )}
        {songs == null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-sheet-foreground/70" />
          </div>
        ) : matches.length === 0 ? (
          <p className="bw-body-sm text-sheet-foreground/75">{t('No songs in the repertoire yet.')}</p>
        ) : (
          <ul className="@container grid grid-cols-1 @min-[600px]:grid-cols-2 gap-1 -mx-2" aria-label={t('Songs')}>
            {matches.slice(0, LIST_MAX).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void attach(s)}
                  className="w-full min-h-12 px-3 py-2 rounded-2xl text-left flex items-center gap-2 hover:bg-sheet-foreground/[0.06] active:bg-sheet-foreground/[0.12] disabled:opacity-60"
                >
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="bw-label-md truncate">{s.title}</span>
                    <span className="bw-body-sm text-sheet-foreground/70 truncate">
                      {[s.artist, s.chord_chart ? t('Has a chord chart: it will be replaced') : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {busy === s.id && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        <PillButton variant="ghost" size="sm" fullWidth={false} className="self-start text-sheet-foreground/80" onClick={discard}>
          {t('Discard the file')}
        </PillButton>
      </div>
    </BwSheet>
  );
};
