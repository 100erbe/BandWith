import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Clock,
  Check,
  X,
  Users,
  Sparkles,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronUp,
  MapPin,
  HelpCircle,
  AlertCircle,
  Trash2,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import {
  togglePollVote,
  clearUserVotesForPoll,
  finalizePollIntoRehearsal,
  dismissPoll,
  deletePoll,
  type RehearsalPoll,
  type RehearsalPollOption,
} from '@/lib/services/rehearsalPolls';

interface RehearsalPollCardProps {
  poll: RehearsalPoll;
  currentUserId: string;
  isAdmin: boolean;
  onConvertProposal?: (poll: RehearsalPoll) => void;
  onPollUpdated?: () => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  defaultExpanded?: boolean;
}

export const RehearsalPollCard: React.FC<RehearsalPollCardProps> = ({
  poll,
  currentUserId,
  isAdmin,
  onConvertProposal,
  onPollUpdated,
  onShowToast,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
  const [finalizingOptionId, setFinalizingOptionId] = useState<string | null>(null);
  const [showLocationInput, setShowLocationInput] = useState<string | null>(null); // optionId when admin clicks lock-in
  const [finalLocation, setFinalLocation] = useState('Band Practice Space');
  const [dismissing, setDismissing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Status checks
  const isProposed = poll.status === 'proposed';
  const isPolling = poll.status === 'polling';
  const isConfirmed = poll.status === 'confirmed';

  // Calculate highest vote count among options
  const maxVotes = useMemo(() => {
    if (!poll.options || poll.options.length === 0) return 0;
    return Math.max(...poll.options.map((o) => o.vote_count || 0));
  }, [poll.options]);

  // Check if current user has voted on any option in this poll
  const hasUserVotedAny = useMemo(() => {
    if (!poll.options) return false;
    return poll.options.some((o) => o.has_voted);
  }, [poll.options]);

  // Unique voters in this poll
  const uniqueVoterCount = useMemo(() => {
    if (!poll.options) return 0;
    const voterSet = new Set<string>();
    poll.options.forEach((o) => {
      o.votes?.forEach((v) => voterSet.add(v.user_id));
    });
    return voterSet.size;
  }, [poll.options]);

  const totalMembers = poll.total_members_count || 1;

  // Auto-close countdown after voting (5 seconds)
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAutoClose = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setAutoCloseCountdown(null);
  }, []);

  const startAutoClose = useCallback(() => {
    clearAutoClose();
    setAutoCloseCountdown(5);

    countdownIntervalRef.current = setInterval(() => {
      setAutoCloseCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          // Don't auto-close if admin is currently entering location or confirming delete
          setShowLocationInput((currentLocationInput) => {
            setShowDeleteConfirm((currentDeleteConfirm) => {
              if (!currentLocationInput && !currentDeleteConfirm) {
                setExpanded(false);
              }
              return currentDeleteConfirm;
            });
            return currentLocationInput;
          });
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearAutoClose]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Cancel countdown if user manually collapses
  useEffect(() => {
    if (!expanded) {
      clearAutoClose();
    }
  }, [expanded, clearAutoClose]);

  // Toggle vote
  const handleToggleVote = async (optionId: string) => {
    setVotingOptionId(optionId);
    startAutoClose();
    const { error } = await togglePollVote(poll.id, optionId, currentUserId);
    setVotingOptionId(null);

    if (error) {
      clearAutoClose();
      onShowToast?.('Failed to register vote. Please try again.', 'error');
    } else {
      onPollUpdated?.();
    }
  };

  // "None of these work"
  const handleNoneWork = async () => {
    if (!hasUserVotedAny) return;
    startAutoClose();
    const { error } = await clearUserVotesForPoll(poll.id, currentUserId);
    if (!error) {
      onShowToast?.('Cleared your availability for this poll.', 'info');
      onPollUpdated?.();
    } else {
      clearAutoClose();
    }
  };

  // Finalize into official rehearsal
  const handleConfirmFinalize = async (optionId: string) => {
    setFinalizingOptionId(optionId);
    const { data: newEv, error } = await finalizePollIntoRehearsal({
      pollId: poll.id,
      winningOptionId: optionId,
      bandId: poll.band_id,
      location: finalLocation,
      notes: poll.notes || undefined,
      adminId: currentUserId,
    });
    setFinalizingOptionId(null);
    setShowLocationInput(null);

    if (error) {
      onShowToast?.(error.message || 'Failed to create rehearsal.', 'error');
    } else {
      onShowToast?.('Rehearsal scheduled and added to the calendar!', 'success');
      onPollUpdated?.();
    }
  };

  // Dismiss proposal
  const handleDismiss = async () => {
    setDismissing(true);
    const { error } = await dismissPoll(poll.id);
    setDismissing(false);
    if (!error) {
      onShowToast?.('Proposal dismissed.', 'info');
      onPollUpdated?.();
    }
  };

  // Permanently delete poll
  const handleDeletePoll = async () => {
    clearAutoClose();
    setIsDeleting(true);
    const { error } = await deletePoll(poll.id);
    setIsDeleting(false);
    setShowDeleteConfirm(false);

    if (error) {
      onShowToast?.('Failed to delete poll. Please try again.', 'error');
    } else {
      onShowToast?.('Rehearsal poll deleted.', 'info');
      onPollUpdated?.();
    }
  };

  // 1. PROPOSAL CARD (For proposed status)
  if (isProposed) {
    // Only show to band admins or the member who proposed it
    const isAuthor = poll.created_by === currentUserId;
    if (!isAdmin && !isAuthor) return null;

    return (
      <div className="w-full bg-card border border-foreground/15 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:border-foreground/25 relative overflow-hidden">
        {/* Accent strip */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--accent-rehearsal)]" />

        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-rehearsal)]/15 border border-[var(--accent-rehearsal)]/30 text-[var(--accent-rehearsal)] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--accent-rehearsal)] block">
                {isAuthor && !isAdmin ? 'Your Rehearsal Proposal' : 'Member Rehearsal Proposal'}
              </span>
              <h4 className="text-base font-black text-foreground uppercase tracking-tight leading-tight">
                {poll.title}
              </h4>
            </div>
          </div>

          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-foreground/10 text-muted-foreground uppercase tracking-wider shrink-0">
            Pending Admin
          </span>
        </div>

        {/* Proposer Details */}
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            Proposed by: {poll.creator_profile?.full_name || poll.creator_profile?.email || 'Band Member'}
          </span>
          <span>•</span>
          <span>
            {new Date(poll.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>

        {/* Preferred Days */}
        {poll.preferred_days && poll.preferred_days.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Preferred:
            </span>
            {poll.preferred_days.map((day) => (
              <span
                key={day}
                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--accent-rehearsal)]/15 text-[var(--accent-rehearsal)] border border-[var(--accent-rehearsal)]/25"
              >
                {day}
              </span>
            ))}
          </div>
        )}

        {/* Optional Notes */}
        {poll.notes && (
          <p className="text-xs text-foreground/80 bg-background/50 rounded-xl p-3 mb-4 leading-relaxed border border-foreground/10">
            {poll.notes}
          </p>
        )}

        {/* Admin Actions */}
        {isAdmin && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-foreground/10">
            <button
              type="button"
              disabled={dismissing}
              onClick={handleDismiss}
              className="py-2 px-3 rounded-lg text-xs font-bold text-muted-foreground hover:text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-colors uppercase"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => onConvertProposal?.(poll)}
              className="py-2 px-4 rounded-xl bg-[var(--accent-rehearsal)] hover:opacity-95 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs"
            >
              <span>Build Poll from Proposal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // 2. ACTIVE AVAILABILITY POLL CARD (For polling status)
  return (
    <div className="w-full bg-card border border-foreground/15 rounded-2xl shadow-xs transition-all hover:border-foreground/25 relative overflow-hidden">
      {/* Accent header bar */}
      <div className="h-1 bg-[var(--accent-rehearsal)] w-full" />

      {/* Main Bar / Header - Clickable entire card area */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => {
          clearAutoClose();
          setExpanded((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            clearAutoClose();
            setExpanded((prev) => !prev);
          }
        }}
        className="p-4 sm:p-5 cursor-pointer select-none transition-colors hover:bg-foreground/[0.03] active:bg-foreground/[0.06]"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-rehearsal)]/15 border border-[var(--accent-rehearsal)]/30 text-[var(--accent-rehearsal)] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--accent-rehearsal)]">
                  Availability Poll
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent-rehearsal)]/15 text-[var(--accent-rehearsal)] border border-[var(--accent-rehearsal)]/25 uppercase shrink-0">
                  Active
                </span>
              </div>
              <h4 className="text-base font-black text-foreground uppercase tracking-tight leading-tight mt-0.5 truncate">
                {poll.title}
              </h4>
            </div>
          </div>

          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground transition-transform shrink-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {poll.notes && (
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            {poll.notes}
          </p>
        )}

        {/* Participation Summary */}
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pt-1">
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
              Vote now
            </span>
          )}
        </div>
      </div>

      {/* Expanded Candidate Options List */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-foreground/10 px-4 sm:px-5 pb-5 pt-3 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Select your available options:
                </span>
                {autoCloseCountdown !== null && (
                  <span className="text-[10px] font-bold text-[var(--accent-rehearsal)] flex items-center gap-1.5 animate-pulse">
                    <span>• Closing in {autoCloseCountdown}s</span>
                    <button
                      type="button"
                      onClick={clearAutoClose}
                      className="text-[9px] font-semibold text-muted-foreground hover:text-foreground underline uppercase tracking-wider"
                    >
                      Keep open
                    </button>
                  </span>
                )}
              </div>

              {hasUserVotedAny && (
                <button
                  type="button"
                  onClick={handleNoneWork}
                  className="text-[10px] font-bold uppercase text-muted-foreground hover:text-[var(--destructive)] transition-colors"
                >
                  None work for me
                </button>
              )}
            </div>

            {/* Candidate Options */}
            <div className="flex flex-col gap-2.5">
              {poll.options.map((option) => {
                const parsedDate = new Date(option.proposed_date + 'T12:00:00');
                const isWinning = maxVotes > 0 && (option.vote_count || 0) === maxVotes;
                const isChecked = !!option.has_voted;
                const isVoting = votingOptionId === option.id;
                const isFinalizing = finalizingOptionId === option.id;
                const isSelectingLocation = showLocationInput === option.id;

                return (
                  <div
                    key={option.id}
                    className={cn(
                      'rounded-xl border p-3 sm:p-3.5 transition-all relative flex flex-col gap-2.5',
                      isChecked
                        ? 'bg-[var(--accent-rehearsal)]/5 border-[var(--accent-rehearsal)] shadow-2xs'
                        : isWinning
                        ? 'bg-card border-[var(--accent-rehearsal)]/40'
                        : 'bg-card border-foreground/10 hover:border-foreground/20'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      {/* Left: Checkbox + Date/Time */}
                      <div
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none"
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
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[var(--accent-rehearsal)] text-white shadow-2xs whitespace-nowrap shrink-0">
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

                      {/* Right: Vote tally + Admin Lock-in */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Attendance badge */}
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

                        {/* Admin Action: Lock In Slot */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              clearAutoClose();
                              setShowLocationInput(isSelectingLocation ? null : option.id);
                            }}
                            className={cn(
                              'py-1.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all border shrink-0',
                              isWinning
                                ? 'bg-[var(--accent-rehearsal)] text-white border-[var(--accent-rehearsal)] hover:opacity-95 shadow-2xs'
                                : 'bg-foreground/5 hover:bg-foreground/10 text-foreground border-foreground/15'
                            )}
                          >
                            Lock In
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Voters Avatars Row */}
                    {option.votes && option.votes.length > 0 && (
                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-foreground/5">
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
                        className="mt-2 p-3 rounded-xl bg-background border border-[var(--accent-rehearsal)]/30 flex flex-col gap-2"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-rehearsal)]">
                          Confirm Rehearsal Location & Create Event
                        </span>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0 bg-card border border-foreground/15 rounded-lg px-2.5 py-1.5 focus-within:border-[var(--accent-rehearsal)]">
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
                            onClick={() => handleConfirmFinalize(option.id)}
                            className="py-2 sm:py-1.5 px-4 rounded-lg bg-[var(--accent-rehearsal)] text-white text-xs font-black uppercase tracking-wider hover:opacity-95 flex items-center justify-center gap-1.5 shrink-0 shadow-2xs active:scale-95 transition-all"
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
              })}
            </div>

            {/* Admin or Creator Footer Action: Delete Poll with Confirmation */}
            {(isAdmin || poll.created_by === currentUserId) && (
              <div className="pt-2 border-t border-foreground/10 flex flex-col gap-2">
                {!showDeleteConfirm ? (
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        clearAutoClose();
                        setShowDeleteConfirm(true);
                      }}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
