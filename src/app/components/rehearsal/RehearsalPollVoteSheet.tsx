import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Check,
  Sparkles,
  MapPin,
  Loader2,
  ArrowUpRight,
  Trash2,
  AlertCircle,
} from '@/app/components/icons';
import { IconButton, PillButton, PillField, StepPad, Tag } from '@/app/components/bw';
import { RailSheet } from '@/lib/railActions';
import {
  getRehearsalPoll,
  togglePollVote,
  clearUserVotesForPoll,
  finalizePollIntoRehearsal,
  deletePoll,
  type RehearsalPoll,
} from '@/lib/services/rehearsalPolls';
import { markAsRead, type Notification } from '@/lib/services/notifications';
import { haptic } from '@/lib/haptics';
import { ErrorState } from '@/app/components/ui/ErrorState';
import { FindADateMode } from '@/app/components/duo';
import { personName } from '@/lib/personName';
import { useSheetDrag } from '@/app/components/bw/useSheetDrag';

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
  const drag = useSheetDrag(onClose);
  const [poll, setPoll] = useState<RehearsalPoll | null>(null);
  const [loading, setLoading] = useState(true);
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState<string | null>(null);
  const [finalLocation, setFinalLocation] = useState('Band Practice Space');
  const [isClearing, setIsClearing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // "None work" for this session. There is no per-user response row in the
  // schema (votes are per option), so this is not persisted: it clears the
  // user's votes and shows their answer until the sheet closes.
  const [declinedAll, setDeclinedAll] = useState(false);

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
    setLoadError(null);
    const { data, error } = await getRehearsalPoll(effectivePollId, currentUserId);
    if (data) {
      setPoll(data);
    } else if (error && !/not found|PGRST116/i.test(`${error.message} ${(error as any).code || ''}`)) {
      setLoadError(error.message || 'Check your connection and try again.');
    }
    setLoading(false);
  }, [effectivePollId, currentUserId]);

  useEffect(() => {
    loadPoll();
  }, [loadPoll]);

  // Handle vote toggle
  const handleToggleVote = async (optionId: string) => {
    if (!poll || votingOptionId) return;
    haptic.selection();
    setVotingOptionId(optionId);
    setDeclinedAll(false);

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
    haptic.selection();
    if (!hasUserVotedAny) {
      // Nothing to clear: record the answer for this session only.
      setDeclinedAll(true);
      onShowToast?.('Marked unavailable for all dates.', 'info');
      return;
    }
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
      onShowToast?.(`Couldn't clear your votes: ${error.message || 'please try again.'}`, 'error');
      loadPoll();
    } else {
      setDeclinedAll(true);
      onShowToast?.('Marked unavailable for all dates.', 'info');
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

  // rehearsal_polls.vote_by (migration 058); absent on older databases.
  const voteByLabel = useMemo(() => {
    const raw = (poll as (RehearsalPoll & { vote_by?: string | null }) | null)?.vote_by;
    if (!raw) return null;
    const d = new Date(String(raw).slice(0, 10) + 'T12:00:00');
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }, [poll]);

  const handleDone = () => {
    if (notification?.id) {
      markAsRead(notification.id).catch(() => {});
    }
    onClose();
  };

  const overline = !poll
    ? 'Rehearsal poll'
    : isProposed
      ? 'Rehearsal proposal'
      : isConfirmed
        ? 'Rehearsal · Confirmed'
        : 'Rehearsal poll · Active';

  const initialsOf = (name?: string | null) =>
    name
      ? name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : 'MB';

  const isActivePoll = !loading && !!poll && !isProposed && !isConfirmed;
  const anyVotes = !!poll?.options?.some((o) => (o.vote_count || 0) > 0);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="bw-rail-sheet fixed inset-0 z-[184] bg-black/60"
        onClick={onClose}
      />

      {/* Figma "Rehearsal / Poll vote sheet": dark sheet + Sheet Header */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="poll-vote-title"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        data-state="open"
        // iPhone Duo open: a rehearsal detail on the trailing page moves to the
        // leading page while you vote (Figma "Open · Event detail / Rehearsal |
        // Rehearsal / Poll vote sheet").
        className="bw-rail-sheet bw-picker dark fixed bottom-0 left-0 right-0 z-[185] bg-sheet text-sheet-foreground rounded-t-[32px] max-h-[88vh] flex flex-col sm:max-w-lg sm:mx-auto sm:bottom-6 sm:rounded-[32px] sm:max-h-[82vh]"
        {...drag.sheet}
      >
        {/* Sheet Header */}
        <div className="shrink-0 px-5 pt-3 pb-2 flex flex-col gap-3" {...drag.handle}>
          <span className="mx-auto w-10 h-[5px] rounded-full bg-sheet-foreground/85" />
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <p className="bw-label-sm text-sheet-foreground/85">{overline}</p>
              <h2 id="poll-vote-title" className="bw-h1 [overflow-wrap:anywhere]">
                {poll?.title || notification?.title || 'Rehearsal availability'}
              </h2>
            </div>
            <RailSheet onClose={onClose} />
            <IconButton label="Close" icon={<X />} size="sm" variant="sheet" onClick={onClose} />
          </div>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto px-5 pt-3 pb-4"
          style={isActivePoll ? undefined : { paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-sheet-foreground/70" />
              <span className="bw-label-sm text-sheet-foreground/70">Loading poll details…</span>
            </div>
          ) : !poll && loadError ? (
            <ErrorState
              className="py-6 px-0"
              title="Couldn't load this poll"
              body={loadError}
              onRetry={loadPoll}
              onBack={onClose}
            />
          ) : !poll ? (
            <div className="flex flex-col gap-4">
              <p className="bw-body-md text-sheet-foreground/80">
                This rehearsal poll or proposal could not be found or has expired.
              </p>
              <PillButton variant="outline" onClick={onClose}>
                Close
              </PillButton>
            </div>
          ) : isProposed ? (
            /* PROPOSAL VIEW */
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 p-4 rounded-[16px] bg-sheet-foreground/[0.08]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <p className="bw-body-sm text-sheet-foreground/80">
                    Proposed by{' '}
                    <span className="text-sheet-foreground font-semibold">
                      {personName(poll.creator_profile, 'Band member')}
                    </span>
                  </p>
                </div>

                {poll.preferred_days && poll.preferred_days.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="bw-label-sm text-sheet-foreground/70 mr-1">Preferred days</span>
                    {poll.preferred_days.map((day) => (
                      <Tag key={day} variant="outline">
                        {day}
                      </Tag>
                    ))}
                  </div>
                )}

                {poll.notes && <p className="bw-body-md text-sheet-foreground/85">{poll.notes}</p>}
              </div>

              {isAdmin ? (
                <PillButton
                  onClick={() => onOpenAdminWizard?.(poll)}
                  trailingIcon={<ArrowUpRight className="w-5 h-5" />}
                >
                  Build poll from proposal
                </PillButton>
              ) : (
                <p className="bw-body-sm text-sheet-foreground/70">
                  This proposal is waiting for the band admin to turn it into an availability poll.
                </p>
              )}
            </div>
          ) : isConfirmed ? (
            /* CONFIRMED VIEW */
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-start gap-3 p-4 rounded-[16px] bg-sheet-foreground/[0.08]">
                <span className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </span>
                <h3 className="bw-h2">Rehearsal confirmed</h3>
                <p className="bw-body-sm text-sheet-foreground/75">
                  This poll has been finalized into a confirmed rehearsal on your band calendar.
                </p>
              </div>
              <PillButton onClick={handleDone}>Close</PillButton>
            </div>
          ) : (
            /* ACTIVE AVAILABILITY POLL OPTIONS */
            <div className="flex flex-col gap-4">
              {/* Status & Summary */}
              <div className="flex items-center gap-2 flex-wrap">
                <Tag variant="accent">{hasUserVotedAny ? 'Voted' : declinedAll ? 'None work' : 'Active'}</Tag>
                <span className="bw-body-sm text-sheet-foreground/85">
                  {voteByLabel ? `Vote by ${voteByLabel} · ` : ''}
                  {uniqueVoterCount} of {totalMembers} voted
                </span>
              </div>

              {poll.notes && <p className="bw-body-sm text-sheet-foreground/75">{poll.notes}</p>}

              <p className="bw-label-sm">Select the dates that work for you</p>

              {/* Candidate pads */}
              {poll.options && poll.options.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {poll.options.map((option) => {
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
              ) : (
                <p className="bw-body-sm text-sheet-foreground/70">
                  No candidate time slots have been added to this poll yet.
                </p>
              )}

              {/* Responses (+ admin lock-in) */}
              {poll.options && poll.options.length > 0 && (isAdmin || anyVotes) && (
                <section className="flex flex-col gap-2 pt-2">
                  <h3 className="bw-label-sm text-sheet-foreground/70">
                    {isAdmin ? 'Responses · Lock in a date' : 'Responses'}
                  </h3>
                  {poll.options.map((option) => {
                    const parsedDate = new Date(option.proposed_date + 'T12:00:00');
                    const isWinning = maxVotes > 0 && (option.vote_count || 0) === maxVotes;
                    const isSelectingLocation = showLocationInput === option.id;
                    if (!isAdmin && !(option.votes && option.votes.length > 0)) return null;

                    return (
                      <div key={option.id} className="flex flex-col gap-3 p-4 rounded-[16px] bg-sheet-foreground/[0.08]">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="bw-body-lg">
                                {parsedDate.toLocaleDateString(undefined, {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              {isWinning && <Tag variant="accent">Top pick</Tag>}
                            </span>
                            <span className="bw-body-sm text-sheet-foreground/70">
                              {option.start_time}
                              {option.end_time ? ` – ${option.end_time}` : ''} · {option.vote_count || 0}/{totalMembers} available
                            </span>
                          </div>
                          {isAdmin && (
                            <PillButton
                              size="sm"
                              fullWidth={false}
                              variant={isWinning ? 'primary' : 'outline'}
                              aria-expanded={isSelectingLocation}
                              onClick={() => setShowLocationInput(isSelectingLocation ? null : option.id)}
                            >
                              Lock in
                            </PillButton>
                          )}
                        </div>

                        {/* Voters */}
                        {option.votes && option.votes.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {option.votes.map((v) => (
                              <span
                                key={v.id}
                                title={personName(v.profile)}
                                className="w-7 h-7 rounded-full border border-sheet-foreground/40 bw-label-xs flex items-center justify-center shrink-0 overflow-hidden"
                              >
                                {v.profile?.avatar_url ? (
                                  <img src={v.profile.avatar_url} alt={v.profile?.full_name || 'Voter'} className="w-full h-full object-cover" />
                                ) : (
                                  initialsOf(v.profile?.full_name)
                                )}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Admin location prompt */}
                        {isAdmin && isSelectingLocation && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col gap-3"
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
                              onClick={() => handleFinalize(option.id)}
                            >
                              Confirm &amp; create event
                            </PillButton>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}

              {/* Admin or creator: delete poll with confirmation */}
              {(isAdmin || poll.created_by === currentUserId) && (
                !showDeleteConfirm ? (
                  <PillButton
                    variant="danger"
                    size="sm"
                    fullWidth={false}
                    className="self-start -ml-3"
                    icon={<Trash2 className="w-4 h-4" />}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete poll
                  </PillButton>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    role="alertdialog"
                    aria-labelledby="poll-delete-title"
                    className="flex flex-col gap-3 p-4 rounded-[16px] border-2 border-destructive"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                      <div className="flex flex-col gap-1">
                        <span id="poll-delete-title" className="bw-h3 text-destructive">
                          Delete rehearsal poll?
                        </span>
                        <p className="bw-body-sm text-sheet-foreground/80">
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
                )
              )}
            </div>
          )}
        </div>

        {/* Footer (active poll) */}
        {isActivePoll && (
          <div
            className="shrink-0 px-5 pt-2 grid grid-cols-[2fr_3fr] gap-3"
            style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
          >
            <PillButton
              variant="outline"
              loading={isClearing}
              aria-pressed={declinedAll}
              className={declinedAll ? 'bg-sheet-foreground/[0.12]' : undefined}
              onClick={handleNoneWork}
            >
              None work
            </PillButton>
            <PillButton icon={<Check className="w-[18px] h-[18px]" />} onClick={handleDone}>
              Done
            </PillButton>
          </div>
        )}
      </motion.div>

      {/* Laptop pose (Figma "Duo · 11"): members × days on the Display, your
          day pads and Lock / Done on the Deck. Renders nothing otherwise. */}
      {(loading || isActivePoll) && (
        <FindADateMode
          poll={isActivePoll ? poll : null}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          loading={loading}
          votingOptionId={votingOptionId}
          onToggleVote={handleToggleVote}
          onLock={isAdmin ? handleFinalize : undefined}
          locking={isFinalizing}
          onDone={handleDone}
          onClose={onClose}
        />
      )}
    </>
  );
};
