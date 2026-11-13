import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Cloud,
  FileText,
  Plus,
  Check,
  ArrowLeft,
  ArrowUpRight,
  Youtube,
  FileMusic,
  StickyNote,
  BookOpen,
  Link as LinkIcon,
  Disc3,
} from '@/app/components/icons';
import { IconButton, NavBackButton, PillButton, PillField, Selector, FormError } from '@/app/components/bw';
import { useRailAction } from '@/lib/railActions';
import { cn } from '@/app/components/ui/utils';
import { createSong, updateSong, type Song } from '@/lib/services/songs';
import {
  SONG_FILE_ACCEPT,
  classifySongFile,
  isStoredSongFile,
  normalizeSongFile,
  removeSongFiles,
  safeHttpsUrl,
  uploadSongFile,
  validateSongFile,
} from '@/lib/services/songFiles';
import { supabase } from '@/lib/supabase';
import { useBand } from '@/lib/BandContext';
import { useAuth } from '@/lib/AuthContext';
import { personName } from '@/lib/personName';
import { notifySongAdded } from '@/lib/services/notifications';
import { genresOf, joinGenres, parseGenres } from '@/lib/songGenres';
import { useT } from '@/lib/i18n';
import { asSongChart, keyLabel, type SongChart } from '@/lib/ireal';
import { IrealImportField } from './IrealImportField';
import { ChordImportSheet } from './ChordImportSheet';
import type { ImportedSong } from '@/lib/songImport';
import { foldSemitones, parseKey, prefersFlats, transposeChart, transposeKey, transposeLyrics } from '@/lib/transpose';
import { TempoKeyTools } from './TempoKeyTools';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  bandId: string;
  onSongAdded?: () => void;
  /** Edit this song instead of creating a new one. */
  song?: Song | null;
}

// 1. Song (title + artist, the only required part) → 2. Details → 3. Files & links.
type StepType = 'details' | 'more' | 'extras';

/** "245" seconds → { min: '4', sec: '05' }. */
const splitDuration = (seconds?: number | null) =>
  seconds && seconds > 0
    ? { min: String(Math.floor(seconds / 60)), sec: String(Math.round(seconds % 60)).padStart(2, '0') }
    : { min: '', sec: '' };

