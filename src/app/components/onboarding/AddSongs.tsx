import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowUpRight,
  Search,
  Plus,
  X,
  Music,
  Upload,
  Clock,
} from '@/app/components/icons';
import { useOnboarding, OnboardingSong } from '@/lib/OnboardingContext';
import { parseSongList, parseDuration, SONG_LIST_ACCEPT } from '@/lib/songListImport';
import { AuthScreen, Kicker, PillButton, PillField } from '@/app/components/bw/Form';
import { ChoicePill, OnboardingSheet, WizardTop, wizardStep } from './OnboardingChrome';

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
    title: 'September',
    artist: 'Earth, Wind & Fire',
    duration: 215,
    bpm: 126,
    key: 'A',
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
    title: 'Uptown Funk',
    artist: 'Bruno Mars',
    duration: 270,
    bpm: 115,
    key: 'Dm',
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
  const { songs, addSong, removeSong, addSongs, path } = useOnboarding();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllSongs, setShowAllSongs] = useState(false);

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
  const [durationInput, setDurationInput] = useState('');

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

  const [importMessage, setImportMessage] = useState<string | null>(null);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setImportMessage('That file is too large for a song list (max 2 MB).');
      return;
    }
    const parsed = parseSongList(await file.text());
    if (parsed.length === 0) {
      setImportMessage('No songs found. Use one song per line or a CSV with a “title” column.');
      return;
    }
    const existing = new Set(songs.map((s) => `${s.title.toLowerCase()}|${(s.artist || '').toLowerCase()}`));
    const fresh = parsed.filter((p) => !existing.has(`${p.title.toLowerCase()}|${(p.artist || '').toLowerCase()}`));
    addSongs(
      fresh.map((p, i) => ({
        id: `import-${Date.now()}-${i}`,
        title: p.title,
        artist: p.artist,
        key: p.key,
        bpm: p.bpm,
        duration: p.duration,
        genre: p.genre,
        source: 'import' as const,
      })),
    );
    setImportMessage(
      fresh.length === parsed.length
        ? `Imported ${fresh.length} song${fresh.length === 1 ? '' : 's'}.`
        : `Imported ${fresh.length} new song${fresh.length === 1 ? '' : 's'} (${parsed.length - fresh.length} already in your list).`,
    );
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
    setDurationInput('');
    setShowAddModal(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsSubmitting(false);
    onComplete();
  };

  // Skip = start with an empty repertoire; drop anything picked so far.
  const handleSkip = () => {
    songs.forEach((song) => removeSong(song.id));
    onComplete();
  };

  const filteredSuggestions = SUGGESTED_SONGS.filter(
    (song) =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { step, total } = wizardStep(path, 'songs');
  const COLLAPSED_COUNT = 2;
  const visibleSongs = showAllSongs ? songs : songs.slice(0, COLLAPSED_COUNT);
  const hiddenCount = songs.length - visibleSongs.length;

  return (
    <AuthScreen
      top={<WizardTop onBack={onBack} step={step} total={total} />}
      bodyClassName="pt-2 gap-4"
      footer={
        <>
          <PillButton variant="ghost" size="sm" className="text-muted-foreground" onClick={handleSkip} disabled={isSubmitting}>
            Skip for now
          </PillButton>
          <PillButton
            onClick={handleSubmit}
            disabled={songs.length === 0 || isSubmitting}
            loading={isSubmitting && songs.length > 0}
            trailingIcon={<ArrowUpRight className="w-5 h-5" />}
          >
            Continue
          </PillButton>
        </>
      }
    >
      <Kicker overline="Repertoire" title="Build your repertoire" />

      {/* Search */}
      <PillField
        label="Search songs"
        hideLabel
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search song or artist…"
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="search"
        icon={<Search className="w-5 h-5" strokeWidth={2} />}
        className="mt-2"
      />

      {/* Suggestions */}
      <div className="flex flex-col gap-3">
        <p id="popular-songs-label" className="bw-label-sm text-muted-foreground">
          Popular songs
        </p>
        <div role="group" aria-labelledby="popular-songs-label" className="flex flex-wrap gap-2">
          {filteredSuggestions.map((song) => (
            <ChoicePill
              key={song.id}
              tone="inverse"
              selected={isSongAdded(song.id)}
              onClick={() => toggleSuggestion(song)}
              aria-label={`${song.title} by ${song.artist}`}
            >
              {song.title}
            </ChoicePill>
          ))}
          {filteredSuggestions.length === 0 && (
            <p className="bw-body-sm text-muted-foreground">No popular songs match. Add it as your own song.</p>
          )}
        </div>
      </div>

      {/* Your songs */}
      <div className="flex items-center justify-between gap-3 mt-2">
        <h2 className="bw-h3 text-foreground">Your songs ({songs.length})</h2>
        <div className="flex items-center -mr-3">
          <PillButton variant="ghost" size="sm" fullWidth={false} onClick={() => setShowImportModal(true)} className="text-muted-foreground">
            Import
          </PillButton>
          <PillButton variant="ghost" size="sm" fullWidth={false} onClick={() => setShowAddModal(true)}>
            + Add song
          </PillButton>
        </div>
      </div>

      {songs.length === 0 ? (
        <p className="bw-body-sm text-muted-foreground -mt-2">Tap a popular song or add your own. This helps build setlists later.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {visibleSongs.map((song) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 p-4 rounded-[16px] bg-card"
              >
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="text-[18px] font-medium leading-[1.35] tracking-[-0.005em] text-foreground truncate">{song.title}</p>
                  <p className="bw-body-sm text-muted-foreground truncate">{song.artist || 'Unknown artist'}</p>
                </div>
                <span className="bw-num text-foreground shrink-0">{formatDuration(song.duration)}</span>
                <button
                  type="button"
                  onClick={() => removeSong(song.id)}
                  aria-label={`Remove ${song.title}`}
                  className="-my-2 -mr-2 p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {(hiddenCount > 0 || showAllSongs) && songs.length > COLLAPSED_COUNT && (
            <button
              type="button"
              onClick={() => setShowAllSongs((v) => !v)}
              aria-expanded={showAllSongs}
              className="self-start bw-label-sm text-muted-foreground py-2"
            >
              {showAllSongs ? 'Show less' : `+ ${hiddenCount} more ${hiddenCount === 1 ? 'song' : 'songs'}`}
            </button>
          )}
        </div>
      )}

      {/* Add Song Sheet */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div className="absolute inset-0 bg-black/60" onClick={() => setShowAddModal(false)} />

            <motion.div
              className="relative w-full max-w-md"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <OnboardingSheet
                overline="Repertoire"
                title="Add custom song"
                labelledBy="add-song-title"
                onClose={() => setShowAddModal(false)}
                closeIcon={<X className="w-4 h-4" strokeWidth={2} />}
              >
                <div className="flex flex-col gap-5">
                  <PillField
                    label="Song title *"
                    type="text"
                    value={customSong.title || ''}
                    onChange={(e) => setCustomSong((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter song title"
                    icon={<Music className="w-5 h-5" strokeWidth={1.75} />}
                  />

                  <PillField
                    label="Artist"
                    type="text"
                    value={customSong.artist || ''}
                    onChange={(e) => setCustomSong((prev) => ({ ...prev, artist: e.target.value }))}
                    placeholder="Enter artist name"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <PillField
                      label="Duration"
                      type="text"
                      placeholder="3:30"
                      inputMode="numeric"
                      value={durationInput}
                      onChange={(e) => {
                        setDurationInput(e.target.value);
                        setCustomSong((prev) => ({ ...prev, duration: parseDuration(e.target.value) }));
                      }}
                      icon={<Clock className="w-4 h-4" strokeWidth={1.75} />}
                    />
                    <PillField
                      label="BPM"
                      type="number"
                      inputMode="numeric"
                      value={customSong.bpm || ''}
                      onChange={(e) =>
                        setCustomSong((prev) => ({
                          ...prev,
                          bpm: parseInt(e.target.value) || undefined,
                        }))
                      }
                      placeholder="120"
                    />
                  </div>

                  {/* Key */}
                  <div className="flex flex-col gap-2">
                    <label htmlFor="custom-song-key" className="bw-label-sm text-muted-foreground">
                      Key
                    </label>
                    <select
                      id="custom-song-key"
                      value={customSong.key || ''}
                      onChange={(e) => setCustomSong((prev) => ({ ...prev, key: e.target.value }))}
                      className="w-full h-[52px] px-4 rounded-full bg-field border border-border text-foreground text-[18px] font-medium outline-none focus:border-2 focus:border-foreground appearance-none"
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

                  <PillButton
                    onClick={handleAddCustomSong}
                    disabled={!customSong.title?.trim()}
                    trailingIcon={<Plus className="w-5 h-5" />}
                  >
                    Add song
                  </PillButton>
                </div>
              </OnboardingSheet>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Sheet */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div className="absolute inset-0 bg-black/60" onClick={() => setShowImportModal(false)} />

            <motion.div
              className="relative w-full max-w-md"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <OnboardingSheet
                overline="Repertoire"
                title="Import songs"
                labelledBy="import-songs-title"
                onClose={() => setShowImportModal(false)}
                closeIcon={<X className="w-4 h-4" strokeWidth={2} />}
              >
                <p className="bw-body-sm text-muted-foreground -mt-2 mb-5">
                  Pick a song list exported from Excel, Numbers or Google Sheets (CSV), or a plain text list with one
                  song per line, like “Superstition - Stevie Wonder”.
                </p>

                <div className="flex flex-col gap-3">
                  <label className="w-full flex items-center gap-4 p-4 rounded-[20px] bg-card text-left cursor-pointer active:scale-[0.99] transition-transform">
                    <input type="file" accept={SONG_LIST_ACCEPT} className="hidden" onChange={handleImportFile} />
                    <span className="w-11 h-11 rounded-full bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                      <Upload className="w-5 h-5" />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="bw-label-md text-foreground">Choose a CSV or TXT file</span>
                      <span className="bw-body-sm text-muted-foreground">From this device, iCloud Drive, Google Drive or Dropbox</span>
                    </span>
                    <ArrowUpRight className="w-5 h-5 text-muted-foreground" />
                  </label>
                  {importMessage && (
                    <p role="status" className="bw-body-sm text-muted-foreground text-center">
                      {importMessage}
                    </p>
                  )}
                  <p className="bw-label-xs text-muted-foreground text-center">
                    Columns we read: title, artist, key, BPM, duration
                  </p>
                </div>
              </OnboardingSheet>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthScreen>
  );
};

export default AddSongs;
