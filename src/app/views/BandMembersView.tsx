import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { hasPlanFeature, isPaidTier } from '@/lib/beta';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Mail,
  Crown,
  MoreHorizontal,
  Trash2,
  UserCog,
  Loader2,
  UserPlus,
  Check,
  Send,
  Search,
  X,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { useBand } from '@/lib/BandContext';
import { useAuth } from '@/lib/AuthContext';
import {
  getBandMembers,
  removeMember,
  updateMemberRole,
  searchUsers,
} from '@/lib/services/bands';
import { inviteToBand } from '@/lib/services/invitations';
import type { BandMember } from '@/lib/services/bands';
import { DotText } from '@/app/components/bw';
import { ScreenHeader, IconButton, Card, Tag, BwSheet } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';
import { personName } from '@/lib/personName';
import { DeputiesSection } from '@/app/components/band/DeputiesSection';
import { useT } from '@/lib/i18n';

/** Small stat card (Figma: label + 24pt dot value). */
const StatCard: React.FC<{ label: string; value: number; delay: number }> = ({ label, value, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="flex-1 min-w-0 flex flex-col gap-1 px-4 py-3 rounded-[24px] bg-card text-card-foreground"
  >
    <span className="bw-label-sm truncate">{label}</span>
    <DotText text={value} size={24} label={`${label}: ${value}`} />
  </motion.div>
);

/** Figma "Avatar" 44: photo or initials on a circle. */
const Avatar: React.FC<{ src?: string | null; alt: string; initials: string; accent?: boolean; className?: string }> = ({
  src,
  alt,
  initials,
  accent,
  className,
}) => (
  <span
    className={cn(
      'w-11 h-11 rounded-full flex items-center justify-center shrink-0 overflow-hidden bw-h3',
      accent ? 'bg-accent text-accent-foreground' : 'bg-white text-black',
      className,
    )}
  >
    {src ? (
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    ) : (
      initials
    )}
  </span>
);

/** Row in the member action menu (dark surface). */
const MenuRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}> = ({ icon, label, hint, danger, disabled, onClick }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    disabled={disabled}
    aria-disabled={disabled || undefined}
    className={cn(
      'w-full min-h-[42px] px-3 py-3 flex items-center gap-3 rounded-[16px] text-left transition-colors hover:bg-sheet-foreground/[0.08]',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent',
      danger ? 'text-destructive' : 'text-sheet-foreground',
    )}
  >
    <span className="shrink-0 flex [&_svg]:w-[18px] [&_svg]:h-[18px]">{icon}</span>
    <span className="flex-1 min-w-0 flex flex-col">
      <span className="bw-label-md">{label}</span>
      {hint && <span className="bw-body-sm text-sheet-foreground/80">{hint}</span>}
    </span>
  </button>
);

interface BandMembersViewProps {
  onClose: () => void;
}

interface SearchUser {
  id: string;
  /** Masked (gi•••@gmail.com) unless the exact address was searched. */
  email: string;
  email_exact?: boolean;
  full_name?: string;
  avatar_url?: string;
}

