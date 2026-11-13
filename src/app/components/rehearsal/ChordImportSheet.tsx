import React from 'react';
import { Capacitor } from '@capacitor/core';
import { ArrowUpRight, FileMusic, Globe, Loader2, Search, X } from '@/app/components/icons';
import { BwSheet, PillButton, PillField } from '@/app/components/bw';
import { chartSummary } from '@/app/components/ui/ChordChart';
import { cn } from '@/app/components/ui/utils';
import { parseIrealLink, type SongChart } from '@/lib/ireal';
import { browseIrealForum, canBrowseForumInApp, IREAL_FORUM_URL } from '@/lib/irealForum';
import { readMusicXml, type MusicXmlError } from '@/lib/musicxml';
import { openExternal } from '@/lib/nativeFiles';
import { takeReceivedChart, receivedChartName } from '@/lib/chartInbox';
import { useT } from '@/lib/i18n';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .trim();

const LIST_MAX = 60;

type Tab = 'forum' | 'file';

/**
 * "Import chords" for a song: from the iReal Pro forum (tap a song or a
 * playlist link; in the app the forum opens inside it, on the web in a new
 * tab with a paste field) or from a MusicXML file (iReal Pro: Share › Export
 * › MusicXML, or any notation app). Only chords and form are imported.
 */
