import React, { useState, useEffect } from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { Music, Link as LinkIcon, FileText, Plus, ArrowUpRight } from 'lucide-react';
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
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title="Song Details">
      <div className="flex flex-col gap-10">
        {/* Tags */}
        <div className="flex gap-1 flex-wrap">
          <div className="px-2.5 py-1 bg-card rounded-full">
            <span className="text-xs font-bold uppercase text-accent-rehearsal">SONG</span>
          </div>
          <div className="px-2.5 py-1 bg-card rounded-full">
            <span className="text-xs font-bold uppercase text-accent-rehearsal">
              {data.priority?.toUpperCase() || 'MEDIUM'}
            </span>
          </div>
        </div>

        {/* Title + Artist */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-accent-foreground uppercase">TITLE</span>
            <input
              value={data.title}
              onChange={e => setData({ ...data, title: e.target.value })}
              className="bg-transparent border-b-2 border-border/30 py-2 text-3xl font-bold text-accent-foreground placeholder:text-accent-foreground/30 focus:outline-none focus:border-border transition-all"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-accent-foreground uppercase">ARTIST</span>
            <input
              value={data.artist}
              onChange={e => setData({ ...data, artist: e.target.value })}
              className="bg-transparent border-b-2 border-border/30 py-2 text-xl font-bold text-accent-foreground placeholder:text-accent-foreground/30 focus:outline-none focus:border-border transition-all"
            />
          </div>
        </div>

        {/* Duration + Priority */}
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-accent-foreground uppercase">DURATION</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-accent-foreground" />
            </div>
            <input
              value={data.duration}
              onChange={e => setData({ ...data, duration: e.target.value })}
              className="bg-transparent border-b-2 border-border/30 py-2 text-4xl font-bold text-accent-foreground placeholder:text-accent-foreground/30 focus:outline-none focus:border-border transition-all"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-accent-foreground uppercase">PRIORITY</span>
            <div className="flex bg-surface-inverse-foreground/10 rounded-xl p-1">
              {(['high', 'medium', 'low'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setData({ ...data, priority: p })}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-bold uppercase transition-all",
                    data.priority === p ? "bg-card text-accent-rehearsal" : "text-accent-foreground/50"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-accent-foreground uppercase">NOTES</span>
          <textarea
            value={data.notes || ''}
            onChange={e => setData({ ...data, notes: e.target.value })}
            className="bg-transparent border-b-2 border-border/30 py-2 text-sm font-bold text-accent-foreground placeholder:text-accent-foreground/30 focus:outline-none focus:border-border transition-all min-h-25 resize-none"
            placeholder="Notes for the band..."
          />
        </div>

        {/* Resources */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-accent-foreground uppercase">RESOURCES</span>
          <div className="grid grid-cols-2 gap-2">
            <button className="py-4 bg-muted/20 rounded-xl flex items-center justify-center gap-2 text-xs font-bold uppercase text-accent-foreground">
              <LinkIcon className="w-4 h-4" /> LINKS
            </button>
            <button className="py-4 bg-muted/20 rounded-xl flex items-center justify-center gap-2 text-xs font-bold uppercase text-accent-foreground">
              <FileText className="w-4 h-4" /> SCORE/TABS
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 rounded-t-3xl px-4 pt-5 pb-8 z-[102]"
        style={{ backgroundColor: 'var(--accent-rehearsal)', boxShadow: '0px -4px 20px var(--dot-inactive)' }}
      >
        <div className="flex flex-col gap-5 items-center">
          <div className="grid grid-cols-2 gap-2.5 w-full">
            <button
              onClick={handleSave}
              className="rounded-xl py-4 flex items-center justify-center gap-2 bg-muted/20"
            >
              <span className="text-base font-bold text-accent-foreground uppercase">SAVE</span>
            </button>
            <button
              onClick={handleSave}
              className="rounded-xl py-4 flex items-center justify-center gap-2 bg-card"
            >
              <Plus className="w-4.5 h-4.5 text-accent-rehearsal" />
              <span className="text-base font-bold text-accent-rehearsal uppercase">SETLIST</span>
            </button>
          </div>
        </div>
      </div>
    </RehearsalModalWrapper>
  );
};
