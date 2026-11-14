import React from 'react';
import { Capacitor } from '@capacitor/core';
import { ArrowUpRight, FileMusic, FileText, Globe, Loader2, Search, X } from '@/app/components/icons';
import { BwSheet, PillButton, PillField } from '@/app/components/bw';
import { chartSummary } from '@/app/components/ui/ChordChart';
import { LyricsText } from '@/app/components/ui/LyricsViewer';
import { cn } from '@/app/components/ui/utils';
import { chartBarCount, parseIrealLink, type SongChart } from '@/lib/ireal';
import { browseIrealForum, canBrowseForumInApp, IREAL_FORUM_URL } from '@/lib/irealForum';
import { pastedLyrics, readSongFile, songFileTooLarge, SONG_FILE_ACCEPT, type ImportedSong, type SongFileError } from '@/lib/songImport';
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

export type ImportTab = 'forum' | 'file' | 'lyrics';

/**
 * "Import chords and lyrics" for a song:
 * - From the forum: tap a song or a playlist link of the iReal Pro forum (in
 *   the app it opens inside it, on the web in a new tab with a paste field).
 * - From file: MusicXML (chords, and lyrics when the score has them),
 *   ChordPro or plain text.
 * - Lyrics: paste from the clipboard.
 * Lyrics always show in a preview before they replace the song's own.
 * Nothing is looked up on a site: only what the musician brings in.
 */
