/**
 * What the gig / rehearsal wizard saves besides the event row: its setlist,
 * to-dos, lineup changes and (iPad composer) rider & stage. Saved offline,
 * they travel with the queued create_event / update_event and are replayed
 * once the event itself is on the server (see syncQueue executeMutation).
 *
 * Replay is best effort after the event is saved: a failure is logged and
 * returned, but never makes the queue send the event again (that would
 * duplicate to-dos or a rider).
 */
import { supabase } from '@/lib/supabase';
import { createSetlist, replaceSetlistSongs, updateSetlist } from '@/lib/services/songs';
import { syncEventTasks, type EventTaskDraft } from '@/lib/services/eventTasks';
import { saveEventLineup, type LineupRow } from '@/lib/services/eventMemberMoney';
import { persistComposerStage, type ComposerStagePayload } from '@/lib/services/composerStage';

export interface QueuedSetlist {
  bandId: string;
  name: string;
  songs: { song_id: string; position: number; set_number: number }[];
  /** Editing: every song was removed from the gig's setlist. */
  cleared?: boolean;
}

export interface QueuedEventExtras {
  setlist?: QueuedSetlist;
  tasks?: { drafts: EventTaskDraft[]; originalIds: string[]; eventDate: string | null };
  /** Edit only: the lineup the admin set (a create carries it in memberIds). */
  lineup?: LineupRow[];
  /** iPad composer: stage and rider document. */
  stage?: { bandId: string; payload: ComposerStagePayload; gig: { title: string; date?: string; venue?: string } };
}

/** The extras in a queued payload, or null when there are none. */
export const extrasOf = (payload: any): QueuedEventExtras | null => {
  const extras = payload?.extras;
  return extras && typeof extras === 'object' && Object.keys(extras).length > 0 ? (extras as QueuedEventExtras) : null;
};

/**
 * Lineup edit as a diff, like the online save: keep everyone's RSVP, remove
 * only who was taken out, add the new ones with the status queued for them.
 */
export const lineupDiff = (
  existing: { user_id: string; status?: string | null }[],
  wanted: LineupRow[],
): { removed: string[]; rows: LineupRow[] } => {
  const statusOf = new Map(existing.map((r) => [r.user_id, r.status]));
  const wantedIds = new Set(wanted.map((r) => r.user_id));
  return {
    removed: existing.map((r) => r.user_id).filter((id) => !wantedIds.has(id)),
    rows: wanted.map((r) => ({ ...r, status: statusOf.get(r.user_id) || r.status || 'pending' })),
  };
};

const saveSetlist = async (eventId: string, setlist: QueuedSetlist): Promise<void> => {
  const { data: ev, error: readErr } = await supabase.from('events').select('setlist_id').eq('id', eventId).maybeSingle();
  if (readErr) throw readErr;
  const existingId = (ev as { setlist_id?: string | null } | null)?.setlist_id;
  if (existingId) {
    if (setlist.songs.length === 0 && !setlist.cleared) return;
    const { error } = await replaceSetlistSongs(
      existingId,
      setlist.songs.map(({ song_id, set_number }) => ({ song_id, set_number })),
    );
    if (error) throw error;
    await updateSetlist(existingId, { name: setlist.name, song_count: setlist.songs.length });
    return;
  }
  if (setlist.songs.length === 0) return;
  const { data: sl, error } = await createSetlist(
    { band_id: setlist.bandId, name: setlist.name, song_count: setlist.songs.length },
    setlist.songs,
  );
  if (error) throw error;
  if (!sl?.id) return;
  const { error: linkErr } = await supabase.from('events').update({ setlist_id: sl.id }).eq('id', eventId);
  if (linkErr) throw linkErr;
};

const saveLineup = async (eventId: string, lineup: LineupRow[]): Promise<void> => {
  const { data: existing, error: readErr } = await supabase
    .from('event_members')
    .select('user_id, status')
    .eq('event_id', eventId);
  if (readErr) throw readErr;
  const { removed, rows } = lineupDiff(existing || [], lineup);
  if (removed.length > 0) {
    const { error } = await supabase.from('event_members').delete().eq('event_id', eventId).in('user_id', removed);
    if (error) throw error;
  }
  const { error } = await saveEventLineup(eventId, rows);
  if (error) throw error;
};

/** Saves the extras for `eventId`. Returns what failed (empty when all saved). */
export async function replayEventExtras(eventId: string, extras: QueuedEventExtras): Promise<string[]> {
  const failed: string[] = [];
  const step = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (err) {
      console.warn(`[syncQueue] ${name} not saved for ${eventId}:`, err);
      failed.push(name);
    }
  };
  if (extras.lineup) await step('lineup', () => saveLineup(eventId, extras.lineup!));
  if (extras.setlist) await step('setlist', () => saveSetlist(eventId, extras.setlist!));
  if (extras.tasks && (extras.tasks.drafts.length > 0 || extras.tasks.originalIds.length > 0)) {
    await step('tasks', async () => {
      const { error } = await syncEventTasks(eventId, extras.tasks!.drafts, extras.tasks!.eventDate, extras.tasks!.originalIds);
      if (error) throw error;
    });
  }
  if (extras.stage) {
    await step('stage', async () => {
      const error = await persistComposerStage(eventId, extras.stage!.bandId, extras.stage!.payload, extras.stage!.gig);
      if (error) throw new Error(error);
    });
  }
  return failed;
}

/** An update queued for a not-yet-synced create: its extras replace the create's. */
export const mergeExtras = (
  create: QueuedEventExtras | null,
  update: QueuedEventExtras | null,
): QueuedEventExtras | undefined => {
  if (!create && !update) return undefined;
  const { lineup: _lineup, ...rest } = update || {};
  return { ...(create || {}), ...rest };
};
