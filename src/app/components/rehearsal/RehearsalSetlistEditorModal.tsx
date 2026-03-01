import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { ListMusic, Search, Plus, Trash2, Save, Copy, CheckCircle2, History, Clock, Check, AlertCircle, X, ChevronRight, Music } from 'lucide-react';
import { RehearsalSong, SetlistTemplate, RehearsalState, SetlistSnapshot } from './types';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTemplate: SetlistTemplate | null;
  library: RehearsalSong[];
  onSave: (template: SetlistTemplate) => void;
  onCreate: (template: SetlistTemplate) => void;
  currentUserInitials: string;
}

export const RehearsalSetlistEditorModal: React.FC<Props> = ({ 
  isOpen, onClose, initialTemplate, library, onSave, onCreate, currentUserInitials 
}) => {
  // Local State
  const [name, setName] = useState('');
  const [currentSongIds, setCurrentSongIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideAlreadyInList, setHideAlreadyInList] = useState(true);
  const [selectedToAddIds, setSelectedToAddIds] = useState<string[]>([]); 
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Initialize
  useEffect(() => {
    if (isOpen) {
        if (initialTemplate) {
            setName(initialTemplate.name);
            setCurrentSongIds(initialTemplate.songIds);
        } else {
            setName('New Runlist Template');
            setCurrentSongIds([]);
        }
        setSearchQuery('');
        setSelectedToAddIds([]);
        setIsSearchExpanded(false);
    }
  }, [isOpen, initialTemplate]);

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
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title={initialTemplate ? "Edit Runlist Template" : "Build New Runlist"} icon={ListMusic}>
        <div className="flex flex-col h-[85vh] md:h-[75vh] w-full relative">
            
            {/* Header / Meta (Hidden when Search Expanded on Mobile) */}
            <div className={cn("flex flex-col md:flex-row md:items-start md:justify-between mb-4 shrink-0 gap-2", isSearchExpanded ? "hidden md:flex" : "flex")}>
                <div className="w-full md:max-w-sm">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1 block">Template Name</label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full text-2xl font-black bg-transparent border-b-2 border-black/10 focus:border-black outline-none placeholder:text-black/20"
                        placeholder="e.g. Summer Tour 2026"
                    />
                </div>
                {initialTemplate && (
                    <div className="flex md:block items-center gap-3 md:text-right text-xs">
                        <div className="hidden md:flex items-center gap-1.5 justify-end text-[10px] font-bold text-black/40 uppercase mb-1">
                            <Clock className="w-3 h-3" /> Last Edited
                        </div>
                        <div className="font-bold text-black/60 md:text-black">{new Date(initialTemplate.updatedAt).toLocaleDateString()}</div>
                        <div className="text-[10px] text-black/40">v{initialTemplate.version} • by {initialTemplate.updatedBy}</div>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-1 gap-4 overflow-hidden relative">
                
                {/* Search Trigger Bar (Visible when not expanded) */}
                {!isSearchExpanded && (
                    <div onClick={() => setIsSearchExpanded(true)} className="bg-black/5 p-3 rounded-[10px] flex items-center gap-3 cursor-pointer hover:bg-black/10 transition-colors group shrink-0">
                        <Search className="w-4 h-4 text-black/40" />
                        <span className="text-sm font-bold text-black/40 group-hover:text-black/60">Tap to add songs...</span>
                        <div className="ml-auto bg-white px-2 py-1 rounded text-[10px] font-bold text-black/40 shadow-sm border border-black/5">
                            {library.length} available
                        </div>
                    </div>
                )}

                {/* Current Runlist */}
                <div className={cn("flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2 bg-white rounded-[10px]", isSearchExpanded ? "hidden md:block opacity-30 pointer-events-none" : "block")}>
                     {currentSongs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-8">
                            <ListMusic className="w-12 h-12 mb-4 text-black/20" />
                            <h4 className="text-lg font-bold text-black/40">List is empty</h4>
                            <p className="text-xs text-black/30 mt-1 max-w-[200px]">Tap the search bar above to start adding songs from your repertoire.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                             {currentSongs.map((song, i) => (
                                <div key={song.id} className="bg-white border border-black/5 p-3 rounded-[10px] flex items-center justify-between group shadow-sm hover:border-black/20 transition-all">
                                    <div className="flex items-center gap-3 overflow-hidden">
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
                                <Search className="w-4 h-4 text-black" />
                                <input 
                                    autoFocus
                                    placeholder="Search library..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="flex-1 text-sm font-bold outline-none placeholder:text-black/30"
                                />
                                <button onClick={() => setIsSearchExpanded(false)} className="p-2 bg-[#F2F2F0] rounded-full hover:bg-black/10 transition-colors">
                                    <X className="w-4 h-4 text-black/60" />
                                </button>
                            </div>

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
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer Actions (Main Modal) */}
            <div className={cn("pt-4 mt-4 border-t border-black/10 shrink-0 flex flex-col md:flex-row gap-3 bg-white pb-2 md:pb-0 z-10", isSearchExpanded ? "hidden md:flex" : "flex")}>
                 <button 
                    onClick={onClose}
                    className="py-4 md:py-0 px-6 rounded-2xl font-bold text-xs uppercase border-2 border-transparent text-black/40 hover:text-black hover:bg-black/5 transition-all"
                >
                    Cancel
                </button>
                
                <div className="flex-1 flex flex-col md:flex-row gap-3 justify-end">
                    {initialTemplate && (
                        <button 
                            onClick={() => handleSaveAction(true)}
                            disabled={!name}
                            className="py-4 px-6 rounded-2xl border-2 border-black/10 font-bold text-xs uppercase tracking-wider hover:border-black hover:text-black text-black/60 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Copy className="w-4 h-4" /> Save as New
                        </button>
                    )}
                    <button 
                        onClick={() => handleSaveAction(false)}
                        disabled={!name}
                        className="py-4 px-8 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:scale-[1.02] transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" /> {initialTemplate ? "Update Template" : "Create Template"}
                    </button>
                </div>
            </div>
        </div>
    </RehearsalModalWrapper>
  );
};