export const ChordImportSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onPick: (song: ImportedSong) => void;
  /** The song's title: preselects the matching songs of a playlist. */
  title: string;
  /** The song already has lyrics: the preview says they will be replaced. */
  hasLyrics?: boolean;
  initialTab?: ImportTab;
  /** Above the song form (z-100). */
  zIndex?: number;
}> = ({ open, onClose, onPick, title, hasLyrics, initialTab = 'forum', zIndex = 120 }) => {
  const t = useT();
  const inApp = canBrowseForumInApp();
  const [tab, setTab] = React.useState<ImportTab>(initialTab);
  const [text, setText] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [list, setList] = React.useState<{ name: string | null; songs: SongChart[] } | null>(null);
  const [filter, setFilter] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [received, setReceived] = React.useState<string | null>(null);
  const [pasted, setPasted] = React.useState('');
  const [preview, setPreview] = React.useState<ImportedSong | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const pasteBox = React.useRef<HTMLTextAreaElement>(null);

  const names = React.useMemo(() => ({ verse: t('Verse'), chorus: t('Chorus'), bridge: t('Bridge') }), [t]);

  // Reads still running when the sheet closes are dropped (see readFile).
  const session = React.useRef(0);
  React.useEffect(() => {
    session.current += 1;
    if (!open) return;
    setPreview(null);
    const name = receivedChartName();
    setReceived(name);
    setTab(name && initialTab !== 'lyrics' ? 'file' : initialTab);
  }, [open, initialTab]);

  const reset = () => {
    setText('');
    setError(null);
    setList(null);
    setFilter('');
    setBusy(false);
    setPreview(null);
  };

  const close = () => {
    reset();
    setPasted('');
    onClose();
  };

  const pick = (song: ImportedSong) => {
    onPick(song);
    close();
  };

  /** Lyrics go through the preview first; a chord chart alone is used straight away. */
  const offer = (song: ImportedSong) => {
    if (song.lyrics) {
      setError(null);
      setPreview(song);
    } else pick(song);
  };

  const readLink = (value: string) => {
    setText(value);
    setList(null);
    if (!value.trim()) return setError(null);
    try {
      const pl = parseIrealLink(value);
      setError(null);
      if (pl.songs.length === 1) pick({ chart: pl.songs[0] });
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
      const link = await browseIrealForum(t('iReal Pro forum'), { close: t('Close'), back: t('Back') });
      if (link) readLink(link);
    } catch {
      setError(t('Could not open the forum. Try again.'));
    }
  };

  const fileErrors: Record<SongFileError, string> = {
    unsupported: t('Choose a MusicXML, ChordPro or text file.'),
    empty: t('This file has no lyrics.'),
    'not-musicxml': t('This file is not MusicXML.'),
    'no-chords': t('This file has no chords or lyrics.'),
    'too-large': t('This file is too large.'),
  };

  const readFile = async (file: File) => {
    setError(null);
    // Too big: refused before it is read into memory.
    if (songFileTooLarge(file.name, file.size)) return setError(fileErrors['too-large']);
    const mine = session.current;
    setBusy(true);
    try {
      const song = await readSongFile(new Uint8Array(await file.arrayBuffer()), file.name, names);
      // Closed (or closed and reopened) while reading: nothing is applied.
      if (session.current !== mine) return;
      offer(song);
    } catch (e) {
      if (session.current !== mine) return;
      const code = (e as Error).message as SongFileError;
      setError(fileErrors[code] ?? fileErrors.unsupported);
    }
    if (session.current === mine) setBusy(false);
  };

  const useReceived = () => {
    const chart = takeReceivedChart();
    setReceived(null);
    if (chart) pick({ chart });
  };

  const previewPasted = (value: string) => {
    const song = pastedLyrics(value, names);
    if (song.lyrics) offer(song);
    else setError(t('There is no text to import.'));
  };

  const pasteFromClipboard = async () => {
    setError(null);
    try {
      const value = await navigator.clipboard.readText();
      if (!value.trim()) {
        setError(t('The clipboard is empty: copy the lyrics first.'));
        return;
      }
      setPasted(value);
      previewPasted(value);
    } catch {
      // No clipboard access (browser setting): the box below takes a normal paste.
      setError(t('Could not read the clipboard: paste into the box below.'));
      pasteBox.current?.focus();
    }
  };

  const matches = React.useMemo(() => {
    if (!list) return [];
    const q = norm(filter);
    return q ? list.songs.filter((s) => norm(s.title).includes(q) || norm(s.composer || '').includes(q)) : list.songs;
  }, [list, filter]);

  const tabs: { id: ImportTab; label: string }[] = [
    { id: 'forum', label: t('From the forum') },
    { id: 'file', label: t('From file') },
    { id: 'lyrics', label: t('Lyrics') },
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
    <BwSheet open={open} onClose={close} overline={title.trim() || undefined} title={t('Import chords and lyrics')} zIndex={zIndex} portal>
      <div className="flex flex-col gap-5 pb-2">
        {preview ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="bw-label-md">{t('Preview')}</span>
              {(preview.title || preview.artist) && (
                <span className="bw-body-sm text-sheet-foreground/75 truncate">{[preview.title, preview.artist].filter(Boolean).join(' · ')}</span>
              )}
              {preview.chart && (
                <span className="bw-body-sm text-sheet-foreground/75">
                  {[t('Chord chart'), chartSummary(preview.chart), t('{count} bars', { count: chartBarCount(preview.chart) })].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
            <div className="max-h-[min(44vh,420px)] overflow-y-auto overscroll-contain rounded-[16px] bg-sheet-foreground/[0.08] px-4 py-3">
              <LyricsText lyrics={preview.lyrics} size={16} muted="text-sheet-foreground/65" className="flex flex-col gap-5" />
            </div>
            {hasLyrics && <p className="bw-body-sm text-sheet-foreground/80">{t('These lyrics replace the ones the song has now.')}</p>}
            <div className="flex flex-wrap gap-2">
              <PillButton variant="white" size="md" fullWidth={false} onClick={() => pick(preview)}>
                {t('Use these lyrics')}
              </PillButton>
              <PillButton variant="ghost" size="md" fullWidth={false} className="text-sheet-foreground" onClick={() => setPreview(null)}>
                {t('Back')}
              </PillButton>
            </div>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label={t('Import chords and lyrics')} className="flex items-center gap-1 self-start max-w-full overflow-x-auto p-1 rounded-full bg-sheet-foreground/[0.08]">
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
                    'shrink-0 min-h-9 px-4 rounded-full bw-label-sm whitespace-nowrap transition-colors',
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
                          onClick={() => pick({ chart: s })}
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
                  {t('Choose a MusicXML (.musicxml, .mxl), ChordPro (.cho, .chordpro, .pro) or text (.txt) file. From iReal Pro: Share › Export › MusicXML, then save it to Files.')}
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
                  accept={Capacitor.getPlatform() === 'ios' ? undefined : SONG_FILE_ACCEPT}
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

            {tab === 'lyrics' && (
              <div role="tabpanel" className="flex flex-col gap-4">
                <p className="bw-body-md text-sheet-foreground/85">
                  {t('Copy the lyrics, then paste them here. Empty lines separate the sections; chords above the words or in [brackets] stay with them.')}
                </p>
                <PillButton variant="white" size="md" fullWidth={false} className="self-start" icon={<FileText className="w-4 h-4" />} onClick={() => void pasteFromClipboard()}>
                  {t('Paste from clipboard')}
                </PillButton>
                <div role="separator" className="flex items-center gap-3 text-sheet-foreground/60">
                  <span className="flex-1 h-px bg-sheet-foreground/20" />
                  <span className="bw-label-sm">{t('or paste them here')}</span>
                  <span className="flex-1 h-px bg-sheet-foreground/20" />
                </div>
                <textarea
                  ref={pasteBox}
                  value={pasted}
                  onChange={(e) => {
                    setPasted(e.target.value);
                    setError(null);
                  }}
                  aria-label={t('Lyrics')}
                  placeholder={[`${t('Verse')} 1`, t('First line…'), '', t('Chorus'), '…'].join('\n')}
                  rows={6}
                  className="w-full rounded-[16px] bg-sheet-foreground/[0.08] px-4 py-3 outline-none focus:ring-2 focus:ring-sheet-foreground/60 text-sheet-foreground placeholder:text-sheet-foreground/45 font-mono text-[15px] leading-snug min-h-[140px] resize-y"
                />
                <PillButton variant="outline" size="md" fullWidth={false} className="self-start text-sheet-foreground border-sheet-foreground/40" disabled={!pasted.trim()} onClick={() => previewPasted(pasted)}>
                  {t('Preview')}
                </PillButton>
              </div>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="bw-body-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1 pt-1 border-t border-sheet-foreground/15">
          <p className="pt-3 bw-body-sm text-sheet-foreground/70">
            {tab === 'forum' && !preview
              ? t('Only chords and form are imported: no melody, no lyrics.')
              : t('Only your band sees the lyrics and charts you import. Import only what you have the right to use.')}
          </p>
          {tab === 'forum' && !preview && (
            <button
              type="button"
              onClick={() => void openExternal(IREAL_FORUM_URL)}
              className="self-start min-h-9 flex items-center gap-1 bw-body-sm text-sheet-foreground/70 underline underline-offset-2"
            >
              {t('Chord charts from the iReal Pro community')}
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </BwSheet>
  );
};
