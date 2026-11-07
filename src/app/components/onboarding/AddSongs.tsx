import React, { useState, useEffect } from 'react';
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
  SpotifyBrandIcon,
  AppleMusicBrandIcon,
} from '@/app/components/icons';
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
  closeModalRef?: React.MutableRefObject<(() => boolean) | null>;
}

export const AddSongs: React.FC<AddSongsProps> = ({
  onBack,
  onComplete,
  closeModalRef,
}) => {
  const { songs, addSong, removeSong, addSongs } = useOnboarding();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (closeModalRef) {
      closeModalRef.current = () => {
        if (showAddModal) {
          setShowAddModal(false);
          return true;
        }
        if (showImportModal) {
          setShowImportModal(false);
          return true;
        }
        return false;
      };
    }
    return () => {
      if (closeModalRef) closeModalRef.current = null;
    };
  }, [showAddModal, showImportModal, closeModalRef]);

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
      className="min-h-screen bg-background flex flex-col relative overflow-hidden"
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
            background: 'linear-gradient(to top, rgba(200, 67, 26, 0.04) 0%, transparent 100%)',
          }}
        />
      </div>

      {/* Header */}
      <div className="px-6 pt-14 pb-4 relative z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-[15px] font-medium">Back</span>
          </button>
          <span className="text-muted-foreground text-[13px] font-medium">Step 4/4</span>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 bg-card/80 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent rounded-full"
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
          <h1 className="text-[28px] font-black text-foreground leading-tight mb-2">
            Build your repertoire
          </h1>
          <p className="text-muted-foreground text-[15px]">
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search song or artist..."
              className="w-full bg-card border border-border rounded-xl pl-12 pr-4 py-3 text-foreground text-[15px] placeholder:text-muted-foreground/60 outline-none focus:border-accent/50 transition-colors"
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
          <label className="text-muted-foreground text-[12px] font-medium mb-3 block uppercase">
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
                      ? 'bg-accent/10 border border-accent/30'
                      : 'bg-card border border-border hover:border-border'
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isAdded ? 'bg-accent text-accent-foreground' : 'bg-card/80 text-foreground'
                    }`}
                  >
                    {isAdded ? (
                      <DotCheckbox checked={true} activeColor="var(--fg)" inactiveColor="var(--dot-inactive)" />
                    ) : (
                      <Music className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p
                      className={`font-medium text-[14px] ${
                        isAdded ? 'text-accent' : 'text-foreground'
                      }`}
                    >
                      {song.title}
                    </p>
                    <p className="text-muted-foreground text-[12px]">{song.artist}</p>
                  </div>
                  <span className="text-muted-foreground text-[13px] tabular-nums">
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
            <label className="text-muted-foreground text-[12px] font-medium mb-3 block uppercase">
              Your songs ({songs.length})
            </label>

            <div className="space-y-2">
              {songs.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 border border-accent/20"
                >
                  <div className="w-10 h-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
                    <DotCheckbox checked={true} activeColor="var(--fg)" inactiveColor="var(--dot-inactive)" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[14px] text-accent truncate">
                      {song.title}
                    </p>
                    <p className="text-muted-foreground text-[12px] truncate">
                      {song.artist || 'Unknown artist'}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-[13px] tabular-nums">
                    {formatDuration(song.duration)}
                  </span>
                  <button
                    onClick={() => removeSong(song.id)}
                    className="w-8 h-8 rounded-full hover:bg-card/80 flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
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
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border text-foreground font-medium text-[14px] hover:border-border"
          >
            <Plus className="w-5 h-5" />
            Add Song
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border text-foreground font-medium text-[14px] hover:border-border"
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
              ? 'bg-accent text-accent-foreground hover:bg-accent/90'
              : 'bg-transparent text-muted-foreground/90 border border-border hover:border-white/40 hover:text-foreground'
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
              className="absolute inset-0 bg-background/60 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            />

            <motion.div
              className="relative w-full max-w-md bg-card rounded-t-[2rem] p-6 max-h-[80vh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute top-6 right-6 text-muted-foreground"
              >
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-foreground font-bold text-[20px] mb-6 flex items-center gap-3">
                <Music className="w-6 h-6 text-accent" />
                Add Custom Song
              </h3>

              {/* Song Title */}
              <div className="mb-4">
                <label className="text-muted-foreground text-[12px] font-medium mb-2 block">
                  SONG TITLE *
                </label>
                <input
                  type="text"
                  value={customSong.title || ''}
                  onChange={(e) =>
                    setCustomSong((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Enter song title"
                  className="w-full bg-background/30 border border-border rounded-xl px-4 py-3 text-foreground text-[15px] placeholder:text-muted-foreground/60 outline-none focus:border-accent/50"
                />
              </div>

              {/* Artist */}
              <div className="mb-4">
                <label className="text-muted-foreground text-[12px] font-medium mb-2 block">
                  ARTIST
                </label>
                <input
                  type="text"
                  value={customSong.artist || ''}
                  onChange={(e) =>
                    setCustomSong((prev) => ({ ...prev, artist: e.target.value }))
                  }
                  placeholder="Enter artist name"
                  className="w-full bg-background/30 border border-border rounded-xl px-4 py-3 text-foreground text-[15px] placeholder:text-muted-foreground/60 outline-none focus:border-accent/50"
                />
              </div>

              {/* Duration & BPM */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-muted-foreground text-[12px] font-medium mb-2 block">
                    DURATION
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                    <input
                      type="text"
                      placeholder="3:30"
                      className="w-full bg-background/30 border border-border rounded-xl pl-10 pr-4 py-3 text-foreground text-[15px] placeholder:text-muted-foreground/60 outline-none focus:border-accent/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground text-[12px] font-medium mb-2 block">
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
                    className="w-full bg-background/30 border border-border rounded-xl px-4 py-3 text-foreground text-[15px] placeholder:text-muted-foreground/60 outline-none focus:border-accent/50"
                  />
                </div>
              </div>

              {/* Key */}
              <div className="mb-6">
                <label className="text-muted-foreground text-[12px] font-medium mb-2 block">
                  KEY
                </label>
                <select
                  value={customSong.key || ''}
                  onChange={(e) =>
                    setCustomSong((prev) => ({ ...prev, key: e.target.value }))
                  }
                  className="w-full bg-background/30 border border-border rounded-xl px-4 py-3 text-foreground text-[15px] outline-none focus:border-accent/50 appearance-none"
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
                className="w-full h-12 rounded-full text-sm font-black uppercase tracking-[0.1em] bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.98] transition-all disabled:opacity-40"
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
              className="absolute inset-0 bg-background/60 backdrop-blur-sm"
              onClick={() => setShowImportModal(false)}
            />

            <motion.div
              className="relative w-full max-w-md bg-card rounded-t-[2rem] p-6"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <button
                onClick={() => setShowImportModal(false)}
                className="absolute top-6 right-6 text-muted-foreground"
              >
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-foreground font-bold text-[20px] mb-2 flex items-center gap-3">
                <Upload className="w-6 h-6 text-accent" />
                Import Songs
              </h3>
              <p className="text-muted-foreground text-[14px] mb-6">
                Choose a source to import your repertoire from:
              </p>

              {/* Streaming Services */}
              <div className="mb-4">
                <label className="text-muted-foreground/60 text-[11px] font-medium mb-2 block uppercase">
                  Streaming Services
                </label>
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/30 hover:border-[#1DB954]/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-[#1DB954] flex items-center justify-center shrink-0">
                      <SpotifyBrandIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-foreground font-medium text-[15px]">Spotify</p>
                      <p className="text-muted-foreground text-[13px]">Import from playlists</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </button>

                  <button className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#FA243C]/10 border border-[#FA243C]/30 hover:border-[#FA243C]/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-b from-[#FA243C] to-[var(--destructive)] flex items-center justify-center shrink-0">
                      <AppleMusicBrandIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-foreground font-medium text-[15px]">Apple Music</p>
                      <p className="text-muted-foreground text-[13px]">Import from library</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* File Upload */}
              <div className="mb-4">
                <label className="text-muted-foreground/60 text-[11px] font-medium mb-2 block uppercase">
                  File Upload
                </label>
                <button className="w-full flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-border transition-colors">
                  <div className="w-10 h-10 rounded-full bg-card/80 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-foreground font-medium text-[15px]">Upload CSV/Excel</p>
                    <p className="text-muted-foreground text-[13px]">Import from local file</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <p className="text-muted-foreground/60 text-[12px] text-center">
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
