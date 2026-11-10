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
  removeSongFiles,
  safeHttpsUrl,
  uploadSongFile,
  validateSongFile,
} from '@/lib/services/songFiles';
import { supabase } from '@/lib/supabase';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  bandId: string;
  onSongAdded?: () => void;
  /** Edit this song instead of creating a new one. */
  song?: Song | null;
}

type StepType = 'source' | 'details' | 'extras';

interface Folder {
  id: string;
  name: string;
  color?: string;
}

export const AddSongModal: React.FC<AddSongModalProps> = ({
  isOpen,
  onClose,
  bandId,
  onSongAdded,
  song,
}) => {
  const isEdit = !!song;
  const [step, setStep] = useState<StepType>('source');
  
  // Basic info
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
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
  const [bpm, setBpm] = useState('');
  const [key, setKey] = useState('');
  const [duration, setDuration] = useState('');
  
  // Status
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen, bandId]);

  // Edit: start from the song's current values.
  useEffect(() => {
    if (!isOpen || !song) return;
    setTitle(song.title || '');
    setArtist(song.artist || '');
    setBpm(song.bpm ? String(song.bpm) : '');
    setKey(song.key || '');
    setDuration(song.duration_seconds ? String(Math.round(song.duration_seconds / 60)) : '');
    setYoutubeUrl(song.youtube_url || '');
    setNotes(song.notes || '');
    setExistingAudio(song.audio_url || undefined);
    setExistingChart(song.chart_url || undefined);
    setChartUrl(song.chart_url && !isStoredSongFile(song.chart_url) ? song.chart_url : '');
    setStep('details');
  }, [isOpen, song?.id]);

  const loadFolders = async () => {
    try {
      const { data } = await supabase
        .from('song_folders')
        .select('*')
        .eq('band_id', bandId)
        .order('name');
      
      setFolders(data || []);
      if (song?.category) {
        const match = (data || []).find((f: Folder) => f.name === song.category);
        if (match) setSelectedFolder(match.id);
      }
    } catch {
      setFolders([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
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

  const handleCreateFolder = async () => {
    const name = newFolderName.trim().toUpperCase();
    if (!name) return;
    const existing = folders.find((f) => f.name === name);
    if (existing) {
      setSelectedFolder(existing.id);
    } else {
      const { data, error: folderError } = await supabase
        .from('song_folders')
        .insert({ band_id: bandId, name })
        .select('id, name, color')
        .single();
      if (folderError || !data) {
        setError('Could not create the folder. Try again.');
        return;
      }
      setFolders((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedFolder(data.id);
    }
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Song title is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Links: https only.
      const youtube = youtubeUrl.trim() ? safeHttpsUrl(youtubeUrl) : undefined;
      const chartLink = chartUrl.trim() ? safeHttpsUrl(chartUrl) : undefined;
      const chords = chordsUrl.trim() ? safeHttpsUrl(chordsUrl) : undefined;
      if ((youtubeUrl.trim() && !youtube) || (chartUrl.trim() && !chartLink) || (chordsUrl.trim() && !chords)) {
        throw new Error('Links must start with https://');
      }

      // Upload new files to the band's private storage.
      let audioRef = existingAudio;
      let chartRef = chartLink ?? existingChart;
      const replaced: Array<string | undefined> = [];
      if (audioFile) {
        const up = await uploadSongFile(bandId, audioFile);
        if (up.error) throw up.error;
        if (existingAudio) replaced.push(existingAudio);
        audioRef = up.ref;
      }
      if (chartFile) {
        const up = await uploadSongFile(bandId, chartFile);
        if (up.error) throw up.error;
        if (existingChart) replaced.push(existingChart);
        chartRef = up.ref;
      } else if (chartLink && existingChart && existingChart !== chartLink) {
        replaced.push(existingChart);
      }

      const selectedFolderObj = folders.find(f => f.name && f.id === selectedFolder);
      const noteText = [notes.trim(), chords && !notes.includes(chords) ? `Chords: ${chords}` : '']
        .filter(Boolean)
        .join('\n');

      const payload: Partial<Song> = {
        title: title.trim(),
        artist: artist.trim() || undefined,
        category: selectedFolderObj?.name,
        audio_url: audioRef,
        chart_url: chartRef,
        youtube_url: youtube,
        notes: noteText || undefined,
        bpm: bpm ? parseInt(bpm) : undefined,
        key: key || undefined,
        duration_seconds: duration ? Math.round(parseFloat(duration) * 60) : undefined,
      };

      const { error: songError } = isEdit && song
        ? await updateSong(song.id, payload)
        : await createSong({ ...payload, band_id: bandId, status: 'ready', priority: 'medium' });

      if (songError) throw songError;
      await removeSongFiles(replaced);

      setSuccess(true);
      setTimeout(() => {
        onSongAdded?.();
        handleClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || (isEdit ? 'Failed to save song' : 'Failed to add song'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep('source');
    setTitle('');
    setArtist('');
    setAudioFile(null);
    setChartFile(null);
    setExistingAudio(undefined);
    setExistingChart(undefined);
    setSelectedFolder(null);
    setYoutubeUrl('');
    setChartUrl('');
    setChordsUrl('');
    setNotes('');
    setBpm('');
    setKey('');
    setDuration('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  const canProceed = () => {
    if (step === 'source') return true;
    if (step === 'details') return title.trim().length > 0;
    return true;
  };

  const nextStep = () => {
    if (step === 'source') setStep('details');
    else if (step === 'details') setStep('extras');
    else handleSubmit();
  };

  const prevStep = () => {
    if (step === 'extras') setStep('details');
    else if (step === 'details') setStep('source');
    else handleClose();
  };

  const getStepInfo = () => {
    switch (step) {
      case 'source': return { num: '01', title: 'Files', subtitle: 'Add a recording and/or a chart (optional).' };
      case 'details': return { num: '02', title: 'Details', subtitle: 'Song information' };
      case 'extras': return { num: '03', title: 'Resources', subtitle: 'Links & notes' };
    }
  };

  // iPhone Duo: close sits in the system column under the clock
  // (Figma "Closed · Songs / Add song – details").
  const closeInRail = useRailAction(isOpen ? handleClose : undefined, { label: 'Close', icon: <X />, pane: true });

  if (!isOpen) return null;

  const stepInfo = getStepInfo();
  const STEP_ORDER: StepType[] = ['source', 'details', 'extras'];
  const stepIndex = STEP_ORDER.indexOf(step);

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
          <NavBackButton pane label={step === 'source' ? 'Cancel' : 'Back'} onClick={prevStep} />
          <h2 id="add-song-title" className="flex-1 min-w-0 bw-h1 truncate">
            {isEdit ? 'Edit song' : 'Add song'}
          </h2>
          {!closeInRail && <IconButton label="Close" icon={<X />} variant="ghost" onClick={handleClose} />}
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
              Step {stepIndex + 1} of {STEP_ORDER.length}
            </span>
            <span className="bw-label-sm">{stepInfo.title}</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {step === 'source' && (
            <motion.div
              key="source"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-5"
            >
              <p className="bw-body-md text-muted-foreground">{stepInfo.subtitle}</p>

              {/* Audio */}
              <FileSlot
                label="Recording"
                hint="MP3, M4A, WAV · max 50 MB"
                file={audioFile}
                existing={existingAudio && isStoredSongFile(existingAudio) ? 'Recording uploaded' : undefined}
                onClear={() => {
                  setAudioFile(null);
                  setExistingAudio(undefined);
                }}
              />
              {/* Chart */}
              <FileSlot
                label="Chart / sheet music"
                hint="PDF or photo · max 20 MB"
                file={chartFile}
                existing={existingChart && isStoredSongFile(existingChart) ? 'Chart uploaded' : undefined}
                onClear={() => {
                  setChartFile(null);
                  setExistingChart(undefined);
                }}
              />

              <label className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-surface-inverse text-surface-inverse-foreground bw-button-md cursor-pointer active:scale-[0.97] transition-transform">
                <input type="file" multiple accept={SONG_FILE_ACCEPT} onChange={handleFileChange} className="hidden" />
                <Plus className="w-[18px] h-[18px]" />
                Choose files
              </label>

              <div className="flex items-start gap-3 p-4 rounded-[16px] bg-card">
                <Cloud className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
                <p className="bw-body-sm text-muted-foreground">
                  Files on iCloud Drive, Google Drive or Dropbox: tap <span className="text-foreground">Choose files</span>,
                  then <span className="text-foreground">Browse</span> and pick the app under Locations. Files are stored
                  privately for your band.
                </p>
              </div>
              {error && <FormError>{error}</FormError>}
            </motion.div>
          )}

          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4"
            >
              <p className="bw-body-md text-muted-foreground">{stepInfo.subtitle}</p>
              <PillField label="Song title *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Superstition" />
              <PillField label="Original artist" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="e.g. Stevie Wonder" />

              <div className="grid grid-cols-3 gap-3">
                <PillField label="BPM" type="number" inputMode="numeric" value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="120" />
                <PillField label="Key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="C maj" />
                <PillField label="Min" type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="4" />
              </div>

              {/* Folder */}
              <fieldset className="flex flex-col gap-2 pt-2">
                <legend className="bw-label-sm text-muted-foreground mb-2">Folder / category</legend>
                <div className="flex flex-wrap items-center gap-2">
                  {folders.map((folder) => (
                    <Selector
                      key={folder.id}
                      size="md"
                      selected={selectedFolder === folder.id}
                      onClick={() => setSelectedFolder(selectedFolder === folder.id ? null : folder.id)}
                    >
                      {folder.name}
                    </Selector>
                  ))}
                  {!showNewFolder && (
                    <Selector size="md" selected={false} onClick={() => setShowNewFolder(true)} className="border-dashed">
                      <Plus className="w-3.5 h-3.5" />
                      New
                    </Selector>
                  )}
                </div>
                {showNewFolder && (
                  <div className="flex items-end gap-2">
                    <PillField
                      label="New folder"
                      hideLabel
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                      placeholder="Folder name"
                      autoFocus
                    />
                    <IconButton label="Create folder" icon={<Check />} variant="filled" className="mb-1" onClick={handleCreateFolder} />
                  </div>
                )}
              </fieldset>
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
              <PillField
                type="url"
                label="YouTube video"
                icon={<Youtube className="w-5 h-5" />}
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=…"
              />
              <PillField
                type="url"
                label="Sheet music"
                icon={<FileMusic className="w-5 h-5" />}
                value={chartUrl}
                onChange={(e) => setChartUrl(e.target.value)}
                placeholder="URL to PDF or sheet music…"
              />
              <PillField
                type="url"
                label="Chords"
                icon={<LinkIcon className="w-5 h-5" />}
                value={chordsUrl}
                onChange={(e) => setChordsUrl(e.target.value)}
                placeholder="Link to chords (Ultimate Guitar, etc.)"
              />

              <label className="flex flex-col gap-2 p-4 rounded-[24px] bg-field border border-border focus-within:border-2 focus-within:border-foreground transition-[border-color]">
                <span className="flex items-center gap-2 bw-label-sm text-muted-foreground">
                  <StickyNote className="w-4 h-4" />
                  Notes
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Arrangement ideas, key changes…"
                  rows={4}
                  className="w-full bg-transparent outline-none bw-body-lg text-foreground placeholder:text-muted-foreground/60 min-h-[96px] resize-none"
                />
              </label>

              {error && <FormError>{error}</FormError>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA bar */}
      <div className="shrink-0 px-4 pt-3 bg-background" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
        <div className="max-w-2xl mx-auto grid grid-cols-[2fr_3fr] gap-3">
          <PillButton variant="outline" onClick={prevStep}>
            {step === 'source' ? 'Cancel' : 'Back'}
          </PillButton>
          <PillButton
            onClick={nextStep}
            disabled={!canProceed() || saving}
            loading={saving}
            className={success ? 'bg-success text-success-foreground' : undefined}
            icon={success ? <Check className="w-[18px] h-[18px]" /> : step === 'extras' ? <Disc3 className="w-[18px] h-[18px]" /> : undefined}
          >
            {success ? (
              isEdit ? 'Saved!' : 'Added!'
            ) : step === 'extras' ? (
              isEdit ? 'Save song' : 'Add song'
            ) : (
              <>
                Next
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
}> = ({ label, hint, file, existing, onClear }) => (
  <div className="flex flex-col gap-2">
    <span className="bw-label-sm text-muted-foreground">{label}</span>
    {file || existing ? (
      <div className="flex items-center gap-3 pl-4 pr-1 py-3 rounded-[16px] bg-card">
        <FileText className="w-6 h-6 shrink-0" aria-hidden />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="bw-body-lg truncate">{file ? file.name : existing}</span>
          <span className="bw-body-sm text-muted-foreground">
            {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · uploads when you save` : 'Stored for your band'}
          </span>
        </div>
        <IconButton label={`Remove ${label.toLowerCase()}`} icon={<X />} variant="ghost" size="sm" onClick={onClear} />
      </div>
    ) : (
      <div className="flex items-center gap-3 px-4 py-4 rounded-[16px] border-[1.5px] border-dashed border-foreground/25">
        <FileMusic className="w-6 h-6 shrink-0 text-muted-foreground" aria-hidden />
        <span className="bw-body-sm text-muted-foreground">{hint}</span>
      </div>
    )}
  </div>
);
