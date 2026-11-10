import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Calendar, MessageSquare, Music } from '@/app/components/icons';
import { AuthScreen, BackButton, PillButton, Selector } from '@/app/components/bw/Form';
import { DotMeter } from '@/app/components/bw/Metric';
import { DotText } from '@/app/components/bw/DotText';
import { setStatusBarTone } from '@/lib/systemBars';
import { parseLocalDate } from '@/lib/dates';
import { FIT, FitText } from '@/app/components/bw/FitText';

export interface InviteData {
  id: string;
  band_id: string;
  email: string;
  role: 'admin' | 'member';
  status: string;
  created_at: string;
  expires_at: string;
  band: {
    id: string;
    name: string;
    logo_url?: string;
    description?: string;
  };
  member_count?: number;
  inviter?: {
    full_name?: string;
    email?: string;
  };
}

interface JoinerInviteLandingProps {
  inviteData: InviteData | null;
  onAccept: () => void;
  onDecline: () => void;
  onBack?: () => void;
}

/** Figma metric meter: 2 × 11 dots, one dot per unit. */
const METER_ROWS = 2;
const METER_COLS = 11;

const PERKS = [
  { icon: Calendar, label: 'Band events & shared calendar' },
  { icon: Music, label: 'Shared setlists & song library' },
  { icon: MessageSquare, label: 'Team chat & notifications' },
];

export const JoinerInviteLanding: React.FC<JoinerInviteLandingProps> = ({
  inviteData,
  onAccept,
  onDecline,
  onBack,
}) => {
  const bandName = inviteData?.band?.name || 'Unknown Band';
  const bandLogo = inviteData?.band?.logo_url;
  const inviterName =
    inviteData?.inviter?.full_name ||
    inviteData?.inviter?.email?.split('@')[0] ||
    'A band admin';
  const memberRole = inviteData?.role === 'admin' ? 'Admin' : 'Member';
  const memberCount = inviteData?.member_count || 0;

  // The invite landing is a dark screen (Figma frame in Dark mode): light status bar icons.
  useEffect(() => setStatusBarTone('dark'), []);

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <AuthScreen
      className="dark bg-sheet"
      bodyClassName="pt-3 gap-5"
      top={onBack ? <BackButton onClick={onBack} /> : undefined}
      footer={
        <>
          <PillButton variant="danger" size="sm" onClick={onDecline}>
            Decline invitation
          </PillButton>
          <PillButton onClick={onAccept} trailingIcon={<ArrowUpRight className="w-5 h-5" />}>
            Accept &amp; continue
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
        <Selector className="self-start bg-accent text-accent-foreground">You're invited</Selector>

        {/* Band */}
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-accent text-accent-foreground flex items-center justify-center overflow-hidden shrink-0">
            {bandLogo ? (
              <img src={bandLogo} alt={bandName} className="w-full h-full object-cover" />
            ) : (
              <span className="bw-h1" aria-hidden>
                {getInitials(bandName)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <FitText as="h1" text={bandName} sizes={FIT.h1} maxLines={2} className="bw-h1 text-foreground" />
            {inviteData?.band?.description && (
              <p className="bw-body-sm text-muted-foreground line-clamp-2">{inviteData.band.description}</p>
            )}
          </div>
        </div>

        {/* Metrics: card layout (dots → label → dot-matrix value) */}
        <div className="flex items-center gap-8">
          <div className="flex-1 min-w-0 flex flex-col gap-2 text-foreground">
            <DotMeter
              value={Math.min(memberCount, METER_ROWS * METER_COLS) / (METER_ROWS * METER_COLS)}
              rows={METER_ROWS}
              cols={METER_COLS}
            />
            <span className="bw-label-md">{memberCount === 1 ? 'Member' : 'Members'}</span>
            <DotText text={memberCount} size={30} label={`${memberCount} ${memberCount === 1 ? 'member' : 'members'}`} />
          </div>
          <div className="flex-1" aria-hidden />
        </div>

        {/* Inviter */}
        <div className="bg-card rounded-[24px] p-4 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-white text-black border-[1.5px] border-border flex items-center justify-center shrink-0">
            <span className="bw-label-sm" aria-hidden>
              {getInitials(inviterName)}
            </span>
          </div>
          <p className="bw-body-sm text-muted-foreground min-w-0">
            {inviterName} invited you as <span className="text-foreground font-medium">{memberRole}</span>
            {inviteData?.created_at && <> · Sent {formatDate(inviteData.created_at)}</>}
          </p>
        </div>

        {/* What you'll get */}
        <p className="bw-label-sm text-muted-foreground">What you'll get</p>
        <ul className="flex flex-col gap-3">
          {PERKS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0">
                <Icon className="w-[18px] h-[18px]" aria-hidden />
              </span>
              <span className="text-[18px] font-medium leading-[1.35] tracking-[-0.005em] text-foreground">{label}</span>
            </li>
          ))}
        </ul>
      </motion.div>
    </AuthScreen>
  );
};

export default JoinerInviteLanding;
