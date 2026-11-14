import { describe, expect, it } from 'vitest';
import { pickGeocodeResult } from '../WeatherWidget';

describe('pickGeocodeResult', () => {
  it('prefers the most populous match over the first one', () => {
    const r = pickGeocodeResult([
      { name: 'Milano', latitude: 30.7, longitude: -96.8, population: 400 },
      { name: 'Milan', latitude: 45.46, longitude: 9.19, population: 1371498 },
    ]);
    expect(r?.name).toBe('Milan');
  });

  it('keeps the first match when no population is known', () => {
    expect(pickGeocodeResult([{ name: 'A' }, { name: 'B' }])?.name).toBe('A');
  });

  it('returns undefined for no results', () => {
    expect(pickGeocodeResult(undefined)).toBeUndefined();
    expect(pickGeocodeResult([])).toBeUndefined();
  });
});
