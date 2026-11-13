import { describe, expect, it } from 'vitest';
import { WIDE_MIN_W, isTabletWindow, tabletListWidth } from './deviceRegions';

describe('tablet layout', () => {
  it('starts at iPad mini portrait width', () => {
    expect(WIDE_MIN_W).toBe(744);
  });

  it('needs a tablet-sized short side, so phones in landscape stay phones', () => {
    expect(isTabletWindow(744, 1133)).toBe(true); // iPad mini portrait
    expect(isTabletWindow(1210, 834)).toBe(true); // iPad 11" landscape
    expect(isTabletWindow(876, 388)).toBe(false); // Android phone landscape
    expect(isTabletWindow(874, 402)).toBe(false); // iPhone landscape
    expect(isTabletWindow(412, 852)).toBe(false); // phone portrait
  });

  it('keeps the list column between 320 and 420 px', () => {
    expect(tabletListWidth(744)).toBe(320); // floor
    expect(tabletListWidth(1024)).toBe(369); // iPad 13" portrait
    expect(tabletListWidth(1133)).toBe(408); // iPad mini landscape
    expect(tabletListWidth(1180)).toBe(420); // iPad 11" landscape
    expect(tabletListWidth(1366)).toBe(420); // iPad 13" landscape (cap)
  });
});
