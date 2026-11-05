import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus,
  X,
  Music2,
  Clock,
  MoreHorizontal,
  Trash2,
  Edit3,
  Loader2,
  Search,
  Play,
  ListMusic,
  GripVertical,
  Check,
  Disc3,
  Timer,
  Zap,
  ArrowLeft,
  Save,
  ChevronRight,
  CheckCircle2
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { useBand } from '@/lib/BandContext';
import {
  getSongs, createSong, deleteSong,
  getSetlists, getSetlist, createSetlist, updateSetlist, deleteSetlist,
  replaceSetlistSongs, seedRepertoireSongs
} from '@/lib/services/songs';
import type { Song, Setlist } from '@/lib/services/songs';
import { AddSongModal } from '@/app/components/rehearsal/AddSongModal';

interface SetlistManagerViewProps {
  onClose: () => void;
}

type ViewMode = 'songs' | 'setlists';

export const SetlistManagerView: React.FC<SetlistManagerViewProps> = ({ onClose }) => {
  const { selectedBand } = useBand();
  const [viewMode, setViewMode] = useState<ViewMode>('songs');
  const [songs, setSongs] = useState<Song[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddSong, setShowAddSong] = useState(false);
  const [showAddSetlist, setShowAddSetlist] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const [newSong, setNewSong] = useState({
    title: '',
    artist: '',
    bpm: '',
    key: '',
    duration: ''
  });
  
  const [, setEditingSong] = useState<Song | null>(null);
  const [newSetlistName, setNewSetlistName] = useState('');

  // Setlist editor state
  const [editingSetlistId, setEditingSetlistId] = useState<string | null>(null);
  const [editingSetlistName, setEditingSetlistName] = useState('');
  const [editingSetlistSongIds, setEditingSetlistSongIds] = useState<string[]>([]);
  const [setlistEditorLoading, setSetlistEditorLoading] = useState(false);
  const [setlistEditorSaving, setSetlistEditorSaving] = useState(false);
  const [setlistEditorSearch, setSetlistEditorSearch] = useState(false);
  const [setlistSearchQuery, setSetlistSearchQuery] = useState('');
  const [setlistSelectedToAdd, setSetlistSelectedToAdd] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
    setLoading(false);
  };

  const handleAddSetlist = async () => {
    if (!selectedBand?.id || !newSetlistName.trim()) return;
    
    const { data } = await createSetlist({
      band_id: selectedBand.id,
      name: newSetlistName.trim(),
      is_template: false
    });

    if (data) {
      setSetlists(prev => [data, ...prev]);
      setNewSetlistName('');
      setShowAddSetlist(false);
    }
  };

  const handleDeleteSong = async (songId: string) => {
    const { error } = await deleteSong(songId);
    if (!error) {
      setSongs(prev => prev.filter(s => s.id !== songId));
    }
    setActionMenuId(null);
  };

  const handlePlaySong = (song: Song) => {
    if (song.spotify_id) {
      window.open(`https://open.spotify.com/track/${song.spotify_id}`, '_blank');
    } else if (song.youtube_url) {
      window.open(song.youtube_url, '_blank');
    } else if (song.audio_url) {
      window.open(song.audio_url, '_blank');
    }
    setActionMenuId(null);
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

  const handleSeedRepertoire = async () => {
    if (!selectedBand?.id || seeding) return;
    setSeeding(true);
    const { count, error } = await seedRepertoireSongs(selectedBand.id);
    if (!error && count > 0) {
      await fetchData();
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
    const totalDurationMinutes = Math.floor(totalDurationSeconds / 60);
    const hours = Math.floor(totalDurationMinutes / 60);
    const minutes = totalDurationMinutes % 60;
    
    const readySongs = songs.filter(s => s.status === 'ready').length;
    const learningSongs = songs.filter(s => s.status === 'learning').length;
    const suggestedSongs = songs.filter(s => (s as any).status === 'suggested').length;
    
    const avgBpm = songs.filter(s => s.bpm).length > 0
      ? Math.round(songs.filter(s => s.bpm).reduce((acc, s) => acc + (s.bpm || 0), 0) / songs.filter(s => s.bpm).length)
      : null;
    
    return {
      totalSongs,
      totalDuration: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      ready: readySongs,
      learning: learningSongs,
      suggested: suggestedSongs,
      avgBpm,
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
    setDraggedIndex(null);
    setDragOverIndex(null);

    const { data } = await getSetlist(setlistId);
    if (data) {
      setEditingSetlistName(data.name);
      const orderedSongIds = data.songs
        .sort((a, b) => (a.set_number - b.set_number) || (a.position - b.position))
        .map(s => s.song_id);
      setEditingSetlistSongIds(orderedSongIds);
    }
    setSetlistEditorLoading(false);
  }, []);

  const closeSetlistEditor = () => {
    setEditingSetlistId(null);
    setSetlistEditorSearch(false);
  };

  const handleSaveSetlist = useCallback(async () => {
    if (!editingSetlistId || !editingSetlistName.trim()) return;
    setSetlistEditorSaving(true);

    await updateSetlist(editingSetlistId, { name: editingSetlistName.trim() });
    await replaceSetlistSongs(editingSetlistId, editingSetlistSongIds);

    setSetlists(prev => prev.map(sl =>
      sl.id === editingSetlistId
        ? { ...sl, name: editingSetlistName.trim(), song_count: editingSetlistSongIds.length }
        : sl
    ));

    setSetlistEditorSaving(false);
    closeSetlistEditor();
  }, [editingSetlistId, editingSetlistName, editingSetlistSongIds]);

  const handleDeleteSetlist = useCallback(async () => {
    if (!editingSetlistId) return;
    const { error } = await deleteSetlist(editingSetlistId);
    if (!error) {
      setSetlists(prev => prev.filter(sl => sl.id !== editingSetlistId));
      closeSetlistEditor();
    }
  }, [editingSetlistId]);

  const handleEditorRemoveSong = (songId: string) => {
    setEditingSetlistSongIds(prev => prev.filter(id => id !== songId));
  };

  const handleEditorAddSelected = () => {
    setEditingSetlistSongIds(prev => [...prev, ...setlistSelectedToAdd]);
    setSetlistSelectedToAdd([]);
    setSetlistSearchQuery('');
    setSetlistEditorSearch(false);
  };

  const handleEditorToggleSelect = (songId: string) => {
    setSetlistSelectedToAdd(prev =>
      prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]
    );
  };

  const handleEditorDragStart = (index: number) => setDraggedIndex(index);

  const handleEditorDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleEditorDragEnd = () => {
    if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    setEditingSetlistSongIds(prev => {
      const next = [...prev];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(dragOverIndex, 0, moved);
      return next;
    });
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const editorSongs = useMemo(() =>
    editingSetlistSongIds.map(id => songs.find(s => s.id === id)).filter(Boolean) as Song[],
    [editingSetlistSongIds, songs]
  );

  const editorFilteredLibrary = useMemo(() => {
    let result = songs.filter(s => !editingSetlistSongIds.includes(s.id));
    if (setlistSearchQuery) {
      const q = setlistSearchQuery.toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [songs, editingSetlistSongIds, setlistSearchQuery]);

  // ── Render ──

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[70] bg-background text-foreground flex flex-col overflow-y-auto"
      style={{
        overscrollBehaviorX: 'none',
        touchAction: 'pan-y',
      }}
    >
      {/* ═══ STICKY HEADER ═══ */}
      <div
        className="px-4 shrink-0 border-b border-foreground/10 bg-background/95 backdrop-blur-md sticky top-0 z-30"
        style={{
          paddingTop: 'var(--wizard-header-pt, max(env(safe-area-inset-top, 0px), 56px))',
          paddingBottom: '14px',
        }}
      >
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              aria-label="Go back"
              className="w-10 h-10 rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground transition-all active:scale-90 shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                MUSIC & REPERTOIRE
              </span>
              <h1 className="text-[22px] font-black uppercase text-foreground leading-none">
                SETLISTS & SONGS
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => (viewMode === 'songs' ? setShowAddSong(true) : setShowAddSetlist(true))}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs active:scale-95 transition-all shrink-0"
            aria-label="Add item"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="p-4 flex-1 flex flex-col gap-5 max-w-2xl mx-auto w-full pb-32">
        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('songs')}
            className={cn(
              'flex-1 py-2.5 rounded-[10px] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border',
              viewMode === 'songs'
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'bg-foreground/5 text-foreground/70 border-foreground/10 hover:bg-foreground/10'
            )}
          >
            <Music2 className="w-4 h-4" />
            Songs ({songs.length})
          </button>
          <button
            onClick={() => setViewMode('setlists')}
            className={cn(
              'flex-1 py-2.5 rounded-[10px] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border',
              viewMode === 'setlists'
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'bg-foreground/5 text-foreground/70 border-foreground/10 hover:bg-foreground/10'
            )}
          >
            <ListMusic className="w-4 h-4" />
            Setlists ({setlists.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={viewMode === 'songs' ? 'Search songs by title or artist...' : 'Search setlists...'}
            className="w-full px-4 py-2.5 pl-10 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary transition-colors"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-foreground/30" />
          </div>
        ) : (
          <>
            {/* Stats Card */}
            {(songs.length > 0 || setlists.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-[16px] p-5 border border-foreground/10 shadow-xs flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                      BAND REPERTOIRE
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-3xl font-black text-foreground">{stats.totalSongs}</span>
                      <span className="text-xs font-semibold text-foreground/50">total songs</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-[10px] bg-foreground/5 flex items-center justify-center text-foreground/70">
                    <Disc3 className="w-5 h-5 text-primary" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-foreground/5 rounded-[10px] p-3 border border-foreground/5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Timer className="w-3.5 h-3.5 text-foreground/50" />
                      <span className="text-[10px] font-bold text-foreground/50 uppercase">Duration</span>
                    </div>
                    <span className="text-base font-bold text-foreground">{stats.totalDuration || '0m'}</span>
                  </div>

                  <div className="bg-foreground/5 rounded-[10px] p-3 border border-foreground/5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ListMusic className="w-3.5 h-3.5 text-foreground/50" />
                      <span className="text-[10px] font-bold text-foreground/50 uppercase">Setlists</span>
                    </div>
                    <span className="text-base font-bold text-foreground">{stats.totalSetlists}</span>
                  </div>

                  <div className="bg-foreground/5 rounded-[10px] p-3 border border-foreground/5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="w-3.5 h-3.5 text-foreground/50" />
                      <span className="text-[10px] font-bold text-foreground/50 uppercase">Avg BPM</span>
                    </div>
                    <span className="text-base font-bold text-foreground">{stats.avgBpm || '-'}</span>
                  </div>
                </div>

                {stats.totalSongs > 0 && (
                  <div className="pt-2 border-t border-foreground/10">
                    <div className="flex items-center justify-between text-[10px] font-bold text-foreground/50 mb-2">
                      <span>STATUS READINESS</span>
                      <span>{stats.ready} of {stats.totalSongs} ready</span>
                    </div>
                    <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden flex">
                      <div style={{ width: `${(stats.ready / stats.totalSongs) * 100}%` }} className="bg-green-500 h-full" />
                      <div style={{ width: `${(stats.learning / stats.totalSongs) * 100}%` }} className="bg-amber-500 h-full" />
                      <div style={{ width: `${(stats.suggested / stats.totalSongs) * 100}%` }} className="bg-foreground/30 h-full" />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-[10px] font-semibold text-foreground/60">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> Ready ({stats.ready})</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Learning ({stats.learning})</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-foreground/30" /> Suggested ({stats.suggested})</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* List Section */}
            {viewMode === 'songs' ? (
              filteredSongs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-foreground/40 text-center">
                  <Music2 className="w-12 h-12 mb-3 text-foreground/20" />
                  <p className="font-bold text-base text-foreground mb-1">No songs in library</p>
                  <p className="text-xs text-foreground/50 max-w-xs">Add your first song or load the curated repertoire to build your catalog.</p>
                  <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                    <button 
                      onClick={() => setShowAddSong(true)}
                      className="px-4 py-2.5 bg-primary text-primary-foreground rounded-[10px] font-bold text-xs uppercase tracking-wider shadow-xs hover:opacity-95 transition-opacity"
                    >
                      Add First Song
                    </button>
                    <button
                      onClick={handleSeedRepertoire}
                      disabled={seeding}
                      className="px-4 py-2.5 bg-foreground/10 hover:bg-foreground/15 text-foreground rounded-[10px] font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                      {seeding ? (
                        <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</span>
                      ) : (
                        'Load 700+ Songs'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                      ALL SONGS ({filteredSongs.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {filteredSongs.map((song, i) => (
                      <motion.div
                        key={song.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                        className="bg-card rounded-[14px] p-3.5 border border-foreground/10 shadow-xs flex items-center gap-3 relative hover:border-foreground/20 transition-all"
                      >
                        <div className="text-foreground/30 cursor-grab shrink-0">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-foreground truncate">{song.title}</h3>
                          <div className="flex items-center gap-2.5 mt-0.5">
                            {song.artist && <span className="text-xs text-foreground/60 truncate">{song.artist}</span>}
                            {song.bpm && <span className="text-[11px] text-foreground/40 font-medium">{song.bpm} BPM</span>}
                            {song.key && (
                              <span className="text-[10px] bg-foreground/10 text-foreground px-1.5 py-0.5 rounded-[4px] font-semibold">
                                {song.key}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-foreground/40 shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">{formatDuration(song.duration_seconds)}</span>
                        </div>

                        <span className={cn(
                          'text-[9px] font-bold uppercase px-2 py-0.5 rounded-[6px] shrink-0 border',
                          song.status === 'ready'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                            : song.status === 'learning'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : 'bg-foreground/5 text-foreground/50 border-foreground/10'
                        )}>
                          {song.status}
                        </span>

                        <div className="relative shrink-0">
                          <button 
                            onClick={() => setActionMenuId(actionMenuId === song.id ? null : song.id)}
                            aria-label="Actions"
                            className="w-8 h-8 rounded-full hover:bg-foreground/10 flex items-center justify-center transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4 text-foreground/50" />
                          </button>
                          <AnimatePresence>
                            {actionMenuId === song.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="absolute right-0 top-9 bg-card rounded-[12px] shadow-lg border border-foreground/15 p-1 z-20 min-w-[140px]"
                              >
                                <button
                                  onClick={() => handlePlaySong(song)}
                                  className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-foreground/5 rounded-[8px] text-left text-xs font-semibold text-foreground transition-colors"
                                >
                                  <Play className="w-3.5 h-3.5 text-foreground/60" /> Play
                                </button>
                                <button
                                  onClick={() => handleEditSong(song)}
                                  className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-foreground/5 rounded-[8px] text-left text-xs font-semibold text-foreground transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-foreground/60" /> Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteSong(song.id)}
                                  className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-destructive/10 rounded-[8px] text-left text-xs font-semibold text-destructive transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              filteredSetlists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-foreground/40 text-center">
                  <ListMusic className="w-12 h-12 mb-3 text-foreground/20" />
                  <p className="font-bold text-base text-foreground mb-1">No setlists created</p>
                  <p className="text-xs text-foreground/50 max-w-xs">Organize your repertoire into performance sets, weddings, or gig playlists.</p>
                  <button 
                    onClick={() => setShowAddSetlist(true)}
                    className="mt-5 px-4 py-2.5 bg-primary text-primary-foreground rounded-[10px] font-bold text-xs uppercase tracking-wider shadow-xs hover:opacity-95 transition-opacity"
                  >
                    Create First Setlist
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                      ALL SETLISTS ({filteredSetlists.length})
                    </span>
                  </div>
                  {filteredSetlists.map((setlist, i) => (
                    <motion.div
                      key={setlist.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.3) }}
                      onClick={() => openSetlistEditor(setlist.id)}
                      className="bg-card rounded-[16px] p-4 border border-foreground/10 shadow-xs cursor-pointer hover:border-foreground/20 hover:shadow-md transition-all active:scale-[0.99] group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                          {setlist.name}
                        </h3>
                        <div className="flex items-center gap-2">
                          {setlist.is_template && (
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-primary/10 text-primary rounded-[6px] border border-primary/20">
                              Template
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-foreground/30 group-hover:text-foreground/70 transition-colors" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-foreground/50">
                        <span className="flex items-center gap-1.5">
                          <Music2 className="w-3.5 h-3.5 text-foreground/40" />
                          {setlist.song_count || 0} songs
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-foreground/40" />
                          {formatDuration(setlist.total_duration_seconds)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )
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
          onSongAdded={fetchData}
        />
      )}

      {/* Add Setlist Modal */}
      <AnimatePresence>
        {showAddSetlist && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowAddSetlist(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="w-full max-w-md bg-card border-t border-foreground/10 rounded-t-[24px] p-6 shadow-2xl"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-foreground/20 rounded-full mx-auto mb-5" />
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                    NEW SETLIST
                  </span>
                  <h2 className="text-xl font-black text-foreground">Create Setlist</h2>
                </div>
                <button
                  onClick={() => setShowAddSetlist(false)}
                  className="w-8 h-8 rounded-full border border-foreground/20 bg-foreground/5 flex items-center justify-center text-foreground hover:bg-foreground/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-foreground/50 uppercase tracking-wider mb-2">
                    Setlist Name *
                  </label>
                  <input
                    type="text"
                    value={newSetlistName}
                    onChange={(e) => setNewSetlistName(e.target.value)}
                    placeholder="e.g., Jazz Night 1st Set, Wedding Main Set"
                    className="w-full h-12 px-4 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary transition-colors"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleAddSetlist}
                  disabled={!newSetlistName.trim()}
                  className={cn(
                    'w-full h-12 rounded-[12px] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-primary text-primary-foreground shadow-xs active:scale-[0.98]',
                    !newSetlistName.trim() && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Check className="w-4 h-4" />
                  Create Setlist
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ SETLIST EDITOR OVERLAY ═══ */}
      <AnimatePresence>
        {editingSetlistId && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-0 z-[80] bg-background text-foreground flex flex-col overflow-y-auto"
            style={{
              overscrollBehaviorX: 'none',
              touchAction: 'pan-y',
            }}
          >
            {setlistEditorLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-foreground/30" />
              </div>
            ) : (
              <>
                {/* Editor Sticky Header */}
                <div
                  className="px-4 shrink-0 border-b border-foreground/10 bg-background/95 backdrop-blur-md sticky top-0 z-30"
                  style={{
                    paddingTop: 'var(--wizard-header-pt, max(env(safe-area-inset-top, 0px), 56px))',
                    paddingBottom: '14px',
                  }}
                >
                  <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
                    <button
                      onClick={closeSetlistEditor}
                      className="flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors font-bold text-xs uppercase tracking-wider"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Repertoire
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDeleteSetlist}
                        aria-label="Delete setlist"
                        className="w-9 h-9 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleSaveSetlist}
                        disabled={setlistEditorSaving || !editingSetlistName.trim()}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-[10px] font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-xs hover:opacity-95 transition-all disabled:opacity-50"
                      >
                        {setlistEditorSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save Setlist
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col gap-4 max-w-2xl mx-auto w-full pb-20 relative">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 mb-1 block">
                      SETLIST NAME
                    </label>
                    <input
                      type="text"
                      value={editingSetlistName}
                      onChange={(e) => setEditingSetlistName(e.target.value)}
                      className="w-full text-2xl font-black bg-transparent border-b border-foreground/15 focus:border-primary outline-none placeholder:text-foreground/20 pb-2 text-foreground transition-colors"
                      placeholder="Setlist Name"
                    />
                  </div>

                  {/* Add Songs Trigger */}
                  {!setlistEditorSearch && (
                    <button
                      onClick={() => setSetlistEditorSearch(true)}
                      className="w-full bg-foreground/5 border border-foreground/10 p-3 rounded-[12px] flex items-center gap-3 hover:bg-foreground/10 transition-colors group"
                    >
                      <Search className="w-4 h-4 text-foreground/40" />
                      <span className="text-xs font-bold text-foreground/50 group-hover:text-foreground/80">
                        Add songs from library...
                      </span>
                      <div className="ml-auto bg-card px-2 py-0.5 rounded-[6px] text-[10px] font-bold text-foreground/60 border border-foreground/10 shadow-xs">
                        {songs.length} available
                      </div>
                    </button>
                  )}

                  {/* Search Overlay */}
                  <AnimatePresence>
                    {setlistEditorSearch && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="bg-card border border-foreground/15 rounded-[16px] overflow-hidden shadow-2xl flex flex-col"
                      >
                        <div className="p-3 border-b border-foreground/10 flex items-center gap-3 bg-card shrink-0">
                          <Search className="w-4 h-4 text-foreground/50" />
                          <input
                            autoFocus
                            placeholder="Search library..."
                            value={setlistSearchQuery}
                            onChange={e => setSetlistSearchQuery(e.target.value)}
                            className="flex-1 text-xs font-bold outline-none bg-transparent text-foreground placeholder:text-foreground/30"
                          />
                          <button 
                            onClick={() => { setSetlistEditorSearch(false); setSetlistSearchQuery(''); setSetlistSelectedToAdd([]); }} 
                            className="p-1.5 rounded-full hover:bg-foreground/10 text-foreground/60 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="px-3 py-1.5 bg-foreground/5 border-b border-foreground/10 flex items-center justify-between shrink-0">
                          <span className="text-[10px] font-bold text-foreground/40">{editorFilteredLibrary.length} results</span>
                          {setlistSelectedToAdd.length > 0 && (
                            <span className="text-[10px] font-bold text-primary">{setlistSelectedToAdd.length} selected</span>
                          )}
                        </div>

                        <div className="max-h-64 overflow-y-auto p-2 space-y-1.5">
                          {editorFilteredLibrary.length === 0 && (
                            <div className="p-6 text-center text-foreground/40">
                              <p className="text-xs font-bold">No matching songs</p>
                            </div>
                          )}
                          {editorFilteredLibrary.map(song => {
                            const isSelected = setlistSelectedToAdd.includes(song.id);
                            return (
                              <button
                                key={song.id}
                                onClick={() => handleEditorToggleSelect(song.id)}
                                className={cn(
                                  'w-full p-2.5 rounded-[10px] flex items-center justify-between transition-all text-left border',
                                  isSelected 
                                    ? 'border-primary bg-primary/10 text-foreground' 
                                    : 'border-foreground/5 bg-card hover:border-foreground/20 text-foreground'
                                )}
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-xs truncate">{song.title}</div>
                                  <div className="text-[10px] text-foreground/50 uppercase">
                                    {song.artist || 'Unknown'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <span className="text-[10px] font-medium text-foreground/40">
                                    {formatDuration(song.duration_seconds)}
                                  </span>
                                  {isSelected ? (
                                    <CheckCircle2 className="w-4 h-4 text-primary" />
                                  ) : (
                                    <Plus className="w-4 h-4 text-foreground/30" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <div className="p-3 border-t border-foreground/10 bg-card shrink-0">
                          <button
                            onClick={handleEditorAddSelected}
                            disabled={setlistSelectedToAdd.length === 0}
                            className="w-full py-2.5 bg-primary text-primary-foreground rounded-[10px] text-xs font-bold uppercase tracking-wider shadow-xs hover:opacity-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            Add {setlistSelectedToAdd.length} Songs <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Songs in this Setlist */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                      SETLIST ORDER ({editorSongs.length} SONGS)
                    </span>
                  </div>

                  {editorSongs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-16 text-foreground/40 border border-dashed border-foreground/15 rounded-[16px] p-6">
                      <ListMusic className="w-10 h-10 mb-3 text-foreground/20" />
                      <h4 className="text-sm font-bold text-foreground">Setlist is empty</h4>
                      <p className="text-xs text-foreground/40 mt-1 max-w-[240px]">
                        Tap "Add songs from library" above to populate your set.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {editorSongs.map((song, i) => (
                        <div
                          key={`${song.id}-${i}`}
                          draggable
                          onDragStart={() => handleEditorDragStart(i)}
                          onDragOver={(e) => handleEditorDragOver(e, i)}
                          onDragEnd={handleEditorDragEnd}
                          className={cn(
                            'bg-card border p-3 rounded-[12px] flex items-center gap-3 shadow-xs transition-all cursor-grab active:cursor-grabbing select-none',
                            draggedIndex === i && 'opacity-40 scale-95',
                            dragOverIndex === i && draggedIndex !== null && draggedIndex !== i && 'border-primary ring-2 ring-primary/20',
                            draggedIndex === null && 'border-foreground/10 hover:border-foreground/20'
                          )}
                        >
                          <GripVertical className="w-4 h-4 text-foreground/30 shrink-0" />
                          <div className="w-6 h-6 rounded-full bg-foreground/10 text-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs truncate text-foreground">{song.title}</div>
                            <div className="text-[10px] text-foreground/50 uppercase truncate">{song.artist || 'Unknown'}</div>
                          </div>
                          <span className="text-[10px] font-medium text-foreground/40 shrink-0">
                            {formatDuration(song.duration_seconds)}
                          </span>
                          <button
                            onClick={() => handleEditorRemoveSong(song.id)}
                            className="p-1.5 text-foreground/30 hover:text-destructive hover:bg-destructive/10 rounded-[6px] transition-colors shrink-0"
                            aria-label="Remove song"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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