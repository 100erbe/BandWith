import React, { useState } from 'react';
import { Link as LinkIcon, Plus, Send, UploadCloud } from '@/app/components/icons';
import { BwSheet, PillButton, PillField } from '@/app/components/bw';
import { SongProposal } from './types';
import { useT } from '@/lib/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPropose: (proposal: SongProposal) => void;
  currentUser: { initials: string };
}

export const RehearsalProposeSongModal: React.FC<Props> = ({ isOpen, onClose, onPropose, currentUser }) => {
  const t = useT();
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
    <BwSheet
      open={isOpen}
      onClose={onClose}
      overline={t('Song proposal')}
      title={t('Propose a song')}
      zIndex={110}
      footer={
        <div className="dark">
          <PillButton
            onClick={handleSubmit}
            disabled={!title || !artist}
            icon={<Send className="w-[18px] h-[18px]" />}
          >
            {t('Submit proposal')}
          </PillButton>
        </div>
      }
    >
      <div className="dark flex flex-col gap-5">
        {/* Title & artist */}
        <PillField
          tone="sheet"
          label={t('Song title *')}
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('e.g. Superstition')}
        />
        <PillField
          tone="sheet"
          label={t('Artist *')}
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder={t('e.g. Stevie Wonder')}
        />

        {/* Why this song */}
        <label className="flex flex-col gap-2 p-4 rounded-[24px] bg-white/10 border border-white/20 focus-within:border-2 focus-within:border-white transition-[border-color]">
          <span className="bw-label-sm text-white/70">{t('Why this song?')}</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-transparent outline-none bw-body-lg text-white placeholder:text-white/40 min-h-[96px] resize-none"
            placeholder={t('Would be great for our funk set! The groove is amazing…')}
          />
        </label>

        {/* Reference links */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="bw-label-sm text-sheet-foreground/70">{t('Reference links')}</h3>
            <PillButton
              variant="ghost"
              size="sm"
              fullWidth={false}
              className="-mr-3"
              icon={<Plus className="w-4 h-4" />}
              onClick={handleAddLink}
            >
              {t('Add link')}
            </PillButton>
          </div>
          {links.map((link, i) => (
            <PillField
              key={i}
              tone="sheet"
              type="url"
              label={t('Reference link {number}', { number: i + 1 })}
              hideLabel
              icon={<LinkIcon className="w-5 h-5" />}
              value={link}
              onChange={(e) => handleLinkChange(i, e.target.value)}
              placeholder="https://youtube.com/…"
            />
          ))}
        </section>

        {/* Upload score */}
        <section className="flex flex-col gap-2">
          <h3 className="bw-label-sm text-sheet-foreground/70">{t('Upload score (optional)')}</h3>
          <div className="flex flex-col items-center justify-center gap-2 p-8 rounded-[24px] border-[1.5px] border-dashed border-sheet-foreground/30 text-center cursor-pointer">
            <span className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </span>
            <span className="bw-body-sm text-sheet-foreground/70">{t('Drag & drop or tap to upload')}</span>
          </div>
        </section>
      </div>
    </BwSheet>
  );
};
