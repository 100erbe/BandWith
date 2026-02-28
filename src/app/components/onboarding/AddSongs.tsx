import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Plus,
  X,
  Music,
  Upload,
  Loader2,
  Clock,
} from 'lucide-react';
import { useOnboarding, OnboardingSong } from '@/lib/OnboardingContext';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';

// Popular songs suggestions (would come from API in production)
const SUGGESTED_SONGS: OnboardingSong[] = [
  {
    id: 's1',
    title: 'Superstition',
    artist: 'Stevie Wonder',
    duration: 225,
    bpm: 95,
    key: 'Eb',
  },
  {
    id: 's2',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    duration: 294,
    bpm: 117,
    key: 'F#m',
  },
  {
    id: 's3',
    title: 'I Feel Good',
    artist: 'James Brown',
    duration: 165,
    bpm: 145,
    key: 'D',
  },
  {
    id: 's4',
    title: 'Uptown Funk',
    artist: 'Bruno Mars',
    duration: 270,
    bpm: 115,
    key: 'Dm',
  },
  {
    id: 's5',
    title: 'Valerie',
    artist: 'Amy Winehouse',
    duration: 213,
    bpm: 100,
    key: 'Eb',
  },
  {
    id: 's6',
    title: 'Lovely Day',
    artist: 'Bill Withers',
    duration: 243,
    bpm: 98,
    key: 'E',
  },
];

interface AddSongsProps {
  onBack: () => void;
  onComplete: () => void;
}

