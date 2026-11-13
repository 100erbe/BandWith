import { describe, expect, it } from 'vitest';
import { WIDE_MIN_W, tabletListWidth } from './deviceRegions';

describe('tablet layout', () => {
  it('starts at iPad mini portrait width', () => {
    expect(WIDE_MIN_W).toBe(744);
  });

  it('keeps the list column between 320 and 420 px', () => {
    expect(tabletListWidth(744)).toBe(320); // floor
    expect(tabletListWidth(1024)).toBe(369); // iPad 13" portrait
    expect(tabletListWidth(1133)).toBe(408); // iPad mini landscape
    expect(tabletListWidth(1180)).toBe(420); // iPad 11" landscape
    expect(tabletListWidth(1366)).toBe(420); // iPad 13" landscape (cap)
  });
});
