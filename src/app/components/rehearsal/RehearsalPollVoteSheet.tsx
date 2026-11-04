import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Calendar,
  Clock,
  Check,
  Users,
  Sparkles,
  MapPin,
  Loader2,
  ArrowRight,
  CheckCheck,
  Trash2,
  AlertCircle,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import {
  getRehearsalPoll,
  togglePollVote,
  clearUserVotesForPoll,
  finalizePollIntoRehearsal,
  deletePoll,
  type RehearsalPoll,
} from '@/lib/services/rehearsalPolls';
import { markAsRead, type Notification } from '@/lib/services/notifications';

interface RehearsalPollVoteSheetProps {
  notification?: Notification | null;
  pollId?: string;
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  onPollUpdated?: () => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  onOpenAdminWizard?: (proposal: RehearsalPoll) => void;
}

export const RehearsalPollVoteSheet: React.FC<RehearsalPollVoteSheetProps> = ({
  notification,
  pollId,
  currentUserId,
  isAdmin,
  onClose,
  onPollUpdated,
  onShowToast,
  onOpenAdminWizard,
}) => {
  const [poll, setPoll] = useState<RehearsalPoll | null>(null);
  const [loading, setLoading] = useState(true);
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState<string | null>(null);
  const [finalLocation, setFinalLocation] = useState('Band Practice Space');
  const [isClearing, setIsClearing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const effectivePollId = useMemo(() => {
    return pollId || (notification?.data as any)?.poll_id || '';
  }, [pollId, notification]);

  // Fetch poll data
  const loadPoll = useCallback(async () => {
    if (!effectivePollId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await getRehearsalPoll(effectivePollId, currentUserId);
    if (data) {
      setPoll(data);
    }
    setLoading(false);
  }, [effectivePollId, currentUserId]);

  useEffect(() => {
    loadPoll();
  }, [loadPoll]);

  // Handle vote toggle
  const handleToggleVote = async (optionId: string) => {
    if (!poll || votingOptionId) return;
    setVotingOptionId(optionId);

    // Optimistic local state update
    setPoll((prev) => {
      if (!prev || !prev.options) return prev;
      const updatedOptions = prev.options.map((opt) => {
        if (opt.id === optionId) {
          const nextVoted = !opt.has_voted;
          const nextCount = Math.max(0, (opt.vote_count || 0) + (nextVoted ? 1 : -1));
          return {
            ...opt,
            has_voted: nextVoted,
            vote_count: nextCount,
          };
        }
        return opt;
      });
      return { ...prev, options: updatedOptions };
    });

    const { error } = await togglePollVote(poll.id, optionId, currentUserId);
    setVotingOptionId(null);

    if (error) {
      onShowToast?.('Failed to update vote. Please try again.', 'error');
      loadPoll();
    } else {
      if (notification?.id) {
        markAsRead(notification.id).catch(() => {});
      }
      onPollUpdated?.();
    }
  };

  // Handle "None of these work for me"
  const handleNoneWork = async () => {
    if (!poll || isClearing) return;
    setIsClearing(true);

    setPoll((prev) => {
      if (!prev || !prev.options) return prev;
      const updatedOptions = prev.options.map((opt) => ({
        ...opt,
        has_voted: false,
        vote_count: opt.has_voted ? Math.max(0, (opt.vote_count || 0) - 1) : opt.vote_count,
      }));
      return { ...prev, options: updatedOptions };
    });

    const { error } = await clearUserVotesForPoll(poll.id, currentUserId);
    setIsClearing(false);

    if (error) {
      onShowToast?.('Failed to clear votes.', 'error');
      loadPoll();
    } else {
      onShowToast?.('Marked unavailable for candidate dates.', 'info');
      if (notification?.id) {
        markAsRead(notification.id).catch(() => {});
      }
      onPollUpdated?.();
    }
  };

  // Admin finalize option into confirmed rehearsal
  const handleFinalize = async (optionId: string) => {
    if (!poll) return;
    setIsFinalizing(true);

    const { error } = await finalizePollIntoRehearsal({
      pollId: poll.id,
      winningOptionId: optionId,
      bandId: poll.band_id,
      location: finalLocation.trim() || 'Band Practice Space',
      notes: poll.notes || undefined,
      adminId: currentUserId,
    });

    setIsFinalizing(false);

    if (error) {
      onShowToast?.('Failed to finalize rehearsal. Please try again.', 'error');
    } else {
      onShowToast?.('Rehearsal scheduled and confirmed!', 'success');
      if (notification?.id) {
        markAsRead(notification.id).catch(() => {});
      }
      onPollUpdated?.();
      onClose();
    }
  };

  // Permanently delete poll
  const handleDeletePoll = async () => {
    if (!poll) return;
    setIsDeleting(true);
    const { error } = await deletePoll(poll.id);
    setIsDeleting(false);
    setShowDeleteConfirm(false);

    if (error) {
      onShowToast?.('Failed to delete poll. Please try again.', 'error');
    } else {
      onShowToast?.('Rehearsal poll deleted.', 'info');
      if (notification?.id) {
        markAsRead(notification.id).catch(() => {});
      }
      onPollUpdated?.();
      onClose();
    }
  };

  const isProposed = poll?.status === 'proposed';
  const isConfirmed = poll?.status === 'confirmed';

  // Vote analytics
  const maxVotes = useMemo(() => {
    if (!poll?.options?.length) return 0;
    return Math.max(...poll.options.map((o) => o.vote_count || 0));
  }, [poll?.options]);

  const hasUserVotedAny = useMemo(() => {
    if (!poll?.options) return false;
    return poll.options.some((o) => o.has_voted);
  }, [poll?.options]);

  const uniqueVoterCount = useMemo(() => {
    if (!poll?.options) return 0;
    const set = new Set<string>();
    poll.options.forEach((o) => {
      o.votes?.forEach((v) => set.add(v.user_id));
    });
    return set.size;
  }, [poll?.options]);

  const totalMembers = poll?.total_members_count || 1;

  const handleDone = () => {
    if (notification?.id) {
      markAsRead(notification.id).catch(() => {});
    }
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-Up Sheet — Aligned with App Theme */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="fixed bottom-0 left-0 right-0 z-[91] bg-card text-card-foreground border-t sm:border border-foreground/15 rounded-t-[28px] sm:rounded-[28px] px-4 sm:px-6 pt-4 max-h-[88vh] overflow-y-auto shadow-2xl sm:max-w-lg sm:mx-auto sm:bottom-6 sm:max-h-[82vh]"
        style={{ paddingBottom: 'calc(36px + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Top Handle */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full bg-foreground/20" />
        </div>

        {/* Header Bar */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent-rehearsal) 15%, transparent)',
                borderColor: 'color-mix(in srgb, var(--accent-rehearsal) 30%, transparent)',
                color: 'var(--accent-rehearsal)',
              }}
            >
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--accent-rehearsal)]">
                  {isProposed ? 'Rehearsal Proposal' : isConfirmed ? 'Rehearsal Confirmed' : 'Rehearsal Poll'}
                </span>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--accent-rehearsal) 15%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--accent-rehearsal) 25%, transparent)',
                    color: 'var(--accent-rehearsal)',
                  }}
                >
                  {isProposed ? 'Proposal' : isConfirmed ? 'Confirmed' : 'Active'}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-foreground uppercase leading-tight mt-0.5">
                {poll?.title || notification?.title || 'Rehearsal Availability'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-foreground/15 flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/5 active:scale-90 transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-7 h-7 text-[var(--accent-rehearsal)] animate-spin" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Loading poll details...
            </span>
          </div>
        ) : !poll ? (
          <div className="p-6 rounded-2xl bg-background border border-foreground/10 text-center mb-6">
            <p className="text-sm font-semibold text-muted-foreground">
              This rehearsal poll or proposal could not be found or has expired.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-4 py-2 rounded-xl bg-foreground/10 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-foreground/15 transition-all"
            >
              Close
            </button>
          </div>
        ) : isProposed ? (
          /* PROPOSAL VIEW */
          <div className="flex flex-col gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-background border border-foreground/10 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="w-4 h-4 text-[var(--accent-rehearsal)] shrink-0" />
                <span>
                  Proposed by:{' '}
                  <strong className="text-foreground">
                    {poll.creator_profile?.full_name || poll.creator_profile?.email || 'Band Member'}
                  </strong>
                </span>
              </div>

              {poll.preferred_days && poll.preferred_days.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Preferred Days:
                  </span>
                  {poll.preferred_days.map((day) => (
                    <span
                      key={day}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md border"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--accent-rehearsal) 15%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--accent-rehearsal) 25%, transparent)',
                        color: 'var(--accent-rehearsal)',
                      }}
                    >
                      {day}
                    </span>
                  ))}
                </div>
              )}

              {poll.notes && (
                <p className="text-xs text-foreground/80 bg-card rounded-xl p-3 leading-relaxed border border-foreground/10">
                  {poll.notes}
                </p>
              )}
            </div>

            {isAdmin ? (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenAdminWizard?.(poll)}
                  className="w-full py-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-98 flex items-center justify-center gap-2 shadow-xs hover:opacity-95"
                  style={{
                    backgroundColor: 'var(--accent-rehearsal)',
                    color: 'var(--accent-rehearsal-fg)',
                  }}
                >
                  <span>Build Poll from Proposal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-center text-muted-foreground py-2">
                This proposal is awaiting band admin setup into an availability poll.
              </p>
            )}
          </div>
        ) : isConfirmed ? (
          /* CONFIRMED VIEW */
          <div className="flex flex-col gap-4 mb-6">
            <div className="p-5 rounded-2xl bg-background border border-[var(--accent-rehearsal)]/40 flex flex-col gap-3 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--accent-rehearsal) 15%, transparent)',
                  color: 'var(--accent-rehearsal)',
                }}
              >
                <Check className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-black uppercase text-foreground">Rehearsal Confirmed</h4>
              <p className="text-xs text-muted-foreground">
                This poll has been finalized into a confirmed rehearsal on your band calendar.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDone}
              className="w-full py-4 rounded-xl bg-foreground text-background font-black text-xs uppercase tracking-wider active:scale-98 transition-all"
            >
              CLOSE
            </button>
          </div>
        ) : (
          /* ACTIVE AVAILABILITY POLL OPTIONS */
          <div className="flex flex-col gap-4 mb-6">
            {/* Notes & Summary */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[var(--accent-rehearsal)]" />
                <span>
                  {uniqueVoterCount} of {totalMembers} members voted
                </span>
              </div>

              {hasUserVotedAny ? (
                <span className="text-[11px] font-bold text-[var(--success)] flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>You voted</span>
                </span>
              ) : (
                <span className="text-[11px] font-bold text-[var(--accent-rehearsal)]">
                  Select your dates below
                </span>
              )}
            </div>

            {poll.notes && (
              <p className="text-xs text-foreground/80 bg-background rounded-xl p-3 leading-relaxed border border-foreground/10">
                {poll.notes}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Candidate Dates & Times:
              </span>

              {hasUserVotedAny && (
                <button
                  type="button"
                  disabled={isClearing}
                  onClick={handleNoneWork}
                  className="text-[10px] font-bold uppercase text-muted-foreground hover:text-[var(--destructive)] transition-colors"
                >
                  {isClearing ? 'Clearing...' : 'None work for me'}
                </button>
              )}
            </div>

            {/* Candidate Options List */}
            <div className="flex flex-col gap-2.5">
              {poll.options && poll.options.length > 0 ? (
                poll.options.map((option) => {
                  const parsedDate = new Date(option.proposed_date + 'T12:00:00');
                  const isWinning = maxVotes > 0 && (option.vote_count || 0) === maxVotes;
                  const isChecked = !!option.has_voted;
                  const isSelectingLocation = showLocationInput === option.id;

                  return (
                    <div
                      key={option.id}
                      className={cn(
                        'rounded-2xl border p-3.5 sm:p-4 transition-all relative flex flex-col gap-2.5',
                        isChecked
                          ? 'border-[var(--accent-rehearsal)] shadow-xs'
                          : isWinning
                          ? 'bg-card border-[var(--accent-rehearsal)]/40'
                          : 'bg-background border-foreground/10 hover:border-foreground/20'
                      )}
                      style={
                        isChecked
                          ? {
                              backgroundColor:
                                'color-mix(in srgb, var(--accent-rehearsal) 10%, transparent)',
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        {/* Left: Clickable Checkbox + Date/Time */}
                        <div
                          className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer select-none"
                          onClick={() => handleToggleVote(option.id)}
                        >
                          <DotCheckbox
                            checked={isChecked}
                            activeColor="var(--accent-rehearsal)"
                            className="shrink-0"
                          />

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-black text-foreground whitespace-nowrap">
                                {parsedDate.toLocaleDateString(undefined, {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>

                              {isWinning && maxVotes > 0 && (
                                <span
                                  className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs whitespace-nowrap shrink-0"
                                  style={{
                                    backgroundColor: 'var(--accent-rehearsal)',
                                    color: 'var(--accent-rehearsal-fg)',
                                  }}
                                >
                                  Top Pick ({option.vote_count})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mt-0.5">
                              <Clock className="w-3.5 h-3.5 opacity-60 shrink-0" />
                              <span className="whitespace-nowrap">
                                {option.start_time}
                                {option.end_time ? ` – ${option.end_time}` : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Vote count + Admin Lock-in */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span
                              className={cn(
                                'text-xs font-black block',
                                isWinning && maxVotes > 0
                                  ? 'text-[var(--accent-rehearsal)]'
                                  : 'text-foreground'
                              )}
                            >
                              {option.vote_count || 0}/{totalMembers}
                            </span>
                            <span className="text-[9px] font-bold uppercase text-muted-foreground block -mt-0.5 whitespace-nowrap">
                              Available
                            </span>
                          </div>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowLocationInput(isSelectingLocation ? null : option.id);
                              }}
                              className={cn(
                                'py-1.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all border shrink-0',
                                isWinning
                                  ? 'shadow-xs hover:opacity-95'
                                  : 'bg-foreground/5 hover:bg-foreground/10 text-foreground border-foreground/15'
                              )}
                              style={
                                isWinning
                                  ? {
                                      backgroundColor: 'var(--accent-rehearsal)',
                                      color: 'var(--accent-rehearsal-fg)',
                                      borderColor: 'var(--accent-rehearsal)',
                                    }
                                  : undefined
                              }
                            >
                              Lock In
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Voters Avatars */}
                      {option.votes && option.votes.length > 0 && (
                        <div className="flex items-center gap-1.5 pt-2 border-t border-foreground/10">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mr-1 shrink-0">
                            Voted:
                          </span>
                          <div className="flex items-center -space-x-1.5 overflow-hidden flex-wrap">
                            {option.votes.map((v) => {
                              const initials = v.profile?.full_name
                                ? v.profile.full_name
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase()
                                : 'MB';

                              return (
                                <div
                                  key={v.id}
                                  title={v.profile?.full_name || 'Member'}
                                  className="w-6 h-6 rounded-full border-2 border-card bg-foreground/10 text-[9px] font-black text-foreground flex items-center justify-center shrink-0 overflow-hidden"
                                >
                                  {v.profile?.avatar_url ? (
                                    <img
                                      src={v.profile.avatar_url}
                                      alt="voter"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    initials
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Admin Location Prompt when clicking Lock In */}
                      {isAdmin && isSelectingLocation && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 p-3 rounded-xl bg-card border border-[var(--accent-rehearsal)]/30 flex flex-col gap-2"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-rehearsal)]">
                            Confirm Rehearsal Location & Create Event
                          </span>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0 bg-background border border-foreground/15 rounded-lg px-2.5 py-1.5 focus-within:border-[var(--accent-rehearsal)]">
                              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                              <input
                                type="text"
                                value={finalLocation}
                                onChange={(e) => setFinalLocation(e.target.value)}
                                placeholder="Location / Practice Studio"
                                className="w-full min-w-0 bg-transparent text-xs font-bold text-foreground focus:outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={isFinalizing}
                              onClick={() => handleFinalize(option.id)}
                              className="py-2 sm:py-1.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider hover:opacity-95 flex items-center justify-center gap-1.5 shrink-0 active:scale-95 transition-all shadow-xs"
                              style={{
                                backgroundColor: 'var(--accent-rehearsal)',
                                color: 'var(--accent-rehearsal-fg)',
                              }}
                            >
                              {isFinalizing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Confirm</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-4 rounded-xl bg-background border border-foreground/10 text-center text-xs text-muted-foreground">
                  No candidate time slots have been added to this poll yet.
                </div>
              )}
            </div>

            {/* Admin or Creator Action: Delete Poll with Confirmation */}
            {(isAdmin || poll.created_by === currentUserId) && (
              <div className="pt-2 border-t border-foreground/10 flex flex-col gap-2">
                {!showDeleteConfirm ? (
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-[11px] font-bold text-muted-foreground hover:text-[var(--destructive)] flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-[var(--destructive)]/10 transition-colors uppercase tracking-wider"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Poll</span>
                    </button>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3 rounded-xl bg-[var(--destructive)]/10 border border-[var(--destructive)]/30 flex flex-col gap-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[var(--destructive)] shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-black text-[var(--destructive)] uppercase">
                          Delete Rehearsal Poll?
                        </span>
                        <p className="text-[11px] font-medium text-foreground/80 leading-snug">
                          All proposed dates and member votes will be permanently deleted. This cannot be undone.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-colors uppercase"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={handleDeletePoll}
                        className="px-3.5 py-1.5 rounded-lg bg-[var(--destructive)] text-white text-xs font-black uppercase tracking-wider hover:opacity-95 flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>{isDeleting ? 'Deleting...' : 'Delete Poll'}</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* Done Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDone}
                className="w-full py-4 rounded-xl font-black text-xs uppercase tracking-wider active:scale-98 transition-all shadow-xs flex items-center justify-center gap-2 hover:opacity-95"
                style={{
                  backgroundColor: 'var(--accent-rehearsal)',
                  color: 'var(--accent-rehearsal-fg)',
                }}
              >
                <CheckCheck className="w-4 h-4" />
                <span>Done</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
};
