import { describe, it, expect } from 'vitest';
import { lineupSoFar, lineupInitials, lineupStatus } from '../lineupSoFar';

const roster = new Map([
  ['leo', { name: 'Leo M.', instrument: 'Keys' }],
  ['omar', { name: 'Omar B.', instrument: 'Drums' }],
  ['jacopo', { name: 'Jacopo L.', instrument: 'Guitar' }],
  ['sara', { name: 'Sara V.', instrument: 'Bass' }],
  ['marta', { name: 'Marta C.', instrument: 'Vocals' }],
]);

describe('lineupSoFar', () => {
  const rows = [
    { user_id: 'sara', status: 'declined' },
    { user_id: 'jacopo', status: 'pending' },
    { user_id: 'marta', status: 'pending', role: 'Vocals' },
    { user_id: 'leo', status: 'confirmed', role: 'admin' },
    { user_id: 'omar', status: 'confirmed' },
  ];

  it('orders by answer, keeps the band order inside a group and splits off the viewer', () => {
    const r = lineupSoFar({ rows, roster, viewerId: 'marta', unknownName: '?' });
    expect(r.others.map((p) => p.userId)).toEqual(['leo', 'omar', 'jacopo', 'sara']);
    expect(r.total).toBe(5);
    expect(r.counts).toEqual({ in: 2, maybe: 0, pending: 2, out: 1 });
    expect(r.people.find((p) => p.userId === 'marta')?.isViewer).toBe(true);
  });

  it('uses the gig part over the roster instrument, but not admin/member', () => {
    const r = lineupSoFar({ rows: [{ user_id: 'leo', role: 'admin' }, { user_id: 'omar', role: 'Percussion' }], roster, unknownName: '?' });
    expect(r.people.map((p) => p.instrument)).toEqual(['Keys', 'Percussion']);
  });

  it('never carries a fee, even when the rows have one', () => {
    const r = lineupSoFar({ rows: [{ user_id: 'leo', status: 'confirmed', fee: 360 } as never], roster, unknownName: '?' });
    expect(Object.keys(r.people[0]).sort()).toEqual(['initials', 'instrument', 'isViewer', 'name', 'status', 'userId']);
  });

  it('names people off the roster from profiles, else the fallback', () => {
    const r = lineupSoFar({
      rows: [{ user_id: 'x' }, { user_id: 'y' }, { user_id: 'x' }],
      roster,
      extraNames: new Map([['x', 'Ivo Marchi']]),
      unknownName: 'Unknown musician',
    });
    expect(r.people.map((p) => [p.name, p.initials])).toEqual([
      ['Ivo Marchi', 'IM'],
      ['Unknown musician', 'UM'],
    ]);
  });
});

describe('helpers', () => {
  it('maps RSVP values', () => {
    expect(['confirmed', 'maybe', 'declined', 'pending', '', null, 'weird'].map(lineupStatus)).toEqual([
      'in', 'maybe', 'out', 'pending', 'pending', 'pending', 'pending',
    ]);
  });
  it('makes initials', () => {
    expect(lineupInitials('Leo M.')).toBe('LM');
    expect(lineupInitials('Cher')).toBe('CH');
    expect(lineupInitials('')).toBe('?');
  });
});
