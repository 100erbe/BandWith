import { supabase } from '../supabase';
import { createEvent } from './events';
import { createBulkNotifications } from './notifications';
import { personName } from '@/lib/personName';
import { t } from '@/lib/i18n';

export interface RehearsalPollOption {
  id: string;
  poll_id: string;
  proposed_date: string; // YYYY-MM-DD
  start_time: string; // e.g. "19:00"
  end_time?: string | null; // e.g. "22:00"
  created_at: string;
  // Computed / joined
  votes?: RehearsalPollVote[];
  vote_count?: number;
  has_voted?: boolean;
}

export interface RehearsalPollVote {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
  profile?: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  } | null;
}

export interface RehearsalPoll {
  id: string;
  band_id: string;
  created_by: string;
  creator_role: 'admin' | 'member';
  title: string;
  notes?: string | null;
  status: 'proposed' | 'polling' | 'confirmed' | 'cancelled' | 'expired';
  confirmed_event_id?: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  options: RehearsalPollOption[];
  creator_profile?: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  } | null;
  preferred_days?: string[];
  total_members_count?: number;
}

export interface ProposalEligibility {
  canPropose: boolean;
  nextAvailableDate: Date | null;
  daysRemaining?: number;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 1. Check if a band member is eligible to propose a rehearsal (max 1 per 7 days).
 * Admins are always eligible.
 */
export const checkMemberProposalEligibility = async (
  bandId: string,
  userId: string
): Promise<ProposalEligibility> => {
  try {
    // 1. Check if user is an admin of the band
    const { data: memberRole, error: roleError } = await supabase
      .from('band_members')
      .select('role')
      .eq('band_id', bandId)
      .eq('user_id', userId)
      .maybeSingle();

    if (roleError) throw roleError;
    if (memberRole?.role === 'admin') {
      return { canPropose: true, nextAvailableDate: null };
    }

    // 2. Query latest proposal submitted by this user in this band
    const { data: latestProposal, error: pollError } = await supabase
      .from('rehearsal_polls')
      .select('id, created_at')
      .eq('band_id', bandId)
      .eq('created_by', userId)
      .eq('creator_role', 'member')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pollError) throw pollError;

    if (!latestProposal) {
      return { canPropose: true, nextAvailableDate: null };
    }

    const proposalTime = new Date(latestProposal.created_at).getTime();
    const now = Date.now();
    const elapsed = now - proposalTime;

    if (elapsed < SEVEN_DAYS_MS) {
      const nextAvailableDate = new Date(proposalTime + SEVEN_DAYS_MS);
      const daysRemaining = Math.max(1, Math.ceil((nextAvailableDate.getTime() - now) / (24 * 60 * 60 * 1000)));
      return { canPropose: false, nextAvailableDate, daysRemaining };
    }

    return { canPropose: true, nextAvailableDate: null };
  } catch (err) {
    console.error('Error checking proposal eligibility:', err);
    // On unexpected error, default to allowed to avoid hard-locking UI
    return { canPropose: true, nextAvailableDate: null };
  }
};

/**
 * 2. Member creates a rehearsal proposal.
 * Inserts with status='proposed', creator_role='member'.
 * Notifies ONLY band admins.
 */
