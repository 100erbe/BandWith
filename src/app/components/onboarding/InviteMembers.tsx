import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, X, Users, Plus, Send } from '@/app/components/icons';
import { useOnboarding, MemberInvite, INSTRUMENTS } from '@/lib/OnboardingContext';
import { AuthScreen, Kicker, PillButton, PillField } from '@/app/components/bw/Form';
import { ChoicePill, DotMatrixRadio, OnboardingSheet, WizardTop, wizardStep } from './OnboardingChrome';
import { useSheetDrag } from '@/app/components/bw/useSheetDrag';
import { useT } from '@/lib/i18n';
import { useCloseOnBack } from '@/lib/overlayBack';

interface InviteMembersProps {
  onBack: () => void;
  onComplete: () => void;
}

export const InviteMembers: React.FC<InviteMembersProps> = ({
  onBack,
  onComplete,
}) => {
  const t = useT();
  const inviteDrag = useSheetDrag(() => setShowModal(false));
  const { invites, addInvite, removeInvite, path } = useOnboarding();

  const [emailInput, setEmailInput] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currentInvite, setCurrentInvite] = useState<Partial<MemberInvite>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  useCloseOnBack(showModal, () => setShowModal(false));

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleAddEmail = () => {
    const email = emailInput.toLowerCase().trim();
    if (!isValidEmail(email)) return;
    if (invites.some((i) => i.email === email)) return;

    setCurrentInvite({ email });
    setShowModal(true);
    setEmailInput('');
  };

  const handleConfirmInvite = () => {
    if (!currentInvite.email) return;

    addInvite({
      email: currentInvite.email,
      name: currentInvite.name,
      role: currentInvite.role,
      instruments: currentInvite.instruments,
      permission: currentInvite.permission || 'member',
    });

    setShowModal(false);
    setCurrentInvite({});
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Invites will be sent when onboarding completes
    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsSubmitting(false);
    onComplete();
  };

  // Skip means "invite nobody now": drop anything queued so completing
  // onboarding doesn't send it anyway.
  const handleSkip = () => {
    invites.forEach((i) => removeInvite(i.email));
    onComplete();
  };

  // Contact Picker API (Android Chrome / WebView). Hidden where unsupported
  // (iOS WebView), so the button never does nothing.
  type PickedContact = { name?: string[]; email?: string[] };
  const contactsApi = (navigator as Navigator & {
    contacts?: { select: (props: string[], opts: { multiple: boolean }) => Promise<PickedContact[]> };
  }).contacts;
  const canPickContacts = typeof window !== 'undefined' && 'ContactsManager' in window && !!contactsApi;
  const handleImportContacts = async () => {
    if (!contactsApi) return;
    try {
      const picked = await contactsApi.select(['name', 'email'], { multiple: true });
      for (const c of picked) {
        const email = c.email?.[0]?.toLowerCase().trim();
        if (!email || !isValidEmail(email) || invites.some((i) => i.email === email)) continue;
        addInvite({ email, name: c.name?.[0], permission: 'member' });
      }
    } catch {
      // Picker dismissed.
    }
  };

  const { step, total } = wizardStep(path, 'invite');

  const initialsFor = (invite: MemberInvite) => {
    const source = invite.name?.trim() || invite.email.split('@')[0];
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
    return letters.toUpperCase();
  };

  // Instrument ids and the English labels are what gets saved; these are display only.
  const instrumentLabel: Record<string, string> = {
    guitar: t('Guitar'),
    bass: t('Bass'),
    drums: t('Drums'),
    vocals: t('Vocals'),
    keys: t('Keys'),
    saxophone: t('Saxophone'),
  };
  const roleLabel = (role: string) => {
    const inst = INSTRUMENTS.find((i) => i.label === role);
    return (inst && instrumentLabel[inst.id]) || role;
  };

  const metaFor = (invite: MemberInvite) => {
    if (invite.permission === 'admin')
      return invite.role ? t('Admin · {role}', { role: roleLabel(invite.role) }) : t('Admin · full access');
    return invite.role ? t('Musician · {role}', { role: roleLabel(invite.role) }) : t('Musician');
  };

  return (
    <AuthScreen
      top={<WizardTop onBack={onBack} step={step} total={total} />}
      bodyClassName="pt-2 gap-4"
      footer={
        <>
          <PillButton variant="ghost" size="sm" className="text-muted-foreground" onClick={handleSkip} disabled={isSubmitting}>
            {t('Skip for now')}
          </PillButton>
          <PillButton
            onClick={handleSubmit}
            disabled={invites.length === 0 || isSubmitting}
            loading={isSubmitting && invites.length > 0}
            trailingIcon={<Send className="w-5 h-5" />}
          >
            {invites.length > 0
              ? invites.length === 1
                ? t('Send {count} invite', { count: invites.length })
                : t('Send {count} invites', { count: invites.length })
              : t('Send invites')}
          </PillButton>
        </>
      }
    >
      <Kicker overline={t('Your crew')} title={t('Invite your bandmates')} />

      {/* Email Input */}
      <div className="flex items-end gap-2">
        <PillField
          label={t('Email address')}
          type="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="member@email.com"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="email"
          enterKeyHint="done"
          className="flex-1 min-w-0"
          icon={<Mail className="w-5 h-5" strokeWidth={1.75} />}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddEmail();
            }
          }}
        />
        <button
          type="button"
          onClick={handleAddEmail}
          disabled={!isValidEmail(emailInput)}
          aria-label={t('Add bandmate')}
          className="shrink-0 w-11 h-11 rounded-full bg-surface-inverse text-surface-inverse-foreground flex items-center justify-center mb-1 active:scale-[var(--press-scale,0.97)] transition-[transform,opacity] disabled:opacity-30"
        >
          <Plus className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>

      {/* Invited List */}
      {invites.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={t('Invited ({count})', { count: invites.length })}>
          <AnimatePresence initial={false}>
            {invites.map((invite, index) => (
              <motion.li
                key={invite.email}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 bg-card rounded-[24px] px-4 py-3"
              >
                <div className="w-11 h-11 rounded-full bg-field border-[1.5px] border-border text-foreground flex items-center justify-center shrink-0">
                  <span className="font-[family-name:var(--font-display)] font-bold text-[18px] leading-none tracking-[-0.01em] uppercase">
                    {initialsFor(invite)}
                  </span>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="text-[16px] leading-[1.45] tracking-[-0.003em] text-foreground truncate">{invite.email}</p>
                  <p className="bw-label-sm text-muted-foreground truncate">{metaFor(invite)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeInvite(invite.email)}
                  aria-label={t('Remove {email}', { email: invite.email })}
                  className="-m-2.5 p-2.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X className="w-[18px] h-[18px]" strokeWidth={2} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* Empty state */}
      {invites.length === 0 && (
        <div className="flex items-center gap-4 rounded-[24px] border-[1.5px] border-dashed border-border p-4">
          <div className="w-11 h-11 rounded-full bg-card flex items-center justify-center shrink-0">
            <Send className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="bw-body-sm text-muted-foreground">{t('Add emails above to invite your bandmates.')}</p>
        </div>
      )}

      {/* Import from Contacts */}
      {canPickContacts && (
        <PillButton variant="outline" size="md" icon={<Users className="w-[18px] h-[18px]" />} onClick={handleImportContacts}>
          {t('Import from contacts')}
        </PillButton>
      )}

      <p className="bw-body-sm text-muted-foreground">{t('You can invite more members later from Band members.')}</p>

      {/* Invite Detail Sheet */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />

            <motion.div
              className="relative w-full max-w-md"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              {...inviteDrag.sheet}
            >
              <OnboardingSheet
                overline={currentInvite.email}
                handleProps={inviteDrag.handle}
                title={t('Invite details')}
                labelledBy="invite-details-title"
                onClose={() => setShowModal(false)}
                closeIcon={<X className="w-4 h-4" strokeWidth={2} />}
              >
                <div className="flex flex-col gap-5">
                  {/* Name (optional) */}
                  <PillField
                    label={t('Name (optional)')}
                    type="text"
                    value={currentInvite.name || ''}
                    onChange={(e) =>
                      setCurrentInvite((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder={t('Their name')}
                    autoCapitalize="words"
                    enterKeyHint="done"
                  />

                  {/* Role/Instrument */}
                  <div className="flex flex-col gap-3">
                    <p id="invite-role-label" className="bw-label-sm text-muted-foreground">
                      {t('Role / instrument')}
                    </p>
                    <div role="group" aria-labelledby="invite-role-label" className="flex flex-wrap gap-2">
                      {INSTRUMENTS.slice(0, 6).map((inst) => (
                        <ChoicePill
                          key={inst.id}
                          selected={currentInvite.role === inst.label}
                          onClick={() =>
                            setCurrentInvite((prev) => ({
                              ...prev,
                              role: inst.label,
                            }))
                          }
                        >
                          {instrumentLabel[inst.id] ?? inst.label}
                        </ChoicePill>
                      ))}
                    </div>
                  </div>

                  {/* Permission */}
                  <div className="flex flex-col gap-3">
                    <p id="invite-permission-label" className="bw-label-sm text-muted-foreground">
                      {t('Permission')}
                    </p>
                    <div role="radiogroup" aria-labelledby="invite-permission-label" className="flex flex-col gap-2">
                      {(
                        [
                          { id: 'member', label: t('Member'), hint: t('Limited access') },
                          { id: 'admin', label: t('Admin'), hint: t('Full access') },
                        ] as const
                      ).map((opt) => {
                        const selected =
                          opt.id === 'admin' ? currentInvite.permission === 'admin' : currentInvite.permission !== 'admin';
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() =>
                              setCurrentInvite((prev) => ({
                                ...prev,
                                permission: opt.id,
                              }))
                            }
                            className={`w-full flex items-center gap-3 p-4 rounded-[20px] text-left transition-colors ${
                              selected ? 'bg-muted' : 'border border-border'
                            }`}
                          >
                            <DotMatrixRadio checked={selected} />
                            <span className="flex flex-col gap-0.5">
                              <span className="bw-label-md text-foreground">{opt.label}</span>
                              <span className="bw-body-sm text-muted-foreground">{opt.hint}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Confirm Button */}
                  <PillButton onClick={handleConfirmInvite} trailingIcon={<Plus className="w-5 h-5" />}>
                    {t('Add to list')}
                  </PillButton>
                </div>
              </OnboardingSheet>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthScreen>
  );
};

export default InviteMembers;
