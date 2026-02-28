import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus,
  Mail,
  Phone,
  Music2,
  Crown,
  MoreHorizontal,
  Trash2,
  UserCog,
  Loader2,
  UserPlus,
  Copy,
  Check,
  Users,
  Shield,
  User,
  Search,
  X,
  Send,
  UserCheck
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { useBand } from '@/lib/BandContext';
import { getBandMembers, removeMember, updateMemberRole, inviteMember, searchUsers, addExistingUserToBand } from '@/lib/services/bands';
import type { BandMember } from '@/lib/services/bands';

interface BandMembersViewProps {
  onClose: () => void;
}

interface SearchUser {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

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
      setMembers(prev => prev.filter(m => m.id !== memberId));
    }
    setActionMenuId(null);
  };

  const handleToggleRole = async (member: BandMember) => {
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    const { error } = await updateMemberRole(member.id, newRole);
    if (!error) {
      setMembers(prev => prev.map(m => 
        m.id === member.id ? { ...m, role: newRole } : m
      ));
    }
    setActionMenuId(null);
  };

  const handleEmailMember = (email: string) => {
    window.location.href = `mailto:${email}`;
    setActionMenuId(null);
  };

  // Debounced search
  const handleSearch = useCallback(async (query: string) => {
    if (!selectedBand?.id || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const { data, error: searchError } = await searchUsers(query, selectedBand.id);
    if (data) setSearchResults(data);
    if (searchError) setError(searchError.message);
    setIsSearching(false);
  }, [selectedBand?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inviteMode === 'search') {
        handleSearch(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch, inviteMode]);

  // Add existing user
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

  // Invite by email (new user)
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
      return member.profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (member.profile?.email) {
      return member.profile.email.slice(0, 2).toUpperCase();
    }
    return '??';
  };

  // Calculate stats for hero card
  const stats = useMemo(() => {
    const admins = members.filter(m => m.role === 'admin').length;
    const regularMembers = members.filter(m => m.role === 'member').length;
    const guests = members.filter(m => m.role === 'guest').length;
    const activeMembers = members.filter(m => m.is_active !== false).length;
    const instruments = [...new Set(members.map(m => m.instrument).filter(Boolean))];
    
    return {
      total: members.length,
      admins,
      members: regularMembers,
      guests,
      active: activeMembers,
      instruments
    };
  }, [members]);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-[70] bg-[#E6E5E1] overflow-y-auto"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Header */}
      <div className="px-6 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Team</p>
            <h1 className="text-4xl font-black text-black tracking-tight uppercase">MEMBERS</h1>
            <p className="text-sm text-black/50 font-bold tracking-tight mt-1">{selectedBand?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowInvite(true)}
              className="w-12 h-12 rounded-full bg-[#D4FB46] flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5 text-black" />
            </button>
            <button
              onClick={onClose}
              className="w-12 h-12 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-all"
            >
              <X className="w-6 h-6 text-black/50" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-32">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-black/40" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-black/40">
            <UserPlus className="w-16 h-16 mb-4" />
            <p className="font-bold text-lg mb-2">No members yet</p>
            <p className="text-sm text-center">Invite your bandmates to collaborate</p>
            <button 
              onClick={() => setShowInvite(true)}
              className="mt-6 px-6 py-3 bg-black text-white rounded-full font-bold text-sm hover:scale-105 transition-transform"
            >
              Invite First Member
            </button>
          </div>
        ) : (
          <>
            {/* Hero Card - Team Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-6 p-6 bg-[#1A1A1A] rounded-[2rem] relative overflow-hidden shadow-xl"
            >
              {/* Decorative gradient */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#D4FB46]/10 rounded-full blur-3xl" />
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[#D4FB46] text-[10px] font-bold uppercase tracking-widest block mb-1">Team Strength</span>
                    <h3 className="text-4xl font-black text-white tracking-tighter">{stats.total}</h3>
                    <span className="text-stone-500 text-sm font-medium">
                      {stats.total === 1 ? 'Member' : 'Members'}
                    </span>
                  </div>
                  <div className="w-14 h-14 bg-[#D4FB46] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(212,251,70,0.3)]">
                    <Users className="w-7 h-7 text-[#1A1A1A]" />
                  </div>
                </div>

                {/* Role Distribution */}
                <div className="flex gap-3 mb-5">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex-1 bg-white/5 rounded-xl p-3 border border-white/10"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Crown className="w-4 h-4 text-[#D4FB46]" />
                      <span className="text-[10px] font-bold text-stone-500 uppercase">Admins</span>
                    </div>
                    <span className="text-2xl font-black text-white">{stats.admins}</span>
                  </motion.div>
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="flex-1 bg-white/5 rounded-xl p-3 border border-white/10"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-white" />
                      <span className="text-[10px] font-bold text-stone-500 uppercase">Members</span>
                    </div>
                    <span className="text-2xl font-black text-white">{stats.members}</span>
                  </motion.div>
                  {stats.guests > 0 && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="flex-1 bg-white/5 rounded-xl p-3 border border-white/10"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-stone-400" />
                        <span className="text-[10px] font-bold text-stone-500 uppercase">Guests</span>
                      </div>
                      <span className="text-2xl font-black text-white">{stats.guests}</span>
                    </motion.div>
                  )}
                </div>

                {/* Instruments bar */}
                {stats.instruments.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="flex flex-wrap gap-2"
                  >
                    {stats.instruments.slice(0, 5).map((instrument, i) => (
                      <span 
                        key={i}
                        className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold text-white uppercase tracking-wide"
                      >
                        {instrument}
                      </span>
                    ))}
                    {stats.instruments.length > 5 && (
                      <span className="px-3 py-1 bg-[#D4FB46]/20 rounded-full text-[10px] font-bold text-[#D4FB46] uppercase">
                        +{stats.instruments.length - 5} more
                      </span>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Members List Header */}
            <h4 className="text-[10px] font-bold text-black/40 uppercase tracking-widest mb-3 px-1">All Members</h4>

            <div className="space-y-3">
              {members.map((member, i) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-[1.5rem] p-4 border border-black/5 shadow-sm relative"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full bg-black flex items-center justify-center text-white font-bold text-lg">
                        {getInitials(member)}
                      </div>
                      {member.role === 'admin' && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#D4FB46] flex items-center justify-center border-2 border-white">
                          <Crown className="w-3 h-3 text-black" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div>
                      <h3 className="font-black text-black">
                        {member.stage_name || member.profile?.full_name || 'Unknown'}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {member.instrument && (
                          <span className="flex items-center gap-1 text-xs font-medium text-black/50">
                            <Music2 className="w-3 h-3" />
                            {member.instrument}
                          </span>
                        )}
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                          member.role === 'admin' 
                            ? "bg-[#D4FB46] text-black" 
                            : "bg-black/5 text-black/60"
                        )}>
                          {member.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="relative">
                    <button 
                      onClick={() => setActionMenuId(actionMenuId === member.id ? null : member.id)}
                      className="w-10 h-10 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5 text-black/40" />
                    </button>

                    {/* Action Menu */}
                    <AnimatePresence>
                      {actionMenuId === member.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -10 }}
                          className="absolute right-0 top-12 bg-white rounded-xl shadow-xl border border-black/10 overflow-hidden z-20 min-w-[160px]"
                        >
                          {member.profile?.email && (
                            <button 
                              onClick={() => handleEmailMember(member.profile!.email)}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/80 text-left text-sm font-medium"
                            >
                              <Mail className="w-4 h-4 text-black/40" />
                              Email
                            </button>
                          )}
                          <button 
                            onClick={() => handleToggleRole(member)}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/80 text-left text-sm font-medium"
                          >
                            <UserCog className="w-4 h-4 text-black/40" />
                            Make {member.role === 'admin' ? 'Member' : 'Admin'}
                          </button>
                          <button 
                            onClick={() => handleRemoveMember(member.id)}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 text-left text-sm font-medium text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Contact Info */}
                {member.profile?.email && (
                  <div className="mt-4 pt-4 border-t border-black/5 flex items-center gap-2 text-sm text-black/50">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{member.profile.email}</span>
                  </div>
                )}
              </motion.div>
            ))}
            </div>
          </>
        )}
      </div>

      {/* Invite Modal - Swiss Editorial Fullscreen */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#E6E5E1]"
          >
            {/* Header */}
            <div 
              className="px-6 pt-6 pb-4 flex-shrink-0"
              style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Add to Band</p>
                  <h1 className="text-4xl font-black text-black tracking-tight">MEMBER</h1>
                  <p className="text-sm text-black/50 mt-1">Search or invite a new member</p>
                </div>
                <button 
                  onClick={() => { setShowInvite(false); setSearchQuery(''); setSearchResults([]); setError(null); }}
                  className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors"
                >
                  <X className="w-5 h-5 text-black" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-32">
              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border-l-4 border-red-500 text-red-700 text-sm flex items-center gap-3">
                  <X className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              )}

              {inviteSuccess && (
                <div className="mb-6 p-4 bg-green-500/10 border-l-4 border-green-500 text-green-700 text-sm flex items-center gap-3">
                  <Check className="w-5 h-5 shrink-0" />
                  {inviteSuccess}
                </div>
              )}

              <div className="space-y-8">
                {/* Search Input */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3 block">
                    Search BandWith Users
                  </label>
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
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Found in BandWith</p>
                    {searchResults.map(user => (
                      <motion.button
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => handleAddUser(user)}
                        disabled={inviting}
                        className="w-full p-4 bg-white/50 rounded-2xl flex items-center gap-4 hover:bg-white transition-colors text-left disabled:opacity-50 border border-black/5"
                      >
                        <div className="w-14 h-14 rounded-full bg-black flex items-center justify-center text-white font-bold text-lg">
                          {user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || user.email.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-black text-lg truncate">{user.full_name || 'No name'}</p>
                          <p className="text-sm text-black/50 truncate">{user.email}</p>
                        </div>
                        <div className="px-4 py-2 bg-black text-white rounded-full text-xs font-bold uppercase flex items-center gap-2">
                          <UserCheck className="w-4 h-4" />
                          Add
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* No results - Invite by email */}
                {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                  <div className="p-6 bg-white/50 rounded-2xl text-center border border-dashed border-black/10">
                    <UserPlus className="w-10 h-10 text-black/20 mx-auto mb-3" />
                    <p className="text-sm text-black/60 mb-4">
                      {searchQuery.includes('@') 
                        ? 'User not found. Send them an invitation?' 
                        : 'No users found. Enter an email to invite.'}
                    </p>
                    {searchQuery.includes('@') && (
                      <button
                        onClick={handleInviteByEmail}
                        disabled={inviting}
                        className="px-8 py-3 bg-black text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 mx-auto hover:scale-105 transition-transform disabled:opacity-50"
                      >
                        {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Invite {searchQuery}
                      </button>
                    )}
                  </div>
                )}

                {/* Role Selection */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3 block">
                    Role
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setInviteRole('member')}
                      className={cn(
                        "flex-1 py-4 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all border-2",
                        inviteRole === 'member'
                          ? "bg-black border-black text-white"
                          : "bg-white/50 border-black/10 text-black/50 hover:bg-white"
                      )}
                    >
                      <User className="w-5 h-5 mx-auto mb-1" />
                      Member
                    </button>
                    <button
                      onClick={() => setInviteRole('admin')}
                      className={cn(
                        "flex-1 py-4 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all border-2",
                        inviteRole === 'admin'
                          ? "bg-black border-black text-white"
                          : "bg-white/50 border-black/10 text-black/50 hover:bg-white"
                      )}
                    >
                      <Crown className="w-5 h-5 mx-auto mb-1" />
                      Admin
                    </button>
                  </div>
                  <p className="text-xs text-black/40 text-center mt-3">
                    Members can view band content. Admins can manage members, events, and settings.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div 
              className="fixed bottom-0 inset-x-0 bg-[#E6E5E1] border-t border-black/10 px-6 py-4"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
            >
              <button
                onClick={() => { setShowInvite(false); setSearchQuery(''); setSearchResults([]); setError(null); }}
                className="w-full py-4 bg-black text-white rounded-full font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
