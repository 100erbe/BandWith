import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { ListMusic, Search, Plus, Trash2, Save, Copy, CheckCircle2, History, Clock, Check, AlertCircle, X, ChevronRight, Music, Link, GripVertical } from 'lucide-react';
import { RehearsalSong, SetlistTemplate, RehearsalState } from './types';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { createSong } from '@/lib/services/songs';

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTemplate: SetlistTemplate | null;
  library: RehearsalSong[];
  onSave: (template: SetlistTemplate) => void;
  onCreate: (template: SetlistTemplate) => void;
  currentUserInitials: string;
  bandId?: string;
  onSongCreated?: (song: RehearsalSong) => void;
}

export const RehearsalSetlistEditorModal: React.FC<Props> = ({ 
  isOpen, onClose, initialTemplate, library, onSave, onCreate, currentUserInitials, bandId, onSongCreated 
}) => {
  // Local State
  const [name, setName] = useState('');
  const [currentSongIds, setCurrentSongIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideAlreadyInList, setHideAlreadyInList] = useState(true);
  const [selectedToAddIds, setSelectedToAddIds] = useState<string[]>([]); 
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [overlayTab, setOverlayTab] = useState<'library' | 'add'>('library');
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const initialNameRef = useRef('');
  const initialSongIdsRef = useRef<string[]>([]);

  // Initialize
  useEffect(() => {
    if (isOpen) {
        if (initialTemplate) {
            setName(initialTemplate.name);
            setCurrentSongIds(initialTemplate.songIds);
            initialNameRef.current = initialTemplate.name;
            initialSongIdsRef.current = initialTemplate.songIds;
        } else {
            setName('New Setlist');
            setCurrentSongIds([]);
            initialNameRef.current = 'New Setlist';
            initialSongIdsRef.current = [];
        }
        setSearchQuery('');
        setSelectedToAddIds([]);
        setIsSearchExpanded(false);
        setOverlayTab('library');
        setNewTitle('');
        setNewArtist('');
        setNewUrl('');
    }
  }, [isOpen, initialTemplate]);

  const hasChanges = useMemo(() => {
    if (name !== initialNameRef.current) return true;
    if (currentSongIds.length !== initialSongIdsRef.current.length) return true;
    return currentSongIds.some((id, i) => id !== initialSongIdsRef.current[i]);
  }, [name, currentSongIds]);

  // Derived Songs (Current List)
  const currentSongs = useMemo(() => {
      return currentSongIds.map(id => library.find(s => s.id === id)).filter(Boolean) as RehearsalSong[];
  }, [currentSongIds, library]);

  // Filtered Library for Search Overlay
  const filteredLibrary = useMemo(() => {
      let result = library;
      
      if (hideAlreadyInList) {
          result = result.filter(s => !currentSongIds.includes(s.id));
      }

      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          result = result.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
      }

      return result;
  }, [library, currentSongIds, hideAlreadyInList, searchQuery]);

  // Grouped by Category for Better UX
  const groupedLibrary = useMemo(() => {
      const groups: Record<string, RehearsalSong[]> = {};
      filteredLibrary.forEach(song => {
          const cat = song.category || 'Uncategorized';
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(song);
      });
      return groups;
  }, [filteredLibrary]);

  const handleToggleSelectToAdd = (id: string) => {
      setSelectedToAddIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleAddSelected = () => {
      setCurrentSongIds(prev => [...prev, ...selectedToAddIds]);
      setSelectedToAddIds([]);
      setSearchQuery('');
      setIsSearchExpanded(false);
  };

  const handleRemoveSong = (id: string) => {
      setCurrentSongIds(prev => prev.filter(sid => sid !== id));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    setCurrentSongIds(prev => {
      const newIds = [...prev];
      const [moved] = newIds.splice(draggedIndex, 1);
      newIds.splice(dragOverIndex, 0, moved);
      return newIds;
    });
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleAddNewSong = useCallback(async () => {
    if (!newTitle.trim() || !bandId) return;
    setSaving(true);

    const urlFields = newUrl.trim() ? detectUrlType(newUrl.trim()) : {};
    const songData = {
      band_id: bandId,
      title: newTitle.trim(),
      artist: newArtist.trim() || undefined,
      status: 'ready' as const,
      priority: 'medium' as const,
      ...urlFields,
    };

    const { data: created } = await createSong(songData);
    setSaving(false);

    if (created) {
      const rehearsalSong: RehearsalSong = {
        id: created.id,
        title: created.title,
        artist: created.artist || '',
        duration: created.duration_seconds
          ? `${Math.floor(created.duration_seconds / 60)}:${String(created.duration_seconds % 60).padStart(2, '0')}`
          : '0:00',
        priority: 'medium',
        type: 'song',
        category: created.category,
      };
      onSongCreated?.(rehearsalSong);
      setCurrentSongIds(prev => [...prev, created.id]);
      setNewTitle('');
      setNewArtist('');
      setNewUrl('');
      setOverlayTab('library');
    }
  }, [newTitle, newArtist, newUrl, bandId, onSongCreated]);

  const handleSaveAction = (asNew: boolean) => {
      if (!name) return;

      const now = new Date().toISOString();
      let template: SetlistTemplate;

      if (!asNew && initialTemplate) {
          // Update existing
          template = {
              ...initialTemplate,
              name,
              songIds: currentSongIds,
              version: initialTemplate.version + 1,
              updatedAt: now,
              updatedBy: currentUserInitials,
              lastChangeSummary: {
                  added: currentSongIds.length - initialTemplate.songIds.length > 0 ? currentSongIds.length - initialTemplate.songIds.length : 0,
                  removed: initialTemplate.songIds.length - currentSongIds.length > 0 ? initialTemplate.songIds.length - currentSongIds.length : 0
              }
          };
          onSave(template);
      } else {
          // Create new / Save as New
          template = {
              id: `tpl-${Date.now()}`,
              name: asNew && initialTemplate ? `${name} (Copy)` : name,
              songIds: currentSongIds,
              version: 1,
              updatedAt: now,
              updatedBy: currentUserInitials,
              derivedFromId: asNew && initialTemplate ? initialTemplate.id : undefined
          };
          onCreate(template);
      }
      onClose();
  };

  return (
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title={initialTemplate ? "Edit Setlist" : "New Setlist"} icon={ListMusic}>
        <div className="flex flex-col h-[85vh] md:h-[75vh] w-full relative">
            
            {/* Header / Meta (Hidden when Search Expanded on Mobile) */}
            <div className={cn("flex flex-col md:flex-row md:items-start md:justify-between mb-4 shrink-0 gap-2", isSearchExpanded ? "hidden md:flex" : "flex")}>
                <div className="w-full md:max-w-sm">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1 block">Setlist Name</label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full text-2xl font-black bg-transparent border-b-2 border-white/30 focus:border-white outline-none placeholder:text-white/30 text-white"
                        placeholder="e.g. Summer Tour 2026"
                    />
                </div>
                {initialTemplate && (
                    <div className="flex md:block items-center gap-3 md:text-right text-xs">
                        <div className="hidden md:flex items-center gap-1.5 justify-end text-[10px] font-bold text-white/40 uppercase mb-1">
                            <Clock className="w-3 h-3" /> Last Edited
                        </div>
                        <div className="font-bold text-white/70">{new Date(initialTemplate.updatedAt).toLocaleDateString()}</div>
                        <div className="text-[10px] text-white/40">v{initialTemplate.version} • by {initialTemplate.updatedBy}</div>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-1 gap-4 overflow-hidden relative">
                
                {/* Search Trigger Bar (Visible when not expanded) */}
                {!isSearchExpanded && (
                    <div onClick={() => setIsSearchExpanded(true)} className="bg-white/10 p-3 rounded-[10px] flex items-center gap-3 cursor-pointer hover:bg-white/20 transition-colors group shrink-0">
                        <Search className="w-4 h-4 text-white/50" />
                        <span className="text-sm font-bold text-white/50 group-hover:text-white/80">Tap to add songs...</span>
                        <div className="ml-auto bg-white/20 px-2 py-1 rounded text-[10px] font-bold text-white/60">
                            {library.length} available
                        </div>
                    </div>
                )}

                {/* Current Runlist */}
                <div className={cn("flex-1 overflow-y-auto custom-scrollbar space-y-2 p-4 bg-white/10 rounded-[10px]", isSearchExpanded ? "hidden md:block opacity-30 pointer-events-none" : "block")}>
                     {currentSongs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                            <ListMusic className="w-12 h-12 mb-4 text-white/25" />
                            <h4 className="text-lg font-bold text-white/50">List is empty</h4>
                            <p className="text-xs text-white/35 mt-1 max-w-[200px]">Tap the search bar above to start adding songs from your repertoire.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                             {currentSongs.map((song, i) => (
                                <div
                                    key={song.id}
                                    draggable
                                    onDragStart={() => handleDragStart(i)}
                                    onDragOver={(e) => handleDragOver(e, i)}
                                    onDragEnd={handleDragEnd}
                                    className={cn(
                                        "bg-white border p-3 rounded-[10px] flex items-center justify-between group shadow-sm transition-all cursor-grab active:cursor-grabbing select-none",
                                        draggedIndex === i && "opacity-40 scale-95",
                                        dragOverIndex === i && draggedIndex !== null && draggedIndex !== i && "border-[#0147FF] border-2",
                                        draggedIndex === null && "border-black/5 hover:border-black/20"
                                    )}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <GripVertical className="w-4 h-4 text-black/20 shrink-0" />
                                        <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                            {i+1}
                                        </div>
                                        <div className="truncate">
                                            <div className="font-bold text-sm truncate">{song.title}</div>
                                            <div className="text-[10px] text-black/50 uppercase truncate">{song.artist}</div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveSong(song.id)} className="p-2 text-black/20 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* FULLSCREEN SEARCH OVERLAY */}
                <AnimatePresence>
                    {isSearchExpanded && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="absolute inset-0 bg-white z-20 flex flex-col rounded-[10px] overflow-hidden shadow-2xl border border-black/10"
                        >
                            {/* Overlay Header */}
                            <div className="p-3 border-b border-black/5 flex items-center gap-3 bg-white shrink-0">
                                {overlayTab === 'library' ? (
                                    <>
                                        <Search className="w-4 h-4 text-black" />
                                        <input 
                                            autoFocus
                                            placeholder="Search library..." 
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="flex-1 text-sm font-bold outline-none placeholder:text-black/30"
                                        />
                                    </>
                                ) : (
                                    <span className="flex-1 text-sm font-bold">Add New Song</span>
                                )}
                                <button onClick={() => setIsSearchExpanded(false)} className="p-2 bg-[#F2F2F0] rounded-full hover:bg-black/10 transition-colors">
                                    <X className="w-4 h-4 text-black/60" />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="px-3 py-2 bg-[#F9F9F8] border-b border-black/5 flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => setOverlayTab('library')}
                                    className={cn(
                                        "flex-1 py-2 rounded-[8px] text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
                                        overlayTab === 'library' ? "bg-black text-white" : "bg-transparent text-black/40 hover:text-black/60"
                                    )}
                                >
                                    <Music className="w-3.5 h-3.5" /> Library
                                </button>
                                <button
                                    onClick={() => setOverlayTab('add')}
                                    className={cn(
                                        "flex-1 py-2 rounded-[8px] text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
                                        overlayTab === 'add' ? "bg-black text-white" : "bg-transparent text-black/40 hover:text-black/60"
                                    )}
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add New
                                </button>
                            </div>

                            {overlayTab === 'library' ? (
                                <>
                                    {/* Filters Row */}
                                    <div className="px-3 py-2 bg-[#F9F9F8] border-b border-black/5 flex items-center justify-between shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setHideAlreadyInList(!hideAlreadyInList)}
                                            className="flex items-center gap-2 cursor-pointer"
                                        >
                                            <DotCheckbox checked={hideAlreadyInList} />
                                            <span className="text-[10px] font-bold text-black/50 uppercase tracking-wide">Hide already in list</span>
                                        </button>
                                        <span className="text-[10px] font-bold text-black/30">{filteredLibrary.length} results</span>
                                    </div>

                                    {/* Grouped Results List */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4 bg-white">
                                        {filteredLibrary.length === 0 && (
                                             <div className="p-8 text-center opacity-40">
                                                <p className="text-xs font-bold">No matching songs found</p>
                                             </div>
                                        )}
                                        
                                        {Object.entries(groupedLibrary).map(([category, songs]) => (
                                            <div key={category} className="space-y-2">
                                                <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 py-1 border-b border-black/5">
                                                    <h5 className="text-[10px] font-black uppercase text-black/40 tracking-widest pl-1">{category}</h5>
                                                </div>
                                                {songs.map(song => {
                                                    const isSelected = selectedToAddIds.includes(song.id);
                                                    return (
                                                        <button 
                                                            key={song.id} 
                                                            onClick={() => handleToggleSelectToAdd(song.id)}
                                                            className={cn(
                                                                "w-full p-3 rounded-[10px] flex items-center justify-between group transition-all text-left border",
                                                                isSelected ? "border-black bg-black text-white" : "border-black/5 bg-white hover:border-black/20"
                                                            )}
                                                        >
                                                            <div>
                                                                <div className="font-bold text-sm">{song.title}</div>
                                                                <div className={cn("text-[10px] uppercase", isSelected ? "text-white/60" : "text-black/50")}>{song.artist}</div>
                                                            </div>
                                                            {isSelected ? (
                                                                <CheckCircle2 className="w-5 h-5 text-[#D4FB46]" />
                                                            ) : (
                                                                <Plus className="w-4 h-4 text-black/20 group-hover:text-black" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Sticky Footer for Add Action */}
                                    <div className="p-3 border-t border-black/5 bg-white shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                                        <button 
                                            onClick={handleAddSelected}
                                            disabled={selectedToAddIds.length === 0}
                                            className="w-full py-3 bg-[#D4FB46] text-black rounded-[10px] text-sm font-black uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:pointer-events-none flex items-center justify-center gap-2 shadow-lg"
                                        >
                                            Add {selectedToAddIds.length} Songs <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Add New Song Form */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase block mb-1 text-black/40">Song Title *</span>
                                            <input
                                                type="text"
                                                autoFocus
                                                value={newTitle}
                                                onChange={(e) => setNewTitle(e.target.value)}
                                                placeholder="Enter song title..."
                                                className="w-full bg-transparent border-b-2 border-black/10 focus:border-black py-2 text-lg font-bold outline-none placeholder:text-black/20 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase block mb-1 text-black/40">Artist</span>
                                            <input
                                                type="text"
                                                value={newArtist}
                                                onChange={(e) => setNewArtist(e.target.value)}
                                                placeholder="Enter artist name..."
                                                className="w-full bg-transparent border-b-2 border-black/10 focus:border-black py-2 text-sm font-bold outline-none placeholder:text-black/20 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase block mb-1 text-black/40">Link (Spotify, YouTube, Drive)</span>
                                            <div className="relative">
                                                <Link className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
                                                <input
                                                    type="url"
                                                    value={newUrl}
                                                    onChange={(e) => setNewUrl(e.target.value)}
                                                    placeholder="Paste URL..."
                                                    className="w-full bg-transparent border-b-2 border-black/10 focus:border-black pl-6 py-2 text-sm font-bold outline-none placeholder:text-black/20 transition-all"
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold mt-1 block text-black/30">
                                                Spotify, YouTube, Google Drive, or any audio link
                                            </span>
                                        </div>
                                    </div>

                                    {/* Footer for Add New */}
                                    <div className="p-3 border-t border-black/5 bg-white shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                                        <button 
                                            onClick={handleAddNewSong}
                                            disabled={!newTitle.trim() || saving}
                                            className="w-full py-3 bg-[#D4FB46] text-black rounded-[10px] text-sm font-black uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:pointer-events-none flex items-center justify-center gap-2 shadow-lg"
                                        >
                                            {saving ? 'Saving...' : 'Add & Select'} <Check className="w-4 h-4" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer Actions (Main Modal) */}
            <div className={cn("pt-4 mt-4 border-t border-white/15 shrink-0 flex flex-col md:flex-row gap-3 pb-2 md:pb-0 z-10", isSearchExpanded ? "hidden md:flex" : "flex")}>
                <div className="flex-1 flex flex-col md:flex-row gap-3 justify-end">
                    {initialTemplate && hasChanges && (
                        <button 
                            onClick={() => handleSaveAction(true)}
                            disabled={!name}
                            className="py-4 px-6 rounded-2xl border-2 border-white/20 font-bold text-xs uppercase tracking-wider hover:border-white hover:text-white text-white/60 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Copy className="w-4 h-4" /> Save as New
                        </button>
                    )}
                    {hasChanges ? (
                        <button 
                            onClick={() => handleSaveAction(false)}
                            disabled={!name}
                            className="py-4 px-8 bg-black text-white rounded-md font-black text-xs uppercase tracking-wider hover:scale-[1.02] transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" /> {initialTemplate ? "Update Setlist" : "Create Setlist"}
                        </button>
                    ) : (
                        <button 
                            onClick={onClose}
                            className="py-4 px-8 bg-black text-white rounded-md font-black text-xs uppercase tracking-wider hover:scale-[1.02] transition-transform shadow-lg flex items-center justify-center gap-2"
                        >
                            <Check className="w-4 h-4" /> Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    </RehearsalModalWrapper>
  );
};
