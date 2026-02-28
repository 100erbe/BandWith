import { supabase } from '../supabase';

// Types
export type SongStatus = 'learning' | 'ready' | 'archived';
export type SongPriority = 'high' | 'medium' | 'low';

export interface Song {
  id: string;
  band_id: string;
  
  title: string;
  artist?: string;
  duration_seconds?: number;
  bpm?: number;
  key?: string;
  genre?: string;
  category?: string;
  
  status: SongStatus;
  priority: SongPriority;
  
  audio_url?: string;
  chart_url?: string;
  lyrics?: string;
  notes?: string;
  
  spotify_id?: string;
  apple_music_id?: string;
  youtube_url?: string;
  
  times_played?: number;
  last_played_at?: string;
  
  added_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Setlist {
  id: string;
  band_id: string;
  
  name: string;
  description?: string;
  is_template: boolean;
  
  total_duration_seconds?: number;
  song_count?: number;
  
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SetlistSong {
  id: string;
  setlist_id: string;
  song_id: string;
  
  position: number;
  set_number: number;
  notes?: string;
  
  created_at: string;
  
  // Joined data
  song?: Song;
}

export interface SetlistWithSongs extends Setlist {
  songs: SetlistSong[];
}

// ============================================
// SONGS CRUD
// ============================================

export const getSongs = async (
  bandId: string,
  options?: {
    status?: SongStatus | SongStatus[];
    priority?: SongPriority;
    category?: string;
    search?: string;
    limit?: number;
  }
): Promise<{ data: Song[] | null; error: Error | null }> => {
  try {
    let query = supabase
      .from('songs')
      .select('*')
      .eq('band_id', bandId)
      .order('title', { ascending: true });

    if (options?.status) {
      if (Array.isArray(options.status)) {
        query = query.in('status', options.status);
      } else {
        query = query.eq('status', options.status);
      }
    }

    if (options?.priority) {
      query = query.eq('priority', options.priority);
    }

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.search) {
      query = query.or(`title.ilike.%${options.search}%,artist.ilike.%${options.search}%`);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const getSong = async (songId: string): Promise<{ data: Song | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('id', songId)
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const createSong = async (songData: Partial<Song>): Promise<{ data: Song | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('songs')
      .insert({
        ...songData,
        added_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const updateSong = async (
  songId: string,
  updates: Partial<Song>
): Promise<{ data: Song | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('songs')
      .update(updates)
      .eq('id', songId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const deleteSong = async (songId: string): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('id', songId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

export const bulkCreateSongs = async (
  bandId: string,
  songs: Omit<Song, 'id' | 'band_id' | 'created_at' | 'updated_at'>[]
): Promise<{ data: Song[] | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('songs')
      .insert(
        songs.map(s => ({
          ...s,
          band_id: bandId,
          added_by: user.id,
        }))
      )
      .select();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

// ============================================
// SETLISTS CRUD
// ============================================

export const getSetlists = async (
  bandId: string,
  options?: {
    isTemplate?: boolean;
    limit?: number;
  }
): Promise<{ data: Setlist[] | null; error: Error | null }> => {
  try {
    let query = supabase
      .from('setlists')
      .select('*')
      .eq('band_id', bandId)
      .order('created_at', { ascending: false });

    if (options?.isTemplate !== undefined) {
      query = query.eq('is_template', options.isTemplate);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const getSetlist = async (setlistId: string): Promise<{ data: SetlistWithSongs | null; error: Error | null }> => {
  try {
    const { data: setlist, error: setlistError } = await supabase
      .from('setlists')
      .select('*')
      .eq('id', setlistId)
      .single();

    if (setlistError) throw setlistError;

    // Get setlist songs with song data
    const { data: songs, error: songsError } = await supabase
      .from('setlist_songs')
      .select(`
        *,
        song:songs (*)
      `)
      .eq('setlist_id', setlistId)
      .order('set_number', { ascending: true })
      .order('position', { ascending: true });

    if (songsError) throw songsError;

    return {
      data: {
        ...setlist,
        songs: songs || [],
      },
      error: null,
    };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const createSetlist = async (
  setlistData: Partial<Setlist>,
  songs?: { song_id: string; position: number; set_number?: number; notes?: string }[]
): Promise<{ data: Setlist | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: setlist, error: insertError } = await supabase
      .from('setlists')
      .insert({
        ...setlistData,
        created_by: user.id,
        song_count: songs?.length || 0,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Add songs if provided
    if (songs && songs.length > 0) {
      const { error: songsError } = await supabase
        .from('setlist_songs')
        .insert(
          songs.map(s => ({
            ...s,
            setlist_id: setlist.id,
          }))
        );

      if (songsError) {
        console.error('Error adding setlist songs:', songsError);
      }
    }

    return { data: setlist, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const updateSetlist = async (
  setlistId: string,
  updates: Partial<Setlist>
): Promise<{ data: Setlist | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('setlists')
      .update(updates)
      .eq('id', setlistId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const deleteSetlist = async (setlistId: string): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('setlists')
      .delete()
      .eq('id', setlistId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// SETLIST SONGS
// ============================================

export const addSongToSetlist = async (
  setlistId: string,
  songId: string,
  position: number,
  setNumber: number = 1
): Promise<{ data: SetlistSong | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('setlist_songs')
      .insert({
        setlist_id: setlistId,
        song_id: songId,
        position,
        set_number: setNumber,
      })
      .select()
      .single();

    if (error) throw error;

    // Update song count
    await supabase.rpc('update_setlist_song_count', { p_setlist_id: setlistId });

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const removeSongFromSetlist = async (setlistSongId: string): Promise<{ error: Error | null }> => {
  try {
    // Get setlist_id before deleting
    const { data: setlistSong } = await supabase
      .from('setlist_songs')
      .select('setlist_id')
      .eq('id', setlistSongId)
      .single();

    const { error } = await supabase
      .from('setlist_songs')
      .delete()
      .eq('id', setlistSongId);

    if (error) throw error;

    // Update song count
    if (setlistSong?.setlist_id) {
      await supabase.rpc('update_setlist_song_count', { p_setlist_id: setlistSong.setlist_id });
    }

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

export const reorderSetlistSongs = async (
  setlistId: string,
  songOrder: { id: string; position: number; set_number: number }[]
): Promise<{ error: Error | null }> => {
  try {
    // Update each song's position
    for (const item of songOrder) {
      const { error } = await supabase
        .from('setlist_songs')
        .update({ position: item.position, set_number: item.set_number })
        .eq('id', item.id);

      if (error) throw error;
    }

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// STATISTICS
// ============================================

export const getSongStats = async (
  bandId: string
): Promise<{
  data: {
    totalSongs: number;
    readySongs: number;
    learningSongs: number;
    totalSetlists: number;
  } | null;
  error: Error | null;
}> => {
  try {
    const { data: songs, error: songsError } = await supabase
      .from('songs')
      .select('status')
      .eq('band_id', bandId);

    if (songsError) throw songsError;

    const { count: setlistCount, error: setlistError } = await supabase
      .from('setlists')
      .select('*', { count: 'exact', head: true })
      .eq('band_id', bandId);

    if (setlistError) throw setlistError;

    const stats = {
      totalSongs: songs?.length || 0,
      readySongs: songs?.filter(s => s.status === 'ready').length || 0,
      learningSongs: songs?.filter(s => s.status === 'learning').length || 0,
      totalSetlists: setlistCount || 0,
    };

    return { data: stats, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};