export const AddSongs: React.FC<AddSongsProps> = ({ onBack, onComplete }) => {
  const { songs, addSong, removeSong, addSongs } = useOnboarding();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom song form
  const [customSong, setCustomSong] = useState<Partial<OnboardingSong>>({});

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isSongAdded = (id: string) => songs.some((s) => s.id === id);

  const toggleSuggestion = (song: OnboardingSong) => {
    if (isSongAdded(song.id)) {
      removeSong(song.id);
    } else {
      addSong(song);
    }
  };

  const handleAddCustomSong = () => {
    if (!customSong.title?.trim()) return;

    addSong({
      id: `custom-${Date.now()}`,
      title: customSong.title.trim(),
      artist: customSong.artist?.trim(),
      duration: customSong.duration,
      bpm: customSong.bpm,
      key: customSong.key,
      source: 'manual',
    });

    setCustomSong({});
    setShowAddModal(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsSubmitting(false);
    onComplete();
  };

  const filteredSuggestions = SUGGESTED_SONGS.filter(
    (song) =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      className="min-h-screen bg-black flex flex-col relative overflow-hidden"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute bottom-0 left-0 right-0 h-[50%]"
          style={{
            background: 'linear-gradient(to top, rgba(212, 251, 70, 0.03) 0%, transparent 100%)',
          }}
        />
      </div>

      {/* Header */}
      <div className="px-6 pt-14 pb-4 relative z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-[15px] font-medium">Back</span>
          </button>
          <span className="text-zinc-500 text-[13px] font-medium">Step 4/4</span>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#D4FB46] rounded-full"
            initial={{ width: '75%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 py-6 relative z-10 overflow-y-auto">
        {/* Title */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-[28px] font-black text-white leading-tight mb-2">
            Build your repertoire
          </h1>
          <p className="text-zinc-500 text-[15px]">
            Add songs your band plays. This helps create setlists later.
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          className="mb-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search song or artist..."
              className="w-full bg-[#1C1C1E] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white text-[15px] placeholder:text-zinc-600 outline-none focus:border-[#D4FB46]/50 transition-colors"
            />
          </div>
        </motion.div>

        {/* Suggestions */}
        <motion.div
          className="mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <label className="text-zinc-500 text-[12px] font-medium mb-3 block uppercase">
            Popular songs
          </label>

          <div className="space-y-2">
            {filteredSuggestions.map((song) => {
              const isAdded = isSongAdded(song.id);
              return (
                <motion.button
                  key={song.id}
                  onClick={() => toggleSuggestion(song)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isAdded
                      ? 'bg-[#D4FB46]/10 border border-[#D4FB46]/30'
                      : 'bg-[#1C1C1E] border border-white/5 hover:border-white/10'
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isAdded ? 'bg-[#D4FB46] text-black' : 'bg-white/10 text-white'
                    }`}
                  >
                    {isAdded ? (
                      <DotCheckbox checked={true} activeColor="#000000" inactiveColor="rgba(0,0,0,0.15)" />
                    ) : (
                      <Music className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p
                      className={`font-medium text-[14px] ${
                        isAdded ? 'text-[#D4FB46]' : 'text-white'
                      }`}
                    >
                      {song.title}
                    </p>
                    <p className="text-zinc-500 text-[12px]">{song.artist}</p>
                  </div>
                  <span className="text-zinc-500 text-[13px] tabular-nums">
                    {formatDuration(song.duration)}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Added Songs */}
        {songs.length > 0 && (
          <motion.div
            className="mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <label className="text-zinc-500 text-[12px] font-medium mb-3 block uppercase">
              Your songs ({songs.length})
            </label>

            <div className="space-y-2">
              {songs.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#D4FB46]/10 border border-[#D4FB46]/20"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#D4FB46] text-black flex items-center justify-center">
                    <DotCheckbox checked={true} activeColor="#000000" inactiveColor="rgba(0,0,0,0.15)" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[14px] text-[#D4FB46] truncate">
                      {song.title}
                    </p>
                    <p className="text-zinc-500 text-[12px] truncate">
                      {song.artist || 'Unknown artist'}
                    </p>
                  </div>
                  <span className="text-zinc-500 text-[13px] tabular-nums">
                    {formatDuration(song.duration)}
                  </span>
                  <button
                    onClick={() => removeSong(song.id)}
                    className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          className="flex gap-3 mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1C1C1E] border border-white/10 text-white font-medium text-[14px] hover:border-white/20"
          >
            <Plus className="w-5 h-5" />
            Add Song
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1C1C1E] border border-white/10 text-white font-medium text-[14px] hover:border-white/20"
          >
            <Upload className="w-5 h-5" />
            Import
          </button>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-10 pt-4 relative z-10">
        <motion.button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full h-14 rounded-full text-sm font-black uppercase tracking-[0.15em] flex items-center justify-center gap-3 active:scale-[0.98] transition-all ${
            songs.length > 0
              ? 'bg-[#D4FB46] text-black hover:bg-[#c8ef3a]'
              : 'bg-transparent text-white/60 border border-white/20 hover:border-white/40 hover:text-white'
          }`}
          whileTap={{ scale: 0.98 }}
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : songs.length > 0 ? (
            <>
              Continue
              <span className="text-xs font-bold opacity-60">({songs.length})</span>
              <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </>
          ) : (
            <>
              Skip for Now
              <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </>
          )}
        </motion.button>
      </div>

      {/* Add Song Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            />

            <motion.div
              className="relative w-full max-w-md bg-[#1C1C1E] rounded-t-[2rem] p-6 max-h-[80vh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute top-6 right-6 text-zinc-500"
              >
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-white font-bold text-[20px] mb-6 flex items-center gap-3">
                <Music className="w-6 h-6 text-[#D4FB46]" />
                Add Custom Song
              </h3>

              {/* Song Title */}
              <div className="mb-4">
                <label className="text-zinc-500 text-[12px] font-medium mb-2 block">
                  SONG TITLE *
                </label>
                <input
                  type="text"
                  value={customSong.title || ''}
                  onChange={(e) =>
                    setCustomSong((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Enter song title"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-[15px] placeholder:text-zinc-600 outline-none focus:border-[#D4FB46]/50"
                />
              </div>

              {/* Artist */}
              <div className="mb-4">
                <label className="text-zinc-500 text-[12px] font-medium mb-2 block">
                  ARTIST
                </label>
                <input
                  type="text"
                  value={customSong.artist || ''}
                  onChange={(e) =>
                    setCustomSong((prev) => ({ ...prev, artist: e.target.value }))
                  }
                  placeholder="Enter artist name"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-[15px] placeholder:text-zinc-600 outline-none focus:border-[#D4FB46]/50"
                />
              </div>

              {/* Duration & BPM */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-zinc-500 text-[12px] font-medium mb-2 block">
                    DURATION
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type="text"
                      placeholder="3:30"
                      className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-[15px] placeholder:text-zinc-600 outline-none focus:border-[#D4FB46]/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-zinc-500 text-[12px] font-medium mb-2 block">
                    BPM
                  </label>
                  <input
                    type="number"
                    value={customSong.bpm || ''}
                    onChange={(e) =>
                      setCustomSong((prev) => ({
                        ...prev,
                        bpm: parseInt(e.target.value) || undefined,
                      }))
                    }
                    placeholder="120"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-[15px] placeholder:text-zinc-600 outline-none focus:border-[#D4FB46]/50"
                  />
                </div>
              </div>

              {/* Key */}
              <div className="mb-6">
                <label className="text-zinc-500 text-[12px] font-medium mb-2 block">
                  KEY
                </label>
                <select
                  value={customSong.key || ''}
                  onChange={(e) =>
                    setCustomSong((prev) => ({ ...prev, key: e.target.value }))
                  }
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-[15px] outline-none focus:border-[#D4FB46]/50 appearance-none"
                >
                  <option value="">Select key</option>
                  <option value="C">C Major</option>
                  <option value="Cm">C Minor</option>
                  <option value="D">D Major</option>
                  <option value="Dm">D Minor</option>
                  <option value="E">E Major</option>
                  <option value="Em">E Minor</option>
                  <option value="F">F Major</option>
                  <option value="Fm">F Minor</option>
                  <option value="G">G Major</option>
                  <option value="Gm">G Minor</option>
                  <option value="A">A Major</option>
                  <option value="Am">A Minor</option>
                  <option value="B">B Major</option>
                  <option value="Bm">B Minor</option>
                </select>
              </div>

              {/* Confirm Button */}
              <button
                onClick={handleAddCustomSong}
                disabled={!customSong.title?.trim()}
                className="w-full h-12 rounded-full text-sm font-black uppercase tracking-[0.1em] bg-[#D4FB46] text-black hover:bg-[#c8ef3a] active:scale-[0.98] transition-all disabled:opacity-40"
              >
                Add Song
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowImportModal(false)}
            />

            <motion.div
              className="relative w-full max-w-md bg-[#1C1C1E] rounded-t-[2rem] p-6"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <button
                onClick={() => setShowImportModal(false)}
                className="absolute top-6 right-6 text-zinc-500"
              >
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-white font-bold text-[20px] mb-2 flex items-center gap-3">
                <Upload className="w-6 h-6 text-[#D4FB46]" />
                Import Songs
              </h3>
              <p className="text-zinc-500 text-[14px] mb-6">
                Choose a source to import your repertoire from:
              </p>

              {/* Streaming Services */}
              <div className="mb-4">
                <label className="text-zinc-600 text-[11px] font-medium mb-2 block uppercase">
                  Streaming Services
                </label>
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/30 hover:border-[#1DB954]/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-[#1DB954] flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium text-[15px]">Spotify</p>
                      <p className="text-zinc-500 text-[13px]">Import from playlists</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-zinc-500" />
                  </button>

                  <button className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#FA243C]/10 border border-[#FA243C]/30 hover:border-[#FA243C]/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-b from-[#FA243C] to-[#D11C3C] flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.364-1.29.44-2.244 1.23-2.874 2.493-.337.674-.497 1.407-.548 2.166-.04.617-.05 1.235-.05 1.853v6.188c.002.7.013 1.4.064 2.098.05.697.18 1.375.423 2.02.463 1.223 1.27 2.12 2.458 2.65.633.284 1.306.416 2.003.466.66.047 1.323.058 1.986.058h12.08c.62 0 1.242-.014 1.86-.058.61-.044 1.203-.14 1.778-.33 1.426-.47 2.434-1.354 3.017-2.74.253-.6.385-1.233.434-1.886.067-.898.07-1.8.068-2.7V8.15c0-.686-.022-1.372-.076-2.025zM11.23 15.21a3.01 3.01 0 01-.75 2.02c-.44.51-1 .8-1.66.85-.08.01-.15.01-.23.01-.68 0-1.28-.23-1.78-.68a2.99 2.99 0 01-.95-1.84c-.05-.37-.04-.75.02-1.12.13-.76.49-1.39 1.07-1.88.51-.43 1.11-.66 1.77-.68.1 0 .19 0 .29.01.54.04 1.02.22 1.45.53.52.38.89.88 1.08 1.5.12.4.15.8.11 1.21h.01zm6.27.68c-.02.25-.08.5-.16.74-.3.86-.83 1.53-1.61 1.97-.52.29-1.08.41-1.68.37-.93-.07-1.72-.43-2.3-1.17a3.19 3.19 0 01-.66-1.63c-.05-.42-.03-.85.07-1.26.19-.81.6-1.5 1.24-2.02.49-.4 1.05-.64 1.67-.72.19-.02.38-.03.57-.01.85.06 1.57.38 2.15.97.52.53.85 1.17.97 1.91.05.28.06.57.03.85h-.01zm.71-7.31H5.77c-.15 0-.3-.02-.46-.05-.28-.06-.52-.2-.71-.43-.19-.22-.29-.49-.3-.79 0-.29.1-.54.28-.76.19-.22.43-.36.72-.42.1-.02.2-.03.3-.03h12.64c.24 0 .47.04.68.15.34.17.56.44.66.8.07.25.05.5-.03.76-.11.34-.33.58-.65.72-.18.08-.38.11-.59.11l.01-.06z"/>
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium text-[15px]">Apple Music</p>
                      <p className="text-zinc-500 text-[13px]">Import from library</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-zinc-500" />
                  </button>
                </div>
              </div>

              {/* File Upload */}
              <div className="mb-4">
                <label className="text-zinc-600 text-[11px] font-medium mb-2 block uppercase">
                  File Upload
                </label>
                <button className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white font-medium text-[15px]">Upload CSV/Excel</p>
                    <p className="text-zinc-500 text-[13px]">Import from local file</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <p className="text-zinc-600 text-[12px] text-center">
                More import options coming soon
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AddSongs;