export const ChordImportSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onPick: (chart: SongChart) => void;
  /** The song's title: preselects the matching songs of a playlist. */
  title: string;
  /** Above the song form (z-100). */
  zIndex?: number;
}> = ({ open, onClose, onPick, title, zIndex = 120 }) => {
  const t = useT();
  const inApp = canBrowseForumInApp();
  const [tab, setTab] = React.useState<Tab>(() => (receivedChartName() ? 'file' : 'forum'));
  const [text, setText] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [list, setList] = React.useState<{ name: string | null; songs: SongChart[] } | null>(null);
  const [filter, setFilter] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [received, setReceived] = React.useState<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const name = receivedChartName();
    setReceived(name);
    if (name) setTab('file');
  }, [open]);

  const reset = () => {
    setText('');
    setError(null);
    setList(null);
    setFilter('');
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pick = (c: SongChart) => {
    onPick(c);
    close();
  };

  const readLink = (value: string) => {
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

  const browse = async () => {
    setError(null);
    try {
      const link = await browseIrealForum(t('iReal Pro forum'));
      if (link) readLink(link);
    } catch {
      setError(t('Could not open the forum. Try again.'));
    }
  };

  const fileErrors: Record<MusicXmlError, string> = {
    'not-musicxml': t('This file is not MusicXML.'),
    'no-chords': t('This file has no chord symbols.'),
    'too-large': t('This file is too large.'),
  };

  const readFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const chart = await readMusicXml(new Uint8Array(await file.arrayBuffer()), file.name);
      pick(chart);
    } catch (e) {
      const code = (e as Error).message as MusicXmlError;
      setError(fileErrors[code] ?? fileErrors['not-musicxml']);
      setBusy(false);
    }
  };

  const useReceived = () => {
    const chart = takeReceivedChart();
    setReceived(null);
    if (chart) pick(chart);
  };

  const matches = React.useMemo(() => {
    if (!list) return [];
    const q = norm(filter);
    return q ? list.songs.filter((s) => norm(s.title).includes(q) || norm(s.composer || '').includes(q)) : list.songs;
  }, [list, filter]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'forum', label: t('From the forum') },
    { id: 'file', label: t('From file') },
  ];

  const pasteField = (
    <PillField
      tone="sheet"
      label={t('iReal Pro link')}
      value={text.length > 200 ? `${text.slice(0, 200)}…` : text}
      // A long pasted link shows shortened: editing it starts over.
      onChange={(e) => readLink(text.length > 200 ? '' : e.target.value)}
      onPaste={(e) => {
        const v = e.clipboardData.getData('text');
        if (v) {
          e.preventDefault();
          readLink(v);
        }
      }}
      placeholder="irealb://…"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
    />
  );

  return (
    <BwSheet open={open} onClose={close} overline={title.trim() || undefined} title={t('Import chords')} zIndex={zIndex} portal>
      <div className="flex flex-col gap-5 pb-2">
        <div role="tablist" aria-label={t('Import chords')} className="flex items-center gap-1 self-start p-1 rounded-full bg-sheet-foreground/[0.08]">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => {
                reset();
                setTab(x.id);
              }}
              className={cn(
                'min-h-9 px-4 rounded-full bw-label-sm transition-colors',
                tab === x.id ? 'bg-sheet-foreground text-sheet' : 'text-sheet-foreground/75',
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        {tab === 'forum' && !list && (
          <div role="tabpanel" className="flex flex-col gap-4">
            <p className="bw-body-md text-sheet-foreground/85">
              {inApp
                ? t('Browse the iReal Pro forum and tap a song or a playlist: its chords come straight here.')
                : t('Open the iReal Pro forum, copy the link of a song or a playlist and paste it here.')}
            </p>
            <PillButton variant="white" size="md" fullWidth={false} className="self-start" icon={<Globe className="w-4 h-4" />} onClick={() => void browse()}>
              {inApp ? t('Browse the iReal Pro forum') : t('Open the iReal Pro forum')}
            </PillButton>
            {inApp && (
              <div role="separator" className="flex items-center gap-3 text-sheet-foreground/60">
                <span className="flex-1 h-px bg-sheet-foreground/20" />
                <span className="bw-label-sm">{t('or paste a link')}</span>
                <span className="flex-1 h-px bg-sheet-foreground/20" />
              </div>
            )}
            {pasteField}
          </div>
        )}

        {tab === 'forum' && list && (
          <div role="tabpanel" className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0 bw-label-sm text-sheet-foreground/80 truncate">
                {t('{name} · {count} songs', { name: list.name || t('Playlist'), count: list.songs.length })}
              </span>
              <button type="button" onClick={reset} className="shrink-0 min-h-9 px-2 bw-label-sm text-sheet-foreground/80 underline underline-offset-2">
                {t('Change')}
              </button>
            </div>
            <PillField
              tone="sheet"
              label={t('Find a song')}
              hideLabel
              icon={<Search className="w-5 h-5" />}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('Find a song')}
              trailing={
                filter ? (
                  <button type="button" onClick={() => setFilter('')} aria-label={t('Clear search')} className="-m-2 p-2 shrink-0 text-sheet-foreground/70">
                    <X className="w-4 h-4" />
                  </button>
                ) : undefined
              }
            />
            {matches.length === 0 ? (
              <p className="bw-body-sm text-sheet-foreground/75">{t('No songs match.')}</p>
            ) : (
              <ul className="@container grid grid-cols-1 gap-1 -mx-2">
                {matches.slice(0, LIST_MAX).map((s, i) => (
                  <li key={`${s.title}-${i}`}>
                    <button
                      type="button"
                      onClick={() => pick(s)}
                      className="w-full min-h-12 px-3 py-2 rounded-2xl text-left flex flex-col hover:bg-sheet-foreground/[0.06] active:bg-sheet-foreground/[0.12]"
                    >
                      <span className="bw-label-md truncate">{s.title}</span>
                      <span className="bw-body-sm text-sheet-foreground/70 truncate">{[s.composer, chartSummary(s)].filter(Boolean).join(' · ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {matches.length > LIST_MAX && (
              <p className="bw-body-sm text-sheet-foreground/75">{t('Showing {shown} of {count}: type to narrow the list.', { shown: LIST_MAX, count: matches.length })}</p>
            )}
          </div>
        )}

        {tab === 'file' && (
          <div role="tabpanel" className="flex flex-col gap-4">
            <p className="bw-body-md text-sheet-foreground/85">
              {t('In iReal Pro open a song, then Share › Export › MusicXML and save it to Files. Choose it here: .musicxml and .mxl files from other apps work too.')}
            </p>
            {received && (
              <button
                type="button"
                onClick={useReceived}
                className="flex items-center gap-3 p-3 rounded-[16px] bg-sheet-foreground/[0.08] text-left hover:bg-sheet-foreground/[0.12]"
              >
                <FileMusic className="w-5 h-5 shrink-0" aria-hidden />
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="bw-label-sm text-sheet-foreground/75">{t('Received file')}</span>
                  <span className="bw-label-md truncate">{received}</span>
                </span>
                <span className="shrink-0 bw-label-sm underline underline-offset-2">{t('Use it')}</span>
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              // iOS greys out types it doesn't know, so it gets no filter; the file is checked once read.
              accept={Capacitor.getPlatform() === 'ios' ? undefined : '.musicxml,.mxl,.xml,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml'}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void readFile(f);
              }}
            />
            <PillButton
              variant="white"
              size="md"
              fullWidth={false}
              className="self-start"
              loading={busy}
              icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileMusic className="w-4 h-4" />}
              onClick={() => fileInput.current?.click()}
            >
              {t('Choose a file')}
            </PillButton>
          </div>
        )}

        {error && (
          <p role="alert" className="bw-body-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1 pt-1 border-t border-sheet-foreground/15">
          <p className="pt-3 bw-body-sm text-sheet-foreground/70">{t('Only chords and form are imported: no melody, no lyrics.')}</p>
          <button
            type="button"
            onClick={() => void openExternal(IREAL_FORUM_URL)}
            className="self-start min-h-9 flex items-center gap-1 bw-body-sm text-sheet-foreground/70 underline underline-offset-2"
          >
            {t('Chord charts from the iReal Pro community')}
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </BwSheet>
  );
};
