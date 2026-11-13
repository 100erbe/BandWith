/**
 * Visual metronome in Stage mode, kept in step across the band's phones.
 *
 * Phones' clocks differ by tens or hundreds of milliseconds, so the leader
 * doesn't send beats (they would arrive late and uneven). It sends once:
 * "the click starts at <my time> T, at B BPM". Every other app measures how
 * far its clock is from the leader's (a few ping/pong round trips on the
 * gig's live channel, the fastest one wins, like NTP) and works out beat n
 * at T + n·60/B in its own time. Good to about ±20–40 ms on a decent
 * connection: right for a count-in and a tempo reference, not for an in-ear
 * click.
 */

/** Realtime broadcast events on the stage channel (stageTopic, migration 085). */
export const CLICK_EVENT = 'click';
export const PING_EVENT = 'click-ping';
export const PONG_EVENT = 'click-pong';

export interface ClickState {
  /** Lamport clock, as for the stage state. */
  seq: number;
  from: string;
  on: boolean;
  bpm: number;
  /** Beats in a bar (the first one is accented). */
  beats: number;
  /** Bars to play, then stop on its own (a count-in); null until stopped. */
  bars: number | null;
  /** Beat 0, in the sender's clock (ms since epoch). */
  startAt: number;
  /** setlist_songs row id the click belongs to: another song means it no longer shows. */
  songId: string | null;
}

export const MIN_CLICK_BPM = 30;
export const MAX_CLICK_BPM = 300;
/** The leader starts this far ahead, so the others get the message before beat 0. */
export const START_LEAD_MS = 700;

const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

export const parseClickState = (payload: unknown): ClickState | null => {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (!num(p.seq, 0, Number.MAX_SAFE_INTEGER) || typeof p.from !== 'string' || !p.from) return null;
  if (typeof p.on !== 'boolean' || !num(p.bpm, MIN_CLICK_BPM, MAX_CLICK_BPM) || !num(p.beats, 1, 16)) return null;
  if (p.bars !== null && !num(p.bars, 1, 64)) return null;
  if (!num(p.startAt, 0, Number.MAX_SAFE_INTEGER)) return null;
  if (p.songId !== null && typeof p.songId !== 'string') return null;
  return {
    seq: p.seq as number,
    from: p.from,
    on: p.on,
    bpm: p.bpm as number,
    beats: Math.round(p.beats as number),
    bars: (p.bars as number | null) === null ? null : Math.round(p.bars as number),
    startAt: p.startAt as number,
    songId: (p.songId as string | null) ?? null,
  };
};

/** One ping/pong: sent at t0 (mine), answered at t1 (theirs), back at t2 (mine). */
export interface ClockSample {
  /** Their clock minus mine. */
  offset: number;
  rtt: number;
}

export const clockSample = (t0: number, t1: number, t2: number): ClockSample => ({ offset: t1 - (t0 + t2) / 2, rtt: Math.max(0, t2 - t0) });

/** The sample with the shortest round trip is the least distorted by the network. */
export const bestSample = (samples: ClockSample[]): ClockSample | null =>
  samples.reduce<ClockSample | null>((best, s) => (!best || s.rtt < best.rtt ? s : best), null);

export interface BeatPosition {
  /** Beat number from 0, or -1 before the start. */
  beat: number;
  /** 0…1 through the current beat. */
  phase: number;
  /** First beat of a bar. */
  downbeat: boolean;
  /** Beat in the bar, 1-based (for "1 2 3 4"). */
  count: number;
  /** A count-in has played out. */
  done: boolean;
}

/** Where the click is at `now` (my clock), given the leader's offset (their clock minus mine). */
export function beatAt(state: Pick<ClickState, 'bpm' | 'beats' | 'bars' | 'startAt'>, now: number, offset: number): BeatPosition {
  const period = 60000 / state.bpm;
  const elapsed = now + offset - state.startAt;
  if (elapsed < 0) return { beat: -1, phase: 0, downbeat: false, count: 0, done: false };
  const beat = Math.floor(elapsed / period);
  const done = state.bars != null && beat >= state.bars * state.beats;
  const inBar = beat % state.beats;
  return { beat, phase: (elapsed - beat * period) / period, downbeat: inBar === 0, count: inBar + 1, done };
}

/** Beats in a bar from a chart's time signature ("3/4" → 3, "6/8" → 6, "12/8" → 12); 4 otherwise. */
export const beatsInBar = (time?: string | null) => {
  const n = parseInt((time || '').split('/')[0], 10);
  return n >= 1 && n <= 16 ? n : 4;
};
