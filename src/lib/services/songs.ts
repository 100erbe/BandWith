import { supabase, getSafeUser } from '../supabase';
import { removeSongFiles } from './songFiles';
import type { SongChart } from '../ireal';

/**
 * RLS refused the write (0 rows): an error the UI maps to a translated
 * "only admins" message (src/lib/userError.ts); the text is for logs only.
 */
const permissionError = (message: string) => Object.assign(new Error(message), { code: '42501' });

// Types
/** 'suggested': proposed by a member; an admin moves it to learning / ready. */
export type SongStatus = 'suggested' | 'learning' | 'ready' | 'archived';
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
  /** Chords and form imported from iReal Pro (no melody, no lyrics). */
  chord_chart?: SongChart | null;
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

/** A song update where null clears a column. */
export type SongChanges = { [K in keyof Song]?: Song[K] | null };

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

export const createSong = async (songData: Partial<Song>): Promise<{ data: Song | null; error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
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
  updates: SongChanges
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
    const { data: existing } = await supabase
      .from('songs')
      .select('audio_url, chart_url')
      .eq('id', songId)
      .maybeSingle();

    // RLS lets only band admins delete songs; for anyone else the delete
    // "succeeds" with zero rows, so ask for the deleted ids back.
    const { data: deleted, error } = await supabase
      .from('songs')
      .delete()
      .eq('id', songId)
      .select('id');

    if (error) throw error;
    if (!deleted || deleted.length === 0) {
      throw permissionError('Only band admins can delete songs.');
    }
    // Files in storage go with the song (only once it is really gone).
    await removeSongFiles([existing?.audio_url, existing?.chart_url]);

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

/** Today as "YYYY-MM-DD" on this device. */
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Upcoming gigs that use any of these setlists (for delete confirmations). */
export const getUpcomingGigsForSetlists = async (
  setlistIds: string[],
): Promise<{ data: { title: string; date: string }[] | null; error: Error | null }> => {
  if (setlistIds.length === 0) return { data: [], error: null };
  try {
    const { data, error } = await supabase
      .from('events')
      .select('title, event_date')
      .in('setlist_id', setlistIds)
      .gte('event_date', localToday())
      .order('event_date', { ascending: true })
      .limit(50);
    if (error) throw error;
    return { data: (data || []).map((e: { title?: string | null; event_date: string }) => ({ title: e.title || '', date: e.event_date })), error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

/** Where a song is used: setlist names and the upcoming gigs playing them. Null when it can't be looked up. */
export const getSongUsage = async (songId: string): Promise<{ setlists: string[]; gigs: { title: string; date: string }[] } | null> => {
  try {
    const { data, error } = await supabase.from('setlist_songs').select('setlist_id, setlist:setlists(name)').eq('song_id', songId);
    if (error) throw error;
    const rows = (data || []) as unknown as { setlist_id: string; setlist?: { name?: string | null } | null }[];
    const ids = [...new Set(rows.map((r) => r.setlist_id))];
    const names = [...new Set(rows.map((r) => r.setlist?.name || '').filter(Boolean))];
    const gigs = await getUpcomingGigsForSetlists(ids);
    if (gigs.error) throw gigs.error;
    return { setlists: names, gigs: gigs.data || [] };
  } catch {
    return null;
  }
};

export const bulkCreateSongs = async (
  bandId: string,
  songs: Omit<Song, 'id' | 'band_id' | 'created_at' | 'updated_at'>[]
): Promise<{ data: Song[] | null; error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
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

export const seedRepertoireSongs = async (
  bandId: string
): Promise<{ data: Song[] | null; count: number; error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not authenticated');

    const { REPERTOIRE_SONGS } = await import('@/app/data/repertoire-songs');

    const { data: existing } = await supabase
      .from('songs')
      .select('title, artist')
      .eq('band_id', bandId);

    const existingSet = new Set(
      (existing || []).map(s => `${s.title}|||${s.artist}`)
    );

    const newSongs = REPERTOIRE_SONGS.filter(
      s => !existingSet.has(`${s.title}|||${s.artist}`)
    );

    if (newSongs.length === 0) {
      return { data: [], count: 0, error: null };
    }

    const BATCH_SIZE = 100;
    const allInserted: Song[] = [];

    for (let i = 0; i < newSongs.length; i += BATCH_SIZE) {
      const batch = newSongs.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from('songs')
        .insert(
          batch.map(s => ({
            ...s,
            band_id: bandId,
            added_by: user.id,
          }))
        )
        .select();

      if (error) throw error;
      if (data) allInserted.push(...data);
    }

    return { data: allInserted, count: allInserted.length, error: null };
  } catch (error: any) {
    return { data: null, count: 0, error };
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

    // Live totals: the stored song_count / total_duration_seconds can be stale
    // (the duration was never written), so count from the setlist's songs.
    const ids = (data || []).map((s: Setlist) => s.id);
    if (ids.length > 0) {
      const { data: rows, error: rowsError } = await supabase
        .from('setlist_songs')
        .select('setlist_id, song:songs (duration_seconds)')
        .in('setlist_id', ids);
      if (!rowsError && rows) {
        const totals = new Map<string, { count: number; seconds: number }>();
        for (const r of rows as Array<{ setlist_id: string; song?: { duration_seconds?: number | null } | null }>) {
          const t = totals.get(r.setlist_id) || { count: 0, seconds: 0 };
          t.count += 1;
          t.seconds += r.song?.duration_seconds || 0;
          totals.set(r.setlist_id, t);
        }
        return {
          data: (data || []).map((s: Setlist) => {
            const t = totals.get(s.id);
            return { ...s, song_count: t?.count ?? 0, total_duration_seconds: t?.seconds ?? 0 };
          }),
          error: null,
        };
      }
    }

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
    const { data: { user } } = await getSafeUser();
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
        // Don't leave an empty setlist behind that looks like it saved.
        await supabase.from('setlists').delete().eq('id', setlist.id);
        throw songsError;
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
    const { data: deleted, error } = await supabase
      .from('setlists')
      .delete()
      .eq('id', setlistId)
      .select('id');

    if (error) throw error;
    if (!deleted || deleted.length === 0) {
      throw permissionError('This setlist could not be deleted. You may not have permission.');
    }

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// SETLIST SONGS
// ============================================

/** Recount a setlist's songs and store it on the setlist (there is no RPC for this). */
const refreshSetlistSongCount = async (setlistId: string): Promise<void> => {
  const { count, error } = await supabase
    .from('setlist_songs')
    .select('id', { count: 'exact', head: true })
    .eq('setlist_id', setlistId);
  if (error || count == null) return;
  await supabase.from('setlists').update({ song_count: count }).eq('id', setlistId);
};

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

    await refreshSetlistSongCount(setlistId);

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
      .maybeSingle();

    const { error } = await supabase
      .from('setlist_songs')
      .delete()
      .eq('id', setlistSongId);

    if (error) throw error;

    if (setlistSong?.setlist_id) {
      await refreshSetlistSongCount(setlistSong.setlist_id);
    }

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

/** One entry for replaceSetlistSongs: a song id, or a song id with its set. */
export type SetlistSongInput =
  | string
  | { song_id: string; set_number?: number; notes?: string | null };

/**
 * Replace a setlist's songs with `songs`, in order.
 *
 * Accepts plain song ids (old callers, everything goes in set 1) or objects
 * carrying `set_number`, so multi-set setlists keep their sets. Notes already
 * stored for a song are kept unless the caller passes new ones. If the insert
 * fails, the previous rows are put back.
 */
export const replaceSetlistSongs = async (
  setlistId: string,
  songs: SetlistSongInput[]
): Promise<{ error: Error | null }> => {
  try {
    // Read the current rows first so a failed insert can be undone.
    const { data: previous, error: readError } = await supabase
      .from('setlist_songs')
      .select('id, setlist_id, song_id, position, set_number, notes')
      .eq('setlist_id', setlistId);

    if (readError) throw readError;
    const previousRows = (previous || []) as Array<{
      id: string;
      setlist_id: string;
      song_id: string;
      position: number;
      set_number: number | null;
      notes: string | null;
    }>;
    const previousNotes = new Map<string, string | null>();
    for (const r of previousRows) {
      if (!previousNotes.has(r.song_id)) previousNotes.set(r.song_id, r.notes ?? null);
    }

    const rows = songs.map((entry, i) => {
      const item = typeof entry === 'string' ? { song_id: entry } : entry;
      const setNumber =
        typeof item.set_number === 'number' && Number.isFinite(item.set_number) && item.set_number >= 1
          ? Math.floor(item.set_number)
          : 1;
      const notes = 'notes' in item && item.notes !== undefined ? item.notes : previousNotes.get(item.song_id) ?? null;
      return {
        setlist_id: setlistId,
        song_id: item.song_id,
        position: i + 1,
        set_number: setNumber,
        notes,
      };
    });

    const { error: deleteError } = await supabase
      .from('setlist_songs')
      .delete()
      .eq('setlist_id', setlistId);

    if (deleteError) throw deleteError;

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from('setlist_songs')
        .insert(rows);

      if (insertError) {
        if (previousRows.length > 0) {
          const { error: restoreError } = await supabase
            .from('setlist_songs')
            .insert(previousRows);
          if (restoreError) {
            console.error('Could not restore setlist songs after a failed save:', restoreError);
          }
        }
        throw insertError;
      }
    }

    const { error: updateError } = await supabase
      .from('setlists')
      .update({ song_count: rows.length })
      .eq('id', setlistId);

    if (updateError) throw updateError;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

/**
 * Save a new song order for a setlist in one request (one transaction), so
 * band members' apps reload it once, already in the new order. `rows` come
 * from reorderRows (src/lib/stageLive.ts). Admins only (RLS, migration 074).
 */
export const saveSetlistOrder = async (
  rows: { id: string; setlist_id: string; song_id: string; position: number; set_number: number }[]
): Promise<{ error: Error | null }> => {
  if (rows.length === 0) return { error: null };
  try {
    const { data, error } = await supabase
      .from('setlist_songs')
      .upsert(rows, { onConflict: 'id', defaultToNull: false })
      .select('id');
    if (error) throw error;
    if (!data || data.length !== rows.length) {
      throw permissionError('The new order could not be saved. You may not have permission.');
    }
    return { error: null };
  } catch (error: any) {
    return { error };
  }
};
