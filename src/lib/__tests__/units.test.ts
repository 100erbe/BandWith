import { describe, expect, it } from 'vitest';
import { formatDistance, formatSpeed, fromUnit, ratePerKm, ratePerUnit, toUnit } from '../units';

describe('distance units', () => {
  it('shows km as is and miles converted', () => {
    expect(toUnit(80, 'km')).toBe(80);
    expect(toUnit(80, 'mi')).toBe(50);
    expect(formatDistance(160, 'mi')).toBe('99 mi');
    expect(formatDistance(30, 'km')).toBe('30 km');
  });

  it('typed miles are stored in km and read back the same', () => {
    for (const mi of [5, 18, 50, 120]) expect(toUnit(fromUnit(mi, 'mi'), 'mi')).toBe(mi);
    expect(fromUnit(42, 'km')).toBe(42);
  });

  it('rates per mile round-trip through the per-km value', () => {
    expect(ratePerUnit(0.5, 'mi')).toBe(0.8);
    for (const r of [0.8, 1.25, 2]) expect(ratePerUnit(ratePerKm(r, 'mi'), 'mi')).toBe(r);
    expect(ratePerKm(0.5, 'km')).toBe(0.5);
  });

  it('wind speed', () => {
    expect(formatSpeed(15, 'km')).toBe('15 km/h');
    expect(formatSpeed(16, 'mi')).toBe('10 mph');
  });
});
