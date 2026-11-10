import React, { useState } from 'react';
import { UploadCloud, Smartphone, FileText, Plus } from '@/app/components/icons';
import { BwSheet, PillButton, PillField, Selector } from '@/app/components/bw';
import { RehearsalSong } from './types';
import { cn } from '@/app/components/ui/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (song: RehearsalSong) => void;
  categories: string[];
  currentFolder?: string | null;
}

export const RehearsalAddSongModal: React.FC<Props> = ({ isOpen, onClose, onAdd, categories, currentFolder }) => {
  const [method, setMethod] = useState<'local' | 'drive' | 'dropbox'>('local');
  const [file, setFile] = useState<File | null>(null);
  const [details, setDetails] = useState({ title: '', artist: '', category: currentFolder || '' });

  // Update category when currentFolder changes
  React.useEffect(() => {
     if (currentFolder) setDetails(prev => ({ ...prev, category: currentFolder }));
  }, [currentFolder]);

  const handleSave = () => {
    if (!details.title) return;
    
    const newSong: RehearsalSong = {
       id: `temp-${Date.now()}`,
       title: details.title,
       artist: details.artist || 'Unknown Artist',
       duration: '0:00', // Placeholder
       priority: 'medium',
       type: 'song',
       category: details.category || 'Uncategorized',
       scoreUploaded: !!file
    };
    onAdd(newSong);
    onClose();
    setDetails({ title: '', artist: '', category: '' });
    setFile(null);
  };

  return (
    <BwSheet
      open={isOpen}
      onClose={onClose}
      overline="Setlist"
      title="Add external song"
      zIndex={110}
      footer={
        <div className="dark">
          <PillButton onClick={handleSave} disabled={!details.title} icon={<Plus className="w-[18px] h-[18px]" />}>
            Add to setlist
          </PillButton>
        </div>
      }
    >
      <div className="dark flex flex-col gap-5">
        {/* Source */}
        <fieldset className="flex flex-col gap-2">
          <legend className="bw-label-sm text-sheet-foreground/70 mb-2">Source</legend>
          <div className="grid grid-cols-3 gap-2">
            {([
              ['local', Smartphone, 'Local device'],
              ['drive', UploadCloud, 'Google Drive'],
              ['dropbox', UploadCloud, 'Dropbox'],
            ] as const).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={method === id}
                onClick={() => setMethod(id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-[16px] transition-colors cursor-pointer',
                  method === id ? 'bg-accent text-accent-foreground' : 'bg-white/[0.08] text-sheet-foreground'
                )}
              >
                <Icon className="w-6 h-6" />
                <span className="bw-label-xs text-center">{label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Upload Area */}
        <div className="flex flex-col items-center justify-center gap-2 p-8 rounded-[24px] border-[1.5px] border-dashed border-sheet-foreground/30 text-center">
          <FileText className="w-8 h-8 text-sheet-foreground/40" />
          <p className="bw-body-md">{file ? file.name : 'Drag & drop or choose a file'}</p>
          <p className="bw-label-sm text-sheet-foreground/60">Supports PDF, MP3, GPX</p>
          <input type="file" className="hidden" id="file-upload" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <label
            htmlFor="file-upload"
            className="mt-2 inline-flex items-center h-9 px-4 rounded-full border-[1.5px] border-sheet-foreground bw-button-sm cursor-pointer active:scale-[0.97] transition-transform"
          >
            Choose file
          </label>
        </div>

        {/* Manual Details */}
        <PillField
          tone="sheet"
          label="Song title *"
          value={details.title}
          onChange={(e) => setDetails({ ...details, title: e.target.value })}
          placeholder="e.g. Superstition"
        />
        <PillField
          tone="sheet"
          label="Artist"
          value={details.artist}
          onChange={(e) => setDetails({ ...details, artist: e.target.value })}
          placeholder="e.g. Stevie Wonder"
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="bw-label-sm text-sheet-foreground/70 mb-2">Folder</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Selector key={cat} selected={details.category === cat} onClick={() => setDetails({ ...details, category: cat })}>
                {cat}
              </Selector>
            ))}
            <Selector
              selected={!categories.includes(details.category) && details.category !== ''}
              onClick={() => setDetails({ ...details, category: '' })}
            >
              <Plus className="w-3 h-3" /> New
            </Selector>
          </div>
          {(!categories.includes(details.category) || details.category === '') && (
            <PillField
              tone="sheet"
              label="New folder name"
              hideLabel
              value={details.category}
              onChange={(e) => setDetails({ ...details, category: e.target.value })}
              placeholder="Type new folder name…"
              autoFocus
            />
          )}
        </fieldset>
      </div>
    </BwSheet>
  );
};
