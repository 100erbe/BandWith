import { describe, it, expect } from 'vitest';
import { syncOpenEvent } from '../openEventSync';

type Ev = { eventId: string; title: string; status: string; venueName?: string };
const open: Ev = { eventId: 'e1', title: 'Gig', status: 'QUOTE', venueName: 'Club' };

describe('syncOpenEvent', () => {
  it('does nothing without an open event or a list version', () => {
    expect(syncOpenEvent<Ev>(null, { title: 'x' }, null)).toEqual({ next: null, seen: null });
    expect(syncOpenEvent(open, undefined, 'sig').next).toBe(open);
  });

  it('only remembers the first list version seen after opening', () => {
    const r = syncOpenEvent(open, { eventId: 'e1', title: 'Old', status: 'QUOTE' }, null);
    expect(r.next).toBe(open);
    expect(r.seen).not.toBeNull();
  });

  it('keeps optimistic changes while the list version is unchanged', () => {
    const listVersion = { eventId: 'e1', title: 'Gig', status: 'QUOTE' };
    const seen = syncOpenEvent(open, listVersion, null).seen;
    const optimistic = { ...open, status: 'CONFIRMED' };
    expect(syncOpenEvent(optimistic, { ...listVersion }, seen).next).toBe(optimistic);
  });

  it('takes a new list version and keeps detail-only fields', () => {
    const seen = syncOpenEvent(open, { eventId: 'e1', title: 'Gig', status: 'QUOTE' }, null).seen;
    const r = syncOpenEvent(open, { eventId: 'e1', title: 'Gig moved', status: 'CONFIRMED' }, seen);
    expect(r.next).toEqual({ eventId: 'e1', title: 'Gig moved', status: 'CONFIRMED', venueName: 'Club' });
    expect(r.seen).not.toBe(seen);
  });
});
