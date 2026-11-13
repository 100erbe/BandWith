import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ListMusic, Search, Plus, Trash2, Save, Copy, Clock, Check, Link, GripVertical } from '@/app/components/icons';
import { RehearsalSong, SetlistTemplate } from './types';
import { cn } from '@/app/components/ui/utils';
import { BwSheet, IconButton, PillButton, PillField, SearchField, Selector } from '@/app/components/bw';
import { createSong } from '@/lib/services/songs';
import { safeHttpsUrl } from '@/lib/services/songFiles';
import { useT, intlLocale } from '@/lib/i18n';

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
  const t = useT();
  // Local State
  const [name, setName] = useState('');
  const [currentSongIds, setCurrentSongIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Songs already in the list stay visible, highlighted (tap again removes).
  const [hideAlreadyInList, setHideAlreadyInList] = useState(false);
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
          const cat = song.category || 'Other';
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(song);
      });
      return groups;
  }, [filteredLibrary]);

  // A tap adds the song to the list at once (or takes it out): the whole
  // library stays on screen for picking several songs.
  const handleToggleSelectToAdd = (id: string) => {
      setCurrentSongIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleAddSelected = () => {
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

  const sheetTitle = isSearchExpanded ? t('Add songs') : initialTemplate ? t('Edit setlist') : t('New setlist');
  const addCount = currentSongIds.length;

  const footer = isSearchExpanded ? (
    <div className="dark">
      {overlayTab === 'library' ? (
        <PillButton onClick={handleAddSelected} icon={<Check className="w-[18px] h-[18px]" />}>
          {addCount === 1 ? t('Done · {count} song', { count: addCount }) : t('Done · {count} songs', { count: addCount })}
        </PillButton>
      ) : (
        <PillButton
          onClick={handleAddNewSong}
          disabled={!newTitle.trim()}
          loading={saving}
          icon={<Check className="w-[18px] h-[18px]" />}
        >
          {saving ? t('Saving…') : t('Add & select')}
        </PillButton>
      )}
    </div>
  ) : (
    <div className="dark flex gap-3">
      {initialTemplate && hasChanges && (
        <PillButton variant="outline" onClick={() => handleSaveAction(true)} disabled={!name} icon={<Copy className="w-4 h-4" />}>
          {t('Save as new')}
        </PillButton>
      )}
      {hasChanges ? (
        <PillButton onClick={() => handleSaveAction(false)} disabled={!name} icon={<Save className="w-[18px] h-[18px]" />}>
          {initialTemplate ? t('Update setlist') : t('Create setlist')}
        </PillButton>
      ) : (
        <PillButton onClick={onClose} icon={<Check className="w-[18px] h-[18px]" />}>
          {t('Done')}
        </PillButton>
      )}
    </div>
  );

  return (
    <BwSheet
      open={isOpen}
      onClose={isSearchExpanded ? () => setIsSearchExpanded(false) : onClose}
      closeLabel={isSearchExpanded ? t('Back to setlist') : t('Close')}
      overline={isSearchExpanded ? name || t('Setlist') : currentSongs.length === 1 ? t('Setlist · {count} song', { count: currentSongs.length }) : t('Setlist · {count} songs', { count: currentSongs.length })}
      title={sheetTitle}
      footer={footer}
      zIndex={110}
    >
      <div className="dark flex flex-col gap-4">
        {!isSearchExpanded ? (
          <>
            {/* Name + meta */}
            <PillField
              tone="sheet"
              label={t('Setlist name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('e.g. Summer tour 2026')}
            />
            {initialTemplate && (
              <p className="flex items-center gap-1.5 bw-label-sm text-sheet-foreground/70">
                <Clock className="w-3.5 h-3.5" />
                {t('Edited {date} · v{version} · by {name}', {
                  date: new Date(initialTemplate.updatedAt).toLocaleDateString(intlLocale()),
                  version: initialTemplate.version,
                  name: initialTemplate.updatedBy,
                })}
              </p>
            )}

            {/* Search trigger */}
            <button
              type="button"
              onClick={() => setIsSearchExpanded(true)}
              className="flex items-center gap-3 h-[52px] px-4 rounded-full bg-white/10 border border-white/20 text-left cursor-pointer active:scale-[0.99] transition-transform"
            >
              <Search className="w-5 h-5 shrink-0" />
              <span className="flex-1 min-w-0 bw-body-lg text-sheet-foreground/60 truncate">{t('Search library to add…')}</span>
              <span className="bw-label-sm text-sheet-foreground/60 shrink-0">{t('{count} songs', { count: library.length })}</span>
            </button>

            {/* Current runlist */}
            {currentSongs.length === 0 ? (
              <div className="flex flex-col items-center text-center gap-2 py-10">
                <ListMusic className="w-8 h-8 text-sheet-foreground/40" />
                <h4 className="bw-h3">{t('List is empty')}</h4>
                <p className="bw-body-sm text-sheet-foreground/60 max-w-[240px]">
                  {t('Search your repertoire above to start adding songs.')}
                </p>
              </div>
            ) : (
              <ol className="flex flex-col gap-2">
                {currentSongs.map((song, i) => (
                  <li
                    key={song.id}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'flex items-center gap-3 pl-3 pr-1 py-2 rounded-[16px] bg-white/[0.08] select-none cursor-grab active:cursor-grabbing transition-[opacity,transform,box-shadow]',
                      draggedIndex === i && 'opacity-40 scale-[0.97]',
                      dragOverIndex === i && draggedIndex !== null && draggedIndex !== i && 'ring-2 ring-accent'
                    )}
                  >
                    <GripVertical className="w-4 h-4 text-sheet-foreground/40 shrink-0" />
                    <span className="w-7 h-7 rounded-full border border-sheet-foreground/40 bw-label-sm flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="bw-label-md truncate">{song.title}</span>
                      <span className="bw-body-sm text-sheet-foreground/60 truncate">{song.artist}</span>
                    </div>
                    <IconButton
                      label={t('Remove {title}', { title: song.title })}
                      icon={<Trash2 />}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSong(song.id)}
                    />
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : (
          <>
            {/* Figma "Picker / Songs" */}
            {overlayTab === 'library' && (
              <SearchField
                autoFocus
                label={t('Search library')}
                placeholder={t('Search library…')}
                value={searchQuery}
                onChange={setSearchQuery}
              />
            )}

            <div className="flex items-center gap-2">
              <Selector
                selected={overlayTab === 'library'}
                onClick={() => setOverlayTab('library')}
                className={overlayTab === 'library' ? 'bg-accent text-accent-foreground' : undefined}
              >
                {t('From library')}
              </Selector>
              <Selector
                selected={overlayTab === 'add'}
                onClick={() => setOverlayTab('add')}
                className={overlayTab === 'add' ? 'bg-accent text-accent-foreground' : undefined}
              >
                {t('Manual')}
              </Selector>
            </div>

            {overlayTab === 'library' ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <Selector size="sm" selected={hideAlreadyInList} onClick={() => setHideAlreadyInList(!hideAlreadyInList)}>
                    {hideAlreadyInList && <Check className="w-3 h-3" />}
                    {t('Hide added')}
                  </Selector>
                  <span className="bw-label-sm text-sheet-foreground/60">
                    {filteredLibrary.length === 1 ? t('{count} result', { count: filteredLibrary.length }) : t('{count} results', { count: filteredLibrary.length })}
                  </span>
                </div>

                {filteredLibrary.length === 0 && (
                  <p className="bw-body-sm text-sheet-foreground/60 text-center py-8">{t('No matching songs found')}</p>
                )}

                {Object.entries(groupedLibrary).map(([category, songs]) => (
                  <section key={category} className="flex flex-col gap-2">
                    <h5 className="bw-label-sm text-sheet-foreground/60">{category === 'Other' ? t('Other') : category}</h5>
                    {songs.map((song) => {
                      const isSelected = currentSongIds.includes(song.id);
                      return (
                        <button
                          key={song.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => handleToggleSelectToAdd(song.id)}
                          className={cn(
                            'w-full flex items-center gap-3 p-4 rounded-[16px] text-left transition-colors cursor-pointer',
                            isSelected ? 'bg-white/[0.08]' : 'bg-transparent'
                          )}
                        >
                          <DotCheck checked={isSelected} />
                          <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <span className="bw-label-md truncate">{song.title}</span>
                            <span className="bw-body-sm text-sheet-foreground/70 truncate">{song.artist}</span>
                          </span>
                          {song.duration && song.duration !== '0:00' && (
                            <span className="bw-label-md shrink-0">{song.duration}</span>
                          )}
                        </button>
                      );
                    })}
                  </section>
                ))}
              </>
            ) : (
              <>
                <PillField
                  tone="sheet"
                  label={t('Song title *')}
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t('Enter song title…')}
                />
                <PillField
                  tone="sheet"
                  label={t('Artist')}
                  value={newArtist}
                  onChange={(e) => setNewArtist(e.target.value)}
                  placeholder={t('Enter artist name…')}
                />
                <PillField
                  tone="sheet"
                  type="url"
                  label={t('Link (Spotify, YouTube, Drive)')}
                  icon={<Link className="w-5 h-5" />}
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder={t('Paste URL…')}
                  hint={t('Spotify, YouTube, Google Drive, or any audio link')}
                />
              </>
            )}
          </>
        )}
      </div>
    </BwSheet>
  );
};

/** Figma "Control": 24pt dot-grid check — solid dots on, a dotted outline off. */
const DotCheck: React.FC<{ checked: boolean; className?: string }> = ({ checked, className }) => (
  <span aria-hidden className={cn('grid grid-cols-4 gap-[2.67px] w-6 h-6 shrink-0', className)}>
    {Array.from({ length: 16 }).map((_, i) => {
      const r = Math.floor(i / 4);
      const c = i % 4;
      const edge = r === 0 || r === 3 || c === 0 || c === 3;
      return (
        <span
          key={i}
          className={cn('w-1 h-1 rounded-full bg-current transition-opacity', !checked && (edge ? 'opacity-35' : 'opacity-0'))}
        />
      );
    })}
  </span>
);
