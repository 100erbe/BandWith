import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import {
  Plus,
  X,
  Music2,
  Trash2,
  Edit3,
  Loader2,
  Search,
  Play,
  ListMusic,
  GripVertical,
  Check,
  Save,
  ChevronRight,
  CheckCircle2,
  FileText,
  Upload,
  BookOpen,
} from '@/app/components/icons';
import { openLyrics } from '@/lib/lyrics';
import { cn } from '@/app/components/ui/utils';
import { useBand } from '@/lib/BandContext';
import {
  getSongs, createSong, deleteSong, updateSong,
  getSetlists, getSetlist, createSetlist, updateSetlist, deleteSetlist,
  replaceSetlistSongs, seedRepertoireSongs, bulkCreateSongs
} from '@/lib/services/songs';
import { parseSongList, SONG_LIST_ACCEPT } from '@/lib/songListImport';
import type { Song, Setlist } from '@/lib/services/songs';
import { AddSongModal } from '@/app/components/rehearsal/AddSongModal';
import { ScreenHeader, IconButton, SearchField, Card, Tag, BwSheet } from '@/app/components/bw/Screen';
import { PillButton, PillField, Selector, FormError } from '@/app/components/bw/Form';
import { openSongResource } from '@/lib/services/songFiles';
import { formatHoursMinutes, genresOf, parseGenres, songHasGenre } from '@/lib/songGenres';
import { playTrack } from '@/lib/audioPlayer';
import { t, useT } from '@/lib/i18n';

/** Readiness dots: 16 per row, one dot per song (scaled down past 48 songs). */
const READINESS_COLS = 16;
const READINESS_MAX = 48;

const ReadinessDots: React.FC<{ ready: number; learning: number; suggested: number; total: number }> = ({ ready, learning, suggested, total }) => {
  const scale = total > READINESS_MAX ? READINESS_MAX / total : 1;
  const n = Math.max(0, Math.round(total * scale));
  const r = Math.round(ready * scale);
  const l = Math.round(learning * scale);
  const s = Math.round(suggested * scale);
  const colors = Array.from({ length: n }).map((_, i) =>
    i < r ? 'var(--accent)' : i < r + l ? 'currentColor' : i < r + l + s ? 'var(--dot-mid)' : 'color-mix(in srgb, currentColor 18%, transparent)',
  );
  return (
    <div className="grid gap-y-2.5 justify-between" style={{ gridTemplateColumns: `repeat(${READINESS_COLS}, 10px)` }} aria-hidden>
      {colors.map((c, i) => (
        <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
      ))}
    </div>
  );
};

/** Popover menu used by song rows (same pattern as Task templates). */
const RowMenu: React.FC<{ items: { label: string; icon: React.ReactNode; run: () => void; danger?: boolean }[] }> = ({ items }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="absolute right-3 top-full -mt-2 z-20 min-w-[168px] p-1 rounded-[16px] bg-popover text-popover-foreground shadow-lg border border-border origin-top-right"
    role="menu"
  >
    {items.map((item) => (
      <button
        key={item.label}
        type="button"
        role="menuitem"
        onClick={item.run}
        className={cn(
          'w-full h-11 px-3 flex items-center gap-3 rounded-[12px] bw-body-sm font-medium text-left hover:bg-foreground/[0.06]',
          item.danger ? 'text-destructive' : 'text-foreground',
        )}
      >
        {item.icon}
        {item.label}
      </button>
    ))}
  </motion.div>
);

/** One song in the setlist editor (a song can only appear once, but rows need stable keys). */
interface EditorItem {
  key: string;
  songId: string;
}

let editorKeySeq = 0;
const newEditorKey = () => `new-${++editorKeySeq}`;

/** Renumber set numbers to 1, 2, 3… keeping their order (empty sets disappear). */
const compactSets = (sets: number[]): number[] => {
  const distinct = Array.from(new Set(sets)).sort((a, b) => a - b);
  return sets.map((n) => distinct.indexOf(n) + 1);
};

const errorText = (error: unknown, fallback: string) =>
  error && typeof error === 'object' && 'message' in error && (error as Error).message
    ? `${fallback}: ${(error as Error).message}`
    : `${fallback}. ${t('Try again.')}`;

/**
 * Setlist row that reorders by dragging its grip (pointer events, so it works
 * with touch). Only the grip starts a drag, so the list still scrolls.
 */
const SetlistOrderRow: React.FC<{
  item: EditorItem;
  song: Song;
  index: number;
  setLabel?: string;
  duration: string;
  onRemove: () => void;
}> = ({ item, song, index, setLabel, duration, onRemove }) => {
  const t = useT();
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);
  return (
    <Reorder.Item
      as="li"
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      whileDrag={{ scale: 1.02 }}
      className={cn(
        'relative flex items-center gap-3 p-3 rounded-[16px] bg-card border-[1.5px] transition-[border-color,box-shadow] select-none',
        dragging ? 'z-10 border-foreground shadow-lg' : 'border-transparent',
      )}
    >
      <span
        onPointerDown={(e) => {
          e.preventDefault();
          controls.start(e);
        }}
        className="-my-2 -ml-2 w-9 h-11 flex items-center justify-center shrink-0 text-muted-foreground cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        title={t('Drag to reorder')}
        aria-hidden
      >
        <GripVertical className="w-4 h-4" />
      </span>
      <span className="w-8 h-8 rounded-full border-[1.5px] border-foreground/30 flex items-center justify-center bw-label-sm shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="bw-label-md truncate flex items-center gap-2 min-w-0">
          <span className="truncate">{song.title}</span>
          {setLabel && <Tag variant="accent">{setLabel}</Tag>}
        </p>
        <p className="bw-body-sm text-muted-foreground truncate">{song.artist || t('Unknown artist')}</p>
      </div>
      <span className="bw-label-sm shrink-0">{duration}</span>
      <IconButton label={t('Remove {title}', { title: song.title })} variant="ghost" size="sm" icon={<X />} onClick={onRemove} />
    </Reorder.Item>
  );
};

