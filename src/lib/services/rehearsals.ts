import { supabase } from '../supabase';
import type { Event } from './events';

// ============================================
// TYPES
// ============================================

export interface RehearsalTask {
  id: string;
  event_id: string;
  title: string;
  assigned_to?: string;
  is_completed: boolean;
  due_date?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  // Joined data
  assignee?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface SongProposal {
  id: string;
  event_id: string;
  song_id?: string;
  title: string;
  artist?: string;
  proposed_by: string;
  status: 'pending' | 'accepted' | 'rejected';
  votes_up: number;
  votes_down: number;
  notes?: string;
  created_at: string;
  // Joined data
  proposer?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
  song?: {
    id: string;
    title: string;
    artist?: string;
    bpm?: number;
    key?: string;
  };
}

export interface RehearsalSetlistItem {
  id: string;
  event_id: string;
  song_id?: string;
  title: string;
  artist?: string;
  position: number;
  notes?: string;
  bpm?: number;
  key?: string;
  duration_seconds?: number;
  created_at: string;
}

export interface RehearsalState {
  event: Event;
  tasks: RehearsalTask[];
  proposals: SongProposal[];
  setlist: RehearsalSetlistItem[];
}

// ============================================
// REHEARSAL TASKS CRUD
// ============================================

export const getRehearsalTasks = async (
  eventId: string
): Promise<{ data: RehearsalTask[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('rehearsal_tasks')
      .select(`
        *,
        assignee:profiles!rehearsal_tasks_assigned_to_fkey (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const createRehearsalTask = async (
  task: Omit<RehearsalTask, 'id' | 'created_at' | 'updated_at' | 'assignee'>
): Promise<{ data: RehearsalTask | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('rehearsal_tasks')
      .insert(task)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const updateRehearsalTask = async (
  taskId: string,
  updates: Partial<RehearsalTask>
): Promise<{ data: RehearsalTask | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('rehearsal_tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const toggleTaskComplete = async (
  taskId: string,
  isCompleted: boolean
): Promise<{ data: RehearsalTask | null; error: Error | null }> => {
  return updateRehearsalTask(taskId, { is_completed: isCompleted });
};

export const deleteRehearsalTask = async (
  taskId: string
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('rehearsal_tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// SONG PROPOSALS CRUD
// ============================================

export const getSongProposals = async (
  eventId: string
): Promise<{ data: SongProposal[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('song_proposals')
      .select(`
        *,
        proposer:profiles!song_proposals_proposed_by_fkey (
          id,
          full_name,
          avatar_url
        ),
        song:songs (
          id,
          title,
          artist,
          bpm,
          key
        )
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const createSongProposal = async (
  proposal: Omit<SongProposal, 'id' | 'created_at' | 'proposer' | 'song' | 'votes_up' | 'votes_down' | 'status'>
): Promise<{ data: SongProposal | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('song_proposals')
      .insert({
        ...proposal,
        proposed_by: user.id,
        status: 'pending',
        votes_up: 0,
        votes_down: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const voteOnProposal = async (
  proposalId: string,
  voteType: 'up' | 'down'
): Promise<{ data: SongProposal | null; error: Error | null }> => {
  try {
    // Get current proposal
    const { data: current, error: fetchError } = await supabase
      .from('song_proposals')
      .select('votes_up, votes_down')
      .eq('id', proposalId)
      .single();

    if (fetchError) throw fetchError;

    const updates = voteType === 'up'
      ? { votes_up: (current.votes_up || 0) + 1 }
      : { votes_down: (current.votes_down || 0) + 1 };

    const { data, error } = await supabase
      .from('song_proposals')
      .update(updates)
      .eq('id', proposalId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const updateProposalStatus = async (
  proposalId: string,
  status: 'accepted' | 'rejected'
): Promise<{ data: SongProposal | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('song_proposals')
      .update({ status })
      .eq('id', proposalId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const deleteProposal = async (
  proposalId: string
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('song_proposals')
      .delete()
      .eq('id', proposalId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// REHEARSAL SETLIST CRUD
// ============================================

export const getRehearsalSetlist = async (
  eventId: string
): Promise<{ data: RehearsalSetlistItem[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('rehearsal_setlist')
      .select('*')
      .eq('event_id', eventId)
      .order('position', { ascending: true });

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const addToRehearsalSetlist = async (
  item: Omit<RehearsalSetlistItem, 'id' | 'created_at'>
): Promise<{ data: RehearsalSetlistItem | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('rehearsal_setlist')
      .insert(item)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const updateSetlistItemPosition = async (
  itemId: string,
  newPosition: number
): Promise<{ data: RehearsalSetlistItem | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('rehearsal_setlist')
      .update({ position: newPosition })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const removeFromRehearsalSetlist = async (
  itemId: string
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('rehearsal_setlist')
      .delete()
      .eq('id', itemId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

export const reorderSetlist = async (
  eventId: string,
  orderedIds: string[]
): Promise<{ error: Error | null }> => {
  try {
    // Update positions for all items
    const updates = orderedIds.map((id, index) => ({
      id,
      position: index,
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from('rehearsal_setlist')
        .update({ position: update.position })
        .eq('id', update.id);

      if (error) throw error;
    }

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// FULL REHEARSAL STATE
// ============================================

export const getRehearsalState = async (
  eventId: string
): Promise<{ data: Omit<RehearsalState, 'event'> | null; error: Error | null }> => {
  try {
    const [tasksResult, proposalsResult, setlistResult] = await Promise.all([
      getRehearsalTasks(eventId),
      getSongProposals(eventId),
      getRehearsalSetlist(eventId),
    ]);

    if (tasksResult.error) throw tasksResult.error;
    if (proposalsResult.error) throw proposalsResult.error;
    if (setlistResult.error) throw setlistResult.error;

    return {
      data: {
        tasks: tasksResult.data || [],
        proposals: proposalsResult.data || [],
        setlist: setlistResult.data || [],
      },
      error: null,
    };
  } catch (error: any) {
    return { data: null, error };
  }
};

// ============================================
// REHEARSAL SUBSCRIPTIONS (Real-time)
// ============================================

export const subscribeToRehearsalTasks = (
  eventId: string,
  onUpdate: (tasks: RehearsalTask[]) => void
) => {
  const channel = supabase
    .channel(`rehearsal-tasks-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rehearsal_tasks',
        filter: `event_id=eq.${eventId}`,
      },
      async () => {
        // Refetch tasks on any change
        const { data } = await getRehearsalTasks(eventId);
        if (data) onUpdate(data);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
};

export const subscribeToSongProposals = (
  eventId: string,
  onUpdate: (proposals: SongProposal[]) => void
) => {
  const channel = supabase
    .channel(`song-proposals-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'song_proposals',
        filter: `event_id=eq.${eventId}`,
      },
      async () => {
        const { data } = await getSongProposals(eventId);
        if (data) onUpdate(data);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
};
