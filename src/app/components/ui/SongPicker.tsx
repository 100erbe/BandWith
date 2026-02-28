import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, X, Link, Music, ArrowLeft, Check } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { getSongs, createSong, type Song } from '@/lib/services/songs';
import { useBand } from '@/lib/BandContext';

export interface PickedSong {
  id: string;
  title: string;
  artist: string;
  duration_seconds?: number;
  category?: string;
  source_url?: string;
}

interface SongPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (song: PickedSong) => void;
  onSelectMultiple?: (songs: PickedSong[]) => void;
  multiSelect?: boolean;
  /** Already selected song IDs to show as checked */
  selectedIds?: string[];
  /** Theme color scheme */
  theme?: 'lime' | 'blue' | 'beige';
}

type Tab = 'library' | 'add';

function detectUrlType(url: string): { spotify_id?: string; youtube_url?: string; audio_url?: string } {
  if (url.includes('spotify.com') || url.includes('spotify:')) {
    const match = url.match(/track[:/]([a-zA-Z0-9]+)/);
    return { spotify_id: match?.[1] || url };
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return { youtube_url: url };
  }
  return { audio_url: url };
}

export const SongPicker: React.FC<SongPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  onSelectMultiple,
  multiSelect = false,
  selectedIds = [],
  theme = 'lime',
}) => {
  const { selectedBand } = useBand();
  const [tab, setTab] = useState<Tab>('library');
  const [search, setSearch] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());

  // Add form
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const themeColors = useMemo(() => {
    switch (theme) {
      case 'blue': return {
        bg: 'bg-[#0147ff]', text: 'text-white', subtext: 'text-white/50',
        input: 'border-white/20 text-white placeholder:text-white/30 focus:border-white',
        pill: 'bg-white/20 text-white', pillActive: 'bg-white text-[#0147ff]',
        card: 'bg-white/10', accent: 'bg-[#D5FB46] text-black',
        btnPrimary: 'bg-black text-white', btnSecondary: 'bg-white/20 text-white',
      };
      case 'beige': return {
        bg: 'bg-[#9a8878]', text: 'text-white', subtext: 'text-white/50',
        input: 'border-white/20 text-white placeholder:text-white/30 focus:border-white',
        pill: 'bg-white/20 text-white', pillActive: 'bg-white text-[#9a8878]',
        card: 'bg-white/10', accent: 'bg-white text-black',
        btnPrimary: 'bg-black text-white', btnSecondary: 'bg-white/20 text-white',
      };
      default: return {
        bg: 'bg-[#D5FB46]', text: 'text-black', subtext: 'text-black/50',
        input: 'border-black/10 text-black placeholder:text-black/20 focus:border-black',
        pill: 'bg-black/10 text-black', pillActive: 'bg-black text-white',
        card: 'bg-white', accent: 'bg-black text-[#D5FB46]',
        btnPrimary: 'bg-black text-white', btnSecondary: 'bg-white text-black',
      };
    }
  }, [theme]);

  useEffect(() => {
    if (!isOpen || !selectedBand?.id) return;
    const fetchSongs = async () => {
      setLoading(true);
      const { data } = await getSongs(selectedBand.id);
      if (data) setSongs(data);
      setLoading(false);
    };
    fetchSongs();
  }, [isOpen, selectedBand?.id]);

  const filtered = useMemo(() => {
    if (!search.trim()) return songs;
    const q = search.toLowerCase();
    return songs.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.artist && s.artist.toLowerCase().includes(q))
    );
  }, [songs, search]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    songs.forEach(s => { if (s.category) cats.add(s.category); });
    return Array.from(cats).sort();
  }, [songs]);

  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const displayed = useMemo(() => {
    if (!filterCategory) return filtered;
    return filtered.filter(s => s.category === filterCategory);
  }, [filtered, filterCategory]);

  const handleSelectSong = useCallback((song: Song) => {
    const picked: PickedSong = {
      id: song.id,
      title: song.title,
      artist: song.artist || '',
      duration_seconds: song.duration_seconds,
      category: song.category,
    };
    if (multiSelect) {
      setMultiSelected(prev => {
        const next = new Set(prev);
        if (next.has(song.id)) next.delete(song.id);
        else next.add(song.id);
        return next;
      });
    } else {
      onSelect(picked);
      onClose();
    }
  }, [multiSelect, onSelect, onClose]);

  const handleConfirmMulti = useCallback(() => {
    if (!onSelectMultiple) return;
    const selected = songs.filter(s => multiSelected.has(s.id)).map(s => ({
      id: s.id, title: s.title, artist: s.artist || '',
      duration_seconds: s.duration_seconds, category: s.category,
    }));
    onSelectMultiple(selected);
    onClose();
  }, [multiSelected, songs, onSelectMultiple, onClose]);

  const handleAddSong = useCallback(async () => {
    if (!newTitle.trim() || !selectedBand?.id) return;
    setSaving(true);

    const urlFields = newUrl.trim() ? detectUrlType(newUrl.trim()) : {};
    const songData: Partial<Song> = {
      band_id: selectedBand.id,
      title: newTitle.trim(),
      artist: newArtist.trim() || undefined,
      status: 'ready',
      priority: 'medium',
      ...urlFields,
    };

    const { data: created } = await createSong(songData);
    setSaving(false);

    if (created) {
      setSongs(prev => [created, ...prev]);
      const picked: PickedSong = {
        id: created.id,
        title: created.title,
        artist: created.artist || '',
        duration_seconds: created.duration_seconds,
        category: created.category,
        source_url: newUrl.trim() || undefined,
      };
      onSelect(picked);
      setNewTitle('');
      setNewArtist('');
      setNewUrl('');
      setTab('library');
    }
  }, [newTitle, newArtist, newUrl, selectedBand?.id, onSelect]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const allSelected = new Set([...selectedIds, ...Array.from(multiSelected)]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn('fixed inset-0 z-[110] flex flex-col overflow-hidden', themeColors.bg)}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className={cn(
            'w-10 h-10 rounded-full border-2 flex items-center justify-center',
            theme === 'lime' ? 'border-black' : 'border-white'
          )}>
            <ArrowLeft className={cn('w-5 h-5', theme === 'lime' ? 'text-black' : 'text-white')} />
          </button>
          <span className={cn('text-[18px] font-bold uppercase', themeColors.text)}>
            {tab === 'library' ? 'SONG LIBRARY' : 'ADD NEW SONG'}
          </span>
          <button onClick={onClose} className={cn(
            'w-[44px] h-[44px] rounded-full border-2 flex items-center justify-center',
            theme === 'lime' ? 'border-black bg-[rgba(216,216,216,0.3)]' : 'border-white bg-white/10'
          )}>
            <X className={cn('w-5 h-5', theme === 'lime' ? 'text-black' : 'text-white')} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setTab('library')}
            className={cn(
              'flex-1 py-2.5 rounded-[10px] text-[12px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5',
              tab === 'library' ? themeColors.pillActive : themeColors.pill
            )}
          >
            <Music className="w-3.5 h-3.5" /> Library
          </button>
          <button
            onClick={() => setTab('add')}
            className={cn(
              'flex-1 py-2.5 rounded-[10px] text-[12px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5',
              tab === 'add' ? themeColors.pillActive : themeColors.pill
            )}
          >
            <Plus className="w-3.5 h-3.5" /> Add New
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
        <AnimatePresence mode="wait">
          {tab === 'library' ? (
            <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Search */}
              <div className="relative mb-3">
                <Search className={cn('absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4', themeColors.subtext)} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title or artist..."
                  className={cn(
                    'w-full bg-transparent border-b-2 pl-6 py-2 text-sm font-bold focus:outline-none transition-all',
                    themeColors.input
                  )}
                />
                {search && (
                  <button onClick={() => setSearch('')} className={cn('absolute right-0 top-1/2 -translate-y-1/2', themeColors.subtext)}>
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category pills */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <button
                    onClick={() => setFilterCategory(null)}
                    className={cn(
                      'px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all',
                      !filterCategory ? themeColors.pillActive : themeColors.pill
                    )}
                  >
                    All
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                      className={cn(
                        'px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all',
                        filterCategory === cat ? themeColors.pillActive : themeColors.pill
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Song list */}
              {loading ? (
                <div className={cn('text-center py-12', themeColors.subtext)}>
                  <span className="text-sm font-bold">Loading songs...</span>
                </div>
              ) : displayed.length === 0 ? (
                <div className={cn('text-center py-12', themeColors.subtext)}>
                  <span className="text-lg font-bold block mb-2">
                    {songs.length === 0 ? 'No songs in library' : 'No matches found'}
                  </span>
                  <button
                    onClick={() => setTab('add')}
                    className={cn('text-sm font-bold underline', themeColors.text)}
                  >
                    Add a new song
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {displayed.map(song => {
                    const isChecked = allSelected.has(song.id);
                    return (
                      <button
                        key={song.id}
                        onClick={() => handleSelectSong(song)}
                        className={cn(
                          'w-full flex items-center justify-between p-3 rounded-[10px] text-left transition-all',
                          themeColors.card,
                          isChecked && theme === 'lime' && 'ring-2 ring-black'
                        )}
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <span className={cn('text-sm font-bold block truncate', themeColors.text)}>{song.title}</span>
                          <div className="flex items-center gap-2">
                            <span className={cn('text-[11px] font-bold truncate', themeColors.subtext)}>
                              {song.artist || 'Unknown Artist'}
                            </span>
                            {song.duration_seconds && (
                              <>
                                <span className={cn('w-1 h-1 rounded-full', theme === 'lime' ? 'bg-black/20' : 'bg-white/20')} />
                                <span className={cn('text-[11px] font-bold', themeColors.subtext)}>
                                  {formatDuration(song.duration_seconds)}
                                </span>
                              </>
                            )}
                            {song.category && (
                              <>
                                <span className={cn('w-1 h-1 rounded-full', theme === 'lime' ? 'bg-black/20' : 'bg-white/20')} />
                                <span className={cn('text-[10px] font-bold uppercase', themeColors.subtext)}>
                                  {song.category}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <DotCheckbox
                          checked={isChecked}
                          activeColor={theme === 'lime' ? '#000000' : '#ffffff'}
                          inactiveColor={theme === 'lime' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)'}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex flex-col gap-5 pt-2">
                <div>
                  <span className={cn('text-[10px] font-bold uppercase block mb-1', themeColors.subtext)}>SONG TITLE *</span>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Enter song title..."
                    className={cn('w-full bg-transparent border-b-2 py-2 text-lg font-bold focus:outline-none transition-all', themeColors.input)}
                  />
                </div>
                <div>
                  <span className={cn('text-[10px] font-bold uppercase block mb-1', themeColors.subtext)}>ARTIST</span>
                  <input
                    type="text"
                    value={newArtist}
                    onChange={(e) => setNewArtist(e.target.value)}
                    placeholder="Enter artist name..."
                    className={cn('w-full bg-transparent border-b-2 py-2 text-sm font-bold focus:outline-none transition-all', themeColors.input)}
                  />
                </div>
                <div>
                  <span className={cn('text-[10px] font-bold uppercase block mb-1', themeColors.subtext)}>
                    LINK (SPOTIFY, YOUTUBE, DRIVE)
                  </span>
                  <div className="relative">
                    <Link className={cn('absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4', themeColors.subtext)} />
                    <input
                      type="url"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="Paste URL..."
                      className={cn('w-full bg-transparent border-b-2 pl-6 py-2 text-sm font-bold focus:outline-none transition-all', themeColors.input)}
                    />
                  </div>
                  <span className={cn('text-[10px] font-bold mt-1 block', themeColors.subtext)}>
                    Spotify, YouTube, Google Drive, or any audio link
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 shrink-0">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={onClose}
            className={cn('py-4 rounded-[10px] flex items-center justify-center gap-2 font-bold text-sm uppercase', themeColors.btnSecondary)}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {tab === 'add' ? (
            <button
              onClick={handleAddSong}
              disabled={!newTitle.trim() || saving}
              className={cn(
                'py-4 rounded-[10px] flex items-center justify-center gap-2 font-bold text-sm uppercase transition-all',
                newTitle.trim() && !saving ? themeColors.btnPrimary : 'bg-black/30 text-white/50 cursor-not-allowed'
              )}
            >
              {saving ? 'Saving...' : 'Add & Select'}
              <Check className="w-4 h-4" />
            </button>
          ) : multiSelect && multiSelected.size > 0 ? (
            <button
              onClick={handleConfirmMulti}
              className={cn('py-4 rounded-[10px] flex items-center justify-center gap-2 font-bold text-sm uppercase', themeColors.btnPrimary)}
            >
              Add {multiSelected.size} Songs
              <Check className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setTab('add')}
              className={cn('py-4 rounded-[10px] flex items-center justify-center gap-2 font-bold text-sm uppercase', themeColors.btnPrimary)}
            >
              <Plus className="w-4 h-4" /> New Song
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
