import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, X, Link, Check } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { BwSheet, Tag } from '@/app/components/bw/Screen';
import { PillButton, PillField, Selector } from '@/app/components/bw/Form';
import { getSongs, createSong, type Song } from '@/lib/services/songs';
import { useBand } from '@/lib/BandContext';
import { safeHttpsUrl } from '@/lib/services/songFiles';

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

function detectUrlType(input: string): { spotify_id?: string; youtube_url?: string; audio_url?: string } {
  const trimmed = input.trim();
  const spotify = trimmed.match(/spotify(?::|\.com\/)(?:.*?)track[:/]([a-zA-Z0-9]{10,40})/);
  if (spotify) return { spotify_id: spotify[1] };
  // Everything else must be an https link (no javascript:, data:, file: …).
  const url = safeHttpsUrl(trimmed);
  if (!url) return {};
  if (/(^|\.)(youtube\.com|youtu\.be)$/i.test(new URL(url).hostname)) return { youtube_url: url };
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
  const query = search.trim();

  const goToManual = () => {
    // Carry the search over as the new song's title ("+ Add “fly” as a new song").
    if (query && !newTitle.trim()) setNewTitle(query);
    setTab('add');
  };

  const footer =
    tab === 'add' ? (
      <PillButton
        icon={<Check className="w-5 h-5" />}
        onClick={handleAddSong}
        disabled={!newTitle.trim()}
        loading={saving}
      >
        {saving ? 'Saving…' : 'Add & select'}
      </PillButton>
    ) : multiSelect && multiSelected.size > 0 ? (
      <PillButton icon={<Plus className="w-5 h-5" />} onClick={handleConfirmMulti}>
        Add {multiSelected.size} {multiSelected.size === 1 ? 'song' : 'songs'}
      </PillButton>
    ) : (
      <PillButton icon={<Plus className="w-5 h-5" />} onClick={goToManual}>
        New song
      </PillButton>
    );

  return (
    <BwSheet
      open={isOpen}
      onClose={onClose}
      overline="Song library"
      title={tab === 'library' ? 'Add songs' : 'New song'}
      footer={footer}
      zIndex={110}
    >
      <div className="flex flex-col gap-3">
        {tab === 'library' ? (
          <>
            {/* Search (Figma Input on the dark sheet) */}
            <PillField
              tone="sheet"
              label="Search library"
              icon={<Search className="w-5 h-5" />}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Title or artist"
              trailing={
                search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="-m-2 p-2 shrink-0 text-sheet-foreground/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : undefined
              }
            />

            {/* Source tabs (Figma Selector SM: Accent = active) */}
            <SourceTabs tab={tab} onLibrary={() => setTab('library')} onManual={goToManual} />

            {/* Category filters */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Selector
                  selected={!filterCategory}
                  onClick={() => setFilterCategory(null)}
                  className={sheetSelector(!filterCategory)}
                >
                  All
                </Selector>
                {categories.map(cat => (
                  <Selector
                    key={cat}
                    selected={filterCategory === cat}
                    onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                    className={sheetSelector(filterCategory === cat)}
                  >
                    {cat}
                  </Selector>
                ))}
              </div>
            )}

            {/* Song list */}
            {loading ? (
              <p className="py-12 text-center bw-body-md text-sheet-foreground/70">Loading songs…</p>
            ) : displayed.length === 0 ? (
              <p className="py-12 text-center bw-body-md text-sheet-foreground/70">
                {songs.length === 0 ? 'No songs in your library yet.' : 'No matches found.'}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {displayed.map(song => {
                  const isChecked = allSelected.has(song.id);
                  const inSet = selectedIds.includes(song.id) && !multiSelected.has(song.id);
                  const subtitle = [song.artist || 'Unknown artist', song.category].filter(Boolean).join(' · ');
                  return (
                    <button
                      key={song.id}
                      type="button"
                      aria-pressed={isChecked}
                      onClick={() => handleSelectSong(song)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-full text-left transition-colors active:scale-[0.99]',
                        isChecked ? 'bg-sheet-foreground/[0.08]' : 'hover:bg-sheet-foreground/[0.04]'
                      )}
                    >
                      <DotCheck checked={isChecked} />
                      <span className="flex-1 min-w-0 flex flex-col">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="bw-label-md text-sheet-foreground truncate">{song.title}</span>
                          {inSet && (
                            <Tag className="bg-sheet-foreground/[0.12] text-sheet-foreground">In set</Tag>
                          )}
                        </span>
                        <span className="bw-body-sm text-sheet-foreground/85 truncate">{subtitle}</span>
                      </span>
                      {song.duration_seconds ? (
                        <span className="bw-label-sm text-sheet-foreground/85 shrink-0 tabular-nums">
                          {formatDuration(song.duration_seconds)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            {/* "+ Add … as a new song" (Figma Button SM, accent text) */}
            {!loading && (
              <button
                type="button"
                onClick={goToManual}
                className="self-start h-9 inline-flex items-center bw-button-sm text-accent active:scale-[var(--press-scale,0.97)] transition-transform"
              >
                {query ? `+ Add “${query}” as a new song` : '+ Add a new song'}
              </button>
            )}
          </>
        ) : (
          <>
            <SourceTabs tab={tab} onLibrary={() => setTab('library')} onManual={goToManual} />
            <PillField
              tone="sheet"
              label="Song title *"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter song title"
              autoFocus
            />
            <PillField
              tone="sheet"
              label="Artist"
              type="text"
              value={newArtist}
              onChange={(e) => setNewArtist(e.target.value)}
              placeholder="Enter artist name"
            />
            <PillField
              tone="sheet"
              label="Link (Spotify, YouTube, Drive)"
              icon={<Link className="w-5 h-5" />}
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Paste URL"
              hint="Spotify, YouTube, Google Drive, or any audio link"
            />
          </>
        )}
      </div>
    </BwSheet>
  );
};

/** Selector on the dark sheet: Accent (lime) when active, white outline otherwise. */
const sheetSelector = (active: boolean) =>
  active
    ? 'bg-accent text-accent-foreground'
    : 'border-sheet-foreground/85 text-sheet-foreground';

const SourceTabs: React.FC<{ tab: Tab; onLibrary: () => void; onManual: () => void }> = ({ tab, onLibrary, onManual }) => (
  <div className="flex items-center gap-2">
    <Selector selected={tab === 'library'} onClick={onLibrary} className={sheetSelector(tab === 'library')}>
      From library
    </Selector>
    <Selector selected={tab === 'add'} onClick={onManual} className={sheetSelector(tab === 'add')}>
      Manual
    </Selector>
  </div>
);

/**
 * Figma "Control" checkbox: a 4×4 dot-matrix square on the 6px pitch —
 * outline dots in dot/mid when off, all dots lit when checked.
 */
const DotCheck: React.FC<{ checked: boolean }> = ({ checked }) => {
  const dots: React.ReactNode[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const edge = r === 0 || r === 3 || c === 0 || c === 3;
      if (!checked && !edge) continue;
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={3 + c * 6}
          cy={3 + r * 6}
          r={2.4}
          fill={checked ? 'currentColor' : 'var(--dot-mid)'}
        />,
      );
    }
  }
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" className="shrink-0 text-sheet-foreground" aria-hidden>
      {dots}
    </svg>
  );
};