export const createMemberRehearsalProposal = async ({
  bandId,
  userId,
  title,
  notes,
  preferredDays = [],
}: {
  bandId: string;
  userId: string;
  title: string;
  notes?: string;
  preferredDays?: string[];
}): Promise<{ data: RehearsalPoll | null; error: Error | null }> => {
  try {
    // Format notes with preferred days metadata if provided
    let combinedNotes = notes?.trim() || '';
    if (preferredDays && preferredDays.length > 0) {
      const daysHeader = `[Preferred Days: ${preferredDays.join(', ')}]`;
      combinedNotes = combinedNotes ? `${daysHeader}\n\n${combinedNotes}` : daysHeader;
    }

    const { data: newPoll, error: insertError } = await supabase
      .from('rehearsal_polls')
      .insert({
        band_id: bandId,
        created_by: userId,
        creator_role: 'member',
        title: title.trim() || 'Rehearsal Proposal',
        notes: combinedNotes || null,
        status: 'proposed',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Get creator name for notification
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle();

    const creatorName = personName(creatorProfile, 'A band member');

    // Query all active band admins
    const { data: admins, error: adminError } = await supabase
      .from('band_members')
      .select('user_id')
      .eq('band_id', bandId)
      .eq('role', 'admin')
      .eq('is_active', true);

    if (!adminError && admins && admins.length > 0) {
      // Deduplicate admin IDs (in case of duplicate member rows in DB)
      const rawAdminIds = Array.from(
        new Set(admins.map((a: { user_id: string }) => a.user_id).filter(Boolean))
      );

      // If there are other admins, notify them; if proposer is the only admin, notify them once
      const otherAdmins = rawAdminIds.filter((id) => id !== userId);
      const targetAdminIds = otherAdmins.length > 0 ? otherAdmins : rawAdminIds;

      if (targetAdminIds.length > 0) {
        try {
          const notifications = targetAdminIds.map((adminId: string) => ({
            user_id: adminId,
            band_id: bandId,
            type: 'rehearsal_proposal' as const,
            title: 'New Rehearsal Proposal',
            body: `${creatorName} proposed: "${newPoll.title}". Set up an availability poll to schedule it!`,
            data: {
              poll_id: newPoll.id,
              band_id: bandId,
              type: 'rehearsal_proposal',
              preferred_days: preferredDays,
            },
          }));

          await createBulkNotifications(notifications, { sendPush: true });
        } catch (notifErr) {
          // Push notifications or in-app notification error should never break proposal creation
          console.warn('Failed to send admin proposal notifications:', notifErr);
        }
      }
    }

    return {
      data: {
        ...newPoll,
        options: [],
        preferred_days: preferredDays,
      },
      error: null,
    };
  } catch (error: any) {
    console.error('Failed to create rehearsal proposal:', error);
    return { data: null, error };
  }
};

/**
 * 3. Admin creates a new poll or converts an existing member proposal into a poll.
 * Bulk-inserts candidate time slots into `rehearsal_poll_options`.
 * Notifies ALL band members.
 */
export const createOrPublishAdminPoll = async ({
  pollId,
  bandId,
  adminId,
  title,
  notes,
  timeSlots,
}: {
  pollId?: string;
  bandId: string;
  adminId: string;
  title: string;
  notes?: string;
  timeSlots: Array<{ proposed_date: string; start_time: string; end_time?: string | null }>;
}): Promise<{ data: RehearsalPoll | null; error: Error | null }> => {
  try {
    if (!timeSlots || timeSlots.length === 0) {
      throw new Error('At least one date/time option is required to publish a poll.');
    }

    let activePollId = pollId;

    if (pollId) {
      // Converting an existing proposal: update status to polling
      const { data: updated, error: updateError } = await supabase
        .from('rehearsal_polls')
        .update({
          title: title.trim() || 'Rehearsal Availability Poll',
          notes: notes?.trim() || null,
          status: 'polling',
          updated_at: new Date().toISOString(),
        })
        .eq('id', pollId)
        .select()
        .single();

      if (updateError) throw updateError;
      activePollId = updated.id;

      // Clean up previous options if any
      await supabase.from('rehearsal_poll_options').delete().eq('poll_id', pollId);
    } else {
      // Brand new poll from admin
      const { data: created, error: createError } = await supabase
        .from('rehearsal_polls')
        .insert({
          band_id: bandId,
          created_by: adminId,
          creator_role: 'admin',
          title: title.trim() || 'Rehearsal Availability Poll',
          notes: notes?.trim() || null,
          status: 'polling',
        })
        .select()
        .single();

      if (createError) throw createError;
      activePollId = created.id;
    }

    if (!activePollId) throw new Error('Failed to resolve poll ID');

    // Bulk insert options
    const optionsPayload = timeSlots.map((slot) => ({
      poll_id: activePollId,
      proposed_date: slot.proposed_date,
      start_time: slot.start_time,
      end_time: slot.end_time || null,
    }));

    const { data: insertedOptions, error: optionsError } = await supabase
      .from('rehearsal_poll_options')
      .insert(optionsPayload)
      .select();

    if (optionsError) throw optionsError;

    // Notify all active band members
    try {
      const { data: members } = await supabase
        .from('band_members')
        .select('user_id')
        .eq('band_id', bandId)
        .eq('is_active', true);

      if (members && members.length > 0) {
        const uniqueMemberIds = Array.from(
          new Set(members.map((m: { user_id: string }) => m.user_id).filter(Boolean))
        );

        const notifPayload = uniqueMemberIds.map((memberId: string) => ({
          user_id: memberId,
          band_id: bandId,
          type: 'rehearsal_poll' as const,
          title: 'Vote on Rehearsal Times',
          body: `New availability poll: "${title}". Tap to select your available dates!`,
          data: {
            poll_id: activePollId,
            band_id: bandId,
            type: 'rehearsal_poll',
          },
        }));

        await createBulkNotifications(notifPayload, { sendPush: true });
      }
    } catch (notifErr) {
      console.warn('Failed to send poll notifications:', notifErr);
    }

    const { data: fullPoll } = await getRehearsalPoll(activePollId);
    return { data: fullPoll, error: null };
  } catch (error: any) {
    console.error('Failed to create/publish admin poll:', error);
    return { data: null, error };
  }
};

/**
 * 4. Toggle member vote for a specific option.
 * Multi-option voting is supported.
 */
export const togglePollVote = async (
  pollId: string,
  optionId: string,
  userId: string
): Promise<{ voted: boolean; error: Error | null }> => {
  try {
    // Check if vote currently exists
    const { data: existingVote, error: checkError } = await supabase
      .from('rehearsal_poll_votes')
      .select('id')
      .eq('option_id', optionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingVote) {
      // Remove vote
      const { error: deleteError } = await supabase
        .from('rehearsal_poll_votes')
        .delete()
        .eq('id', existingVote.id);

      if (deleteError) throw deleteError;
      return { voted: false, error: null };
    } else {
      // Add vote
      const { error: insertError } = await supabase
        .from('rehearsal_poll_votes')
        .insert({
          poll_id: pollId,
          option_id: optionId,
          user_id: userId,
        });

      if (insertError) throw insertError;
      return { voted: true, error: null };
    }
  } catch (error: any) {
    console.error('Failed to toggle vote:', error);
    return { voted: false, error };
  }
};

/**
 * Clear all votes by a user on a poll ("None of these work" toggle).
 */
export const clearUserVotesForPoll = async (
  pollId: string,
  userId: string
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('rehearsal_poll_votes')
      .delete()
      .eq('poll_id', pollId)
      .eq('user_id', userId);

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error('Failed to clear votes:', error);
    return { error };
  }
};

/**
 * 5. Admin finalizes poll into official rehearsal event.
 * Creates event in `public.events`, populates `public.event_members`,
 * updates poll status='confirmed', and notifies band.
 */
export const finalizePollIntoRehearsal = async ({
  pollId,
  winningOptionId,
  bandId,
  location,
  notes,
  adminId,
}: {
  pollId: string;
  winningOptionId: string;
  bandId: string;
  location?: string;
  notes?: string;
  adminId: string;
}): Promise<{ data: any | null; error: Error | null }> => {
  try {
    // 1. Fetch winning option
    const { data: option, error: optError } = await supabase
      .from('rehearsal_poll_options')
      .select('*')
      .eq('id', winningOptionId)
      .single();

    if (optError || !option) throw optError || new Error('Winning option not found');

    // 2. Fetch poll details
    const { data: poll, error: pollError } = await supabase
      .from('rehearsal_polls')
      .select('*')
      .eq('id', pollId)
      .single();

    if (pollError || !poll) throw pollError || new Error('Poll not found');

    // 3. Fetch active band members to create rosters
    const { data: bandMembers, error: membersError } = await supabase
      .from('band_members')
      .select('user_id, role, default_fee')
      .eq('band_id', bandId)
      .eq('is_active', true);

    if (membersError) throw membersError;

    // Deduplicate members by user_id
    const seenUsers = new Set<string>();
    const uniqueBandMembers = (bandMembers || []).filter((bm: any) => {
      if (!bm.user_id || seenUsers.has(bm.user_id)) return false;
      seenUsers.add(bm.user_id);
      return true;
    });

    const roster = uniqueBandMembers.map((bm: any) => ({
      user_id: bm.user_id,
      role: bm.role || 'member',
      fee: bm.default_fee != null ? Number(bm.default_fee) : 0,
      status: bm.user_id === adminId ? 'confirmed' : 'pending',
    }));

    // 4. Create confirmed rehearsal event
    const venueName = location?.trim() || t('Band Practice Space');
    const finalNotes = notes?.trim() || poll.notes || t('Scheduled via Band Availability Poll');

    const { data: newEvent, error: eventError } = await createEvent(
      {
        band_id: bandId,
        title: poll.title?.trim() || t('Rehearsal'),
        event_type: 'rehearsal',
        status: 'confirmed',
        event_date: option.proposed_date,
        start_time: option.start_time,
        end_time: option.end_time || null,
        venue: venueName,
        venue_name: venueName,
        notes: finalNotes,
      },
      roster
    );

    if (eventError || !newEvent) throw eventError || new Error('Failed to create rehearsal event');

    // 5. Update poll status to 'confirmed'
    const { error: updatePollError } = await supabase
      .from('rehearsal_polls')
      .update({
        status: 'confirmed',
        confirmed_event_id: newEvent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pollId);

    if (updatePollError) {
      console.warn('Failed to update poll confirmed status:', updatePollError);
    }

    // 6. Notify band members
    try {
      if (uniqueBandMembers && uniqueBandMembers.length > 0) {
        const notifPayload = uniqueBandMembers.map((m: any) => ({
          user_id: m.user_id,
          band_id: bandId,
          type: 'rehearsal_poll_finalized' as const,
          title: 'Rehearsal Confirmed!',
          body: `Rehearsal locked in for ${option.proposed_date} at ${option.start_time} (${venueName}).`,
          data: {
            event_id: newEvent.id,
            poll_id: pollId,
            band_id: bandId,
            date: option.proposed_date,
            time: option.start_time,
          },
        }));

        await createBulkNotifications(notifPayload, { sendPush: true });
      }
    } catch (notifErr) {
      console.warn('Failed to send finalization notifications:', notifErr);
    }

    return { data: newEvent, error: null };
  } catch (error: any) {
    console.error('Failed to finalize poll into rehearsal:', error);
    return { data: null, error };
  }
};

/**
 * Dismiss or cancel a proposal/poll.
 */
export const dismissPoll = async (pollId: string): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('rehearsal_polls')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', pollId);

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error('Failed to dismiss poll:', error);
    return { error };
  }
};

