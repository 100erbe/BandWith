import React, { useState, useEffect } from 'react';
import { FileText, Link, Paperclip, X, Plus, Save, Clock, User, CheckCircle2, ArrowLeft, Image as ImageIcon, Music, File } from '@/app/components/icons';
import { SongProposal, ProposalAttachment } from './types';
import { BwSheet, IconButton, PillButton, PillField, Selector, Tag } from '@/app/components/bw';
import { useRailOwnsChrome } from '@/lib/railActions';

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
  // iPhone Duo: the sheet's Back (rail) already returns to the proposal.
  const railOwnsBack = useRailOwnsChrome();
  
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

  const isAdding = view === 'add_attachment';

  return (
    <BwSheet
      open={isOpen}
      onClose={isAdding ? () => setView('edit') : onClose}
      closeLabel={isAdding ? 'Back to proposal' : 'Close'}
      overline={isAdding ? proposal.title : `Song proposal · By ${proposal.proposer}`}
      title={isAdding ? 'Add attachment' : proposal.title}
      zIndex={110}
      footer={
        <div className="dark">
          {isAdding ? (
            <PillButton
              onClick={handleSaveAttachment}
              disabled={!attType || !attLabel || (attType === 'link' && !attUrl)}
              icon={<Paperclip className="w-[18px] h-[18px]" />}
            >
              Add attachment
            </PillButton>
          ) : (
            <PillButton onClick={handleSave} icon={<Save className="w-[18px] h-[18px]" />}>
              Save changes
            </PillButton>
          )}
        </div>
      }
    >
      {isAdding ? (
        /* --- SUB-VIEW: ADD ATTACHMENT --- */
        <div className="dark flex flex-col gap-5">
          {!railOwnsBack && (
            <PillButton
              variant="ghost"
              size="sm"
              fullWidth={false}
              className="self-start -ml-3"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => setView('edit')}
            >
              Back to proposal
            </PillButton>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="bw-label-sm text-sheet-foreground/70 mb-2">Attachment type</legend>
            <div className="flex flex-wrap gap-2">
              {(['link', 'pdf', 'image', 'audio'] as const).map((t) => (
                <Selector key={t} size="md" selected={attType === t} onClick={() => setAttType(t)}>
                  {getIconForType(t)}
                  {t}
                </Selector>
              ))}
            </div>
          </fieldset>

          {attType && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
              {attType === 'link' ? (
                <PillField
                  tone="sheet"
                  type="url"
                  label="URL"
                  icon={<Link className="w-5 h-5" />}
                  value={attUrl}
                  onChange={(e) => setAttUrl(e.target.value)}
                  placeholder="https://…"
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="bw-label-sm text-sheet-foreground/70">Upload file</span>
                  <div className="flex flex-col items-center justify-center gap-2 p-8 rounded-[24px] border-[1.5px] border-dashed border-sheet-foreground/30 text-center">
                    <span className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center">
                      {getIconForType(attType)}
                    </span>
                    <span className="bw-body-sm text-sheet-foreground/70">Tap to upload {attType}</span>
                  </div>
                </div>
              )}

              <PillField
                tone="sheet"
                label="Label (required)"
                value={attLabel}
                onChange={(e) => setAttLabel(e.target.value)}
                placeholder={attType === 'link' ? 'e.g. Live version 2024' : 'e.g. Chart PDF'}
              />
            </div>
          )}
        </div>
      ) : (
        /* --- MAIN VIEW: EDIT --- */
        <div className="dark flex flex-col gap-5">
          <div className="flex flex-wrap gap-1.5">
            <Tag
              variant={proposal.status === 'approved' ? 'accent' : 'outline'}
              icon={proposal.status === 'approved' ? <CheckCircle2 /> : <Clock />}
            >
              {proposal.status}
            </Tag>
            <Tag variant="outline" icon={<User />}>
              By {proposal.proposer}
            </Tag>
            <Tag variant="outline" icon={<Paperclip />}>
              {attachments.length} {attachments.length === 1 ? 'attachment' : 'attachments'}
            </Tag>
          </div>

          {proposal.artist && <p className="bw-body-md text-sheet-foreground/70">{proposal.artist}</p>}

          {/* Reason */}
          <label className="flex flex-col gap-2 p-4 rounded-[24px] bg-white/10 border border-white/20 focus-within:border-2 focus-within:border-white transition-[border-color]">
            <span className="bw-label-sm text-white/70">Reason for proposal</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-transparent outline-none bw-body-lg text-white placeholder:text-white/40 min-h-[96px] resize-none"
              placeholder="Why should we play this?"
            />
          </label>

          {/* Attachments */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="bw-label-sm text-sheet-foreground/70">Attachments</h3>
              <PillButton
                variant="ghost"
                size="sm"
                fullWidth={false}
                className="-mr-3"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setView('add_attachment')}
              >
                Add
              </PillButton>
            </div>

            {attachments.length === 0 && (
              <p className="p-4 rounded-[16px] border-[1.5px] border-dashed border-sheet-foreground/25 bw-body-sm text-sheet-foreground/60 text-center">
                No attachments yet
              </p>
            )}
            {attachments.map((att, i) => (
              <div key={att.id} className="flex items-center gap-3 pl-3 pr-1 py-2 rounded-[16px] bg-white/[0.08]">
                <span className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center shrink-0">
                  {getIconForType(att.type)}
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="bw-body-lg truncate">{att.label}</span>
                  <span className="bw-body-sm text-sheet-foreground/60 truncate">{att.url || att.fileMeta?.name || att.type}</span>
                </div>
                <IconButton
                  label={`Remove ${att.label}`}
                  icon={<X />}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveAttachment(i)}
                />
              </div>
            ))}
          </section>
        </div>
      )}
    </BwSheet>
  );
};
