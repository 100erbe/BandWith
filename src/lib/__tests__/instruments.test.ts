import { describe, it, expect } from 'vitest';
import { deputyCoverage, instrumentKeys, mainInstrument, sharesInstrument } from '../instruments';

describe('instrumentKeys', () => {
  it('maps spellings and languages to one key', () => {
    expect(instrumentKeys('Bass')).toEqual(['bass']);
    expect(instrumentKeys('Bass guitar')).toEqual(['bass']);
    expect(instrumentKeys('Electric bass')).toEqual(['bass']);
    expect(instrumentKeys('Batteria')).toEqual(['drums']);
    expect(instrumentKeys('Tastiere')).toEqual(['keys']);
    expect(instrumentKeys('Chitarra')).toEqual(['guitar']);
    expect(instrumentKeys('Voce')).toEqual(['vocals']);
  });

  it('keeps double bass apart from bass', () => {
    expect(instrumentKeys('Double bass')).toEqual(['double-bass']);
    expect(instrumentKeys('Contrabbasso')).toEqual(['double-bass']);
    expect(sharesInstrument('Bass', 'Double bass')).toBe(false);
  });

  it('splits compound fields and drops roles that are not instruments', () => {
    expect(instrumentKeys('Guitar / Backing vocals')).toEqual(['guitar', 'vocals']);
    expect(instrumentKeys('Bass · Band leader')).toEqual(['bass']);
    expect(instrumentKeys('Keys & synth')).toEqual(['keys']);
    expect(instrumentKeys('Chitarra e voce')).toEqual(['guitar', 'vocals']);
    expect(instrumentKeys('Harp')).toEqual(['harp']);
    expect(instrumentKeys('')).toEqual([]);
    expect(instrumentKeys(null)).toEqual([]);
  });

  it('knows the main instrument', () => {
    expect(mainInstrument('Vocals, guitar')).toBe('vocals');
    expect(mainInstrument('Musician')).toBeNull();
  });
});

describe('deputyCoverage', () => {
  const dep = (id: string, instrument: string | null) => ({ id, name: id.toUpperCase(), instrument });
  it('lists each band instrument with its members and deputies, gaps first', () => {
    const { rows, others } = deputyCoverage(
      [
        { name: 'Alex', instrument: 'Vocals' },
        { name: 'Jonah', instrument: 'Bass' },
        { name: 'Sam', instrument: 'Guitar / Backing vocals' },
        { name: 'Marta', instrument: 'Drums' },
        { name: 'Nobody', instrument: null },
      ],
      [dep('b1', 'Bass guitar'), dep('db', 'Double bass'), dep('g1', 'Chitarra'), dep('v1', 'Singer'), dep('h', 'Harp'), dep('n', null)],
    );
    expect(rows.map((r) => [r.key, r.members, r.deputies.map((d) => d.id)])).toEqual([
      ['drums', ['Marta'], []],
      ['bass', ['Jonah'], ['b1']],
      ['guitar', ['Sam'], ['g1']],
      ['vocals', ['Alex', 'Sam'], ['v1']],
    ]);
    expect(rows.find((r) => r.key === 'bass')!.label).toBe('Bass');
    expect(others.map((d) => d.id)).toEqual(['db', 'h', 'n']);
  });

  it('returns nothing when no member has an instrument', () => {
    expect(deputyCoverage([{ name: 'A' }], [dep('x', 'Bass')])).toEqual({ rows: [], others: [dep('x', 'Bass')] });
  });
});
