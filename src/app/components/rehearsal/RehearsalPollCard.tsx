import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  AlertCircle,
  Trash2,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import {
  togglePollVote,
  clearUserVotesForPoll,
  finalizePollIntoRehearsal,
  dismissPoll,
  deletePoll,
  type RehearsalPoll,
} from '@/lib/services/rehearsalPolls';
import { haptic } from '@/lib/haptics';
import { StepPad, Card, Tag, PillButton, PillField } from '@/app/components/bw';

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
    haptic.selection();
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
    const { error } = await finalizePollIntoRehearsal({
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
      <Card className="w-full gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="flex items-center gap-2 bw-label-sm text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-accent-rehearsal" />
              {isAuthor && !isAdmin ? 'Your rehearsal proposal' : 'Member rehearsal proposal'}
            </span>
            <h4 className="bw-h2 [overflow-wrap:anywhere]">{poll.title}</h4>
          </div>
          <Tag variant="subtle">Pending admin</Tag>
        </div>

        {/* Proposer Details */}
        <p className="bw-body-sm text-muted-foreground">
          Proposed by{' '}
          <span className="text-foreground font-semibold">
            {poll.creator_profile?.full_name || poll.creator_profile?.email || 'Band member'}
          </span>{' '}
          ·{' '}
          {new Date(poll.created_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </p>

        {/* Preferred Days */}
        {poll.preferred_days && poll.preferred_days.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="bw-label-sm text-muted-foreground mr-1">Preferred</span>
            {poll.preferred_days.map((day) => (
              <Tag key={day} variant="rehearsal">
                {day}
              </Tag>
            ))}
          </div>
        )}

        {/* Optional Notes */}
        {poll.notes && <p className="bw-body-md">{poll.notes}</p>}

        {/* Admin Actions */}
        {isAdmin && (
          <div className="flex items-center justify-end gap-2">
            <PillButton variant="ghost" size="sm" fullWidth={false} loading={dismissing} onClick={handleDismiss}>
              Dismiss
            </PillButton>
            <PillButton
              variant="dark"
              size="sm"
              fullWidth={false}
              onClick={() => onConvertProposal?.(poll)}
              icon={<ArrowUpRight className="w-4 h-4" />}
            >
              Build poll
            </PillButton>
          </div>
        )}
      </Card>
    );
  }

  // 2. ACTIVE AVAILABILITY POLL CARD (For polling status)
  // Figma "Action card": dark card, status row, title, and one Step Pad per
  // option. Tapping a pad toggles your availability; "Details" opens the
  // full list (lock-in, delete, "none work").
  const padOptions = poll.options.slice(0, 8);
  return (
    <div className="dark w-full bg-sheet text-sheet-foreground rounded-[24px] relative overflow-hidden">
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 bw-label-sm">
            <span className="w-2 h-2 rounded-full bg-destructive-solid" />
            Poll · Active
          </span>
          <span
            className={cn(
              'h-4 px-1.5 rounded-full inline-flex items-center bw-label-xs',
              hasUserVotedAny ? 'bg-white/15 text-white' : 'bg-accent text-accent-foreground'
            )}
          >
            {hasUserVotedAny ? 'Voted' : 'Vote now'}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="bw-h2 text-white">{poll.title}</h4>
          <p className="bw-body-sm text-white/75">
            {poll.notes ? `${poll.notes} — ` : 'Select your available options — '}
            {uniqueVoterCount} of {totalMembers} voted
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, padOptions.length))}, minmax(0, 1fr))` }}>
          {padOptions.map((option) => {
            const d = new Date(option.proposed_date + 'T12:00:00');
            const count = option.vote_count || 0;
            const slots = Math.min(Math.max(totalMembers, count, 1), 8);
            return (
              <StepPad
                key={option.id}
                onDark
                selected={!!option.has_voted}
                disabled={votingOptionId === option.id}
                day={d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                date={d.getDate()}
                time={`${(option.start_time || '').slice(0, 5)}${option.end_time ? `–${option.end_time.slice(0, 5)}` : ''}`}
                votes={Array.from({ length: slots }, (_, i) => i < count)}
                onClick={() => handleToggleVote(option.id)}
              />
            );
          })}
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => {
            clearAutoClose();
            setExpanded((prev) => !prev);
          }}
          className="self-start flex items-center gap-1.5 bw-label-sm text-white/70 hover:text-white transition-colors cursor-pointer"
        >
          {expanded ? 'Hide details' : isAdmin ? 'Details · Lock in' : 'Details'}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expanded Candidate Options List */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 min-h-9">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="bw-label-sm text-white/70">Your availability</span>
                  {autoCloseCountdown !== null && (
                    <span className="flex items-center gap-2 bw-label-sm text-white/70">
                      <span className="animate-pulse">· Closing in {autoCloseCountdown}s</span>
                      <button
                        type="button"
                        onClick={clearAutoClose}
                        className="underline underline-offset-2 text-white hover:opacity-80"
                      >
                        Keep open
                      </button>
                    </span>
                  )}
                </div>

                {hasUserVotedAny && (
                  <PillButton variant="ghost" size="sm" fullWidth={false} className="-mr-3 shrink-0" onClick={handleNoneWork}>
                    None work
                  </PillButton>
                )}
              </div>

              {/* Candidate Options */}
              <div className="flex flex-col gap-2">
                {poll.options.map((option) => {
                  const parsedDate = new Date(option.proposed_date + 'T12:00:00');
                  const isWinning = maxVotes > 0 && (option.vote_count || 0) === maxVotes;
                  const isChecked = !!option.has_voted;
                  const isFinalizing = finalizingOptionId === option.id;
                  const isSelectingLocation = showLocationInput === option.id;

                  return (
                    <div
                      key={option.id}
                      className={cn(
                        'rounded-[16px] p-4 flex flex-col gap-3 transition-colors',
                        isChecked ? 'bg-accent text-accent-foreground' : 'bg-white/[0.08] text-white'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Toggle vote */}
                        <button
                          type="button"
                          aria-pressed={isChecked}
                          disabled={votingOptionId === option.id}
                          onClick={() => handleToggleVote(option.id)}
                          className="flex-1 min-w-0 flex flex-col gap-1 text-left cursor-pointer select-none"
                        >
                          <span className="flex items-center gap-2 flex-wrap">
                            <span className="bw-body-lg whitespace-nowrap">
                              {parsedDate.toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            {isWinning && (
                              <Tag variant={isChecked ? 'solid' : 'accent'} className={isChecked ? 'bg-black text-white' : undefined}>
                                Top pick
                              </Tag>
                            )}
                          </span>
                          <span className="bw-body-sm opacity-75 min-w-0 [overflow-wrap:anywhere]">
                            {option.start_time}
                            {option.end_time ? ` – ${option.end_time}` : ''} · {option.vote_count || 0}/{totalMembers} available
                          </span>
                        </button>

                        {/* Admin Action: Lock In Slot */}
                        {isAdmin && (
                          <PillButton
                            size="sm"
                            fullWidth={false}
                            variant={isChecked ? 'dark' : isWinning ? 'primary' : 'outline'}
                            className={isChecked ? 'bg-black text-white' : undefined}
                            aria-expanded={isSelectingLocation}
                            onClick={() => {
                              clearAutoClose();
                              setShowLocationInput(isSelectingLocation ? null : option.id);
                            }}
                          >
                            Lock in
                          </PillButton>
                        )}
                      </div>

                      {/* Voters */}
                      {option.votes && option.votes.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
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
                              <span
                                key={v.id}
                                title={v.profile?.full_name || 'Member'}
                                className="w-7 h-7 rounded-full border border-current/40 bw-label-xs flex items-center justify-center shrink-0 overflow-hidden"
                              >
                                {v.profile?.avatar_url ? (
                                  <img src={v.profile.avatar_url} alt={v.profile?.full_name || 'Voter'} className="w-full h-full object-cover" />
                                ) : (
                                  initials
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Admin Location Prompt when clicking Lock In */}
                      {isAdmin && isSelectingLocation && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex flex-col gap-3 p-4 -mx-1 rounded-[16px] bg-sheet text-white"
                        >
                          <PillField
                            tone="sheet"
                            label="Rehearsal location"
                            icon={<MapPin className="w-5 h-5" />}
                            value={finalLocation}
                            onChange={(e) => setFinalLocation(e.target.value)}
                            placeholder="Location / practice studio"
                          />
                          <PillButton
                            size="md"
                            loading={isFinalizing}
                            icon={<Check className="w-4 h-4" />}
                            onClick={() => handleConfirmFinalize(option.id)}
                          >
                            Confirm &amp; create event
                          </PillButton>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Admin or Creator: Delete Poll with Confirmation */}
              {(isAdmin || poll.created_by === currentUserId) &&
                (!showDeleteConfirm ? (
                  <PillButton
                    variant="danger"
                    size="sm"
                    fullWidth={false}
                    className="self-start -ml-3"
                    icon={<Trash2 className="w-4 h-4" />}
                    onClick={() => {
                      clearAutoClose();
                      setShowDeleteConfirm(true);
                    }}
                  >
                    Delete poll
                  </PillButton>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    role="alertdialog"
                    aria-labelledby={`poll-delete-${poll.id}`}
                    className="flex flex-col gap-3 p-4 rounded-[16px] border-2 border-destructive"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                      <div className="flex flex-col gap-1">
                        <span id={`poll-delete-${poll.id}`} className="bw-h3 text-destructive">
                          Delete rehearsal poll?
                        </span>
                        <p className="bw-body-sm text-white/80">
                          All proposed dates and member votes will be permanently deleted. This cannot be undone.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <PillButton
                        variant="ghost"
                        size="sm"
                        fullWidth={false}
                        disabled={isDeleting}
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </PillButton>
                      <PillButton
                        size="sm"
                        fullWidth={false}
                        loading={isDeleting}
                        icon={<Trash2 className="w-4 h-4" />}
                        className="bg-destructive-solid text-white"
                        onClick={handleDeletePoll}
                      >
                        {isDeleting ? 'Deleting…' : 'Delete poll'}
                      </PillButton>
                    </div>
                  </motion.div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
