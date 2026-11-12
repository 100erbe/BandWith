import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ArrowUpRight, RefreshCw } from '@/app/components/icons';
import { AuthScreen, Kicker, PillButton } from '@/app/components/bw/Form';
import { useOnboarding } from '@/lib/OnboardingContext';
import { personName } from '@/lib/personName';
import { useT } from '@/lib/i18n';

interface JoinerWelcomeBandProps {
  inviteData: any;
  /** Joins the band (server-side) and opens the app. */
  onComplete: () => void;
  joining?: boolean;
  error?: string | null;
}

export const JoinerWelcomeBand: React.FC<JoinerWelcomeBandProps> = ({
  inviteData,
  onComplete,
  joining = false,
  error = null,
}) => {
  const t = useT();
  const { profileData } = useOnboarding();
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const bandName = inviteData?.band?.name || t('Your Band');
  const bandLogo = inviteData?.band?.logo_url;

  // Only what we actually know before joining: who invited you and how many
  // people are in the band. (The member list is visible once you're in.)
  const inviterName =
    personName(inviteData?.inviter, '') || undefined;
  const memberCount: number = inviteData?.member_count ?? 0;
  const bandmates = inviterName
    ? [{ id: 'inviter', name: inviterName, role: t('Invited you'), isAdmin: true }]
    : [];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const youName = profileData?.fullName || t('You');
  const youMeta = profileData?.instruments?.length ? profileData.instruments.join(' · ') : t('Musician');
  // Avatars we can show before joining: the inviter, then a "+N" chip for the rest.
  const othersCount = Math.max(0, memberCount - bandmates.length);

  return (
    <AuthScreen
      className="relative overflow-hidden"
      bodyClassName="pt-10 gap-5 relative z-10"
      footer={
        <PillButton
          onClick={onComplete}
          loading={joining}
          aria-busy={joining}
          icon={error && !joining ? <RefreshCw className="w-5 h-5" /> : undefined}
          trailingIcon={!error ? <ArrowUpRight className="w-5 h-5" /> : undefined}
        >
          <span className="block max-w-[240px] truncate">
            {joining ? t('Joining…') : error ? t('Try again') : t('Join {band}', { band: bandName })}
          </span>
        </PillButton>
      }
    >
      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          {[...Array(40)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{
                background: ['var(--accent)', 'var(--accent-rehearsal)', 'var(--destructive)', 'var(--secondary)'][i % 4],
                left: `${Math.random() * 100}%`,
                top: '-20px',
              }}
              initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
              animate={{
                y: window.innerHeight + 100,
                x: (Math.random() - 0.5) * 200,
                rotate: Math.random() * 720,
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                delay: Math.random() * 0.5,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Accent pill row */}
      <motion.div
        className="flex items-center gap-1"
        aria-hidden
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="w-6 h-2.5 rounded-full bg-accent" />
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35 }}
      >
        <Kicker overline={t('You’re joining')} title={bandName} size="xl" className="break-words" />
      </motion.div>

      {/* Bandmates */}
      <motion.div
        className="bg-card rounded-[24px] p-4 flex flex-col gap-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.35 }}
      >
        <p className="bw-label-md text-foreground">
          {memberCount > 0
            ? memberCount === 1
              ? t('{count} member + you', { count: memberCount })
              : t('{count} members + you', { count: memberCount })
            : t('Your band')}
        </p>
        {(bandmates.length > 0 || othersCount > 0) && (
          <div className="flex items-center">
            {bandmates.map((member) => (
              <div
                key={member.id}
                title={`${member.name} · ${member.role}`}
                className="w-11 h-11 -mr-2 last:mr-0 rounded-full bg-white text-black border-[1.5px] border-border flex items-center justify-center shrink-0"
              >
                <span className="bw-h3" aria-hidden>
                  {getInitials(member.name)}
                </span>
                <span className="sr-only">
                  {member.name}, {member.isAdmin ? `${t('admin')}, ` : ''}
                  {member.role}
                </span>
              </div>
            ))}
            {othersCount > 0 && (
              <div className="w-11 h-11 rounded-full bg-white text-black border-[1.5px] border-border flex items-center justify-center shrink-0">
                <span className="bw-label-md" aria-label={t('and {count} more', { count: othersCount })}>
                  +{othersCount}
                </span>
              </div>
            )}
          </div>
        )}
        {inviterName && <p className="bw-body-sm text-muted-foreground">{t('{name} invited you', { name: inviterName })}</p>}
      </motion.div>

      {/* You (new member) */}
      <motion.div
        className="dark bg-sheet text-sheet-foreground rounded-[24px] p-4 flex items-center gap-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.35 }}
      >
        <div className="w-11 h-11 rounded-full bg-accent text-accent-foreground flex items-center justify-center shrink-0">
          <span className="bw-h3" aria-hidden>
            {getInitials(youName)}
          </span>
        </div>
        <div className="min-w-0 flex flex-col gap-1">
          <p className="bw-h3 truncate">
            {youName}
            <span className="sr-only">, {t('new member')}</span>
          </p>
          <p className="bw-label-sm truncate">{youMeta}</p>
        </div>
      </motion.div>

      {error && (
        <div
          role="alert"
          className="bg-muted border border-destructive rounded-[24px] px-4 py-3 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-destructive" aria-hidden />
          <p className="bw-body-sm text-foreground">{error}</p>
        </div>
      )}
    </AuthScreen>
  );
};

export default JoinerWelcomeBand;
