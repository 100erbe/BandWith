import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Mail,
  Music2,
  Crown,
  MoreHorizontal,
  Trash2,
  UserCog,
  Loader2,
  UserPlus,
  Check,
  ArrowLeft,
  Send,
  UserCheck,
  X,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { useBand } from '@/lib/BandContext';
import {
  getBandMembers,
  removeMember,
  updateMemberRole,
  inviteMember,
  searchUsers,
  addExistingUserToBand,
} from '@/lib/services/bands';
import type { BandMember } from '@/lib/services/bands';
import { DotRadio } from '@/app/components/ui/DotRadio';

interface BandMembersViewProps {
  onClose: () => void;
}

interface SearchUser {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

const MembersDotGrid: React.FC<{ filled: number; color: string }> = ({ filled, color }) => {
  const total = 24;
  const count = Math.min(filled, total);
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(0);
    if (count === 0) return;
    let c = 0;
    const iv = setInterval(() => {
      c++;
      setVisible(c);
      if (c >= count) clearInterval(iv);
    }, 40);
    return () => clearInterval(iv);
  }, [count]);

  return (
    <div className="grid grid-cols-6 grid-rows-4 gap-1 w-full h-[72px]">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-[10px]"
          style={{
            backgroundColor: i < count && i < visible ? color : '#CDCACA',
            transition: 'background-color 0.15s',
          }}
        />
      ))}
    </div>
  );
};