export const AddSongModal: React.FC<AddSongModalProps> = ({
  isOpen,
  onClose,
  bandId,
  onSongAdded,
  song,
}) => {
  const t = useT();
  const isEdit = !!song;
  const { isAdmin } = useBand();
  const { profile, user } = useAuth();
  const [step, setStep] = useState<StepType>('details');
  
  // Basic info
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  // Genre tags (songs.genre, comma-separated): the band's genres to pick
  // from, plus any new one typed here.
  const [genres, setGenres] = useState<string[]>([]);
  const [bandGenres, setBandGenres] = useState<string[]>([]);
  const [showNewGenre, setShowNewGenre] = useState(false);
  const [newGenre, setNewGenre] = useState('');
  
  // Files (uploaded to the band's private storage on save)
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [chartFile, setChartFile] = useState<File | null>(null);
  const [existingAudio, setExistingAudio] = useState<string | undefined>();
  const [existingChart, setExistingChart] = useState<string | undefined>();
  
  // Extra fields
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [chartUrl, setChartUrl] = useState('');
  const [chordsUrl, setChordsUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [lyricsImportOpen, setLyricsImportOpen] = useState(false);
  // Chord chart pasted from iReal Pro (songs.chord_chart); saved only when changed here.
  const [chordChart, setChordChart] = useState<SongChart | null>(null);
  const [chordChartTouched, setChordChartTouched] = useState(false);
  const [bpm, setBpm] = useState('');
  const [key, setKey] = useState('');
  /** Semitones moved with Transpose in this edit. */
  const [transposed, setTransposed] = useState(0);
  // Duration as minutes + seconds (number pads have no ":").
  const [durMin, setDurMin] = useState('');
  const [durSec, setDurSec] = useState('');
  
  // Status
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadGenres();
    }
  }, [isOpen, bandId]);

  // Edit: start from the song's current values.
  useEffect(() => {
    if (!isOpen || !song) return;
    setTitle(song.title || '');
    setArtist(song.artist || '');
    setBpm(song.bpm ? String(song.bpm) : '');
    setKey(song.key || '');
    const d = splitDuration(song.duration_seconds);
    setDurMin(d.min);
    setDurSec(d.sec);
    setYoutubeUrl(song.youtube_url || '');
    setNotes(song.notes || '');
    setLyrics(song.lyrics || '');
    setChordChart(asSongChart(song.chord_chart));
    setChordChartTouched(false);
    setGenres(parseGenres(song.genre));
    setExistingAudio(song.audio_url || undefined);
    setExistingChart(song.chart_url || undefined);
    setChartUrl(song.chart_url && !isStoredSongFile(song.chart_url) ? song.chart_url : '');
  }, [isOpen, song?.id]);

  const loadGenres = async () => {
    try {
      const { data } = await supabase.from('songs').select('genre').eq('band_id', bandId).not('genre', 'is', null);
      setBandGenres(genresOf((data || []) as Array<{ genre?: string | null }>));
    } catch {
      setBandGenres([]);
    }
  };

  const toggleGenre = (g: string) =>
    setGenres((prev) => (prev.some((x) => x.toLowerCase() === g.toLowerCase()) ? prev.filter((x) => x.toLowerCase() !== g.toLowerCase()) : [...prev, g]));

  const handleAddGenre = () => {
    const added = parseGenres(newGenre);
    if (added.length) {
      setGenres((prev) => parseGenres([...prev, ...added].join(',')));
      setBandGenres((prev) => genresOf([{ genre: [...prev, ...added].join(',') }]));
    }
    setNewGenre('');
    setShowNewGenre(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Array.from(e.target.files || []);
    e.target.value = '';
    // Files from Drive & co. can come without extension/type: read them.
    const picked = await Promise.all(raw.map(normalizeSongFile));
    for (const f of picked) {
      const problem = validateSongFile(f);
      if (problem) {
        setError(problem);
        continue;
      }
      setError(null);
      if (classifySongFile(f) === 'audio') setAudioFile(f);
      else setChartFile(f);
      if (!title) setTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim());
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError(t('Song title is required'));
      return;
    }

    setSaving(true);
    setError(null);

    // Files uploaded in this attempt: removed again if the song isn't saved.
    const uploaded: string[] = [];
    try {
      // Links: https only.
      const youtube = youtubeUrl.trim() ? safeHttpsUrl(youtubeUrl) : undefined;
      const chartLink = chartUrl.trim() ? safeHttpsUrl(chartUrl) : undefined;
      const chords = chordsUrl.trim() ? safeHttpsUrl(chordsUrl) : undefined;
      if ((youtubeUrl.trim() && !youtube) || (chartUrl.trim() && !chartLink) || (chordsUrl.trim() && !chords)) {
        throw new Error(t('Links must start with https://'));
      }

      // Upload new files to the band's private storage.
      let audioRef = existingAudio;
      let chartRef = chartLink ?? existingChart;
      const replaced: Array<string | undefined> = [];
      if (audioFile) {
        const up = await uploadSongFile(bandId, audioFile);
        if (up.error) throw up.error;
        uploaded.push(up.ref);
        if (existingAudio) replaced.push(existingAudio);
        audioRef = up.ref;
      }
      if (chartFile) {
        const up = await uploadSongFile(bandId, chartFile);
        if (up.error) throw up.error;
        uploaded.push(up.ref);
        if (existingChart) replaced.push(existingChart);
        chartRef = up.ref;
      } else if (chartLink && existingChart && existingChart !== chartLink) {
        replaced.push(existingChart);
      }

      const noteText = [notes.trim(), chords && !notes.includes(chords) ? `Chords: ${chords}` : '']
        .filter(Boolean)
        .join('\n');

      const mins = parseInt(durMin || '0', 10) || 0;
      const secs = Math.min(59, parseInt(durSec || '0', 10) || 0);
      const durationSeconds = mins * 60 + secs;

      const payload: Partial<Song> = {
        title: title.trim(),
        artist: artist.trim() || undefined,
        // Editing to no genre clears it.
        genre: joinGenres(genres) ?? (isEdit ? '' : undefined),
        audio_url: audioRef,
        chart_url: chartRef,
        youtube_url: youtube,
        notes: noteText || undefined,
        // Editing to empty clears them.
        lyrics: lyrics.trim() ? lyrics.replace(/\s+$/, '').slice(0, 20000) : isEdit ? '' : undefined,
        ...(chordChartTouched ? { chord_chart: chordChart } : {}),
        bpm: bpm ? parseInt(bpm) : undefined,
        key: key || undefined,
        duration_seconds: durationSeconds || undefined,
      };

      // Members suggest songs; an admin moves them to Learning / Ready.
      const suggested = !isEdit && !isAdmin;
      const { data: savedSong, error: songError } = isEdit && song
        ? await updateSong(song.id, payload)
        : await createSong({ ...payload, band_id: bandId, status: suggested ? 'suggested' : 'ready', priority: 'medium' });

      if (songError) throw songError;
      if (!isEdit) {
        // Inbox note to the rest of the band (no push).
        void notifySongAdded(
          bandId,
          { id: savedSong?.id, title: payload.title || title.trim(), artist: payload.artist },
          { suggested, byName: personName(profile ? { ...profile, email: profile.email ?? user?.email } : { email: user?.email }, '') },
        );
      }
      uploaded.length = 0; // saved: the new files now belong to the song
      await removeSongFiles(replaced);

      setSuccess(true);
      setTimeout(() => {
        onSongAdded?.();
        handleClose();
      }, 1000);
    } catch (err: any) {
      // Don't leave orphaned uploads in storage when the song wasn't saved.
      if (uploaded.length > 0) await removeSongFiles(uploaded);
      setError(
        err?.message
          ? isEdit
            ? t('Could not save the song: {error}', { error: err.message })
            : t('Could not add the song: {error}', { error: err.message })
          : isEdit
            ? t('Could not save the song. Try again.')
            : t('Could not add the song. Try again.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep('details');
    setTitle('');
    setArtist('');
    setAudioFile(null);
    setChartFile(null);
    setExistingAudio(undefined);
    setExistingChart(undefined);
    setGenres([]);
    setNewGenre('');
    setShowNewGenre(false);
    setYoutubeUrl('');
    setChartUrl('');
    setChordsUrl('');
    setNotes('');
    setLyrics('');
    setChordChart(null);
    setChordChartTouched(false);
    setBpm('');
    setKey('');
    setDurMin('');
    setDurSec('');
    setTransposed(0);
    setError(null);
    setSuccess(false);
    onClose();
  };

  const canProceed = () => title.trim().length > 0;

  // A chart fills what the form doesn't have yet (title, artist, key, tempo).
  const handleChordChart = (c: SongChart | null) => {
    setChordChart(c);
    setChordChartTouched(true);
    if (!c) return;
    if (!title.trim()) setTitle(c.title);
    if (!artist.trim() && c.composer) setArtist(c.composer);
    if (!key.trim() && c.key) setKey(keyLabel(c.key) || '');
    if (!bpm && c.bpm) setBpm(String(c.bpm).slice(0, 3));
  };

  // Imported chords and/or lyrics (the sheet shows lyrics in a preview first).
  const handleImport = (song: ImportedSong) => {
    if (song.chart) handleChordChart(song.chart);
    if (song.lyrics) setLyrics(song.lyrics);
    if (!title.trim() && song.title) setTitle(song.title);
    if (!artist.trim() && song.artist) setArtist(song.artist);
    if (!key.trim() && song.key) setKey(song.key.slice(0, 8));
    if (!bpm && song.bpm) setBpm(String(song.bpm).slice(0, 3));
  };

  // Transpose for the band: key, chart and the lyrics' inline chords move together (saved with the song).
  const transposeSong = (by: number) => {
    const flats = prefersFlats(key || keyLabel(chordChart?.key), by);
    if (parseKey(key)) setKey(transposeKey(key, by));
    if (chordChart) {
      setChordChart(transposeChart(chordChart, by));
      setChordChartTouched(true);
    }
    if (lyrics) setLyrics(transposeLyrics(lyrics, by, flats));
    setTransposed((n) => foldSemitones(n + by));
  };

  const nextStep = () => {
    if (step === 'details') setStep('more');
    else if (step === 'more') setStep('extras');
    else handleSubmit();
  };

  const prevStep = () => {
    if (step === 'extras') setStep('more');
    else if (step === 'more') setStep('details');
    else handleClose();
  };

  const getStepInfo = () => {
    switch (step) {
      case 'details': return { num: '01', title: t('Song'), subtitle: t('Title and artist are all you need. The rest is optional.') };
      case 'more': return { num: '02', title: t('Details · optional'), subtitle: t('Duration, tempo, key and folder.') };
      case 'extras': return { num: '03', title: t('Files & links · optional'), subtitle: t('A recording, a chart, links and notes.') };
    }
  };

  // iPhone Duo: close sits in the system column under the clock
  // (Figma "Closed · Songs / Add song – details").
  const closeInRail = useRailAction(isOpen ? handleClose : undefined, { label: t('Close'), icon: <X />, pane: true });

  if (!isOpen) return null;

  const stepInfo = getStepInfo();
  const STEP_ORDER: StepType[] = ['details', 'more', 'extras'];
  const stepIndex = STEP_ORDER.indexOf(step);
  const [suggestedBefore, suggestedAfter] = t('Your song is added as {status}: an admin moves it to Learning or Ready.').split('{status}');
  const cloudParts = t('Files on iCloud Drive, Google Drive or Dropbox: tap {choose}, then {browse} and pick the app under Locations. Files are stored privately for your band.').split(/\{choose\}|\{browse\}/);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-song-title"
      className="bw-pane-detail fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background text-foreground"
    >
      {/* Header: Top Bar + wizard steps */}
      <header className="shrink-0 px-4 pb-3 flex flex-col gap-3" style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}>
        <div className="flex items-center gap-3 min-h-11">
          <NavBackButton pane label={step === 'details' ? t('Cancel') : t('Back')} onClick={prevStep} />
          <h2 id="add-song-title" className="flex-1 min-w-0 bw-h1 truncate">
            {isEdit ? t('Edit song') : t('Add song', { context: 'title' })}
          </h2>
          {!closeInRail && <IconButton label={t('Close')} icon={<X />} variant="ghost" onClick={handleClose} />}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {STEP_ORDER.map((s, i) => (
              <span
                key={s}
                className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= stepIndex ? 'bg-foreground' : 'bg-foreground/15')}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="bw-label-sm text-muted-foreground">
              {t('Step {step} of {total}', { step: stepIndex + 1, total: STEP_ORDER.length })}
            </span>
            <span className="bw-label-sm">{stepInfo.title}</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4"
            >
              <p className="bw-body-md text-muted-foreground">{stepInfo.subtitle}</p>
              <PillField
                label={t('Song title *')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canProceed() && nextStep()}
                placeholder={t('e.g. Superstition')}
                autoFocus={!isEdit}
                enterKeyHint="next"
              />
              <PillField label={t('Original artist')} value={artist} onChange={(e) => setArtist(e.target.value)} placeholder={t('e.g. Stevie Wonder')} />
              <IrealImportField chart={chordChart} onChange={handleChordChart} onImport={handleImport} title={title} hasLyrics={!!lyrics.trim()} />
              {!isEdit && !isAdmin && (
                <p className="bw-body-sm text-muted-foreground">
                  {suggestedBefore}<span className="text-foreground">{t('Suggested')}</span>{suggestedAfter}
                </p>
              )}
              {error && <FormError>{error}</FormError>}
            </motion.div>
          )}

          {step === 'more' && (
            <motion.div
              key="more"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4"
            >
              <p className="bw-body-md text-muted-foreground">{stepInfo.subtitle}</p>

              {/* Duration: minutes : seconds (numeric pads have no colon key) */}
              <fieldset className="flex flex-col gap-2">
                <legend className="bw-label-sm text-muted-foreground mb-2">{t('Duration')}</legend>
                <div className="flex items-center gap-2">
                  <PillField
                    label={t('Minutes')}
                    hideLabel
                    className="w-24"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    value={durMin}
                    onChange={(e) => setDurMin(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    placeholder="4"
                    trailing={<span className="bw-label-xs text-muted-foreground">{t('min')}</span>}
                  />
                  <span className="bw-h2" aria-hidden>:</span>
                  <PillField
                    label={t('Seconds')}
                    hideLabel
                    className="w-24"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    value={durSec}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                      setDurSec(v && parseInt(v, 10) > 59 ? '59' : v);
                    }}
                    onBlur={() => durSec.length === 1 && setDurSec(`0${durSec}`)}
                    placeholder="00"
                    trailing={<span className="bw-label-xs text-muted-foreground">{t('sec')}</span>}
                  />
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                <PillField label="BPM" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} value={bpm} onChange={(e) => setBpm(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="120" />
                <PillField label={t('Key')} value={key} onChange={(e) => setKey(e.target.value)} placeholder={t('C maj')} />
              </div>
              <TempoKeyTools
                bpm={bpm}
                onBpm={(v) => setBpm(v.slice(0, 3))}
                audioFile={audioFile}
                storedAudio={existingAudio}
                canTranspose={!!parseKey(key) || !!chordChart || /\[[A-G][^\]\s]{0,15}\]/.test(lyrics)}
                moved={transposed}
                onTranspose={transposeSong}
              />

              {/* Genre tags: used to filter the library when building a setlist */}
              <fieldset className="flex flex-col gap-2 pt-2">
                <legend className="bw-label-sm text-muted-foreground mb-2">{t('Genre')}</legend>
                <div className="flex flex-wrap items-center gap-2">
                  {genresOf([{ genre: [...bandGenres, ...genres].join(',') }]).map((g) => (
                    <Selector
                      key={g}
                      size="md"
                      selected={genres.some((x) => x.toLowerCase() === g.toLowerCase())}
                      onClick={() => toggleGenre(g)}
                    >
                      {g}
                    </Selector>
                  ))}
                  {!showNewGenre && (
                    <Selector size="md" selected={false} onClick={() => setShowNewGenre(true)} className="border-dashed">
                      <Plus className="w-3.5 h-3.5" />
                      {t('Genre')}
                    </Selector>
                  )}
                </div>
                {showNewGenre && (
                  <div className="flex items-end gap-2">
                    <PillField
                      label={t('New genre')}
                      hideLabel
                      value={newGenre}
                      onChange={(e) => setNewGenre(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddGenre()}
                      placeholder={t('e.g. Funk, Soul')}
                      autoFocus
                    />
                    <IconButton label={t('Add genre')} icon={<Check />} variant="filled" className="mb-1" onClick={handleAddGenre} />
                  </div>
                )}
              </fieldset>
              {error && <FormError>{error}</FormError>}
            </motion.div>
          )}

          {step === 'extras' && (
            <motion.div
              key="extras"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4"
            >
              <p className="bw-body-md text-muted-foreground">{stepInfo.subtitle}</p>
              {/* Audio */}
              <FileSlot
                label={t('Recording')}
                hint={t('MP3, M4A, WAV · max 50 MB')}
                file={audioFile}
                existing={existingAudio && isStoredSongFile(existingAudio) ? t('Recording uploaded') : undefined}
                onClear={() => {
                  setAudioFile(null);
                  setExistingAudio(undefined);
                }}
              />
              {/* Chart */}
              <FileSlot
                label={t('Chart / sheet music')}
                hint={t('PDF or photo · max 20 MB')}
                file={chartFile}
                existing={existingChart && isStoredSongFile(existingChart) ? t('Chart uploaded') : undefined}
                onClear={() => {
                  setChartFile(null);
                  setExistingChart(undefined);
                }}
              />

              <label className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-surface-inverse text-surface-inverse-foreground bw-button-md cursor-pointer active:scale-[0.97] transition-transform">
                <input type="file" multiple accept={SONG_FILE_ACCEPT} onChange={handleFileChange} className="hidden" />
                <Plus className="w-[18px] h-[18px]" />
                {t('Choose files')}
              </label>

              <div className="flex items-start gap-3 p-4 rounded-[16px] bg-card">
                <Cloud className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
                <p className="bw-body-sm text-muted-foreground">
                  {cloudParts[0]}<span className="text-foreground">{t('Choose files')}</span>{cloudParts[1]}<span className="text-foreground">{t('Browse')}</span>{cloudParts[2]}
                </p>
              </div>
              <PillField
                type="url"
                label={t('YouTube video')}
                icon={<Youtube className="w-5 h-5" />}
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=…"
              />
              <PillField
                type="url"
                label={t('Sheet music')}
                icon={<FileMusic className="w-5 h-5" />}
                value={chartUrl}
                onChange={(e) => setChartUrl(e.target.value)}
                placeholder={t('URL to PDF or sheet music…')}
              />
              <PillField
                type="url"
                label={t('Chords')}
                icon={<LinkIcon className="w-5 h-5" />}
                value={chordsUrl}
                onChange={(e) => setChordsUrl(e.target.value)}
                placeholder={t('Link to chords (Ultimate Guitar, etc.)')}
              />

              <label className="flex flex-col gap-2 p-4 rounded-[24px] bg-field border border-border focus-within:border-2 focus-within:border-foreground transition-[border-color]">
                <span className="flex items-center gap-2 bw-label-sm text-muted-foreground">
                  <StickyNote className="w-4 h-4" />
                  {t('Notes')}
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('Arrangement ideas, key changes…')}
                  rows={4}
                  className="w-full bg-transparent outline-none bw-body-lg text-foreground placeholder:text-muted-foreground/60 min-h-[96px] resize-none"
                />
              </label>

              <label className="flex flex-col gap-2 p-4 rounded-[24px] bg-field border border-border focus-within:border-2 focus-within:border-foreground transition-[border-color]">
                <span className="flex items-center gap-2 bw-label-sm text-muted-foreground">
                  <BookOpen className="w-4 h-4" />
                  {t('Lyrics · text, Markdown or JSON')}
                </span>
                <textarea
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder={[`# ${t('Verse 1')}`, t('First line…'), '', `[${t('Chorus')}]`, '…'].join('\n')}
                  rows={6}
                  className="w-full bg-transparent outline-none bw-body-lg text-foreground placeholder:text-muted-foreground/60 min-h-[140px] resize-y font-mono text-[15px]"
                />
                <span className="bw-body-sm text-muted-foreground">{t('Read them in the app from the song menu or the player.')}</span>
              </label>
              <PillButton size="sm" variant="outline" fullWidth={false} className="self-start -mt-2" icon={<FileText className="w-4 h-4" />} onClick={() => setLyricsImportOpen(true)}>
                {t('Paste or import lyrics')}
              </PillButton>
              <ChordImportSheet
                open={lyricsImportOpen}
                onClose={() => setLyricsImportOpen(false)}
                onPick={handleImport}
                title={title}
                hasLyrics={!!lyrics.trim()}
                initialTab="lyrics"
              />

              {error && <FormError>{error}</FormError>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA bar */}
      <div className="shrink-0 px-4 pt-3 bg-background flex flex-col gap-2" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
        {/* The optional steps can be skipped: save with what's there. */}
        {step !== 'extras' && !success && (
          <div className="max-w-2xl mx-auto w-full flex justify-center">
            <PillButton variant="ghost" size="sm" fullWidth={false} onClick={handleSubmit} disabled={!canProceed() || saving}>
              {isEdit ? t('Save now') : t('Add song now')}
            </PillButton>
          </div>
        )}
        <div className="max-w-2xl mx-auto w-full grid grid-cols-[2fr_3fr] gap-3">
          <PillButton variant="outline" onClick={prevStep}>
            {step === 'details' ? t('Cancel') : t('Back')}
          </PillButton>
          <PillButton
            onClick={nextStep}
            disabled={!canProceed() || saving}
            loading={saving}
            className={success ? 'bg-success text-success-foreground' : undefined}
            icon={success ? <Check className="w-[18px] h-[18px]" /> : step === 'extras' ? <Disc3 className="w-[18px] h-[18px]" /> : undefined}
          >
            {success ? (
              isEdit ? t('Saved!') : t('Added!')
            ) : step === 'extras' ? (
              isEdit ? t('Save song') : t('Add song')
            ) : (
              <>
                {t('Next')}
                <ArrowUpRight className="w-5 h-5" />
              </>
            )}
          </PillButton>
        </div>
      </div>
    </motion.div>
  );
};

/** One upload slot: the picked file, an already uploaded one, or empty. */
const FileSlot: React.FC<{
  label: string;
  hint: string;
  file: File | null;
  existing?: string;
  onClear: () => void;
}> = ({ label, hint, file, existing, onClear }) => {
  const t = useT();
  return (
  <div className="flex flex-col gap-2">
    <span className="bw-label-sm text-muted-foreground">{label}</span>
    {file || existing ? (
      <div className="flex items-center gap-3 pl-4 pr-1 py-3 rounded-[16px] bg-card">
        <FileText className="w-6 h-6 shrink-0" aria-hidden />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="bw-body-lg truncate">{file ? file.name : existing}</span>
          <span className="bw-body-sm text-muted-foreground">
            {file ? t('{size} MB · uploads when you save', { size: (file.size / 1024 / 1024).toFixed(1) }) : t('Stored for your band')}
          </span>
        </div>
        <IconButton label={t('Remove {label}', { label: label.toLowerCase() })} icon={<X />} variant="ghost" size="sm" onClick={onClear} />
      </div>
    ) : (
      <div className="flex items-center gap-3 px-4 py-4 rounded-[16px] border-[1.5px] border-dashed border-foreground/25">
        <FileMusic className="w-6 h-6 shrink-0 text-muted-foreground" aria-hidden />
        <span className="bw-body-sm text-muted-foreground">{hint}</span>
      </div>
    )}
  </div>
  );
};
