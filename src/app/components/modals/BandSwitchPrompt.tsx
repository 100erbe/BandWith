import React from 'react';
import { BwSheet } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';

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
export const BandSwitchPrompt: React.FC<BandSwitchPromptProps> = ({ request, onChoose }) => (
  <BwSheet
    open={!!request}
    onClose={() => onChoose('cancel')}
    zIndex={140}
    portal
    overline="Another band"
    title={<span>This is from {request?.bandName}</span>}
    footer={
      request ? (
        <div className="flex flex-col gap-2">
          <PillButton onClick={() => onChoose('switch')}>Switch to {request.bandName}</PillButton>
          {request.allowStay ? (
            <PillButton variant="outline" onClick={() => onChoose('stay')}>
              Just view
            </PillButton>
          ) : (
            <PillButton variant="outline" onClick={() => onChoose('cancel')}>
              Cancel
            </PillButton>
          )}
        </div>
      ) : null
    }
  >
    {request && (
      <p className="bw-body-md text-sheet-foreground/85 pb-2">
        {request.activeBandName ? `You’re in ${request.activeBandName} right now. ` : ''}
        To {request.action}, switch to {request.bandName} first.
        {request.allowStay ? ' You can also just view it without switching.' : ''}
      </p>
    )}
  </BwSheet>
);

export default BandSwitchPrompt;
