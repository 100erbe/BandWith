import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Smartphone,
  Cloud,
  Droplet,
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
import { IconButton, PillButton, PillField, Selector, FormError } from '@/app/components/bw';
import { cn } from '@/app/components/ui/utils';
import { createSong } from '@/lib/services/songs';
import { supabase } from '@/lib/supabase';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  bandId: string;
  onSongAdded?: () => void;
}

type SourceType = 'local' | 'google' | 'dropbox';
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
}) => {
  const [step, setStep] = useState<StepType>('source');
  const [source, setSource] = useState<SourceType>('local');
  
  // Basic info
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([
    { id: '1', name: 'ROCK 80S' },
    { id: '2', name: 'ROCK 70S' },
    { id: '3', name: 'POP' },
    { id: '4', name: 'JAZZ' },
  ]);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Files
  const [file, setFile] = useState<File | null>(null);
  
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

  const loadFolders = async () => {
    try {
      const { data } = await supabase
        .from('song_folders')
        .select('*')
        .eq('band_id', bandId)
        .order('name');
      
      if (data && data.length > 0) {
        setFolders(data);
      }
    } catch (err) {
      // Use default folders
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!title) {
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const newFolder: Folder = {
      id: `new-${Date.now()}`,
      name: newFolderName.toUpperCase(),
    };
    setFolders([...folders, newFolder]);
    setSelectedFolder(newFolder.id);
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
      let audioUrl: string | undefined;
      
      if (file) {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const isAudio = ['mp3', 'wav', 'm4a', 'aac'].includes(fileExt || '');
        
        if (isAudio) {
          audioUrl = `pending-upload/${bandId}/${Date.now()}-${file.name}`;
        }
      }

      const selectedFolderObj = folders.find(f => f.id === selectedFolder);
      
      const { error: songError } = await createSong({
        band_id: bandId,
        title: title.trim(),
        artist: artist.trim() || undefined,
        category: selectedFolderObj?.name,
        audio_url: audioUrl,
        chart_url: chartUrl || undefined,
        youtube_url: youtubeUrl || undefined,
        notes: notes || undefined,
        bpm: bpm ? parseInt(bpm) : undefined,
        key: key || undefined,
        duration_seconds: duration ? parseInt(duration) * 60 : undefined,
        status: 'ready',
        priority: 'medium',
      });

      if (songError) throw songError;

      setSuccess(true);
      setTimeout(() => {
        onSongAdded?.();
        handleClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to add song');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep('source');
    setTitle('');
    setArtist('');
    setFile(null);
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
      case 'source': return { num: '01', title: 'Source', subtitle: 'Where is your song?' };
      case 'details': return { num: '02', title: 'Details', subtitle: 'Song information' };
      case 'extras': return { num: '03', title: 'Resources', subtitle: 'Links & notes' };
    }
  };

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
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background text-foreground"
    >
      {/* Header: Top Bar + wizard steps */}
      <header className="shrink-0 px-4 pb-3 flex flex-col gap-3" style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}>
        <div className="flex items-center gap-3 min-h-11">
          <IconButton label={step === 'source' ? 'Cancel' : 'Back'} icon={<ArrowLeft />} onClick={prevStep} />
          <h2 id="add-song-title" className="flex-1 min-w-0 bw-h1 truncate">
            Add song
          </h2>
          <IconButton label="Close" icon={<X />} variant="ghost" onClick={handleClose} />
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

              {/* Source Selection */}
              <fieldset className="flex flex-col gap-2">
                <legend className="bw-label-sm text-muted-foreground mb-2">Select source</legend>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'local', icon: Smartphone, label: 'Local device' },
                    { id: 'google', icon: Cloud, label: 'Google Drive' },
                    { id: 'dropbox', icon: Droplet, label: 'Dropbox' },
                  ].map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={source === id}
                      onClick={() => setSource(id as SourceType)}
                      className={cn(
                        'flex flex-col items-center gap-2 py-5 px-2 rounded-[16px] transition-colors cursor-pointer',
                        source === id ? 'bg-surface-inverse text-surface-inverse-foreground' : 'bg-card text-foreground'
                      )}
                    >
                      <Icon className="w-7 h-7" />
                      <span className="bw-label-xs text-center">{label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* File Upload */}
              <div className="flex flex-col gap-2">
                <span className="bw-label-sm text-muted-foreground">Upload file</span>
                {file ? (
                  <div className="flex items-center gap-3 pl-4 pr-1 py-3 rounded-[16px] bg-card">
                    <FileText className="w-6 h-6 shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="bw-body-lg truncate">{file.name}</span>
                      <span className="bw-body-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <IconButton label="Remove file" icon={<X />} variant="ghost" size="sm" onClick={() => setFile(null)} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 p-8 rounded-[24px] border-[1.5px] border-dashed border-foreground/25 text-center">
                    <FileMusic className="w-10 h-10 text-muted-foreground" />
                    <p className="bw-h3">Drag &amp; drop or choose</p>
                    <p className="bw-label-sm text-muted-foreground">Supports PDF, MP3, WAV</p>
                    <label className="mt-3 inline-flex items-center h-11 px-5 rounded-full bg-surface-inverse text-surface-inverse-foreground bw-button-md cursor-pointer active:scale-[0.97] transition-transform">
                      <input type="file" accept=".pdf,.mp3,.wav,.m4a" onChange={handleFileChange} className="hidden" />
                      Choose file
                    </label>
                  </div>
                )}
              </div>
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
              'Added!'
            ) : step === 'extras' ? (
              'Add song'
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
