import { describe, it, expect } from 'vitest';
import { chatEventContext } from '../chatEventContext';

describe('chatEventContext', () => {
  const base = { id: 'e1', title: ' Wedding Rossi ', event_type: 'gig', status: 'confirmed', event_date: '2026-12-12' };

  it('prefers load-in, joins venue and city', () => {
    const c = chatEventContext({ ...base, start_time: '19:30:00', load_in_time: '17:00:00', venue_name: 'Villa Clara', venue_city: 'Como' }, '2026-12-01');
    expect(c).toEqual({
      id: 'e1', title: 'Wedding Rossi', eventType: 'gig', day: '2026-12-12', when: 'later',
      time: { kind: 'loadIn', value: '17:00' }, place: 'Villa Clara, Como', cancelled: false,
      details: {
        bandId: null, status: 'confirmed', venue: 'Villa Clara', address: null,
        loadIn: '17:00', soundcheck: null, start: '19:30', end: null,
      },
    });
  });

  it('carries the times and address for the context pane', () => {
    const c = chatEventContext({ ...base, band_id: 'b1', start_time: '20:30', end_time: '01:00:00', load_in_time: '17:00', soundcheck_time: '18:30', venue_name: 'Villa Clara', venue_address: ' Via dei Colli 12, Bologna ' }, '2026-12-01');
    expect(c.details).toEqual({
      bandId: 'b1', status: 'confirmed', venue: 'Villa Clara', address: 'Via dei Colli 12, Bologna',
      loadIn: '17:00', soundcheck: '18:30', start: '20:30', end: '01:00',
    });
  });

  it('falls back to the start time and the old columns', () => {
    const c = chatEventContext({ id: 'e2', title: 'Rehearsal', event_type: 'rehearsal', date: '2026-12-02', time: '9:00', venue: 'Blackbox, Milano', venue_city: 'Milano' }, '2026-12-01');
    expect(c.time).toEqual({ kind: 'start', value: '09:00' });
    expect(c.place).toBe('Blackbox, Milano');
    expect(c.when).toBe('tomorrow');
  });

  it('knows today, past and cancelled, across months', () => {
    expect(chatEventContext({ ...base, event_date: '2026-12-31' }, '2026-12-31').when).toBe('today');
    expect(chatEventContext({ ...base, event_date: '2027-01-01' }, '2026-12-31').when).toBe('tomorrow');
    expect(chatEventContext({ ...base, event_date: '2026-11-30' }, '2026-12-31').when).toBe('past');
    expect(chatEventContext({ ...base, status: 'cancelled' }, '2026-12-01').cancelled).toBe(true);
    expect(chatEventContext({ id: 'e3' }, '2026-12-01')).toMatchObject({ day: null, when: null, time: null, place: null, eventType: 'gig' });
  });
});

describe('CHAT_EVENT_COLUMNS', () => {
  it('reads only public event columns (no fee, no client)', async () => {
    const { CHAT_EVENT_COLUMNS } = await import('../chatEventContext');
    const { EVENT_PUBLIC_COLUMNS } = await import('../services/eventPrivate');
    const pub = new Set(EVENT_PUBLIC_COLUMNS.split(',').map((c) => c.trim()));
    for (const c of CHAT_EVENT_COLUMNS.split(',').map((x) => x.trim())) expect(pub.has(c)).toBe(true);
  });
});
