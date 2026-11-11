import { describe, it, expect } from 'vitest';
import { rankDeputies, deputyRequestText, whatsappUrl, type Deputy } from '../deputies';

const dep = (name: string, instrument: string | null): Deputy => ({
  id: name, band_id: 'b', name, instrument, phone: null, email: null, notes: null, default_fee: null,
});

describe('deputies', () => {
  it('puts the same instrument first', () => {
    const list = [dep('A', 'Drums'), dep('B', null), dep('C', 'Bass')];
    expect(rankDeputies(list, 'Bass · Backing vocals').map((d) => d.name)).toEqual(['C', 'A', 'B']);
    expect(rankDeputies(list, '').map((d) => d.name)).toEqual(['A', 'B', 'C']);
  });

  it('writes the request and links', () => {
    const t = deputyRequestText({ deputyName: 'Marco Rossi', bandName: 'Velvet', eventTitle: 'Wedding', dateLabel: 'Sat 12 Dec', venue: 'Villa', role: 'Bass' });
    expect(t).toContain('Hi Marco');
    expect(t).toContain('play bass');
    expect(whatsappUrl('+39 333 123 4567', 'hi')).toBe('https://wa.me/393331234567?text=hi');
    expect(whatsappUrl('0039 333 1', 'x')).toBe('https://wa.me/393331?text=x');
  });
});
