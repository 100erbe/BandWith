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
      <div className="flex flex-col gap-[40px]">
        {/* Tags */}
        <div className="flex gap-[4px] flex-wrap">
          <div className="px-[10px] py-[4px] bg-white rounded-[6px]">
            <span className="text-[12px] font-bold uppercase text-[#0147FF]">SONG</span>
          </div>
          <div className="px-[10px] py-[4px] bg-white rounded-[6px]">
            <span className="text-[12px] font-bold uppercase text-[#0147FF]">
              {data.priority?.toUpperCase() || 'MEDIUM'}
            </span>
          </div>
        </div>

        {/* Title + Artist */}
        <div className="flex flex-col gap-[20px]">
          <div className="flex flex-col gap-[4px]">
            <span className="text-[12px] font-bold text-white uppercase">TITLE</span>
            <input
              value={data.title}
              onChange={e => setData({ ...data, title: e.target.value })}
              className="bg-transparent border-b-2 border-white/30 py-[8px] text-[32px] font-bold text-white placeholder:text-white/30 focus:outline-none focus:border-white transition-all"
            />
          </div>
          <div className="flex flex-col gap-[4px]">
            <span className="text-[12px] font-bold text-white uppercase">ARTIST</span>
            <input
              value={data.artist}
              onChange={e => setData({ ...data, artist: e.target.value })}
              className="bg-transparent border-b-2 border-white/30 py-[8px] text-[22px] font-bold text-white placeholder:text-white/30 focus:outline-none focus:border-white transition-all"
            />
          </div>
        </div>

        {/* Duration + Priority */}
        <div className="grid grid-cols-2 gap-[20px]">
          <div className="flex flex-col gap-[4px]">
            <div className="flex items-center gap-[6px]">
              <span className="text-[12px] font-bold text-white uppercase">DURATION</span>
              <ArrowUpRight className="w-[14px] h-[14px] text-white" />
            </div>
            <input
              value={data.duration}
              onChange={e => setData({ ...data, duration: e.target.value })}
              className="bg-transparent border-b-2 border-white/30 py-[8px] text-[42px] font-bold text-white placeholder:text-white/30 focus:outline-none focus:border-white transition-all"
            />
          </div>
          <div className="flex flex-col gap-[8px]">
            <span className="text-[12px] font-bold text-white uppercase">PRIORITY</span>
            <div className="flex bg-white/10 rounded-[10px] p-[4px]">
              {(['high', 'medium', 'low'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setData({ ...data, priority: p })}
                  className={cn(
                    "flex-1 py-[8px] rounded-[8px] text-[12px] font-bold uppercase transition-all",
                    data.priority === p ? "bg-white text-[#0147FF]" : "text-white/50"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-[4px]">
          <span className="text-[12px] font-bold text-white uppercase">NOTES</span>
          <textarea
            value={data.notes || ''}
            onChange={e => setData({ ...data, notes: e.target.value })}
            className="bg-transparent border-b-2 border-white/30 py-[8px] text-[14px] font-bold text-white placeholder:text-white/30 focus:outline-none focus:border-white transition-all min-h-[100px] resize-none"
            placeholder="Notes for the band..."
          />
        </div>

        {/* Resources */}
        <div className="flex flex-col gap-[8px]">
          <span className="text-[12px] font-bold text-white uppercase">RESOURCES</span>
          <div className="grid grid-cols-2 gap-[8px]">
            <button className="py-[16px] bg-white/20 rounded-[10px] flex items-center justify-center gap-[8px] text-[12px] font-bold uppercase text-white">
              <LinkIcon className="w-[16px] h-[16px]" /> LINKS
            </button>
            <button className="py-[16px] bg-white/20 rounded-[10px] flex items-center justify-center gap-[8px] text-[12px] font-bold uppercase text-white">
              <FileText className="w-[16px] h-[16px]" /> SCORE/TABS
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 rounded-t-[26px] px-[16px] pt-[20px] pb-[30px] z-[102]"
        style={{ backgroundColor: '#0147FF', boxShadow: '0px -4px 20px rgba(0,0,0,0.15)' }}
      >
        <div className="flex flex-col gap-[20px] items-center">
          <div className="grid grid-cols-2 gap-[10px] w-full">
            <button
              onClick={handleSave}
              className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] bg-white/20"
            >
              <span className="text-[16px] font-bold text-white uppercase">SAVE</span>
            </button>
            <button
              onClick={handleSave}
              className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] bg-white"
            >
              <Plus className="w-[18px] h-[18px] text-[#0147FF]" />
              <span className="text-[16px] font-bold text-[#0147FF] uppercase">SETLIST</span>
            </button>
          </div>
        </div>
      </div>
    </RehearsalModalWrapper>
  );
};
