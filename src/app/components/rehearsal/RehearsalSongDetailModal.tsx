import React, { useState, useEffect } from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { Music, AlertCircle, Link as LinkIcon, FileText, Plus } from 'lucide-react';
import { RehearsalSong, SongPriority } from './types';
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
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title="Edit Song Details" icon={Music}>
        <div className="space-y-6">
            
            <div className="space-y-4">
                <div className="group">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Title</label>
                    <input 
                       value={data.title}
                       onChange={e => setData({...data, title: e.target.value})}
                       className="w-full bg-black/5 p-3 rounded-xl font-bold text-black border-none focus:ring-2 focus:ring-black/20 outline-none"
                    />
                </div>
                <div className="group">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Artist</label>
                    <input 
                       value={data.artist}
                       onChange={e => setData({...data, artist: e.target.value})}
                       className="w-full bg-black/5 p-3 rounded-xl font-bold text-black border-none focus:ring-2 focus:ring-black/20 outline-none"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Duration</label>
                    <input 
                       value={data.duration}
                       onChange={e => setData({...data, duration: e.target.value})}
                       className="w-full bg-black/5 p-3 rounded-xl font-bold text-black border-none focus:ring-2 focus:ring-black/20 outline-none"
                    />
               </div>
               <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Priority</label>
                    <div className="flex bg-black/5 rounded-xl p-1 mt-1">
                        {(['high', 'medium', 'low'] as const).map(p => (
                            <button
                               key={p}
                               onClick={() => setData({...data, priority: p})}
                               className={cn(
                                   "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all",
                                   data.priority === p ? "bg-black text-[#D4FB46]" : "text-black/40"
                               )}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
               </div>
            </div>

            <div>
               <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Notes</label>
               <textarea 
                  value={data.notes || ''} 
                  onChange={e => setData({...data, notes: e.target.value})}
                  className="w-full bg-black/5 p-3 rounded-xl font-bold text-black border-none focus:ring-2 focus:ring-black/20 outline-none min-h-[100px] resize-none" 
                  placeholder="Notes for the band..."
               />
            </div>

            {/* Resources (Mock) */}
            <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Resources</label>
               <div className="flex gap-2">
                   <button className="flex-1 py-3 border border-black/10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold uppercase text-black/60 hover:bg-black/5">
                       <LinkIcon className="w-4 h-4" /> Links
                   </button>
                   <button className="flex-1 py-3 border border-black/10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold uppercase text-black/60 hover:bg-black/5">
                       <FileText className="w-4 h-4" /> Score/Tabs
                   </button>
               </div>
            </div>

            <div className="flex gap-3">
                <button 
                   onClick={handleSave}
                   className="flex-1 py-4 bg-black/5 text-black rounded-2xl font-bold text-sm uppercase tracking-wider hover:bg-black/10 transition-colors"
                >
                   Save Changes
                </button>
                <button 
                   onClick={handleSave}
                   className="flex-1 py-4 bg-black text-[#D4FB46] rounded-2xl font-black text-sm uppercase tracking-wider hover:scale-[1.02] transition-transform shadow-lg flex items-center justify-center gap-2"
                >
                   <Plus className="w-4 h-4" /> Add to Setlist
                </button>
            </div>
        </div>
    </RehearsalModalWrapper>
  );
};
