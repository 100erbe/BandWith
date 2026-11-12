import React from 'react';
import { motion } from 'motion/react';
import { Mail, RefreshCw, Users } from '@/app/components/icons';
import { AuthScreen, BackButton, Kicker, PillButton } from '@/app/components/bw/Form';
import { useT } from '@/lib/i18n';

interface JoinerNoInvitesProps {
  email: string;
  onBack: () => void;
  onCreateBand: () => void;
}

export const JoinerNoInvites: React.FC<JoinerNoInvitesProps> = ({
  email,
  onBack,
  onCreateBand,
}) => {
  const t = useT();
  const SUGGESTIONS = [
    { icon: Mail, label: t('Check your spam folder') },
    { icon: RefreshCw, label: t('Try another email address') },
    { icon: Users, label: t('Ask your band admin to resend the invite') },
  ];
  // "We couldn't find pending invitations for {email}." with the address highlighted.
  const [notFoundBefore, notFoundAfter = ''] = t("We couldn't find pending invitations for {email}.", {
    email: '\u0000',
  }).split('\u0000');
  return (
    <AuthScreen
      bodyClassName="pt-3 gap-5"
      top={<BackButton onClick={onBack} className="bw-duo-rail-back" />}
      footer={
        <>
          <PillButton variant="ghost" size="sm" onClick={onCreateBand}>
            {t('Or create your own band →')}
          </PillButton>
          <PillButton variant="dark" onClick={onBack}>
            {t('Try another email')}
          </PillButton>
        </>
      }
    >
      <motion.div
        className="flex flex-col gap-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {/* Empty-state dot cluster: 3 × 3, centre dot lit */}
        <div className="grid grid-cols-3 gap-2 self-start" aria-hidden>
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className={i === 4 ? 'w-2.5 h-2.5 rounded-full bg-dot-mid' : 'w-2.5 h-2.5 rounded-full bg-dot-off'} />
          ))}
        </div>

        <Kicker overline={t('Nothing here yet')} title={t('No invites found')} />

        <p className="text-[16px] leading-[1.45] tracking-[-0.003em] text-muted-foreground max-w-[340px] break-words">
          {notFoundBefore}
          <span className="text-foreground font-medium">{email}</span>
          {notFoundAfter}
        </p>

        <div className="bg-card rounded-[24px] p-4 flex flex-col gap-4">
          <p className="bw-label-md text-foreground">{t('What to do')}</p>
          <ul className="flex flex-col gap-4">
            {SUGGESTIONS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-foreground">
                <Icon className="w-5 h-5 shrink-0" aria-hidden />
                <span className="text-[16px] leading-[1.45] tracking-[-0.003em]">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </AuthScreen>
  );
};

export default JoinerNoInvites;
