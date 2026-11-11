import { describe, expect, it } from 'vitest';
import { venueFields } from './location';

describe('venueFields', () => {
  it('keeps the venue name out of the address', () => {
    const f = venueFields({
      name: 'Blackbox Studios',
      address: 'Via Ventura 4',
      postcode: '20134',
      city: 'Milano',
      country: 'Italia',
      fullAddress: 'Blackbox Studios, Via Ventura 4, Milano, Italia',
      provider: 'photon',
    });
    expect(f).toEqual({ location: 'Blackbox Studios', address: 'Via Ventura 4, 20134 Milano, Italia', isNamedPlace: true });
  });

  it('uses the street as location when the pick is only an address', () => {
    const f = venueFields({
      name: 'Via Mozart',
      address: 'Via Mozart 14',
      postcode: '20122',
      city: 'Milano',
      country: 'Italia',
      provider: 'photon',
    });
    expect(f).toEqual({ location: 'Via Mozart 14', address: '20122 Milano, Italia', isNamedPlace: false });
  });

  it('does not repeat a city picked as location', () => {
    const f = venueFields({ name: 'Milano', city: 'Milano', country: 'Italia', provider: 'photon' });
    expect(f.location).toBe('Milano');
    expect(f.address).toBe('Italia');
  });

  it('falls back to the full address without the name', () => {
    const f = venueFields({ name: 'Blue Note', fullAddress: 'Blue Note, Via Borsieri 37, Milano', provider: 'google' });
    expect(f).toEqual({ location: 'Blue Note', address: 'Via Borsieri 37, Milano', isNamedPlace: true });
  });
});