export const BandMembersView: React.FC<BandMembersViewProps> = ({ onClose }) => {
  const t = useT();
  const { selectedBand, isAdmin } = useBand();
  const { profile: currentProfile } = useAuth();
  const [members, setMembers] = useState<BandMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteShare, setInviteShare] = useState<{ code: string; url: string | null; name: string } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteMode, setInviteMode] = useState<'search' | 'email'>('search');

  useEffect(() => {
    if (selectedBand?.id) {
      fetchMembers();
    }
  }, [selectedBand?.id]);

  const fetchMembers = async () => {
    if (!selectedBand?.id) return;
    setLoading(true);
    const { data, error } = await getBandMembers(selectedBand.id);
    if (data) setMembers(data);
    if (error) setError(error.message);
    setLoading(false);
  };

  const [pendingRemoval, setPendingRemoval] = useState<BandMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [memberNotice, setMemberNotice] = useState<string | null>(null);
  const flashNotice = (text: string) => {
    setMemberNotice(text);
    setTimeout(() => setMemberNotice(null), 5000);
  };
  const adminCount = members.filter((m) => m.role === 'admin').length;
  const isLastAdmin = (member: BandMember) => member.role === 'admin' && adminCount <= 1;

  const handleRemoveMember = (member: BandMember) => {
    setActionMenuId(null);
    if (isLastAdmin(member)) {
      flashNotice(t('A band needs at least one admin. Make someone else admin first.'));
      return;
    }
    setPendingRemoval(member);
  };

  const confirmRemoveMember = async () => {
    if (!pendingRemoval || removing) return;
    setRemoving(true);
    const { error } = await removeMember(pendingRemoval.id);
    setRemoving(false);
    if (error) {
      flashNotice(error.message || t('Could not remove the member. Try again.'));
      return;
    }
    // The database notifies the removed member and the band (migration 046).
    setMembers((prev) => prev.filter((m) => m.id !== pendingRemoval.id));
    setPendingRemoval(null);
  };

  const handleToggleRole = async (member: BandMember) => {
    setActionMenuId(null);
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    if (newRole === 'member' && isLastAdmin(member)) {
      flashNotice(t('A band needs at least one admin. Make someone else admin first.'));
      return;
    }
    const { error } = await updateMemberRole(member.id, newRole);
    if (error) {
      flashNotice(error.message || t('Could not change the role. Try again.'));
      return;
    }
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m)),
    );
  };

  const handleEmailMember = (email: string) => {
    window.location.href = `mailto:${email}`;
    setActionMenuId(null);
  };

  const handleSearch = useCallback(
    async (query: string) => {
      if (!selectedBand?.id || query.trim().length < 3) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      const { data, error: searchError } = await searchUsers(query, selectedBand.id);
      if (data) setSearchResults(data);
      if (searchError) setError(searchError.message);
      setIsSearching(false);
    },
    [selectedBand?.id],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inviteMode === 'search') {
        handleSearch(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch, inviteMode]);

  // Everyone joins by accepting an invitation (no one is added without consent).
  // Existing users see the invite in the app; new users get an email + link.
  const sendInvite = async (target: { email?: string; userId?: string }, displayName: string) => {
    if (!selectedBand?.id) return false;
    setInviting(true);
    setError(null);
    try {
      const result = await inviteToBand({
        bandId: selectedBand.id,
        ...target,
        role: inviteRole,
        inviterName: currentProfile?.full_name ?? undefined,
      });
      if (result.kind === 'existing_user') {
        setInviteSuccess(t('Invite sent to {name}. They’ll see it next time they open BandWith.', { name: displayName }));
      } else {
        // New person: keep the sheet open with the code and a Share button
        // (copying after an await is blocked on iOS, and there may be no email).
        setInviteShare({ code: result.token, url: result.inviteUrl, name: displayName });
        setInviteSuccess(
          result.emailSent
            ? t('Invite emailed to {name}. You can also share it directly.', { name: displayName })
            : t('Invite created for {name}. Share it so they can join.', { name: displayName })
        );
        return true;
      }
      setTimeout(() => {
        setShowInvite(false);
        setSearchQuery('');
        setSearchResults([]);
        setInviteSuccess(null);
      }, 2500);
      return true;
    } catch (e: any) {
      setError(e?.message || t('We couldn’t send the invite. Try again.'));
      return false;
    } finally {
      setInviting(false);
    }
  };

  const handleAddUser = async (user: SearchUser) => {
    // Search results only carry a masked email: invite by id, the server
    // looks the address up.
    await sendInvite(
      user.email_exact ? { email: user.email } : { userId: user.id },
      user.full_name || user.email
    );
  };

  const handleInviteByEmail = async () => {
    if (!selectedBand?.id || !searchQuery || !searchQuery.includes('@')) return;
    const email = searchQuery.trim().toLowerCase();
    await sendInvite({ email }, email);
  };

  const getInitials = (member: BandMember) => {
    if (member.profile?.full_name) {
      return member.profile.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (member.profile?.email) {
      return member.profile.email.slice(0, 2).toUpperCase();
    }
    return '??';
  };

  // Paid plan (Indie Act / single_band is free, so it isn't "Pro").
  const isProMember = (member: BandMember): boolean => isPaidTier(member.profile?.sub_tier);
  // Co-managing a band is a paid feature, open to everyone during the beta.
  const canBeAdmin = (member: BandMember): boolean => hasPlanFeature(member.profile?.sub_tier);

  const stats = useMemo(() => {
    const admins = members.filter((m) => m.role === 'admin').length;
    const regularMembers = members.filter((m) => m.role === 'member').length;
    return { total: members.length, admins, members: regularMembers };
  }, [members]);

  const closeInvite = () => {
    setShowInvite(false);
    setInviteShare(null);
    setInviteSuccess(null);
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
  };

  const userInitials = (user: SearchUser) =>
    user.full_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || user.email.slice(0, 2).toUpperCase();

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="bw-pane-hub fixed inset-0 z-[70] bg-background text-foreground flex flex-col overflow-y-auto overflow-x-hidden"
      style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}
    >
      <ScreenHeader
        onBack={onClose}
        overline={selectedBand?.name}
        title={(() => {
          // Two lines: the first word, then the rest ("Band / members").
          const [first, ...rest] = t('Band members').split(' ');
          return rest.length ? <>{first}<br />{rest.join(' ')}</> : first;
        })()}
        actions={
          isAdmin ? <IconButton label={t('Invite member')} variant="filled" icon={<Plus />} onClick={() => setShowInvite(true)} /> : undefined
        }
      />

      <div className="flex-1 flex flex-col gap-4 px-4 pt-4 max-w-2xl mx-auto w-full" style={{ paddingBottom: isAdmin ? 24 : 'calc(var(--safe-bottom) + 40px)' }}>
        {memberNotice && (
          <p role="alert" className="bw-body-sm text-destructive">{memberNotice}</p>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <Card className="items-center text-center py-10 gap-4">
            <UserPlus className="w-10 h-10 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <h2 className="bw-h3">{t('No members yet')}</h2>
              <p className="bw-body-sm text-muted-foreground">{t('Invite your bandmates to collaborate.')}</p>
            </div>
          </Card>
        ) : (
          <>
            <div className="flex gap-2">
              <StatCard label={t('Total')} value={stats.total} delay={0.05} />
              <StatCard label={t('Admins')} value={stats.admins} delay={0.1} />
              <StatCard label={t('Members')} value={stats.members} delay={0.15} />
            </div>

            <ul className="flex flex-col gap-4" aria-label={t('All members')}>
              {members.map((member, i) => {
                const name = member.stage_name || personName(member.profile, t('Unknown'));
                const open = actionMenuId === member.id;
                const roleLabel = member.role === 'admin' ? t('Admin') : member.role === 'member' ? t('Member') : member.role;
                return (
                  <motion.li
                    key={member.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3) }}
                    className="flex flex-col gap-4"
                  >
                    <div
                      className={cn(
                        'flex items-center gap-3 p-4 pr-3 rounded-[24px] bg-card text-card-foreground border-[1.5px]',
                        open ? 'border-foreground' : 'border-transparent',
                      )}
                    >
                      <Avatar
                        src={member.profile?.avatar_url}
                        alt={personName(member.profile)}
                        initials={getInitials(member)}
                        accent={member.role === 'admin'}
                      />
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="bw-label-md truncate">{name}</span>
                          {isProMember(member) && <Tag variant="solid">Pro</Tag>}
                        </div>
                        <span className="bw-body-sm text-muted-foreground truncate">
                          {[member.instrument, roleLabel].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <IconButton
                        label={t('Actions for {name}', { name })}
                        variant="ghost"
                        size="sm"
                        icon={<MoreHorizontal />}
                        aria-expanded={open}
                        onClick={() => setActionMenuId(open ? null : member.id)}
                      />
                    </div>

                    {/* Member menu (Figma: dark card under the row) */}
                    <AnimatePresence>
                      {open && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden -mt-4"
                        >
                          <div className="dark mt-4 p-2 rounded-[24px] bg-sheet text-sheet-foreground flex flex-col gap-1" role="menu">
                            {member.profile?.email && (
                              <MenuRow icon={<Mail />} label={t('Email')} onClick={() => handleEmailMember(member.profile!.email)} />
                            )}
                            {isAdmin && (
                              <>
                                {member.role === 'admin' ? (
                                  <MenuRow icon={<UserCog />} label={t('Make member')} onClick={() => handleToggleRole(member)} />
                                ) : canBeAdmin(member) ? (
                                  <MenuRow icon={<Crown />} label={t('Make admin')} onClick={() => handleToggleRole(member)} />
                                ) : (
                                  <MenuRow icon={<Crown />} label={t('Make admin')} hint={t('Requires a Pro account to co-manage')} disabled />
                                )}
                                <MenuRow icon={<Trash2 />} label={t('Remove from band')} danger onClick={() => handleRemoveMember(member)} />
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </>
        )}
        {isAdmin && !loading && selectedBand?.id && <DeputiesSection bandId={selectedBand.id} bandName={selectedBand.name} />}
      </div>

      {/* Primary CTA (Figma Button, lime) */}
      {isAdmin && !loading && (
        <div className="sticky bottom-0 px-4 pt-3 bg-background" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
          <div className="max-w-2xl mx-auto w-full">
            <PillButton icon={<Plus className="w-[18px] h-[18px]" />} onClick={() => setShowInvite(true)}>
              {members.length === 0 ? t('Invite first member') : t('Invite member')}
            </PillButton>
          </div>
        </div>
      )}

      {/* Invite member (Figma Sheet, Style=Dark) */}
      <BwSheet
        open={!!pendingRemoval}
        onClose={() => !removing && setPendingRemoval(null)}
        overline={selectedBand?.name}
        title={t('Remove from band?')}
        zIndex={102}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <PillButton variant="outline" onClick={() => setPendingRemoval(null)} disabled={removing}>
              {t('Cancel')}
            </PillButton>
            <PillButton variant="danger" loading={removing} icon={<Trash2 className="w-4 h-4" />} onClick={confirmRemoveMember}>
              {t('Remove')}
            </PillButton>
          </div>
        }
      >
        <p className="bw-body-md text-sheet-foreground/80">
          {t("{name} loses access to the band's events, chats and repertoire. You can invite them again later.", { name: personName(pendingRemoval?.profile, t('This member')) })}
        </p>
      </BwSheet>

      <BwSheet open={showInvite} onClose={closeInvite} overline={selectedBand?.name} title={t('Invite member')} zIndex={102}>
        <div className="dark flex flex-col gap-3 text-sheet-foreground">
          {/* Search (white pill) */}
          <label className="flex items-center gap-3 h-12 px-4 rounded-full bg-white text-black">
            <span className="sr-only">{t('Search BandWith users')}</span>
            <Search className="w-[18px] h-[18px] shrink-0" aria-hidden />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Name or email address…')}
              autoComplete="off"
              className="flex-1 min-w-0 bg-transparent outline-none bw-body-lg placeholder:text-black/40"
            />
            {isSearching ? (
              <Loader2 className="w-[18px] h-[18px] shrink-0 animate-spin text-black/50" />
            ) : (
              searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} aria-label={t('Clear search')} className="-m-2 p-2 shrink-0 text-black/50">
                  <X className="w-4 h-4" />
                </button>
              )
            )}
          </label>

          {error && (
            <div role="alert" className="flex items-center gap-3 p-4 rounded-[16px] bg-sheet-foreground/[0.08] text-destructive">
              <X className="w-[18px] h-[18px] shrink-0" />
              <span className="bw-body-sm">{error}</span>
            </div>
          )}

          {/* Results */}
          {searchResults.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="bw-label-sm text-sheet-foreground/70">{t('Found in BandWith')}</h3>
              {searchResults.map((user) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-[24px] bg-sheet-foreground/[0.08]"
                >
                  <Avatar src={user.avatar_url} alt={user.full_name || user.email} initials={userInitials(user)} />
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="bw-label-md truncate">{user.full_name || t('No name')}</span>
                    <span className="bw-body-sm text-sheet-foreground/70 truncate">{user.email}</span>
                  </div>
                  <PillButton size="sm" fullWidth={false} onClick={() => handleAddUser(user)} disabled={inviting} aria-label={t('Invite {name}', { name: user.full_name || user.email })}>
                    {t('Invite', { context: 'verb' })}
                  </PillButton>
                </motion.div>
              ))}
            </section>
          )}

          {/* No results: invite by email */}
          {searchQuery.trim().length >= 3 && searchResults.length === 0 && !isSearching && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <UserPlus className="w-8 h-8 text-sheet-foreground/50" />
              <p className="bw-body-sm text-sheet-foreground/70">
                {searchQuery.includes('@') ? t('User not found. Send them an invitation?') : t('No users found. Enter an email to invite.')}
              </p>
              {searchQuery.includes('@') && (
                <PillButton
                  size="md"
                  fullWidth={false}
                  loading={inviting}
                  icon={<Send className="w-4 h-4" />}
                  onClick={handleInviteByEmail}
                  className="max-w-full [&>span]:min-w-0 [&>span]:truncate"
                >
                  {t('Invite {name}', { name: searchQuery })}
                </PillButton>
              )}
            </div>
          )}

          {/* Role */}
          <section className="flex flex-col gap-3">
            <h3 className="bw-label-sm text-sheet-foreground/70">{t('Role')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'member', label: t('Member'), desc: t('Can view band content') },
                  { value: 'admin', label: t('Admin'), desc: t('Manage members, events & settings') },
                ] as const
              ).map((role) => {
                const selected = inviteRole === role.value;
                return (
                  <button
                    key={role.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setInviteRole(role.value)}
                    className={cn(
                      'flex flex-col gap-1 p-4 rounded-[24px] text-left active:scale-[0.98] transition-[transform,background-color]',
                      selected ? 'bg-accent text-accent-foreground' : 'bg-sheet-foreground/[0.08] text-sheet-foreground',
                    )}
                  >
                    <span className="bw-label-md">{role.label}</span>
                    <span className={cn('bw-body-sm', !selected && 'text-sheet-foreground/80')}>{role.desc}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {inviteSuccess && (
            <div role="status" className="flex items-center gap-3 p-4 rounded-[16px] bg-sheet-foreground/[0.08]">
              <Check className="w-[18px] h-[18px] shrink-0 text-success" />
              <span className="bw-body-sm">{inviteSuccess}</span>
            </div>
          )}
          {inviteShare && (
            <div className="flex flex-col gap-3 p-4 rounded-[16px] bg-sheet-foreground/[0.08]">
              <span className="bw-label-sm text-sheet-foreground/70">{t('Invite code')}</span>
              <span className="bw-body-sm font-mono select-all [overflow-wrap:anywhere]">{inviteShare.code}</span>
              <span className="bw-body-sm text-sheet-foreground/70">
                {inviteShare.url
                  ? t('They install BandWith, sign up and paste this code, or open the link.')
                  : t('They install BandWith, sign up and paste this code.')}
              </span>
              <div className="grid grid-cols-2 gap-2">
                <PillButton
                  variant="outline"
                  icon={codeCopied ? <Check className="w-4 h-4" /> : undefined}
                  onClick={() => {
                    navigator.clipboard?.writeText(inviteShare.code).then(
                      () => { setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); },
                      () => setError(t('Could not copy. Use Share instead.'))
                    );
                  }}
                >
                  {codeCopied ? t('Copied') : t('Copy code')}
                </PillButton>
                <PillButton
                  onClick={async () => {
                    const text = [
                      `Join ${selectedBand?.name || 'our band'} on BandWith.`,
                      inviteShare.url ? inviteShare.url : null,
                      `Invite code: ${inviteShare.code}`,
                    ].filter(Boolean).join('\n');
                    try {
                      if (Capacitor.isNativePlatform()) {
                        const { Share } = await import('@capacitor/share');
                        await Share.share({ title: 'BandWith invite', text });
                      } else if (navigator.share) {
                        await navigator.share({ title: 'BandWith invite', text });
                      } else {
                        await navigator.clipboard.writeText(text);
                        setCodeCopied(true);
                      }
                    } catch {
                      // share sheet closed
                    }
                  }}
                >
                  {t('Share invite')}
                </PillButton>
              </div>
            </div>
          )}
        </div>
      </BwSheet>
    </motion.div>
  );
};