/**
 * Permanently delete or cancel a rehearsal poll.
 */
export const deletePoll = async (pollId: string): Promise<{ error: Error | null }> => {
  try {
    // 1. Delete dependent votes and options
    await supabase.from('rehearsal_poll_votes').delete().eq('poll_id', pollId);
    await supabase.from('rehearsal_poll_options').delete().eq('poll_id', pollId);

    // 2. Delete the poll itself
    const { error } = await supabase.from('rehearsal_polls').delete().eq('id', pollId);
    if (error) {
      // If hard delete is restricted, soft delete by setting status = 'cancelled'
      const { error: cancelErr } = await supabase
        .from('rehearsal_polls')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', pollId);
      if (cancelErr) throw cancelErr;
    }
    return { error: null };
  } catch (error: any) {
    console.error('Failed to delete poll:', error);
    return { error };
  }
};

/**
 * Helper to parse preferred days from notes string.
 */
export const extractPreferredDays = (notes?: string | null): string[] => {
  if (!notes) return [];
  const match = notes.match(/\[Preferred Days:\s*([^\]]+)\]/i);
  if (!match || !match[1]) return [];
  return match[1].split(',').map((d) => d.trim()).filter(Boolean);
};

/**
 * Clean user notes without the metadata tag.
 */
export const cleanNotesWithoutDays = (notes?: string | null): string => {
  if (!notes) return '';
  return notes.replace(/\[Preferred Days:\s*[^\]]+\]\s*/i, '').trim();
};

