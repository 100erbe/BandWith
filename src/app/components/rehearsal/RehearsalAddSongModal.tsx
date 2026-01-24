import React, { useState } from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { Music, UploadCloud, Smartphone, FileText, Folder, Plus } from 'lucide-react';
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
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title="Add External Song" icon={Music}>
        <div className="space-y-6">
            
            {/* Source Selection */}
            <div className="grid grid-cols-3 gap-3">
               <button onClick={() => setMethod('local')} className={cn("flex flex-col items-center p-4 rounded-xl border-2 transition-all", method === 'local' ? "bg-black border-black text-[#D4FB46]" : "bg-transparent border-black/10 text-black/40")}>
                  <Smartphone className="w-6 h-6 mb-2" />
                  <span className="text-[10px] font-bold uppercase">Local Device</span>
               </button>
               <button onClick={() => setMethod('drive')} className={cn("flex flex-col items-center p-4 rounded-xl border-2 transition-all", method === 'drive' ? "bg-black border-black text-[#D4FB46]" : "bg-transparent border-black/10 text-black/40")}>
                  <UploadCloud className="w-6 h-6 mb-2" />
                  <span className="text-[10px] font-bold uppercase">Google Drive</span>
               </button>
               <button onClick={() => setMethod('dropbox')} className={cn("flex flex-col items-center p-4 rounded-xl border-2 transition-all", method === 'dropbox' ? "bg-black border-black text-[#D4FB46]" : "bg-transparent border-black/10 text-black/40")}>
                  <UploadCloud className="w-6 h-6 mb-2" />
                  <span className="text-[10px] font-bold uppercase">Dropbox</span>
               </button>
            </div>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-black/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-black/[0.02]">
                <FileText className="w-10 h-10 text-black/20 mb-3" />
                <p className="text-sm font-bold text-black/60 mb-1">
                   {file ? file.name : "Drag & Drop or Click to Upload"}
                </p>
                <p className="text-[10px] font-bold text-black/30 uppercase">
                   Supports PDF, MP3, GPX
                </p>
                <input 
                   type="file" 
                   className="hidden" 
                   id="file-upload"
                   onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="file-upload" className="mt-4 px-4 py-2 bg-black/5 rounded-full text-xs font-bold uppercase cursor-pointer hover:bg-black/10 transition-colors">
                   Choose File
                </label>
            </div>

            {/* Manual Details */}
            <div className="space-y-4">
                <div className="group">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Song Title *</label>
                    <input 
                       type="text" 
                       value={details.title}
                       onChange={e => setDetails({...details, title: e.target.value})}
                       className="w-full bg-transparent border-b-2 border-black/10 py-2 text-xl font-bold text-black focus:outline-none focus:border-black transition-all placeholder:text-black/20"
                       placeholder="e.g. Superstition"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="group">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Artist</label>
                        <input 
                           type="text" 
                           value={details.artist}
                           onChange={e => setDetails({...details, artist: e.target.value})}
                           className="w-full bg-transparent border-b-2 border-black/10 py-2 text-lg font-bold text-black focus:outline-none focus:border-black transition-all placeholder:text-black/20"
                           placeholder="e.g. Stevie Wonder"
                        />
                    </div>
                    <div className="group">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Folder</label>
                        <div className="space-y-2">
                             <div className="flex flex-wrap gap-2">
                                 {categories.map(cat => (
                                     <button
                                         key={cat}
                                         onClick={() => setDetails({...details, category: cat})}
                                         className={cn(
                                             "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all",
                                             details.category === cat 
                                                ? "bg-black text-[#D4FB46] border-black" 
                                                : "bg-transparent text-black/40 border-black/10 hover:border-black/30"
                                         )}
                                     >
                                         {cat}
                                     </button>
                                 ))}
                                 <button
                                     onClick={() => setDetails({...details, category: ''})} // Clear to trigger input or use a 'custom' state
                                     className={cn(
                                         "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border border-dashed transition-all flex items-center gap-1",
                                         !categories.includes(details.category) && details.category !== '' 
                                             ? "bg-black text-[#D4FB46] border-black" 
                                             : "text-black/40 border-black/20 hover:border-black/40"
                                     )}
                                 >
                                     <Plus className="w-3 h-3" /> New
                                 </button>
                             </div>
                             {(!categories.includes(details.category) || details.category === '') && (
                                 <input 
                                     type="text"
                                     value={details.category}
                                     onChange={(e) => setDetails({...details, category: e.target.value})}
                                     className="w-full bg-transparent border-b-2 border-black/10 py-1 text-sm font-bold text-black focus:outline-none focus:border-black transition-all placeholder:text-black/20"
                                     placeholder="Type new folder name..."
                                     autoFocus
                                 />
                             )}
                        </div>
                    </div>
                </div>
            </div>

            <button 
               onClick={handleSave}
               disabled={!details.title}
               className="w-full py-4 bg-black text-[#D4FB46] rounded-2xl font-black text-sm uppercase tracking-wider hover:scale-[1.02] transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
               Add to Setlist
            </button>
        </div>
    </RehearsalModalWrapper>
  );
};