interface SetlistManagerViewProps {
  onClose: () => void;
}

type ViewMode = 'songs' | 'setlists';

export const SetlistManagerView: React.FC<SetlistManagerViewProps> = ({ onClose }) => {
  const t = useT();
  const { selectedBand, isAdmin } = useBand();
  const [viewMode, setViewMode] = useState<ViewMode>('songs');
  const [songs, setSongs] = useState<Song[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddSong, setShowAddSong] = useState(false);
  const [showAddSetlist, setShowAddSetlist] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  /** Feedback line above the lists (import results, failed actions). */
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [addSetlistError, setAddSetlistError] = useState<string | null>(null);
  const [addingSetlist, setAddingSetlist] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  /** The setlist couldn't be read: saving would wipe its songs, so it is blocked. */
  const [editorLoadFailed, setEditorLoadFailed] = useState(false);

  const [newSong, setNewSong] = useState({
    title: '',
    artist: '',
    bpm: '',
    key: '',
    duration: ''
  });
  
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [newSetlistName, setNewSetlistName] = useState('');

  // Setlist editor state
  const [editingSetlistId, setEditingSetlistId] = useState<string | null>(null);
  const [editingSetlistName, setEditingSetlistName] = useState('');
  const [editorItems, setEditorItems] = useState<EditorItem[]>([]);
  /** Set number for each position in `editorItems` (sets keep their size when songs move). */
  const [editorSets, setEditorSets] = useState<number[]>([]);
  const [setlistEditorLoading, setSetlistEditorLoading] = useState(false);
  const [setlistEditorSaving, setSetlistEditorSaving] = useState(false);
  const [setlistEditorSearch, setSetlistEditorSearch] = useState(false);
  const [setlistSearchQuery, setSetlistSearchQuery] = useState('');
  const [setlistSelectedToAdd, setSetlistSelectedToAdd] = useState<string[]>([]);
  const [editorGenre, setEditorGenre] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBand?.id) {
      fetchData();
    }
  }, [selectedBand?.id]);

  const fetchData = async () => {
    if (!selectedBand?.id) return;
    setLoading(true);
    
    const [songsRes, setlistsRes] = await Promise.all([
      getSongs(selectedBand.id),
      getSetlists(selectedBand.id)
    ]);
    
    if (songsRes.data) setSongs(songsRes.data);
    if (setlistsRes.data) setSetlists(setlistsRes.data);
    if (songsRes.error || setlistsRes.error) {
      setNotice({ text: errorText(songsRes.error || setlistsRes.error, t('Could not load your songs and setlists')), error: true });
    }
    setLoading(false);
  };

  const handleAddSetlist = async () => {
    if (!selectedBand?.id || !newSetlistName.trim() || addingSetlist) return;
    setAddingSetlist(true);
    setAddSetlistError(null);

    const { data, error } = await createSetlist({
      band_id: selectedBand.id,
      name: newSetlistName.trim(),
      is_template: false
    });
    setAddingSetlist(false);

    if (error || !data) {
      setAddSetlistError(errorText(error, t('Could not create the setlist')));
      return;
    }
    setSetlists(prev => [data, ...prev]);
    setNewSetlistName('');
    setShowAddSetlist(false);
  };

  const handleDeleteSong = async (songId: string) => {
    setActionMenuId(null);
    const { error } = await deleteSong(songId);
    if (error) {
      setNotice({ text: errorText(error, t('Could not delete the song')), error: true });
      return;
    }
    setSongs(prev => prev.filter(s => s.id !== songId));
  };

  /** Admins move a suggested song to Learning / Ready (and back). */
  const handleSetSongStatus = async (song: Song, status: Song['status']) => {
    setActionMenuId(null);
    const previous = song.status;
    setSongs((prev) => prev.map((s) => (s.id === song.id ? { ...s, status } : s)));
    const { error } = await updateSong(song.id, { status });
    if (error) {
      setSongs((prev) => prev.map((s) => (s.id === song.id ? { ...s, status: previous } : s)));
      setNotice({ text: errorText(error, t('Could not update the song')), error: true });
    }
  };

  const handlePlaySong = async (song: Song) => {
    setActionMenuId(null);
    // A recording (uploaded file, Drive or any audio link) plays in the app's
    // mini player; only Spotify / YouTube open outside.
    if (song.audio_url) {
      void playTrack({ id: song.id, title: song.title, artist: song.artist, lyrics: song.lyrics }, song.audio_url);
      return;
    }
    const opened = await openSongResource([
      song.audio_url,
      song.spotify_id ? `https://open.spotify.com/track/${encodeURIComponent(song.spotify_id)}` : undefined,
      song.youtube_url,
    ]);
    if (!opened) setNotice({ text: t('Could not open this song. Check its recording or links.'), error: true });
  };

  const handleOpenChart = async (song: Song) => {
    setActionMenuId(null);
    const opened = await openSongResource(song.chart_url);
    if (!opened) setNotice({ text: t('Could not open the chart. Try again.'), error: true });
  };

  const handleEditSong = (song: Song) => {
    setEditingSong(song);
    setNewSong({
      title: song.title,
      artist: song.artist || '',
      bpm: song.bpm?.toString() || '',
      key: song.key || '',
      duration: song.duration_seconds ? Math.floor(song.duration_seconds / 60).toString() : ''
    });
    setShowAddSong(true);
    setActionMenuId(null);
  };

  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const setImportStatus = (text: string, error = false) => setNotice({ text, error });

  // Song list from CSV/TXT (Excel, Numbers, Sheets, Notes) → songs library.
  const handleImportList = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedBand?.id) return;
    if (file.size > 2 * 1024 * 1024) {
      setImportStatus(t('That file is too large for a song list (max 2 MB).'), true);
      return;
    }
    setImporting(true);
    try {
      const parsed = parseSongList(await file.text());
      if (parsed.length === 0) {
        setImportStatus(t('No songs found. Use one song per line or a CSV with a “title” column.'), true);
        return;
      }
      const known = new Set(songs.map((s) => `${s.title.toLowerCase()}|${(s.artist || '').toLowerCase()}`));
      const fresh = parsed.filter((p) => !known.has(`${p.title.toLowerCase()}|${(p.artist || '').toLowerCase()}`));
      if (fresh.length === 0) {
        setImportStatus(t('All {count} songs are already in your library.', { count: parsed.length }));
        return;
      }
      const { error } = await bulkCreateSongs(
        selectedBand.id,
        fresh.map((p) => ({
          title: p.title,
          artist: p.artist,
          key: p.key,
          bpm: p.bpm,
          duration_seconds: p.duration,
          genre: p.genre,
          status: 'ready' as const,
          priority: 'medium' as const,
        })) as Parameters<typeof bulkCreateSongs>[1],
      );
      if (error) {
        setImportStatus(t('Import failed: {error}', { error: error.message }), true);
        return;
      }
      setImportStatus(
        fresh.length < parsed.length
          ? fresh.length === 1
            ? t('Imported {count} song ({skipped} already in your library).', { count: fresh.length, skipped: parsed.length - fresh.length })
            : t('Imported {count} songs ({skipped} already in your library).', { count: fresh.length, skipped: parsed.length - fresh.length })
          : fresh.length === 1
            ? t('Imported {count} song.', { count: fresh.length })
            : t('Imported {count} songs.', { count: fresh.length }),
      );
      await fetchData();
    } catch (err) {
      setImportStatus(errorText(err, t('Could not read that file')), true);
    } finally {
      setImporting(false);
    }
  };

  const handleSeedRepertoire = async () => {
    if (!selectedBand?.id || seeding) return;
    setSeeding(true);
    const { count, error } = await seedRepertoireSongs(selectedBand.id);
    if (error) {
      setNotice({ text: errorText(error, t('Could not load the repertoire')), error: true });
    } else if (count > 0) {
      setNotice({ text: count === 1 ? t('Added {count} song to your library.', { count }) : t('Added {count} songs to your library.', { count }) });
      await fetchData();
    } else {
      setNotice({ text: t('All repertoire songs are already in your library.') });
    }
    setSeeding(false);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredSongs = songs.filter(song => 
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSetlists = setlists.filter(setlist =>
    setlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = useMemo(() => {
    const totalSongs = songs.length;
    const totalDurationSeconds = songs.reduce((acc, song) => acc + (song.duration_seconds || 0), 0);
    
    const readySongs = songs.filter(s => s.status === 'ready').length;
    const learningSongs = songs.filter(s => s.status === 'learning').length;
    const suggestedSongs = songs.filter(s => (s as any).status === 'suggested').length;
    
    return {
      totalSongs,
      totalDuration: formatHoursMinutes(totalDurationSeconds),
      ready: readySongs,
      learning: learningSongs,
      suggested: suggestedSongs,
      totalSetlists: setlists.length
    };
  }, [songs, setlists]);

  // ── Setlist Editor Logic ──

  const openSetlistEditor = useCallback(async (setlistId: string) => {
    setEditingSetlistId(setlistId);
    setSetlistEditorLoading(true);
    setSetlistEditorSearch(false);
    setSetlistSearchQuery('');
    setSetlistSelectedToAdd([]);
    setEditorError(null);
    setEditorLoadFailed(false);
    setEditorItems([]);
    setEditorSets([]);

    const { data, error } = await getSetlist(setlistId);
    if (data) {
      setEditingSetlistName(data.name);
      const seen = new Set<string>();
      const ordered = [...data.songs]
        .sort((a, b) => ((a.set_number ?? 1) - (b.set_number ?? 1)) || (a.position - b.position))
        .filter((s) => (seen.has(s.song_id) ? false : (seen.add(s.song_id), true)));
      setEditorItems(ordered.map((s) => ({ key: s.id || newEditorKey(), songId: s.song_id })));
      setEditorSets(compactSets(ordered.map((s) => s.set_number ?? 1)));
    } else {
      setEditorError(errorText(error, t('Could not load this setlist')));
      setEditorLoadFailed(true);
    }
    setSetlistEditorLoading(false);
  }, [t]);

  // Setlist → PDF (share sheet on phones, download on the web).
  const [exportingPdf, setExportingPdf] = useState(false);
  const handleExportSetlistPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const [{ generateSetlistPdf }, { shareFile }] = await Promise.all([
        import('@/lib/services/setlistPdf'),
        import('@/lib/nativeFiles'),
      ]);
      const name = editingSetlistName.trim() || 'Setlist';
      const { blob, fileName } = generateSetlistPdf({
        name,
        bandName: selectedBand?.name,
        songs: editorRows.map(({ fullIndex, song }) => ({
          title: song.title,
          artist: song.artist,
          key: song.key,
          bpm: song.bpm,
          durationSeconds: song.duration_seconds,
          setNumber: editorSets[fullIndex] ?? 1,
        })),
      });
      await shareFile(blob, fileName, { title: t('{name} · setlist', { name }), dialogTitle: t('Export setlist') });
    } catch {
      setEditorError(t('Could not export the setlist PDF. Try again.'));
    } finally {
      setExportingPdf(false);
    }
  };

  const closeSetlistEditor = () => {
    setEditingSetlistId(null);
    setSetlistEditorSearch(false);
    setEditorError(null);
  };

  const handleSaveSetlist = useCallback(async () => {
    if (!editingSetlistId || !editingSetlistName.trim() || setlistEditorSaving || editorLoadFailed) return;
    setSetlistEditorSaving(true);
    setEditorError(null);
    const name = editingSetlistName.trim();
    const sets = compactSets(editorSets);

    try {
      const { error: nameError } = await updateSetlist(editingSetlistId, { name });
      if (nameError) {
        setEditorError(errorText(nameError, t('Could not save the setlist')));
        return;
      }
      const { error: songsError } = await replaceSetlistSongs(
        editingSetlistId,
        editorItems.map((it, i) => ({ song_id: it.songId, set_number: sets[i] ?? 1 })),
      );
      // The name is saved either way; keep the list in step with it.
      setSetlists(prev => prev.map(sl =>
        sl.id === editingSetlistId
          ? { ...sl, name, ...(songsError ? {} : { song_count: editorItems.length }) }
          : sl
      ));
      if (songsError) {
        setEditorError(errorText(songsError, t('The name was saved, but the song order was not')));
        return;
      }
      closeSetlistEditor();
    } finally {
      setSetlistEditorSaving(false);
    }
  }, [editingSetlistId, editingSetlistName, editorItems, editorSets, setlistEditorSaving, editorLoadFailed, t]);

  const handleDeleteSetlist = useCallback(async () => {
    if (!editingSetlistId) return;
    setEditorError(null);
    const { error } = await deleteSetlist(editingSetlistId);
    if (error) {
      setEditorError(errorText(error, t('Could not delete the setlist')));
      return;
    }
    setSetlists(prev => prev.filter(sl => sl.id !== editingSetlistId));
    closeSetlistEditor();
  }, [editingSetlistId, t]);

  const handleEditorRemoveSong = (key: string) => {
    const index = editorItems.findIndex((it) => it.key === key);
    if (index < 0) return;
    setEditorItems(prev => prev.filter((_, i) => i !== index));
    setEditorSets(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditorAddSelected = () => {
    setSetlistSelectedToAdd([]);
    setEditorGenre(null);
    setSetlistSearchQuery('');
    setSetlistEditorSearch(false);
  };

  const handleEditorToggleSelect = (songId: string) => {
    const index = editorItems.findIndex((it) => it.songId === songId);
    if (index >= 0) {
      setEditorItems(prev => prev.filter((_, i) => i !== index));
      setEditorSets(prev => prev.filter((_, i) => i !== index));
      return;
    }
    // New songs go at the end, in the last set.
    const lastSet = editorSets[editorSets.length - 1] ?? 1;
    setEditorItems(prev => [...prev, { key: newEditorKey(), songId }]);
    setEditorSets(prev => [...prev, lastSet]);
  };

  const songsById = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);

  /** Editor rows whose song is in the library (with their position in `editorItems`). */
  const editorRows = useMemo(
    () =>
      editorItems
        .map((item, fullIndex) => ({ item, fullIndex, song: songsById.get(item.songId) }))
        .filter((r): r is { item: EditorItem; fullIndex: number; song: Song } => !!r.song),
    [editorItems, songsById],
  );
  const editorSongs = useMemo(() => editorRows.map((r) => r.song), [editorRows]);
  const editorVisibleItems = useMemo(() => editorRows.map((r) => r.item), [editorRows]);
  const editorMultiSet = useMemo(() => new Set(editorSets).size > 1, [editorSets]);
  const editorSetNumbers = useMemo(() => compactSets(editorSets), [editorSets]);

  /** Running time of the setlist (and of each set), plus songs with no duration. */
  const editorTotals = useMemo(() => {
    const perSet = new Map<number, { count: number; seconds: number }>();
    let seconds = 0;
    let missing = 0;
    for (const { fullIndex, song } of editorRows) {
      const d = song.duration_seconds || 0;
      seconds += d;
      if (!d) missing += 1;
      const n = editorSetNumbers[fullIndex] ?? 1;
      const acc = perSet.get(n) || { count: 0, seconds: 0 };
      acc.count += 1;
      acc.seconds += d;
      perSet.set(n, acc);
    }
    return { seconds, missing, perSet: [...perSet.entries()].sort((a, b) => a[0] - b[0]) };
  }, [editorRows, editorSetNumbers]);

  // Reorder moves songs; set sizes stay put, so a song dragged across a
  // boundary joins the set it lands in.
  const handleEditorReorder = (nextVisible: EditorItem[]) => {
    setEditorItems((prev) => {
      const visible = new Set(editorVisibleItems);
      let k = 0;
      return prev.map((it) => (visible.has(it) ? nextVisible[k++] ?? it : it));
    });
  };

  // The whole library stays listed while building a setlist: songs already
  // in it are highlighted, a tap adds or removes one. Genre chips filter it.
  const editorInSetlist = useMemo(() => new Set(editorItems.map((it) => it.songId)), [editorItems]);
  const editorGenres = useMemo(() => genresOf(songs), [songs]);
  const editorFilteredLibrary = useMemo(() => {
    let result = songs.filter(s => songHasGenre(s, editorGenre));
    if (setlistSearchQuery) {
      const q = setlistSearchQuery.toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [songs, editorGenre, setlistSearchQuery]);

  // ── Render ──

  const formatClock = (seconds?: number) => (seconds ? formatDuration(seconds) : '—');

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="bw-pane-hub fixed inset-0 z-[70] bg-background text-foreground flex flex-col overflow-y-auto"
      style={{
        overscrollBehaviorX: 'none',
        touchAction: 'pan-y',
      }}
    >
      <ScreenHeader
        onBack={onClose}
        backLabel={t('Go back')}
        overline={t('Songs & setlists')}
        title={t('Repertoire')}
        actions={
          <>
            {viewMode === 'songs' && (
              <IconButton
                label={t('Import song list')}
                icon={<Upload />}
                disabled={importing}
                onClick={() => importInputRef.current?.click()}
              />
            )}
            <IconButton
              label={viewMode === 'songs' ? t('Add song') : t('New setlist')}
              variant="filled"
              icon={<Plus />}
              onClick={() => (viewMode === 'songs' ? setShowAddSong(true) : setShowAddSetlist(true))}
            />
          </>
        }
      />

      <input
        ref={importInputRef}
        type="file"
        accept={SONG_LIST_ACCEPT}
        className="hidden"
        onChange={handleImportList}
        aria-hidden
        tabIndex={-1}
      />
      <div className="flex-1 flex flex-col gap-4 px-4 pt-4 max-w-2xl mx-auto w-full" style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}>
        {notice && (
          notice.error ? (
            <FormError>{notice.text}</FormError>
          ) : (
            <p role="status" className="px-4 py-3 rounded-[16px] bg-card bw-body-sm">
              {notice.text}
            </p>
          )
        )}
        {/* View toggle (Figma Selector MD) */}
        <div className="flex gap-2">
          <Selector size="md" selected={viewMode === 'songs'} onClick={() => setViewMode('songs')} count={songs.length}>
            {t('Songs')}
          </Selector>
          <Selector size="md" selected={viewMode === 'setlists'} onClick={() => setViewMode('setlists')} count={setlists.length}>
            {t('Setlists')}
          </Selector>
        </div>

        <SearchField
          value={searchQuery}
          onChange={setSearchQuery}
          label={viewMode === 'songs' ? t('Search songs') : t('Search setlists')}
          placeholder={viewMode === 'songs' ? t('Search songs, artists…') : t('Search setlists…')}
        />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Band repertoire (Figma: inverse card) */}
            {(songs.length > 0 || setlists.length > 0) && (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[24px] p-5 bg-surface-inverse text-surface-inverse-foreground flex flex-col gap-4"
              >
                <h2 className="bw-label-sm">{t('Band repertoire')}</h2>
                {/* Counts on the left, total playing time on the right */}
                <dl className="flex flex-wrap items-end gap-x-4 gap-y-3">
                  {[
                    { label: t('Songs'), value: stats.totalSongs },
                    { label: t('Setlists'), value: stats.totalSetlists },
                  ].map((s) => (
                    <div key={s.label} className="flex flex-col gap-1">
                      <dt className="bw-label-xs">{s.label}</dt>
                      <dd className="bw-h2">{s.value}</dd>
                    </div>
                  ))}
                  <div className="ml-auto flex flex-col gap-1 text-right">
                    <dt className="bw-label-xs">{t('Total duration')}</dt>
                    <dd className="bw-h2">{stats.totalDuration}</dd>
                  </div>
                </dl>

                {stats.totalSongs > 0 && (
                  <>
                    <h3 className="bw-label-xs" aria-label={t('Status readiness: {ready} of {total} ready', { ready: stats.ready, total: stats.totalSongs })}>
                      {t('Status readiness')}
                    </h3>
                    <ReadinessDots ready={stats.ready} learning={stats.learning} suggested={stats.suggested} total={stats.totalSongs} />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      {[
                        { label: t('Ready'), value: stats.ready, color: 'var(--accent)' },
                        { label: t('Learning'), value: stats.learning, color: 'currentColor' },
                        { label: t('Suggested'), value: stats.suggested, color: 'var(--dot-mid)' },
                      ].map((l) => (
                        <span key={l.label} className="flex items-center gap-2 bw-label-sm">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
                          {l.label} {l.value}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </motion.section>
            )}

            {/* List */}
            {viewMode === 'songs' ? (
              filteredSongs.length === 0 ? (
                <Card className="items-center text-center py-10 gap-4">
                  <Music2 className="w-10 h-10 text-muted-foreground" />
                  <div className="flex flex-col gap-1">
                    <h2 className="bw-h3">{searchQuery ? t('No matches') : t('No songs in library')}</h2>
                    <p className="bw-body-sm text-muted-foreground max-w-xs">
                      {searchQuery
                        ? t('Try another title or artist.')
                        : t('Add your first song or load the curated repertoire to build your catalogue.')}
                    </p>
                  </div>
                  {!searchQuery && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <PillButton size="md" fullWidth={false} icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddSong(true)}>
                        {t('Add first song')}
                      </PillButton>
                      <PillButton size="md" variant="outline" fullWidth={false} loading={importing} onClick={() => importInputRef.current?.click()}>
                        {t('Import list (CSV/TXT)')}
                      </PillButton>
                      <PillButton size="md" variant="outline" fullWidth={false} loading={seeding} onClick={handleSeedRepertoire}>
                        {t('Load 700+ songs')}
                      </PillButton>
                    </div>
                  )}
                </Card>
              ) : (
                <ul className="flex flex-col gap-4" aria-label={t('All songs ({count})', { count: filteredSongs.length })}>
                  {filteredSongs.map((song, i) => {
                    const canPlay = !!(song.spotify_id || song.youtube_url || song.audio_url);
                    const hasChart = !!song.chart_url;
                    const open = actionMenuId === song.id;
                    return (
                      <motion.li
                        key={song.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                        className="relative"
                      >
                        <div className="flex items-center gap-3 px-4 py-3 rounded-[24px] bg-card text-card-foreground">
                          <IconButton
                            label={t('Play {title}', { title: song.title })}
                            size="sm"
                            icon={<Play />}
                            disabled={!canPlay}
                            onClick={() => handlePlaySong(song)}
                          />
                          <button
                            type="button"
                            onClick={() => setActionMenuId(open ? null : song.id)}
                            aria-haspopup="menu"
                            aria-expanded={open}
                            aria-label={t('Actions for {title}', { title: song.title })}
                            className="flex-1 min-w-0 flex items-center gap-3 text-left"
                          >
                            <span className="flex-1 min-w-0 flex flex-col gap-1">
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="bw-label-md truncate">{song.title}</span>
                                {song.status === 'suggested' && <Tag variant="outline">{t('Suggested')}</Tag>}
                                {song.status === 'learning' && <Tag>{t('Learning')}</Tag>}
                              </span>
                              <span className="bw-body-sm text-muted-foreground truncate">
                                {[song.artist, song.key].filter(Boolean).join(' · ') || t('Unknown artist')}
                              </span>
                            </span>
                            <span className="flex flex-col items-end gap-1 shrink-0">
                              <span className="bw-label-md">{formatClock(song.duration_seconds)}</span>
                              {song.bpm ? <span className="bw-label-xs text-muted-foreground">{song.bpm} BPM</span> : null}
                            </span>
                          </button>
                        </div>
                        <AnimatePresence>
                          {open && (
                            <RowMenu
                              items={[
                                ...(canPlay ? [{ label: t('Play'), icon: <Play className="w-4 h-4" />, run: () => handlePlaySong(song) }] : []),
                                ...(song.lyrics?.trim()
                                  ? [{ label: t('Lyrics'), icon: <BookOpen className="w-4 h-4" />, run: () => { setActionMenuId(null); openLyrics({ songId: song.id, title: song.title, artist: song.artist, lyrics: song.lyrics || '' }); } }]
                                  : []),
                                ...(hasChart ? [{ label: t('Open chart'), icon: <FileText className="w-4 h-4" />, run: () => handleOpenChart(song) }] : []),
                                { label: t('Edit'), icon: <Edit3 className="w-4 h-4" />, run: () => handleEditSong(song) },
                                ...(isAdmin && song.status !== 'ready'
                                  ? [{ label: t('Mark as ready'), icon: <CheckCircle2 className="w-4 h-4" />, run: () => handleSetSongStatus(song, 'ready') }]
                                  : []),
                                ...(isAdmin && song.status !== 'learning'
                                  ? [{ label: song.status === 'suggested' ? t('Approve · learning') : t('Back to learning'), icon: <Music2 className="w-4 h-4" />, run: () => handleSetSongStatus(song, 'learning') }]
                                  : []),
                                ...(isAdmin
                                  ? [{ label: t('Delete'), icon: <Trash2 className="w-4 h-4" />, run: () => handleDeleteSong(song.id), danger: true }]
                                  : []),
                              ]}
                            />
                          )}
                        </AnimatePresence>
                      </motion.li>
                    );
                  })}
                </ul>
              )
            ) : filteredSetlists.length === 0 ? (
              <Card className="items-center text-center py-10 gap-4">
                <ListMusic className="w-10 h-10 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <h2 className="bw-h3">{searchQuery ? t('No matches') : t('No setlists yet')}</h2>
                  <p className="bw-body-sm text-muted-foreground max-w-xs">
                    {searchQuery ? t('Try another name.') : t('Organise your repertoire into performance sets, weddings or gig playlists.')}
                  </p>
                </div>
                {!searchQuery && (
                  <PillButton size="md" fullWidth={false} icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddSetlist(true)}>
                    {t('Create first setlist')}
                  </PillButton>
                )}
              </Card>
            ) : (
              <ul className="flex flex-col gap-4" aria-label={t('All setlists ({count})', { count: filteredSetlists.length })}>
                {filteredSetlists.map((setlist, i) => (
                  <motion.li
                    key={setlist.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  >
                    <button
                      type="button"
                      onClick={() => openSetlistEditor(setlist.id)}
                      className="w-full flex items-center gap-3 p-4 rounded-[24px] bg-card text-card-foreground text-left active:scale-[0.99] transition-transform"
                    >
                      <span className="w-11 h-11 rounded-full bg-foreground/[0.08] flex items-center justify-center shrink-0">
                        <ListMusic className="w-5 h-5" />
                      </span>
                      <span className="flex-1 min-w-0 flex flex-col gap-1">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="bw-h3 truncate">{setlist.name}</span>
                          {setlist.is_template && <Tag variant="accent">{t('Template')}</Tag>}
                        </span>
                        <span className="bw-body-sm text-muted-foreground">{(setlist.song_count || 0) === 1 ? t('{count} song', { count: 1 }) : t('{count} songs', { count: setlist.song_count || 0 })}</span>
                      </span>
                      <span className="bw-label-md shrink-0 text-right">
                        {setlist.total_duration_seconds ? formatHoursMinutes(setlist.total_duration_seconds) : '—'}
                      </span>
                      <ChevronRight className="w-5 h-5 shrink-0" aria-hidden />
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Add Song Modal */}
      {selectedBand?.id && (
        <AddSongModal
          isOpen={showAddSong}
          onClose={() => {
            setShowAddSong(false);
            setEditingSong(null);
            setNewSong({ title: '', artist: '', bpm: '', key: '', duration: '' });
          }}
          bandId={selectedBand.id}
          song={editingSong}
          onSongAdded={fetchData}
        />
      )}

      {/* New setlist (Figma Sheet, Style=Dark) */}
      <BwSheet
        open={showAddSetlist}
        onClose={() => {
          setShowAddSetlist(false);
          setAddSetlistError(null);
        }}
        overline={t('New setlist')}
        title={t('Create setlist')}
        zIndex={80}
        footer={
          <PillButton icon={<Check className="w-[18px] h-[18px]" />} onClick={handleAddSetlist} loading={addingSetlist} disabled={!newSetlistName.trim() || addingSetlist}>
            {t('Create setlist')}
          </PillButton>
        }
      >
        <PillField
          tone="sheet"
          label={t('Setlist name *')}
          value={newSetlistName}
          onChange={(e) => setNewSetlistName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSetlist())}
          placeholder={t('Jazz night 1st set, wedding main set…')}
          autoFocus
        />
        {addSetlistError && <FormError className="mt-3">{addSetlistError}</FormError>}
      </BwSheet>

      {/* ═══ SETLIST EDITOR ═══ */}
      <AnimatePresence>
        {editingSetlistId && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            className="bw-pane-detail fixed inset-0 z-[80] bg-background text-foreground flex flex-col"
            style={{
              overscrollBehaviorX: 'none',
              touchAction: 'pan-y',
            }}
          >
            {setlistEditorLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <motion.div layoutScroll className="flex-1 overflow-y-auto">
                  <ScreenHeader
                pane
                    onBack={closeSetlistEditor}
                    backLabel={t('Back to repertoire')}
                    overline={editorSongs.length === 1 ? t('Setlist · {count} song', { count: 1 }) : t('Setlist · {count} songs', { count: editorSongs.length })}
                    title={editingSetlistName.trim() || t('Setlist')}
                    titleSize="h1"
                    actions={
                      <div className="flex items-center gap-2">
                        <IconButton
                          label={t('Export setlist as PDF')}
                          icon={exportingPdf ? <Loader2 className="animate-spin" /> : <FileText />}
                          onClick={handleExportSetlistPdf}
                          disabled={exportingPdf || editorRows.length === 0}
                        />
                        <IconButton label={t('Delete setlist')} icon={<Trash2 />} className="text-destructive border-destructive" onClick={handleDeleteSetlist} />
                      </div>
                    }
                  />

                  <div className="px-4 pt-6 pb-8 flex flex-col gap-6 max-w-2xl mx-auto w-full">
                    <PillField
                      label={t('Setlist name')}
                      value={editingSetlistName}
                      onChange={(e) => setEditingSetlistName(e.target.value)}
                      placeholder={t('Setlist name')}
                    />

                    {/* Add songs from the library */}
                    {!setlistEditorSearch ? (
                      <button
                        type="button"
                        onClick={() => setSetlistEditorSearch(true)}
                        className="flex items-center gap-3 h-[52px] px-4 rounded-full bg-field border border-border text-left"
                      >
                        <Search className="w-5 h-5 shrink-0" aria-hidden />
                        <span className="flex-1 min-w-0 truncate bw-body-lg text-muted-foreground/60">{t('Add songs from library…')}</span>
                        <Tag variant="subtle">{t('{count} available', { count: songs.length })}</Tag>
                      </button>
                    ) : (
                      <AnimatePresence>
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                          <Card className="gap-4">
                            <div className="flex items-center gap-2">
                              <SearchField
                                className="flex-1"
                                value={setlistSearchQuery}
                                onChange={setSetlistSearchQuery}
                                label={t('Search library')}
                                placeholder={t('Search library…')}
                                autoFocus
                              />
                              <IconButton
                                label={t('Close library search')}
                                variant="ghost"
                                icon={<X />}
                                onClick={() => {
                                  setSetlistEditorSearch(false);
                                  setSetlistSearchQuery('');
                                  setSetlistSelectedToAdd([]);
                                }}
                              />
                            </div>
                            {editorGenres.length > 0 && (
                              <div className="flex flex-wrap gap-2" role="group" aria-label={t('Filter by genre')}>
                                <Selector size="sm" selected={!editorGenre} onClick={() => setEditorGenre(null)}>{t('All')}</Selector>
                                {editorGenres.map((g) => (
                                  <Selector key={g} size="sm" selected={editorGenre === g} onClick={() => setEditorGenre(editorGenre === g ? null : g)}>
                                    {g}
                                  </Selector>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center justify-between bw-label-sm text-muted-foreground">
                              <span>{editorFilteredLibrary.length === 1 ? t('{count} result', { count: 1 }) : t('{count} results', { count: editorFilteredLibrary.length })}</span>
                              <span className="text-foreground">{editorItems.length === 1 ? t('{count} song in setlist', { count: 1 }) : t('{count} songs in setlist', { count: editorItems.length })}</span>
                            </div>
                            <div className="max-h-72 overflow-y-auto -mx-1 px-1 flex flex-col gap-2">
                              {editorFilteredLibrary.length === 0 && (
                                <p className="py-6 text-center bw-body-sm text-muted-foreground">{t('No matching songs')}</p>
                              )}
                              {editorFilteredLibrary.map((song) => {
                                const isSelected = editorInSetlist.has(song.id);
                                return (
                                  <button
                                    key={song.id}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => handleEditorToggleSelect(song.id)}
                                    className={cn(
                                      'w-full flex items-center gap-3 p-3 pl-4 rounded-[16px] text-left transition-colors',
                                      isSelected ? 'bg-accent text-accent-foreground' : 'bg-field text-foreground',
                                    )}
                                  >
                                    <span className="flex-1 min-w-0 flex flex-col gap-1">
                                      <span className="bw-label-md truncate">{song.title}</span>
                                      <span className={cn('bw-body-sm truncate', !isSelected && 'text-muted-foreground')}>
                                        {[song.artist || 'Unknown artist', parseGenres(song.genre).join(', ')].filter(Boolean).join(' · ')}
                                      </span>
                                    </span>
                                    <span className="bw-label-sm shrink-0">{formatClock(song.duration_seconds)}</span>
                                    {isSelected ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <Plus className="w-5 h-5 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                            <PillButton
                              size="md"
                              variant="dark"
                              icon={<Check className="w-4 h-4" />}
                              onClick={handleEditorAddSelected}
                            >
                              {t('Done')}
                            </PillButton>
                          </Card>
                        </motion.div>
                      </AnimatePresence>
                    )}

                    {/* Setlist order */}
                    <section className="flex flex-col gap-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <h2 className="bw-label-sm text-muted-foreground">{editorSongs.length === 1 ? t('Setlist order ({count} song)', { count: 1 }) : t('Setlist order ({count} songs)', { count: editorSongs.length })}</h2>
                        {editorSongs.length > 0 && (
                          <span className="bw-label-md shrink-0 text-right" aria-label={t('Total running time {duration}', { duration: formatHoursMinutes(editorTotals.seconds) })}>
                            {t('Total {duration}', { duration: formatHoursMinutes(editorTotals.seconds) })}
                          </span>
                        )}
                      </div>
                      {editorMultiSet && editorTotals.perSet.length > 1 && (
                        <div className="flex flex-wrap gap-2">
                          {editorTotals.perSet.map(([n, tot]) => (
                            <Tag key={n} className="h-6 px-2.5">
                              {tot.count === 1
                                ? t('Set {number} · {count} song · {duration}', { number: n, count: 1, duration: formatHoursMinutes(tot.seconds) })
                                : t('Set {number} · {count} songs · {duration}', { number: n, count: tot.count, duration: formatHoursMinutes(tot.seconds) })}
                            </Tag>
                          ))}
                        </div>
                      )}
                      {editorTotals.missing > 0 && (
                        <p className="bw-body-sm text-muted-foreground">
                          {editorTotals.missing === 1
                            ? t('{count} song without a duration: add it with Edit for an exact total.', { count: 1 })
                            : t('{count} songs without a duration: add it with Edit for an exact total.', { count: editorTotals.missing })}
                        </p>
                      )}
                      {editorSongs.length === 0 ? (
                        <Card className="items-center text-center py-10 gap-3">
                          <ListMusic className="w-10 h-10 text-muted-foreground" />
                          <h3 className="bw-h3">{t('Setlist is empty')}</h3>
                          <p className="bw-body-sm text-muted-foreground max-w-[240px]">{t('Tap "Add songs from library" above to build your set.')}</p>
                        </Card>
                      ) : (
                        <Reorder.Group
                          as="ol"
                          axis="y"
                          values={editorVisibleItems}
                          onReorder={handleEditorReorder}
                          className="flex flex-col gap-2"
                        >
                          {editorRows.map(({ item, fullIndex, song }, i) => {
                            const firstOfSet =
                              editorMultiSet && (fullIndex === 0 || editorSets[fullIndex] !== editorSets[fullIndex - 1]);
                            return (
                              <SetlistOrderRow
                                key={item.key}
                                item={item}
                                song={song}
                                index={i}
                                setLabel={firstOfSet ? t('Set {number}', { number: editorSetNumbers[fullIndex] }) : undefined}
                                duration={formatClock(song.duration_seconds)}
                                onRemove={() => handleEditorRemoveSong(item.key)}
                              />
                            );
                          })}
                        </Reorder.Group>
                      )}
                    </section>
                  </div>
                </motion.div>

                <div className="shrink-0 px-4 pt-3 bg-background" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
                  <div className="max-w-2xl mx-auto w-full flex flex-col gap-3">
                    {editorError && <FormError>{editorError}</FormError>}
                    <PillButton
                      onClick={handleSaveSetlist}
                      loading={setlistEditorSaving}
                      disabled={!editingSetlistName.trim() || editorLoadFailed || setlistEditorSaving}
                      icon={<Save className="w-[18px] h-[18px]" />}
                    >
                      {t('Save setlist')}
                    </PillButton>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SetlistManagerView;
