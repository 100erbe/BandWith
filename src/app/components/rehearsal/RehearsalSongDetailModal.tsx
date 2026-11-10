import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, FileText, Plus } from '@/app/components/icons';
import { BwSheet, PillButton, PillField, Tag } from '@/app/components/bw';
import { RehearsalSong } from './types';
import { cn } from '@/app/components/ui/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  song: RehearsalSong | null;
  onUpdate: (song: RehearsalSong) => void;
}

export const RehearsalSongDetailModal: React.FC<Props> = ({ isOpen, onClose, song, onUpdate }) => {
  const [data, setData] = useState<RehearsalSong | null>(null);

  useEffect(() => {
    if (song) setData({ ...song });
  }, [song]);

  const handleSave = () => {
    if (data) {
      onUpdate(data);
      onClose();
    }
  };

  if (!data) return null;

  return (
    <BwSheet
      open={isOpen}
      onClose={onClose}
      overline="Song"
      title="Song details"
      zIndex={110}
      footer={
        <div className="dark grid grid-cols-2 gap-3">
          <PillButton variant="outline" onClick={handleSave}>
            Save
          </PillButton>
          <PillButton onClick={handleSave} icon={<Plus className="w-[18px] h-[18px]" />}>
            Setlist
          </PillButton>
        </div>
      }
    >
      <div className="dark flex flex-col gap-5">
        <div className="flex flex-wrap gap-1.5">
          <Tag variant="rehearsal">Song</Tag>
          <Tag variant="outline">{data.priority || 'medium'}</Tag>
        </div>

        <PillField tone="sheet" label="Title" value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} />
        <PillField tone="sheet" label="Artist" value={data.artist} onChange={(e) => setData({ ...data, artist: e.target.value })} />

        <div className="grid grid-cols-[2fr_3fr] gap-3 items-end">
          <PillField
            tone="sheet"
            label="Duration"
            value={data.duration}
            onChange={(e) => setData({ ...data, duration: e.target.value })}
          />
          <fieldset className="flex flex-col gap-2 min-w-0">
            <legend className="bw-label-sm text-white/70 mb-2">Priority</legend>
            <div className="flex p-1 gap-1 h-[52px] rounded-full bg-white/[0.08]">
              {(['high', 'medium', 'low'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={data.priority === p}
                  onClick={() => setData({ ...data, priority: p })}
                  className={cn(
                    'flex-1 rounded-full bw-button-sm transition-colors',
                    data.priority === p ? 'bg-accent text-accent-foreground' : 'text-sheet-foreground/70'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <label className="flex flex-col gap-2 p-4 rounded-[24px] bg-white/10 border border-white/20 focus-within:border-2 focus-within:border-white transition-[border-color]">
          <span className="bw-label-sm text-white/70">Notes</span>
          <textarea
            value={data.notes || ''}
            onChange={(e) => setData({ ...data, notes: e.target.value })}
            className="w-full bg-transparent outline-none bw-body-lg text-white placeholder:text-white/40 min-h-[96px] resize-none"
            placeholder="Notes for the band…"
          />
        </label>

        <section className="flex flex-col gap-2">
          <h3 className="bw-label-sm text-sheet-foreground/70">Resources</h3>
          <div className="grid grid-cols-2 gap-2">
            <PillButton variant="outline" size="md" icon={<LinkIcon className="w-4 h-4" />}>
              Links
            </PillButton>
            <PillButton variant="outline" size="md" icon={<FileText className="w-4 h-4" />}>
              Score / tabs
            </PillButton>
          </div>
        </section>
      </div>
    </BwSheet>
  );
};
