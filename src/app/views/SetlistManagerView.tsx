import React, { useState, useEffect, useMemo } from 'react';
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
  Zap
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { useBand } from '@/lib/BandContext';
import { getSongs, createSong, deleteSong, getSetlists, createSetlist } from '@/lib/services/songs';
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

  // New song form
  const [newSong, setNewSong] = useState({
    title: '',
    artist: '',
    bpm: '',
    key: '',
    duration: ''
  });
  
  // Song being edited
  const [editingSong, setEditingSong] = useState<Song | null>(null);

  // New setlist form
  const [newSetlistName, setNewSetlistName] = useState('');

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

  const handleAddSong = async () => {
    if (!selectedBand?.id || !newSong.title) return;
    
    const { data, error } = await createSong({
      band_id: selectedBand.id,
      title: newSong.title,
      artist: newSong.artist || undefined,
      bpm: newSong.bpm ? parseInt(newSong.bpm) : undefined,
      key: newSong.key || undefined,
      duration_seconds: newSong.duration ? parseInt(newSong.duration) * 60 : undefined,
      status: 'ready',
      priority: 'medium'
    });

    if (data) {
      setSongs(prev => [data, ...prev]);
      setNewSong({ title: '', artist: '', bpm: '', key: '', duration: '' });
      setShowAddSong(false);
    }
  };

  const handleAddSetlist = async () => {
    if (!selectedBand?.id || !newSetlistName) return;
    
    const { data, error } = await createSetlist({
      band_id: selectedBand.id,
      name: newSetlistName,
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
    // Open in a new tab if there's a Spotify/YouTube link, otherwise show an alert
    if (song.spotify_url) {
      window.open(song.spotify_url, '_blank');
    } else if (song.youtube_url) {
      window.open(song.youtube_url, '_blank');
    } else {
      // Could implement an audio player here in the future
      alert(`Playing: ${song.title}${song.artist ? ` by ${song.artist}` : ''}`);
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

  // Calculate stats for hero card
  const stats = useMemo(() => {
    const totalSongs = songs.length;
    const totalDurationSeconds = songs.reduce((acc, song) => acc + (song.duration_seconds || 0), 0);
    const totalDurationMinutes = Math.floor(totalDurationSeconds / 60);
    const hours = Math.floor(totalDurationMinutes / 60);
    const minutes = totalDurationMinutes % 60;
    
    const readySongs = songs.filter(s => s.status === 'ready').length;
    const learningSongs = songs.filter(s => s.status === 'learning').length;
    const suggestedSongs = songs.filter(s => s.status === 'suggested').length;
    
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

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-[70] bg-[#E6E5E1] overflow-y-auto"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Header */}
      <div className="px-6 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Music</p>
            <h1 className="text-4xl font-black text-black tracking-tight uppercase">REPERTOIRE</h1>
            <p className="text-sm text-black/50 font-bold tracking-tight mt-1">{selectedBand?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => viewMode === 'songs' ? setShowAddSong(true) : setShowAddSetlist(true)}
              className="w-12 h-12 rounded-full bg-[#D4FB46] flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5 text-black" />
            </button>
            <button
              onClick={onClose}
              className="w-12 h-12 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-all"
            >
              <X className="w-6 h-6 text-black/50" />
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode('songs')}
            className={cn(
              "flex-1 py-3 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2",
              viewMode === 'songs'
                ? "bg-black text-white"
                : "bg-white/60 text-black/50 hover:bg-white"
            )}
          >
            <Music2 className="w-4 h-4" />
            Songs ({songs.length})
          </button>
          <button
            onClick={() => setViewMode('setlists')}
            className={cn(
              "flex-1 py-3 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2",
              viewMode === 'setlists'
                ? "bg-black text-white"
                : "bg-white/60 text-black/50 hover:bg-white"
            )}
          >
            <ListMusic className="w-4 h-4" />
            Setlists ({setlists.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={viewMode === 'songs' ? "Search songs..." : "Search setlists..."}
            className="w-full h-12 pl-11 pr-4 rounded-2xl bg-white text-sm font-medium text-black placeholder:text-black/30 border border-black/5 focus:outline-none focus:border-black/20 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-32">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-black/40" />
          </div>
        ) : (
          <>
            {/* Hero Card - Repertoire Overview */}
            {(songs.length > 0 || setlists.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-6 p-6 bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2E] rounded-[2rem] relative overflow-hidden shadow-xl"
              >
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4FB46]/5 rounded-full blur-2xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl" />
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[#D4FB46] text-[10px] font-bold uppercase tracking-widest block mb-1">Repertoire</span>
                      <div className="flex items-baseline gap-3">
                        <h3 className="text-4xl font-black text-white tracking-tighter">{stats.totalSongs}</h3>
                        <span className="text-stone-500 text-lg font-medium">songs</span>
                      </div>
                    </div>
                    <div className="w-14 h-14 bg-gradient-to-br from-[#D4FB46] to-[#9EE62D] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(212,251,70,0.3)]">
                      <Disc3 className="w-7 h-7 text-[#1A1A1A]" />
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="bg-white/5 rounded-xl p-3 border border-white/10"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Timer className="w-4 h-4 text-[#D4FB46]" />
                        <span className="text-[10px] font-bold text-stone-500 uppercase">Duration</span>
                      </div>
                      <span className="text-xl font-black text-white">{stats.totalDuration || '0m'}</span>
                    </motion.div>
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.25 }}
                      className="bg-white/5 rounded-xl p-3 border border-white/10"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <ListMusic className="w-4 h-4 text-purple-400" />
                        <span className="text-[10px] font-bold text-stone-500 uppercase">Setlists</span>
                      </div>
                      <span className="text-xl font-black text-white">{stats.totalSetlists}</span>
                    </motion.div>
                    {stats.avgBpm && (
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white/5 rounded-xl p-3 border border-white/10"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="w-4 h-4 text-amber-400" />
                          <span className="text-[10px] font-bold text-stone-500 uppercase">Avg BPM</span>
                        </div>
                        <span className="text-xl font-black text-white">{stats.avgBpm}</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Status Progress */}
                  {stats.totalSongs > 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35 }}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-stone-500 mb-2">
                        <span>SONG STATUS</span>
                        <span>{stats.ready} of {stats.totalSongs} ready</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(stats.ready / stats.totalSongs) * 100}%` }}
                          transition={{ delay: 0.4, duration: 0.5, ease: "easeOut" }}
                          className="bg-green-500 h-full"
                        />
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(stats.learning / stats.totalSongs) * 100}%` }}
                          transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
                          className="bg-yellow-500 h-full"
                        />
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(stats.suggested / stats.totalSongs) * 100}%` }}
                          transition={{ delay: 0.6, duration: 0.5, ease: "easeOut" }}
                          className="bg-stone-500 h-full"
                        />
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-[10px] font-bold">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Ready</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Learning</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-stone-500" /> Suggested</span>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {viewMode === 'songs' ? (
              /* Songs List */
              filteredSongs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-black/40">
                  <Music2 className="w-16 h-16 mb-4" />
                  <p className="font-bold text-lg mb-2">No songs yet</p>
                  <p className="text-sm text-center">Add songs to build your repertoire</p>
                  <button 
                    onClick={() => setShowAddSong(true)}
                    className="mt-6 px-6 py-3 bg-black text-white rounded-full font-bold text-sm hover:scale-105 transition-transform"
                  >
                    Add First Song
                  </button>
                </div>
              ) : (
                <>
                  <h4 className="text-[10px] font-bold text-black/40 uppercase tracking-widest mb-3 px-1">All Songs</h4>
                  <div className="space-y-2">
                    {filteredSongs.map((song, i) => (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-white rounded-xl p-4 border border-black/5 shadow-sm flex items-center gap-4 relative"
                >
                  {/* Drag Handle */}
                  <div className="text-black/20 cursor-grab">
                    <GripVertical className="w-5 h-5" />
                  </div>

                  {/* Song Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-black truncate">{song.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      {song.artist && (
                        <span className="text-xs text-black/50 truncate">{song.artist}</span>
                      )}
                      {song.bpm && (
                        <span className="text-xs text-black/40">{song.bpm} BPM</span>
                      )}
                      {song.key && (
                        <span className="text-xs bg-black/5 px-1.5 py-0.5 rounded font-medium">{song.key}</span>
                      )}
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-1 text-black/40">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-medium">{formatDuration(song.duration_seconds)}</span>
                  </div>

                  {/* Status Badge */}
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-1 rounded-full",
                    song.status === 'ready' ? "bg-green-100 text-green-600" :
                    song.status === 'learning' ? "bg-yellow-100 text-yellow-600" :
                    "bg-black/5 text-black/50"
                  )}>
                    {song.status}
                  </span>

                  {/* Actions */}
                  <div className="relative">
                    <button 
                      onClick={() => setActionMenuId(actionMenuId === song.id ? null : song.id)}
                      className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5 text-black/40" />
                    </button>

                    <AnimatePresence>
                      {actionMenuId === song.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="absolute right-0 top-10 bg-white rounded-xl shadow-xl border border-black/10 overflow-hidden z-20 min-w-[140px]"
                        >
                          <button 
                            onClick={() => handlePlaySong(song)}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/80 text-left text-sm font-medium"
                          >
                            <Play className="w-4 h-4 text-black/40" />
                            Play
                          </button>
                          <button 
                            onClick={() => handleEditSong(song)}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/80 text-left text-sm font-medium"
                          >
                            <Edit3 className="w-4 h-4 text-black/40" />
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteSong(song.id)}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 text-left text-sm font-medium text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
                  </div>
                </>
              )
            ) : (
              /* Setlists List */
          filteredSetlists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-black/40">
              <ListMusic className="w-16 h-16 mb-4" />
              <p className="font-bold text-lg mb-2">No setlists yet</p>
              <p className="text-sm text-center">Create setlists to organize your performances</p>
              <button 
                onClick={() => setShowAddSetlist(true)}
                className="mt-6 px-6 py-3 bg-black text-white rounded-full font-bold text-sm hover:scale-105 transition-transform"
              >
                Create First Setlist
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSetlists.map((setlist, i) => (
                <motion.div
                  key={setlist.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-[1.5rem] p-5 border border-black/5 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-lg text-black">{setlist.name}</h3>
                    {setlist.is_template && (
                      <span className="text-[10px] font-bold uppercase px-2 py-1 bg-[#D4FB46] text-black rounded-full">
                        Template
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-black/50">
                    <span className="flex items-center gap-1">
                      <Music2 className="w-4 h-4" />
                      {setlist.song_count || 0} songs
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
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
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="w-full max-w-md bg-white rounded-t-[2rem] p-6"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-black/10 rounded-full mx-auto mb-6" />
              
              <h2 className="text-2xl font-black text-black mb-6">Create Setlist</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-black/40 uppercase tracking-widest mb-2">Name *</label>
                  <input
                    type="text"
                    value={newSetlistName}
                    onChange={(e) => setNewSetlistName(e.target.value)}
                    placeholder="e.g., Jazz Night Set"
                    className="w-full h-14 px-4 rounded-2xl bg-black/[0.03] text-black font-medium placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-[#D4FB46]"
                  />
                </div>

                <button
                  onClick={handleAddSetlist}
                  disabled={!newSetlistName}
                  className={cn(
                    "w-full h-14 rounded-full font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-black text-white hover:scale-[1.02] active:scale-[0.98]",
                    !newSetlistName && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Check className="w-5 h-5" />
                  Create Setlist
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
