import React, { useState } from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { Mic2, Link as LinkIcon, Plus, UploadCloud } from 'lucide-react';
import { SongProposal } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPropose: (proposal: SongProposal) => void;
  currentUser: { initials: string };
}

export const RehearsalProposeSongModal: React.FC<Props> = ({ isOpen, onClose, onPropose, currentUser }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [reason, setReason] = useState('');
  const [links, setLinks] = useState<string[]>(['']);
  
  const handleAddLink = () => setLinks([...links, '']);
  const handleLinkChange = (idx: number, val: string) => {
    const newLinks = [...links];
    newLinks[idx] = val;
    setLinks(newLinks);
  };

  const handleSubmit = () => {
    if (!title || !artist) return;
    const newProposal: SongProposal = {
        id: `prop-${Date.now()}`,
        title,
        artist,
        proposer: currentUser.initials,
        reason,
        votes: { yes: 1, no: 0, comments: 0 }, // Auto-vote yes
        status: 'new',
        links: links.filter(l => l.trim() !== ''),
        userVote: 'yes'
    };
    onPropose(newProposal);
    onClose();
    setTitle('');
    setArtist('');
    setReason('');
    setLinks(['']);
  };

  return (
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title="Propose New Song" icon={Mic2}>
        <div className="space-y-6">
            
            {/* Title & Artist */}
            <div className="space-y-4">
                <div>
                   <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Song Title *</label>
                   <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black/5 p-3 rounded-xl font-bold text-black border-none focus:ring-2 focus:ring-black/20 outline-none" placeholder="e.g. Superstition" />
                </div>
                <div>
                   <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Artist *</label>
                   <input value={artist} onChange={e => setArtist(e.target.value)} className="w-full bg-black/5 p-3 rounded-xl font-bold text-black border-none focus:ring-2 focus:ring-black/20 outline-none" placeholder="e.g. Stevie Wonder" />
                </div>
            </div>

            {/* Why This Song */}
            <div>
               <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Why This Song?</label>
               <textarea 
                  value={reason} 
                  onChange={e => setReason(e.target.value)}
                  className="w-full bg-black/5 p-3 rounded-xl font-bold text-black border-none focus:ring-2 focus:ring-black/20 outline-none min-h-[100px] resize-none" 
                  placeholder="Would be great for our funk set! The groove is amazing..."
               />
            </div>

            {/* Links */}
            <div>
               <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2 block">Reference Links</label>
               <div className="space-y-2">
                  {links.map((link, i) => (
                      <div key={i} className="flex items-center gap-2">
                          <LinkIcon className="w-4 h-4 text-black/30" />
                          <input 
                            value={link}
                            onChange={e => handleLinkChange(i, e.target.value)}
                            className="flex-1 bg-transparent border-b border-black/10 py-1 text-sm font-bold text-black focus:outline-none focus:border-black"
                            placeholder="https://youtube.com/..."
                          />
                      </div>
                  ))}
                  <button onClick={handleAddLink} className="text-[10px] font-bold uppercase text-black/40 hover:text-black flex items-center gap-1 mt-1">
                      <Plus className="w-3 h-3" /> Add Link
                  </button>
               </div>
            </div>

            {/* Upload Score */}
            <div>
               <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2 block">Upload Score (Optional)</label>
               <div className="border border-dashed border-black/20 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-black/[0.02] cursor-pointer hover:bg-black/5 transition-colors">
                   <UploadCloud className="w-6 h-6 text-black/30 mb-1" />
                   <span className="text-xs font-bold text-black/50">Drag & drop or click to upload</span>
               </div>
            </div>

            <button 
               onClick={handleSubmit}
               disabled={!title || !artist}
               className="w-full py-4 bg-black text-[#D4FB46] rounded-2xl font-black text-sm uppercase tracking-wider hover:scale-[1.02] transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
               Submit Proposal
            </button>
        </div>
    </RehearsalModalWrapper>
  );
};
