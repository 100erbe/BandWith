import React, { useState, useEffect } from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { FileText, Link, Paperclip, X, Plus, Save, Clock, User, CheckCircle2, ArrowLeft, Image as ImageIcon, Music, File } from 'lucide-react';
import { SongProposal, ProposalAttachment } from './types';
import { cn } from '@/app/components/ui/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  proposal: SongProposal | null;
  onSave: (id: string, reason: string, attachments: ProposalAttachment[]) => void;
}

export const RehearsalEditProposalModal: React.FC<Props> = ({ isOpen, onClose, proposal, onSave }) => {
  const [reason, setReason] = useState('');
  const [attachments, setAttachments] = useState<ProposalAttachment[]>([]);
  
  // Sub-flow State
  const [view, setView] = useState<'edit' | 'add_attachment'>('edit');
  
  // Add Attachment State
  const [attType, setAttType] = useState<ProposalAttachment['type'] | null>(null);
  const [attUrl, setAttUrl] = useState('');
  const [attLabel, setAttLabel] = useState('');
  
  useEffect(() => {
    if (proposal) {
      setReason(proposal.reason || '');
      // Migrate legacy links
      const initialAttachments = (proposal.attachments || []).map(a => ({
          ...a,
          // Ensure legacy attachments have valid types if missing
          type: a.type || 'link'
      }));
      
      if (initialAttachments.length === 0 && proposal.links) {
        proposal.links.forEach(l => initialAttachments.push({ 
            id: `att-${Date.now()}-${Math.random()}`, 
            type: 'link', 
            url: l, 
            label: 'Link' 
        }));
      }
      setAttachments(initialAttachments);
    }
  }, [proposal]);

  // Cleanup when closing sub-flow
  useEffect(() => {
      if (view === 'edit') {
          setAttType(null);
          setAttUrl('');
          setAttLabel('');
      }
  }, [view]);

  const handleSaveAttachment = () => {
      if (!attType || !attLabel) return;
      
      const newAtt: ProposalAttachment = {
          id: `att-${Date.now()}`,
          type: attType,
          label: attLabel,
          url: attType === 'link' ? attUrl : '#', // Mock URL for files
          fileMeta: attType !== 'link' ? { name: attLabel, sizeBytes: 1024 * 500 } : undefined
      };
      
      setAttachments(prev => [...prev, newAtt]);
      setView('edit');
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (proposal) {
      onSave(proposal.id, reason, attachments);
      onClose();
    }
  };

  const getIconForType = (type: ProposalAttachment['type']) => {
      switch (type) {
          case 'link': return <Link className="w-4 h-4" />;
          case 'pdf': return <FileText className="w-4 h-4" />;
          case 'image': return <ImageIcon className="w-4 h-4" />;
          case 'audio': return <Music className="w-4 h-4" />;
          default: return <File className="w-4 h-4" />;
      }
  };

  if (!proposal) return null;

  // --- SUB-VIEW: ADD ATTACHMENT ---
  if (view === 'add_attachment') {
      return (
        <RehearsalModalWrapper isOpen={isOpen} onClose={() => setView('edit')} title="Add Attachment" icon={Paperclip}>
            <div className="flex flex-col h-[60vh]">
                <button onClick={() => setView('edit')} className="flex items-center gap-2 text-xs font-bold uppercase text-black/40 mb-4 hover:text-black">
                    <ArrowLeft className="w-4 h-4" /> Back to Proposal
                </button>

                <div className="flex-1 space-y-6">
                    {/* Type Selection */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Attachment Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['link', 'pdf', 'image', 'audio'] as const).map(t => (
                                <button 
                                    key={t}
                                    onClick={() => setAttType(t)}
                                    className={cn(
                                        "p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold uppercase transition-all",
                                        attType === t ? "bg-black text-white border-black shadow-md" : "bg-white border-black/10 text-black/60 hover:border-black/30"
                                    )}
                                >
                                    {getIconForType(t)} {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {attType && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            {/* URL Input for Links */}
                            {attType === 'link' && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">URL Link</label>
                                    <input 
                                        value={attUrl}
                                        onChange={e => setAttUrl(e.target.value)}
                                        placeholder="https://..."
                                        className="w-full bg-[#F2F2F0] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-1 focus:ring-black"
                                    />
                                </div>
                            )}

                            {/* File Upload Mock */}
                            {attType !== 'link' && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Upload File</label>
                                    <div className="border-2 border-dashed border-black/10 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-black/5 transition-colors">
                                        <div className="w-10 h-10 bg-black/5 rounded-full flex items-center justify-center mb-2 text-black/40">
                                            {getIconForType(attType)}
                                        </div>
                                        <span className="text-xs font-bold text-black/60">Tap to upload {attType}</span>
                                    </div>
                                </div>
                            )}

                            {/* Label Input */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Label (Required)</label>
                                <input 
                                    value={attLabel}
                                    onChange={e => setAttLabel(e.target.value)}
                                    placeholder={attType === 'link' ? "e.g. Live Version 2024" : "e.g. Chart PDF"}
                                    className="w-full bg-[#F2F2F0] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-1 focus:ring-black"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-black/10">
                    <button 
                        onClick={handleSaveAttachment}
                        disabled={!attType || !attLabel || (attType === 'link' && !attUrl)}
                        className="w-full py-3 bg-black text-[#D4FB46] rounded-xl font-bold text-sm uppercase tracking-wider hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Add Attachment
                    </button>
                </div>
            </div>
        </RehearsalModalWrapper>
      );
  }

  // --- MAIN VIEW: EDIT ---
  return (
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title="Edit Proposal Details" icon={FileText}>
      <div className="flex flex-col h-[70vh] md:h-auto">
        
        {/* Swiss Summary Row */}
        <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-black/5 shrink-0">
             <div className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1", proposal.status === 'approved' ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")}>
                 {proposal.status === 'approved' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                 {proposal.status}
             </div>
             <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-bold uppercase text-black/60 flex items-center gap-1">
                 <User className="w-3 h-3" /> By {proposal.proposer}
             </div>
             <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-bold uppercase text-black/60 flex items-center gap-1">
                 <Paperclip className="w-3 h-3" /> {attachments.length} Attachments
             </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
           
           {/* Header Info (Read Only) */}
           <div>
              <h3 className="font-black text-xl text-black leading-none">{proposal.title}</h3>
              <p className="text-xs font-bold uppercase text-black/50 mt-1">{proposal.artist}</p>
           </div>

           {/* Reason */}
           <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1 block">Reason for proposal</label>
              <textarea 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-24 bg-white border border-black/10 rounded-xl p-3 text-sm font-medium focus:border-black focus:ring-1 focus:ring-black transition-all resize-none"
                placeholder="Why should we play this?"
              />
           </div>

           {/* Attachments */}
           <div>
              <div className="flex justify-between items-end mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Attachments</label>
                  <button onClick={() => setView('add_attachment')} className="text-[10px] font-bold uppercase text-black hover:underline flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add Attachment
                  </button>
              </div>

              <div className="space-y-2">
                  {attachments.length === 0 && (
                      <div className="text-center p-4 border-2 border-dashed border-black/5 rounded-xl text-xs text-black/30">
                          No attachments yet
                      </div>
                  )}
                  {attachments.map((att, i) => (
                      <div key={att.id} className="flex items-center justify-between p-3 bg-white border border-black/5 rounded-xl group">
                          <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-black/50 shrink-0">
                                  {getIconForType(att.type)}
                              </div>
                              <div className="truncate">
                                  <div className="text-xs font-bold truncate">{att.label}</div>
                                  <div className="text-[9px] text-black/40 truncate">{att.url || att.fileMeta?.name || att.type}</div>
                              </div>
                          </div>
                          <button onClick={() => handleRemoveAttachment(i)} className="p-2 text-black/20 hover:text-red-500 transition-colors">
                              <X className="w-4 h-4" />
                          </button>
                      </div>
                  ))}
              </div>
           </div>
        </div>

        <div className="pt-4 mt-4 border-t border-black/10 shrink-0">
            <button 
                onClick={handleSave}
                className="w-full py-3 bg-black text-[#D4FB46] rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
            >
                <Save className="w-4 h-4" /> Save Changes
            </button>
        </div>
      </div>
    </RehearsalModalWrapper>
  );
};
