import React from 'react';
import { BwSheet } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';
import { useT } from '@/lib/i18n';

/**
 * Closing a wizard with something typed in it: save it as a draft, throw it
 * away, or go back to it (the sheet's X, the scrim or a swipe down).
 */
export const LeaveWizardSheet: React.FC<{
  open: boolean;
  what: string;
  onSaveDraft: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
  saving?: boolean;
  /** Where the draft shows up afterwards. */
  draftHint?: string;
  /** "Delete draft" when the wizard was reopened from one. */
  discardLabel?: string;
}> = ({ open, what, onSaveDraft, onDiscard, onKeepEditing, saving, draftHint, discardLabel }) => {
  const t = useT();
  // Whole sentences per kind so each language can get the grammar right; callers pass English `what`.
  const title =
    what === 'gig'
      ? t('Save this gig as a draft?')
      : what === 'quote'
        ? t('Save this quote as a draft?')
        : what === 'rehearsal'
          ? t('Save this rehearsal as a draft?')
          : t('Save this {what} as a draft?', { what });
  return (
    <BwSheet
      open={open}
      onClose={onKeepEditing}
      overline={t('Unsaved changes')}
      title={title}
      closeLabel={t('Keep editing')}
      tone="light"
      zIndex={170}
      portal
      footer={
        <div className="flex flex-col gap-2">
          <PillButton onClick={onSaveDraft} loading={saving}>
            {t('Save draft')}
          </PillButton>
          <PillButton variant="outline" onClick={onDiscard} disabled={saving}>
            {discardLabel ?? t('Discard')}
          </PillButton>
        </div>
      }
    >
      <p className="bw-body-md text-muted-foreground">
        {draftHint ?? t('Only you can see drafts, members get nothing until you create it. Pick it up later from Drafts on the home screen, or from its day in the calendar.')}
      </p>
    </BwSheet>
  );
};
