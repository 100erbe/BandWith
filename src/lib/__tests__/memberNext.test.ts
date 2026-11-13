import { describe, it, expect } from 'vitest';
import { memberNext } from '../memberNext';

const ev = (id: string, date: string, extra: Record<string, unknown> = {}) => ({
  id, band_id: 'b1', title: ` ${id} `, event_type: 'gig', status: 'confirmed', event_date: date, start_time: '20:30:00', ...extra,
});

describe('memberNext', () => {
  const today = '2026-12-10';
  const events = [
    ev('wedding', '2026-12-12'),
    ev('rehearsal', '2026-12-11', { event_type: 'rehearsal', start_time: '21:00' }),
    ev('past', '2026-12-01'),
    ev('cancelled', '2026-12-13', { status: 'cancelled' }),
    ev('other-band', '2026-12-14', { band_id: 'b2' }),
    ev('declined', '2026-12-15'),
    ev('quote', '2026-12-18', { status: 'tentative' }),
    ev('later', '2027-01-20'),
  ];
  const rows = [
    { event_id: 'wedding', status: 'confirmed', role: 'Vocals' },
    { event_id: 'rehearsal', status: 'confirmed', role: 'member' },
    { event_id: 'past', status: 'confirmed' },
    { event_id: 'cancelled', status: 'confirmed' },
    { event_id: 'other-band', status: 'confirmed' },
    { event_id: 'declined', status: 'declined' },
    { event_id: 'quote', status: 'pending' },
    { event_id: 'later', status: 'confirmed' },
  ];

  it('lists the next three in this band the member has not declined, soonest first', () => {
    const r = memberNext(rows, events, { bandId: 'b1', today });
    expect(r.map((x) => x.eventId)).toEqual(['rehearsal', 'wedding', 'quote']);
    expect(r[0]).toMatchObject({ title: 'rehearsal', eventType: 'rehearsal', start: '21:00', part: null, answer: 'in' });
    expect(r[1]).toMatchObject({ part: 'Vocals', start: '20:30' });
    expect(r[2]).toMatchObject({ answer: 'pending', eventStatus: 'tentative' });
  });

  it('skips events the member is not on, and honours the limit', () => {
    expect(memberNext([], events, { bandId: 'b1', today })).toEqual([]);
    expect(memberNext(rows, events, { bandId: 'b1', today, limit: 5 })).toHaveLength(4);
  });
});
