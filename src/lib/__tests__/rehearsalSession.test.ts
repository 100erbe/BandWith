import { describe, it, expect, beforeEach } from 'vitest';
import {
  __resetSessions, elapsedSeconds, endSession, formatClock, formatSpan, getSession, isLate,
  scheduledStart, sessionKey, startSession, summarize, togglePause, updateSession,
} from '../rehearsalSession';

const MIN = 60_000;

describe('rehearsalSession', () => {
  beforeEach(() => __resetSessions());

  it('keys a session by rehearsal and day (recurring rehearsals share an id)', () => {
    expect(sessionKey('ev1', '2026-11-13T00:00:00')).toBe('ev1|2026-11-13');
    expect(sessionKey('ev1', '2026-11-20')).not.toBe(sessionKey('ev1', '2026-11-13'));
  });

  it('reads the scheduled start in local time', () => {
    expect(scheduledStart('2026-11-13', '21:00')).toBe(new Date(2026, 10, 13, 21, 0).getTime());
    expect(scheduledStart('2026-11-13', '')).toBeNull();
    expect(scheduledStart(undefined, '21:00')).toBeNull();
  });

  it('counts from the scheduled start once it has passed, else from now', () => {
    const start = new Date(2026, 10, 13, 21, 0).getTime();
    const late = startSession('a', start, start + 10 * MIN);
    expect(late.startedAt).toBe(start);
    const early = startSession('b', start, start - 30 * MIN);
    expect(early.startedAt).toBe(start - 30 * MIN);
    // Another day's start doesn't count.
    expect(startSession('c', start, start + 20 * 3600_000).startedAt).toBe(start + 20 * 3600_000);
  });

  it('keeps the running session when live mode is reopened, a new one after it ended', () => {
    const s = startSession('k', null, 1000);
    expect(startSession('k', null, 5000)).toBe(s);
    endSession('k', 9000);
    expect(startSession('k', null, 10_000).startedAt).toBe(10_000);
  });

  it('leaves pauses out of the elapsed time', () => {
    startSession('k', null, 0);
    togglePause('k', 60_000);
    expect(elapsedSeconds(getSession('k')!, 120_000)).toBe(60);
    togglePause('k', 120_000);
    expect(elapsedSeconds(getSession('k')!, 180_000)).toBe(120);
    endSession('k', 200_000);
    expect(elapsedSeconds(getSession('k')!, 999_000)).toBe(140);
  });

  it('formats clocks and spans', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(47 * 60 + 23)).toBe('47:23');
    expect(formatClock(3600 + 5 * 60 + 9)).toBe('1:05:09');
    expect(formatSpan(45 * 60)).toBe('45m');
    expect(formatSpan(2 * 3600 + 15 * 60)).toBe('2h 15m');
    expect(formatSpan(2 * 3600)).toBe('2h');
  });

  it('summarizes what was played and what needs work, in set order', () => {
    startSession('k', null, 0);
    updateSession('k', () => ({ reached: 1, verdicts: { s1: 'nailed', s2: 'work', s4: 'problem' } }));
    expect(summarize(getSession('k'), ['s1', 's2', 's3', 's4'])).toEqual({
      played: 3,
      needWork: 1,
      problems: 1,
      focus: ['s2', 's4'],
    });
    expect(summarize(undefined, ['s1'])).toEqual({ played: 0, needWork: 0, problems: 0, focus: [] });
    expect(summarize(getSession('k'), [])).toEqual({ played: 0, needWork: 0, problems: 0, focus: [] });
  });

  it('marks arrivals more than five minutes after the start as late', () => {
    expect(isLate(10 * MIN, 0)).toBe(true);
    expect(isLate(5 * MIN, 0)).toBe(false);
    expect(isLate(60 * MIN, null)).toBe(false);
  });
});