/**
 * Get all active polls and proposals for a band.
 */
export const getRehearsalPolls = async (
  bandId: string,
  userId?: string | null
): Promise<{ data: RehearsalPoll[] | null; error: Error | null }> => {
  try {
    // 1. Fetch polls
    const { data: polls, error: pollsError } = await supabase
      .from('rehearsal_polls')
      .select('*')
      .eq('band_id', bandId)
      .in('status', ['proposed', 'polling', 'confirmed'])
      .order('created_at', { ascending: false });

    if (pollsError) throw pollsError;
    if (!polls || polls.length === 0) return { data: [], error: null };

    const pollIds = polls.map((p) => p.id);

    // 2. Fetch options
    const { data: options, error: optError } = await supabase
      .from('rehearsal_poll_options')
      .select('*')
      .in('poll_id', pollIds)
      .order('proposed_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (optError) throw optError;

    // 3. Fetch votes
    const { data: votes, error: votesError } = await supabase
      .from('rehearsal_poll_votes')
      .select('*')
      .in('poll_id', pollIds);

    if (votesError) throw votesError;

    // 4. Fetch profiles for creators and voters
    const creatorUserIds = polls.map((p) => p.created_by).filter(Boolean);
    const voterUserIds = (votes || []).map((v) => v.user_id).filter(Boolean);
    const allUserIds = Array.from(new Set([...creatorUserIds, ...voterUserIds]));

    let profilesMap: Record<string, any> = {};
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .in('id', allUserIds);

      if (profiles) {
        profiles.forEach((p) => {
          profilesMap[p.id] = p;
        });
      }
    }

    // 5. Total band members count for attendance percentage
    const { count: memberCount } = await supabase
      .from('band_members')
      .select('id', { count: 'exact', head: true })
      .eq('band_id', bandId);

    const totalMembers = memberCount || 1;

    // 6. Map options and votes into polls
    const enrichedPolls: RehearsalPoll[] = polls.map((poll) => {
      const pollOptions = (options || []).filter((o) => o.poll_id === poll.id);

      const enrichedOptions: RehearsalPollOption[] = pollOptions.map((opt) => {
        const optVotes = (votes || [])
          .filter((v) => v.option_id === opt.id)
          .map((v) => ({
            ...v,
            profile: profilesMap[v.user_id] || null,
          }));

        const hasVoted = userId ? optVotes.some((v) => v.user_id === userId) : false;

        return {
          ...opt,
          votes: optVotes,
          vote_count: optVotes.length,
          has_voted: hasVoted,
        };
      });

      return {
        ...poll,
        options: enrichedOptions,
        creator_profile: profilesMap[poll.created_by] || null,
        preferred_days: extractPreferredDays(poll.notes),
        total_members_count: totalMembers,
      };
    });

    return { data: enrichedPolls, error: null };
  } catch (error: any) {
    console.error('Failed to get rehearsal polls:', error);
    return { data: null, error };
  }
};

/**
 * Get a single poll by ID.
 */
export const getRehearsalPoll = async (
  pollId: string,
  userId?: string | null
): Promise<{ data: RehearsalPoll | null; error: Error | null }> => {
  try {
    const { data: poll, error: pollError } = await supabase
      .from('rehearsal_polls')
      .select('*')
      .eq('id', pollId)
      .single();

    if (pollError || !poll) throw pollError || new Error('Poll not found');

    const { data: polls } = await getRehearsalPolls(poll.band_id, userId);
    const found = (polls || []).find((p) => p.id === pollId) || null;
    return { data: found, error: null };
  } catch (error: any) {
    console.error('Failed to get poll:', error);
    return { data: null, error };
  }
};

/**
 * Realtime subscription for rehearsal polls and votes.
 */
export const subscribeToRehearsalPolls = (
  bandId: string,
  onUpdate: () => void
): (() => void) => {
  const channel = supabase
    .channel(`rehearsal_polls_${bandId}_${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rehearsal_polls',
        filter: `band_id=eq.${bandId}`,
      },
      () => onUpdate()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rehearsal_poll_options',
      },
      () => onUpdate()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rehearsal_poll_votes',
      },
      () => onUpdate()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
