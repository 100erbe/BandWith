import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from '@/app/components/icons';
import { InviteData } from './JoinerInviteLanding';
import { AuthScreen, BackButton, Kicker } from '@/app/components/bw/Form';
import { cn } from '@/app/components/ui/utils';
import { personName } from '@/lib/personName';
import { useT } from '@/lib/i18n';

interface JoinerInviteSelectProps {
  invites: InviteData[];
  onBack: () => void;
  onSelect: (invite: InviteData) => void;
}

export const JoinerInviteSelect: React.FC<JoinerInviteSelectProps> = ({
  invites,
  onBack,
  onSelect,
}) => {
  const t = useT();
  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const inviterOf = (invite: InviteData) =>
    personName(invite.inviter, '') || undefined;

  return (
    <AuthScreen bodyClassName="pt-3 gap-4" top={<BackButton onClick={onBack} className="bw-duo-rail-back" />}>
      <Kicker
        overline={
          invites.length === 1
            ? t('{count} invitation', { count: invites.length })
            : t('{count} invitations', { count: invites.length })
        }
        title={t('Choose your band')}
      />

      {/* Band list — the first invite is featured on the dark surface (Figma) */}
      <div className="flex flex-col gap-4">
        {invites.map((invite, index) => {
          const featured = index === 0;
          const name = invite.band?.name || t('Unknown Band');
          const count = invite.member_count || 0;
          const inviter = inviterOf(invite);
          const role = invite.role === 'admin' ? t('Admin') : t('Member');
          return (
            <motion.button
              key={invite.id}
              type="button"
              onClick={() => onSelect(invite)}
              aria-label={
                inviter
                  ? count === 1
                    ? t('{name}, {count} member, invited as {role} by {inviter}', { name, count, role, inviter })
                    : t('{name}, {count} members, invited as {role} by {inviter}', { name, count, role, inviter })
                  : count === 1
                    ? t('{name}, {count} member, invited as {role}', { name, count, role })
                    : t('{name}, {count} members, invited as {role}', { name, count, role })
              }
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-[24px] text-left',
                'active:scale-[var(--press-scale,0.97)] transition-transform',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                featured ? 'dark bg-sheet text-sheet-foreground' : 'bg-card text-foreground border border-border',
              )}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.06, duration: 0.35 }}
            >
              {/* Band avatar */}
              <div
                className={cn(
                  'w-16 h-16 rounded-full flex items-center justify-center shrink-0 overflow-hidden',
                  featured ? 'bg-accent text-accent-foreground' : 'bg-white text-black border-[1.5px] border-border',
                )}
              >
                {invite.band?.logo_url ? (
                  <img src={invite.band.logo_url} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="bw-h2" aria-hidden>
                    {getInitials(invite.band?.name || 'B')}
                  </span>
                )}
              </div>

              {/* Band info */}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <h3 className="bw-h3 truncate">{name}</h3>
                <p className={cn('bw-body-sm truncate', !featured && 'text-muted-foreground')}>
                  {count === 1 ? t('{count} member', { count }) : t('{count} members', { count })} ·{' '}
                  {inviter ? t('invited by {name}', { name: inviter }) : role}
                </p>
              </div>

              <ChevronRight className="w-5 h-5 shrink-0" aria-hidden />
            </motion.button>
          );
        })}
      </div>

      <p className="bw-body-sm text-muted-foreground">{t('Tap a band to view invitation details.')}</p>
    </AuthScreen>
  );
};

export default JoinerInviteSelect;
