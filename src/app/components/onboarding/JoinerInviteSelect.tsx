import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from '@/app/components/icons';
import { InviteData } from './JoinerInviteLanding';
import { AuthScreen, BackButton, Kicker } from '@/app/components/bw/Form';
import { cn } from '@/app/components/ui/utils';

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
    invite.inviter?.full_name || invite.inviter?.email?.split('@')[0];

  return (
    <AuthScreen bodyClassName="pt-3 gap-4" top={<BackButton onClick={onBack} className="bw-duo-rail-back" />}>
      <Kicker
        overline={`${invites.length} ${invites.length === 1 ? 'invitation' : 'invitations'}`}
        title="Choose your band"
      />

      {/* Band list — the first invite is featured on the dark surface (Figma) */}
      <div className="flex flex-col gap-4">
        {invites.map((invite, index) => {
          const featured = index === 0;
          const name = invite.band?.name || 'Unknown Band';
          const count = invite.member_count || 0;
          const inviter = inviterOf(invite);
          const role = invite.role === 'admin' ? 'Admin' : 'Member';
          return (
            <motion.button
              key={invite.id}
              type="button"
              onClick={() => onSelect(invite)}
              aria-label={`${name}, ${count} ${count === 1 ? 'member' : 'members'}, invited as ${role}${inviter ? ` by ${inviter}` : ''}`}
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
                  {count} {count === 1 ? 'member' : 'members'} · {inviter ? `invited by ${inviter}` : role}
                </p>
              </div>

              <ChevronRight className="w-5 h-5 shrink-0" aria-hidden />
            </motion.button>
          );
        })}
      </div>

      <p className="bw-body-sm text-muted-foreground">Tap a band to view invitation details.</p>
    </AuthScreen>
  );
};

export default JoinerInviteSelect;
