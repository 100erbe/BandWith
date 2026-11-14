/**
 * A rehearsal's live session on this device (Check in / live → summary):
 * when it started, the song the band is on, the verdict given to each song
 * and who checked in when. Kept in memory for the app session; nothing here
 * is sent anywhere.
 */

export type SongVerdict = 'nailed' | 'work' | 'problem' | 'redo';

export interface RehearsalSession {
  key: string;
  startedAt: number;
  endedAt?: number;
  /** Time spent paused, and when the current pause began. */
  pausedMs: number;
  pausedAt?: number;
  /** Index of the song on screen, and the furthest one reached. */
  current: number;
  reached: number;
  verdicts: Record<string, SongVerdict>;
  /** Member user id → check-in time. */
  arrivals: Record<string, number>;
}

const sessions = new Map<string, RehearsalSession>();

/** One session per rehearsal occurrence (recurring rehearsals share the event id). */
export const sessionKey = (eventId: string | number | undefined, date: string | undefined) =>
  `${eventId ?? ''}|${(date || '').slice(0, 10)}`;

/** The scheduled start as a timestamp (local time), or null without a date and time. */
export const scheduledStart = (date?: string, time?: string): number | null => {
  const d = (date || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = (time || '').match(/^(\d{1,2}):(\d{2})/);
  if (!d || !t) return null;
  return new Date(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]).getTime();
};

/**
 * The running session for this rehearsal, started now if there is none (or
 * the last one ended). A rehearsal that already began today counts from its
 * scheduled start.
 */
export const startSession = (key: string, start: number | null, now = Date.now()): RehearsalSession => {
  const existing = sessions.get(key);
  if (existing && !existing.endedAt) return existing;
  const begun = start !== null && start <= now && now - start < 12 * 3600_000;
  const session: RehearsalSession = {
    key,
    startedAt: begun ? start : now,
    pausedMs: 0,
    current: 0,
    reached: 0,
    verdicts: {},
    arrivals: {},
  };
  sessions.set(key, session);
  return session;
};

export const getSession = (key: string): RehearsalSession | undefined => sessions.get(key);

export const updateSession = (key: string, patch: (s: RehearsalSession) => Partial<RehearsalSession>) => {
  const s = sessions.get(key);
  if (!s) return undefined;
  const next = { ...s, ...patch(s) };
  sessions.set(key, next);
  return next;
};

export const togglePause = (key: string, now = Date.now()) =>
  updateSession(key, (s) =>
    s.pausedAt !== undefined ? { pausedAt: undefined, pausedMs: s.pausedMs + (now - s.pausedAt) } : { pausedAt: now },
  );

export const endSession = (key: string, now = Date.now()) =>
  updateSession(key, (s) => ({
    endedAt: now,
    pausedAt: undefined,
    pausedMs: s.pausedAt !== undefined ? s.pausedMs + (now - s.pausedAt) : s.pausedMs,
  }));

/** Seconds of rehearsal so far (pauses excluded). */
export const elapsedSeconds = (s: RehearsalSession, now = Date.now()) => {
  const end = s.endedAt ?? s.pausedAt ?? now;
  return Math.max(0, Math.floor((end - s.startedAt - s.pausedMs) / 1000));
};

/** "47:23", or "1:05:09" past an hour. */
export const formatClock = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
};

/** "2h 15m", "45m". */
export const formatSpan = (sec: number) => {
  const total = Math.round(sec / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export interface SessionSummary {
  played: number;
  needWork: number;
  problems: number;
  /** Songs to work on next time (needs work, redo, problems), in set order. */
  focus: string[];
}

export const summarize = (s: RehearsalSession | undefined, songIds: string[]): SessionSummary => {
  if (!s || songIds.length === 0) return { played: 0, needWork: 0, problems: 0, focus: [] };
  const played = songIds.filter((id, i) => i <= s.reached || s.verdicts[id]).length;
  const v = songIds.map((id) => s.verdicts[id]);
  return {
    played,
    needWork: v.filter((x) => x === 'work' || x === 'redo').length,
    problems: v.filter((x) => x === 'problem').length,
    focus: songIds.filter((id) => s.verdicts[id] && s.verdicts[id] !== 'nailed'),
  };
};

/** Arrived more than five minutes after the scheduled start. */
export const isLate = (arrival: number, start: number | null) => start !== null && arrival - start > 5 * 60_000;

/** Test helper. */
export const __resetSessions = () => sessions.clear();
