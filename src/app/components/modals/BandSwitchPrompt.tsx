import React from 'react';
import { BwSheet } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';
import { useT } from '@/lib/i18n';

export type BandSwitchChoice = 'switch' | 'stay' | 'cancel';

export interface BandSwitchRequest {
  /** Band the item belongs to. */
  bandName: string;
  /** Band the user is in right now. */
  activeBandName?: string;
  /** What the user is about to do, as a verb phrase: "edit this event". */
  action: string;
  /**
   * The item can also be looked at without switching (events, chats): offer
   * "Just view" next to the switch.
   */
  allowStay?: boolean;
}

interface BandSwitchPromptProps {
  request: BandSwitchRequest | null;
  onChoose: (choice: BandSwitchChoice) => void;
}

/**
 * Asks before acting on something that belongs to another band than the
 * active one, so a change never lands in the wrong band by mistake.
 */
/** The whole sentence per action, so each language can word it naturally. */
const switchSentence = (t: ReturnType<typeof useT>, action: string, band: string): string => {
  switch (action) {
    case 'edit this event':
      return t('To edit this event, switch to {band} first.', { band });
    case 'delete this event':
      return t('To delete this event, switch to {band} first.', { band });
    case 'confirm this quote':
      return t('To confirm this quote, switch to {band} first.', { band });
    case 'change this quote':
      return t('To change this quote, switch to {band} first.', { band });
    case 'act on it':
      return t('To act on it, switch to {band} first.', { band });
    case 'open it':
      return t('To open it, switch to {band} first.', { band });
    default:
      return t('To {action}, switch to {band} first.', { action, band });
  }
};

export const BandSwitchPrompt: React.FC<BandSwitchPromptProps> = ({ request, onChoose }) => {
  const t = useT();
  return (
    <BwSheet
      open={!!request}
      onClose={() => onChoose('cancel')}
      zIndex={140}
      portal
      overline={t('Another band')}
      title={<span>{request ? t('This is from {band}', { band: request.bandName }) : null}</span>}
      footer={
        request ? (
          <div className="flex flex-col gap-2">
            <PillButton onClick={() => onChoose('switch')}>{t('Switch to {band}', { band: request.bandName })}</PillButton>
            {request.allowStay ? (
              <PillButton variant="outline" onClick={() => onChoose('stay')}>
                {t('Just view')}
              </PillButton>
            ) : (
              <PillButton variant="outline" onClick={() => onChoose('cancel')}>
                {t('Cancel')}
              </PillButton>
            )}
          </div>
        ) : null
      }
    >
      {request && (
        <p className="bw-body-md text-sheet-foreground/85 pb-2">
          {request.activeBandName ? `${t('You’re in {band} right now.', { band: request.activeBandName })} ` : ''}
          {switchSentence(t, request.action, request.bandName)}
          {request.allowStay ? ` ${t('You can also just view it without switching.')}` : ''}
        </p>
      )}
    </BwSheet>
  );
};
