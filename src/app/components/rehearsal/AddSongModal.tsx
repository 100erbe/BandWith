import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Music2,
  Upload,
  Smartphone,
  Cloud,
  Droplet,
  FileText,
  Plus,
  Check,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Youtube,
  FileMusic,
  StickyNote,
  Link as LinkIcon,
  Disc3,
  FolderOpen,
  ChevronDown
} from 'lucide-react';
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#E6E5E1]"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div className="px-6 pt-8 pb-4 flex justify-between items-start shrink-0 max-w-4xl mx-auto w-full">
        <div>
          <span className="text-black/40 text-xs font-black uppercase tracking-[0.3em] mb-2 block">
            Step {stepInfo.num}
          </span>
          <h2 className="text-4xl font-black text-black tracking-tighter uppercase leading-none">
            {stepInfo.title}
          </h2>
          <p className="text-black/50 font-bold text-sm mt-1 tracking-tight">{stepInfo.subtitle}</p>
        </div>
        
        <button 
          onClick={handleClose}
          className="w-12 h-12 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-black/50 hover:text-black transition-all hover:rotate-90"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-32 max-w-4xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {step === 'source' && (
            <motion.div
              key="source"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Source Selection */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Select Source</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'local', icon: Smartphone, label: 'Local Device' },
                    { id: 'google', icon: Cloud, label: 'Google Drive' },
                    { id: 'dropbox', icon: Droplet, label: 'Dropbox' },
                  ].map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setSource(id as SourceType)}
                      className={cn(
                        "flex flex-col items-center gap-3 py-6 rounded-3xl border-2 transition-all",
                        source === id
                          ? "bg-black border-black text-white"
                          : "bg-white/50 border-stone-200 text-black/50 hover:bg-white"
                      )}
                    >
                      <Icon className="w-8 h-8" />
                      <span className="text-xs font-bold uppercase tracking-tight">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[1px] bg-black/10" />

              {/* File Upload */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Upload File</label>
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-3xl p-8 text-center transition-all",
                    file ? "border-black bg-black/5" : "border-black/20 hover:border-black/40"
                  )}
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-4">
                      <FileText className="w-10 h-10 text-black" />
                      <div className="text-left">
                        <p className="font-black text-black truncate max-w-[200px]">{file.name}</p>
                        <p className="text-sm text-black/50">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button 
                        onClick={() => setFile(null)}
                        className="p-2 hover:bg-black/10 rounded-full"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <FileMusic className="w-12 h-12 text-black/30 mx-auto mb-4" />
                      <p className="font-black text-black text-xl mb-1">Drag & Drop or Click</p>
                      <p className="text-sm text-black/50 uppercase tracking-wide mb-6">Supports PDF, MP3, WAV</p>
                      <label className="inline-block">
                        <input
                          type="file"
                          accept=".pdf,.mp3,.wav,.m4a"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <span className="px-8 py-3 bg-black text-white rounded-full font-bold text-sm cursor-pointer hover:scale-105 transition-transform inline-block">
                          CHOOSE FILE
                        </span>
                      </label>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Title */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                  Song Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Superstition"
                  className="w-full bg-transparent border-b-2 border-black/10 py-3 text-3xl font-black text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                />
              </div>

              {/* Artist */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Original Artist</label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="e.g. Stevie Wonder"
                  className="w-full bg-transparent border-b-2 border-black/10 py-3 text-xl font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                />
              </div>

              <div className="h-[1px] bg-black/10" />

              {/* Details Grid */}
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">BPM</label>
                  <input
                    type="number"
                    value={bpm}
                    onChange={(e) => setBpm(e.target.value)}
                    placeholder="120"
                    className="w-full bg-transparent border-b-2 border-black/10 py-3 text-xl font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Key</label>
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="C major"
                    className="w-full bg-transparent border-b-2 border-black/10 py-3 text-xl font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Duration (min)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="4"
                    className="w-full bg-transparent border-b-2 border-black/10 py-3 text-xl font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                  />
                </div>
              </div>

              <div className="h-[1px] bg-black/10" />

              {/* Folder */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Folder / Category</label>
                <div className="flex flex-wrap gap-2">
                  {folders.map(folder => (
                    <button
                      key={folder.id}
                      onClick={() => setSelectedFolder(selectedFolder === folder.id ? null : folder.id)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-bold uppercase transition-all",
                        selectedFolder === folder.id
                          ? "bg-black text-white"
                          : "bg-white/50 text-black/60 hover:bg-white"
                      )}
                    >
                      {folder.name}
                    </button>
                  ))}
                  {showNewFolder ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                        placeholder="Folder name"
                        className="w-28 bg-transparent border-b-2 border-black/10 py-2 text-sm font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                        autoFocus
                      />
                      <button
                        onClick={handleCreateFolder}
                        className="w-8 h-8 bg-black rounded-full flex items-center justify-center"
                      >
                        <Check className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewFolder(true)}
                      className="px-4 py-2 rounded-full border-2 border-dashed border-black/20 text-sm font-bold text-black/50 flex items-center gap-1 hover:border-black/40 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      NEW
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {step === 'extras' && (
            <motion.div
              key="extras"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* YouTube Link */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 flex items-center gap-2">
                  <Youtube className="w-4 h-4" />
                  YouTube Video
                </label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-transparent border-b-2 border-black/10 py-3 text-lg font-medium text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                />
              </div>

              {/* Chart/Sheet Music URL */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 flex items-center gap-2">
                  <FileMusic className="w-4 h-4" />
                  Sheet Music / Spartiti
                </label>
                <input
                  type="url"
                  value={chartUrl}
                  onChange={(e) => setChartUrl(e.target.value)}
                  placeholder="URL to PDF or sheet music..."
                  className="w-full bg-transparent border-b-2 border-black/10 py-3 text-lg font-medium text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                />
              </div>

              {/* Chords URL */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Chords / Accordi
                </label>
                <input
                  type="url"
                  value={chordsUrl}
                  onChange={(e) => setChordsUrl(e.target.value)}
                  placeholder="Link to chords (Ultimate Guitar, etc.)"
                  className="w-full bg-transparent border-b-2 border-black/10 py-3 text-lg font-medium text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                />
              </div>

              <div className="h-[1px] bg-black/10" />

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 flex items-center gap-2">
                  <StickyNote className="w-4 h-4" />
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes, arrangement ideas, key changes..."
                  rows={4}
                  className="w-full bg-transparent border-b-2 border-black/10 py-3 text-base font-medium text-black placeholder:text-black/30 focus:outline-none focus:border-black transition-all min-h-[120px] resize-none"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 inset-x-0 bg-[#E6E5E1] border-t border-stone-200 px-6 py-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={prevStep}
            className="flex items-center gap-2 text-black/50 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold text-sm uppercase">{step === 'source' ? 'Cancel' : 'Back'}</span>
          </button>

          {/* Progress Dots */}
          <div className="flex gap-2">
            {['source', 'details', 'extras'].map((s, i) => (
              <div
                key={s}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  s === step ? "bg-black w-6" : "bg-black/20"
                )}
              />
            ))}
          </div>

          <button
            onClick={nextStep}
            disabled={!canProceed() || saving}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm uppercase transition-all",
              success
                ? "bg-green-500 text-white"
                : canProceed() && !saving
                  ? "bg-black text-white hover:scale-105"
                  : "bg-black/20 text-black/40 cursor-not-allowed"
            )}
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : success ? (
              <>
                <Check className="w-5 h-5" />
                Added!
              </>
            ) : step === 'extras' ? (
              <>
                <Disc3 className="w-5 h-5" />
                Add Song
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
