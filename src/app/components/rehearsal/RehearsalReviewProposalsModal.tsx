import React from 'react';
import { MessageCircle, ThumbsUp, CheckCircle2, Clock } from '@/app/components/icons';
import { BwSheet, Tag } from '@/app/components/bw';
import { SongProposal } from './types';
import { cn } from '@/app/components/ui/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  proposals: SongProposal[];
}

export const RehearsalReviewProposalsModal: React.FC<Props> = ({ isOpen, onClose, proposals }) => {
  const approved = proposals.filter(p => p.status === 'approved');
  const pending = proposals.filter(p => p.status === 'pending' || p.status === 'new');

  return (
    <BwSheet
      open={isOpen}
      onClose={onClose}
      overline={`${proposals.length} ${proposals.length === 1 ? 'proposal' : 'proposals'}`}
      title="Proposals outcome"
      zIndex={110}
    >
      <div className="dark flex flex-col gap-5">
        {/* Summary */}
        <div className="flex flex-wrap gap-1.5">
          <Tag variant="outline" icon={<MessageCircle />}>
            Total {proposals.length}
          </Tag>
          <Tag variant="accent" icon={<CheckCircle2 />}>
            Approved {approved.length}
          </Tag>
          <Tag variant="outline" icon={<Clock />}>
            Pending {pending.length}
          </Tag>
        </div>

        {/* Approved */}
        <section className="flex flex-col gap-2">
          <h4 className="bw-label-sm text-sheet-foreground/70">Approved</h4>
          {approved.length === 0 ? (
            <EmptyNote>None yet</EmptyNote>
          ) : (
            approved.map(p => (
              <div key={p.id} className="flex flex-col gap-3 p-4 rounded-[16px] bg-white/[0.08]">
                <ProposalHead proposal={p} />
                {p.reason && (
                  <p className="bw-body-sm text-sheet-foreground/70">“{p.reason}”</p>
                )}
              </div>
            ))
          )}
        </section>

        {/* Pending */}
        <section className="flex flex-col gap-2">
          <h4 className="bw-label-sm text-sheet-foreground/70">Pending</h4>
          {pending.length === 0 ? (
            <EmptyNote>None</EmptyNote>
          ) : (
            pending.map(p => (
              <div key={p.id} className="p-4 rounded-[16px] bg-white/[0.08]">
                <ProposalHead proposal={p} muted />
              </div>
            ))
          )}
        </section>
      </div>
    </BwSheet>
  );
};

const ProposalHead: React.FC<{ proposal: SongProposal; muted?: boolean }> = ({ proposal, muted }) => (
  <div className="flex items-start gap-3">
    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
      <span className={cn('bw-body-lg truncate', muted && 'text-sheet-foreground/70')}>{proposal.title}</span>
      {proposal.artist && <span className="bw-body-sm text-sheet-foreground/60 truncate">{proposal.artist}</span>}
    </div>
    <span
      className="flex items-center gap-1 bw-label-sm text-sheet-foreground/70 shrink-0"
      aria-label={`${proposal.votes.yes} ${proposal.votes.yes === 1 ? 'vote' : 'votes'} in favour`}
    >
      <ThumbsUp className="w-4 h-4" /> {proposal.votes.yes}
    </span>
  </div>
);

const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="p-4 rounded-[16px] border-[1.5px] border-dashed border-sheet-foreground/25 bw-body-sm text-sheet-foreground/60 text-center">
    {children}
  </p>
);