export const BandMembersView: React.FC<BandMembersViewProps> = ({ onClose }) => {
  const { selectedBand } = useBand();
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

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await removeMember(memberId);
    if (!error) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
    setActionMenuId(null);
  };

  const handleToggleRole = async (member: BandMember) => {
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    const { error } = await updateMemberRole(member.id, newRole);
    if (!error) {
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m)),
      );
    }
    setActionMenuId(null);
  };

  const handleEmailMember = (email: string) => {
    window.location.href = `mailto:${email}`;
    setActionMenuId(null);
  };

  const handleSearch = useCallback(
    async (query: string) => {
      if (!selectedBand?.id || query.length < 2) {
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

  const handleAddUser = async (user: SearchUser) => {
    if (!selectedBand?.id) return;
    setInviting(true);
    setError(null);

    const { error } = await addExistingUserToBand(selectedBand.id, user.id, inviteRole);

    if (error) {
      setError(error.message);
    } else {
      setInviteSuccess(`${user.full_name || user.email} added!`);
      await fetchMembers();
      setTimeout(() => {
        setShowInvite(false);
        setSearchQuery('');
        setSearchResults([]);
        setInviteSuccess(null);
      }, 1500);
    }
    setInviting(false);
  };

  const handleInviteByEmail = async () => {
    if (!selectedBand?.id || !searchQuery || !searchQuery.includes('@')) return;
    setInviting(true);
    setError(null);

    const { data, error } = await inviteMember(selectedBand.id, searchQuery, inviteRole);

    if (error) {
      setError(error.message);
    } else {
      if (data?.invited) {
        setInviteSuccess('Invitation sent!');
      } else {
        setInviteSuccess('Member added!');
        await fetchMembers();
      }
      setTimeout(() => {
        setShowInvite(false);
        setSearchQuery('');
        setInviteSuccess(null);
      }, 1500);
    }
    setInviting(false);
  };

  const getInitials = (member: BandMember) => {
    if (member.profile?.full_name) {
      return member.profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (member.profile?.email) {
      return member.profile.email.slice(0, 2).toUpperCase();
    }
    return '??';
  };

  const stats = useMemo(() => {
    const admins = members.filter((m) => m.role === 'admin').length;
    const regularMembers = members.filter((m) => m.role === 'member').length;
    return { total: members.length, admins, members: regularMembers };
  }, [members]);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[70] bg-[#E6E5E1] overflow-y-auto overflow-x-hidden"
      style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}
    >
      {/* Header */}
      <div
        className="px-4 shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
      >
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={onClose}
            className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-black shrink-0 active:scale-90 transition-transform"
            style={{ backgroundColor: 'rgba(216,216,216,0.2)' }}
          >
            <ArrowLeft className="w-[24px] h-[24px] text-black" />
          </button>
          <div className="flex flex-col leading-none flex-1">
            <span className="text-[32px] font-bold text-black leading-none">BAND</span>
            <span className="text-[32px] font-bold text-black leading-none">MEMBERS</span>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="w-[50px] h-[50px] rounded-full flex items-center justify-center bg-[#D5FB46] shrink-0 active:scale-90 transition-transform"
          >
            <Plus className="w-[20px] h-[20px] text-black" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-32">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-black/30" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <UserPlus className="w-12 h-12 text-black/20 mb-4" />
            <span className="text-xs font-bold text-black uppercase tracking-wide mb-1">
              No members yet
            </span>
            <span className="text-[10px] font-medium text-black/40 uppercase mb-6">
              Invite your bandmates to collaborate
            </span>
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center justify-between px-5 py-3 rounded-[10px] bg-[#D5FB46] active:scale-95 transition-transform"
            >
              <span className="text-xs font-bold text-black">INVITE FIRST MEMBER</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {/* Stats Row */}
            <div className="flex gap-5">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex-1 flex flex-col gap-2 items-start text-left"
              >
                <span className="text-xs font-bold text-black tracking-wide">TOTAL</span>
                <div className="h-[62px] overflow-hidden">
                  <span className="text-[52px] font-bold leading-none text-black block">
                    {stats.total}
                  </span>
                </div>
                <MembersDotGrid filled={stats.total} color="#D5FB46" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex-1 flex flex-col gap-2 items-start text-left"
              >
                <span className="text-xs font-bold text-black tracking-wide">ADMINS</span>
                <div className="h-[62px] overflow-hidden">
                  <span className="text-[52px] font-bold leading-none text-black block">
                    {stats.admins}
                  </span>
                </div>
                <MembersDotGrid filled={stats.admins} color="#0147FF" />
              </motion.div>
            </div>

            {/* Members List */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col">
                <span className="text-[32px] font-bold leading-none text-black">ALL</span>
                <span className="text-[32px] font-bold leading-none text-black">MEMBERS</span>
              </div>

              <div className="flex flex-col gap-0">
                {members.map((member, i) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="relative"
                  >
                    <div className="flex items-center justify-between py-4 border-b border-black/10">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">
                            {getInitials(member)}
                          </div>
                          {member.role === 'admin' && (
                            <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#D5FB46] flex items-center justify-center">
                              <Crown className="w-2.5 h-2.5 text-black" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-xs font-bold text-black uppercase tracking-wide">
                            {member.stage_name || member.profile?.full_name || 'Unknown'}
                          </span>
                          <span className="text-[10px] font-medium text-black/40 uppercase">
                            {[member.instrument, member.role].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          setActionMenuId(actionMenuId === member.id ? null : member.id)
                        }
                        className="w-8 h-8 flex items-center justify-center active:opacity-70 transition-opacity"
                      >
                        <MoreHorizontal className="w-4 h-4 text-black" />
                      </button>
                    </div>

                    {/* Action Menu */}
                    <AnimatePresence>
                      {actionMenuId === member.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden border-b border-black/10"
                        >
                          <div className="py-2 flex flex-col gap-0">
                            {member.profile?.email && (
                              <button
                                onClick={() => handleEmailMember(member.profile!.email)}
                                className="flex items-center gap-3 py-3 px-2 active:opacity-70 transition-opacity"
                              >
                                <Mail className="w-4 h-4 text-black/40" />
                                <span className="text-xs font-bold text-black uppercase tracking-wide">
                                  EMAIL
                                </span>
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleRole(member)}
                              className="flex items-center gap-3 py-3 px-2 active:opacity-70 transition-opacity"
                            >
                              <UserCog className="w-4 h-4 text-black/40" />
                              <span className="text-xs font-bold text-black uppercase tracking-wide">
                                MAKE {member.role === 'admin' ? 'MEMBER' : 'ADMIN'}
                              </span>
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="flex items-center gap-3 py-3 px-2 active:opacity-70 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4 text-[#A73131]" />
                              <span className="text-xs font-bold text-[#A73131] uppercase tracking-wide">
                                REMOVE
                              </span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#E6E5E1]"
          >
            {/* Header */}
            <div
              className="px-4 shrink-0"
              style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
            >
              <div className="flex items-center gap-4 mb-10">
                <button
                  onClick={() => {
                    setShowInvite(false);
                    setSearchQuery('');
                    setSearchResults([]);
                    setError(null);
                  }}
                  className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-black shrink-0 active:scale-90 transition-transform"
                  style={{ backgroundColor: 'rgba(216,216,216,0.2)' }}
                >
                  <ArrowLeft className="w-[24px] h-[24px] text-black" />
                </button>
                <div className="flex flex-col leading-none">
                  <span className="text-[32px] font-bold text-black leading-none">INVITE</span>
                  <span className="text-[32px] font-bold text-black leading-none">MEMBER</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-32">
              {error && (
                <div className="mb-6 py-3 px-4 border border-[#A73131]/20 rounded-[10px] flex items-center gap-3">
                  <X className="w-4 h-4 text-[#A73131] shrink-0" />
                  <span className="text-xs font-bold text-[#A73131] uppercase">{error}</span>
                </div>
              )}

              {inviteSuccess && (
                <div className="mb-6 py-3 px-4 border border-[#22C55E]/20 rounded-[10px] flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#22C55E] shrink-0" />
                  <span className="text-xs font-bold text-[#22C55E] uppercase">
                    {inviteSuccess}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-10">
                {/* Search Input */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-black/40 uppercase tracking-wide">
                    SEARCH BANDWITH USERS
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Name or email address..."
                      className="w-full bg-transparent border-b-2 border-black/10 py-3 text-xl font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-colors"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 text-black/40 animate-spin" />
                    )}
                  </div>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-black/40 uppercase tracking-wide">
                      FOUND IN BANDWITH
                    </span>
                    <div className="flex flex-col gap-0">
                      {searchResults.map((user) => (
                        <motion.button
                          key={user.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => handleAddUser(user)}
                          disabled={inviting}
                          className="flex items-center justify-between py-4 border-b border-black/10 last:border-0 active:opacity-70 transition-opacity disabled:opacity-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {user.full_name
                                ?.split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase() || user.email.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="text-xs font-bold text-black uppercase tracking-wide">
                                {user.full_name || 'No name'}
                              </span>
                              <span className="text-[10px] font-medium text-black/40 uppercase">
                                {user.email}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 px-3 py-1.5 bg-black rounded-full">
                            <UserCheck className="w-3 h-3 text-white" />
                            <span className="text-[10px] font-bold text-white uppercase">ADD</span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* No results - Invite by email */}
                {searchQuery.length >= 2 &&
                  searchResults.length === 0 &&
                  !isSearching && (
                    <div className="flex flex-col items-center py-8">
                      <UserPlus className="w-10 h-10 text-black/20 mb-3" />
                      <span className="text-[10px] font-medium text-black/40 uppercase mb-4 text-center">
                        {searchQuery.includes('@')
                          ? 'User not found. Send them an invitation?'
                          : 'No users found. Enter an email to invite.'}
                      </span>
                      {searchQuery.includes('@') && (
                        <button
                          onClick={handleInviteByEmail}
                          disabled={inviting}
                          className="flex items-center gap-2 px-5 py-3 bg-black rounded-[10px] active:scale-95 transition-transform disabled:opacity-50"
                        >
                          {inviting ? (
                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                          ) : (
                            <Send className="w-4 h-4 text-white" />
                          )}
                          <span className="text-xs font-bold text-white uppercase">
                            INVITE {searchQuery}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                {/* Role Selection */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-black/40 uppercase tracking-wide">
                    ROLE
                  </span>
                  <div className="flex flex-col gap-0">
                    <button
                      onClick={() => setInviteRole('member')}
                      className="flex items-center justify-between w-full py-4 border-b border-black/10 active:opacity-70 transition-opacity"
                    >
                      <div className="flex items-center gap-3">
                        <Music2 className="w-4 h-4 text-black/40" />
                        <div className="flex flex-col items-start">
                          <span className="text-xs font-bold text-black uppercase tracking-wide">
                            MEMBER
                          </span>
                          <span className="text-[10px] font-medium text-black/40 uppercase">
                            Can view band content
                          </span>
                        </div>
                      </div>
                      <DotRadio
                        selected={inviteRole === 'member'}
                        activeColor={inviteRole === 'member' ? '#000000' : undefined}
                        className="!w-[60px] !h-[38px]"
                      />
                    </button>
                    <button
                      onClick={() => setInviteRole('admin')}
                      className="flex items-center justify-between w-full py-4 border-b border-black/10 active:opacity-70 transition-opacity"
                    >
                      <div className="flex items-center gap-3">
                        <Crown className="w-4 h-4 text-black/40" />
                        <div className="flex flex-col items-start">
                          <span className="text-xs font-bold text-black uppercase tracking-wide">
                            ADMIN
                          </span>
                          <span className="text-[10px] font-medium text-black/40 uppercase">
                            Manage members, events & settings
                          </span>
                        </div>
                      </div>
                      <DotRadio
                        selected={inviteRole === 'admin'}
                        activeColor={inviteRole === 'admin' ? '#000000' : undefined}
                        className="!w-[60px] !h-[38px]"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
