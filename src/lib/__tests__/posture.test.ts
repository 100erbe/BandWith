import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  computePosture,
  createPostureSettler,
  effectivePosture,
  foldBands,
  foldFromDivision,
  foldFromSegments,
  FOLD_BAND,
  getLaptopPoseEnabled,
  setLaptopPoseEnabled,
  LAPTOP_POSE_PREF,
} from '../posture';

const portraitPhone = { w: 393, h: 852 };
const landscapePhone = { w: 932, h: 430 };

describe('foldFromDivision', () => {
  it('reads a tall division as a vertical fold and a wide one as horizontal', () => {
    expect(foldFromDivision({ x: 400, y: 0, w: 20, h: 700 })?.orientation).toBe('vertical');
    expect(foldFromDivision({ x: 0, y: 380, w: 700, h: 20 })?.orientation).toBe('horizontal');
  });
  it('ignores missing or empty divisions', () => {
    expect(foldFromDivision(null)).toBeNull();
    expect(foldFromDivision({ x: 0, y: 0, w: 0, h: 0 })).toBeNull();
    expect(foldFromDivision({ x: NaN, y: 0, w: 10, h: 10 })).toBeNull();
  });
});

describe('foldFromSegments', () => {
  const vp = { w: 800, h: 700 };
  it('finds the vertical gap between side-by-side segments', () => {
    expect(foldFromSegments([{ x: 0, y: 0, w: 390, h: 700 }, { x: 410, y: 0, w: 390, h: 700 }], vp)).toEqual({
      orientation: 'vertical', x: 390, y: 0, w: 20, h: 700,
    });
  });
  it('finds the horizontal gap between stacked segments, in any order', () => {
    expect(foldFromSegments([{ x: 0, y: 360, w: 800, h: 340 }, { x: 0, y: 0, w: 800, h: 340 }], vp)).toEqual({
      orientation: 'horizontal', x: 0, y: 340, w: 800, h: 20,
    });
  });
  it('needs two segments', () => {
    expect(foldFromSegments([{ x: 0, y: 0, w: 800, h: 700 }], vp)).toBeNull();
    expect(foldFromSegments(null, vp)).toBeNull();
  });
});

describe('computePosture', () => {
  it('stays inert on an ordinary phone (no posture data)', () => {
    for (const viewport of [portraitPhone, landscapePhone]) {
      const r = computePosture({ viewport });
      expect(r).toEqual({ posture: 'closed', detected: false, fold: null, twoPane: false, railEdge: null });
    }
  });

  it('keeps native iPhone (no status, no hinge) inert even in wide landscape', () => {
    const r = computePosture({ viewport: landscapePhone, status: null, division: null, hinge: null });
    expect(r.detected).toBe(false);
    expect(r.twoPane).toBe(false);
  });

  it('Duo closed: status column on the right, single pane, rail on the right', () => {
    const r = computePosture({ viewport: { w: 330, h: 678 }, status: { x: 290, y: 0, w: 40, h: 678 } });
    expect(r).toMatchObject({ posture: 'closed', detected: true, twoPane: false, railEdge: 'right' });
  });

  it('a status rect from an older shell (no edge) counts as the right edge', () => {
    expect(computePosture({ viewport: portraitPhone, status: { x: 340, y: 0, w: 53, h: 120 } }).railEdge).toBe('right');
  });

  it('a column on the left puts the rail on the left; top/bottom bands get no rail', () => {
    expect(computePosture({ viewport: portraitPhone, status: { x: 0, y: 0, w: 48, h: 300, edge: 'left' } }).railEdge).toBe('left');
    expect(computePosture({ viewport: portraitPhone, status: { x: 300, y: 0, w: 93, h: 30, edge: 'top' } }).railEdge).toBeNull();
  });

  it('the closed Duo turned over: the clock + camera corner block is a column of its side', () => {
    const closedLandscape = { w: 678, h: 466 };
    expect(computePosture({ viewport: closedLandscape, status: { x: 0, y: 0, w: 84, h: 82, edge: 'top' } }).railEdge).toBe('left');
    expect(computePosture({ viewport: closedLandscape, status: { x: 594, y: 384, w: 84, h: 82, edge: 'bottom' } }).railEdge).toBe('right');
    expect(computePosture({ viewport: closedLandscape, status: { x: 300, y: 0, w: 84, h: 82, edge: 'top' } }).railEdge).toBeNull();
  });

  it('Duo open landscape with a vertical division: book, two panes', () => {
    const r = computePosture({
      viewport: { w: 900, h: 669 },
      status: { x: 830, y: 0, w: 70, h: 669, edge: 'right' },
      division: { x: 440, y: 0, w: 20, h: 669 },
      hinge: 'open',
    });
    expect(r).toMatchObject({ posture: 'book', twoPane: true });
    expect(r.fold?.orientation).toBe('vertical');
  });

  it('half-folded book is still the book layout', () => {
    const r = computePosture({ viewport: { w: 900, h: 669 }, division: { x: 440, y: 0, w: 20, h: 669 }, hinge: 'half-open' });
    expect(r.posture).toBe('book');
    expect(r.twoPane).toBe(true);
  });

  it('Duo open landscape without a division splits evenly from 860pt', () => {
    const status = { x: 830, y: 0, w: 70, h: 669, edge: 'right' as const };
    expect(computePosture({ viewport: { w: 900, h: 669 }, status }).twoPane).toBe(true);
    expect(computePosture({ viewport: { w: 850, h: 669 }, status }).twoPane).toBe(false);
  });

  it('half folded with a horizontal fold: tabletop (Laptop pose)', () => {
    const r = computePosture({
      viewport: { w: 669, h: 900 },
      division: { x: 0, y: 440, w: 669, h: 20 },
      hinge: 'half-open',
    });
    expect(r).toMatchObject({ posture: 'tabletop', twoPane: false, detected: true });
    expect(r.fold).toEqual({ orientation: 'horizontal', x: 0, y: 440, w: 669, h: 20 });
  });

  it('a horizontal fold without a hinge reading counts as tabletop', () => {
    expect(computePosture({ viewport: { w: 669, h: 900 }, division: { x: 0, y: 440, w: 669, h: 20 } }).posture).toBe('tabletop');
  });

  it('opening flat with a horizontal fold is open-flat (open portrait)', () => {
    const r = computePosture({ viewport: { w: 669, h: 900 }, division: { x: 0, y: 440, w: 669, h: 20 }, hinge: 'open' });
    expect(r.posture).toBe('open-flat');
    expect(r.twoPane).toBe(false);
  });

  it('hinge open with no fold reported and a narrow display is open-flat', () => {
    expect(computePosture({ viewport: { w: 669, h: 900 }, hinge: 'open' }).posture).toBe('open-flat');
  });

  it('hinge closed is closed', () => {
    expect(computePosture({ viewport: { w: 330, h: 678 }, hinge: 'closed' })).toMatchObject({ posture: 'closed', detected: true });
  });

  it('Split View: the window is narrower than the screen', () => {
    const r = computePosture({
      viewport: { w: 400, h: 669 },
      status: { x: 0, y: 0, w: 60, h: 669, edge: 'left' },
      window: { x: 0, y: 0, w: 400, h: 669 },
      screen: { w: 900, h: 669 },
    });
    expect(r).toMatchObject({ posture: 'split', twoPane: false, railEdge: 'left' });
  });

  it('a full-screen window is not Split View', () => {
    const r = computePosture({ viewport: { w: 330, h: 678 }, window: { x: 0, y: 0, w: 330, h: 678 }, screen: { w: 330, h: 678 }, hinge: 'closed' });
    expect(r.posture).toBe('closed');
  });

  it('web: wide landscape tablet (no native data) gets the book split', () => {
    const r = computePosture({ viewport: { w: 1180, h: 820 } });
    expect(r).toMatchObject({ posture: 'book', twoPane: true, detected: true, railEdge: null });
  });

  it('web: wide but short (a phone in landscape) stays inert', () => {
    expect(computePosture({ viewport: { w: 915, h: 412 } }).detected).toBe(false);
  });

  it('large tablet held upright gets the book split, a smaller one does not', () => {
    expect(computePosture({ viewport: { w: 1024, h: 1366 } })).toMatchObject({ posture: 'book', twoPane: true });
    expect(computePosture({ viewport: { w: 820, h: 1180 } })).toMatchObject({ posture: 'closed', twoPane: false });
    // The Duo's Laptop pose is never mistaken for a tablet.
    expect(computePosture({ viewport: { w: 669, h: 951 } }).twoPane).toBe(false);
  });

  it('web: viewport segments give the book split and tabletop', () => {
    const book = computePosture({
      viewport: { w: 841, h: 701 },
      segments: [{ x: 0, y: 0, w: 420, h: 701 }, { x: 421, y: 0, w: 420, h: 701 }],
    });
    expect(book).toMatchObject({ posture: 'book', twoPane: true });
    const table = computePosture({
      viewport: { w: 701, h: 841 },
      segments: [{ x: 0, y: 0, w: 701, h: 420 }, { x: 0, y: 421, w: 701, h: 420 }],
      hinge: 'half-open',
    });
    expect(table.posture).toBe('tabletop');
  });
});

describe('effectivePosture', () => {
  it('turns tabletop into open-flat when Laptop pose is switched off', () => {
    expect(effectivePosture('tabletop', false)).toBe('open-flat');
    expect(effectivePosture('tabletop', true)).toBe('tabletop');
    expect(effectivePosture('book', false)).toBe('book');
  });
});

describe('foldBands', () => {
  it('keeps at least the 44pt band empty around a thin fold', () => {
    const b = foldBands({ orientation: 'horizontal', x: 0, y: 440, w: 669, h: 20 }, 900);
    expect(b.deckTop - b.displayH).toBe(FOLD_BAND);
    expect(b.displayH).toBe(450 - 22);
    expect(b.deckH).toBe(900 - b.deckTop);
  });
  it('uses the fold itself when it is wider than the band', () => {
    const b = foldBands({ orientation: 'horizontal', x: 0, y: 400, w: 669, h: 60 }, 900);
    expect(b).toEqual({ displayH: 400, deckTop: 460, deckH: 440 });
  });
});

describe('createPostureSettler', () => {
  afterEach(() => vi.useRealTimers());

  it('applies the first posture at once and debounces entering tabletop', () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const s = createPostureSettler(apply, 600);
    s.push('book');
    expect(apply).toHaveBeenLastCalledWith('book');
    s.push('tabletop');
    vi.advanceTimersByTime(599);
    expect(apply).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(apply).toHaveBeenLastCalledWith('tabletop');
  });

  it('cancels a pending tabletop when the phone moves on before settling', () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const s = createPostureSettler(apply, 600);
    s.push('book');
    s.push('tabletop');
    vi.advanceTimersByTime(300);
    s.push('book');
    vi.advanceTimersByTime(1000);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(s.current).toBe('book');
  });

  it('leaves tabletop at once when opened flat', () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const s = createPostureSettler(apply, 600);
    s.push('tabletop');
    s.push('book');
    expect(apply).toHaveBeenLastCalledWith('book');
  });
});

describe('Laptop pose preference', () => {
  afterEach(() => localStorage.removeItem(LAPTOP_POSE_PREF));
  it('defaults to on and persists changes', () => {
    expect(getLaptopPoseEnabled()).toBe(true);
    setLaptopPoseEnabled(false);
    expect(localStorage.getItem(LAPTOP_POSE_PREF)).toBe('0');
    expect(getLaptopPoseEnabled()).toBe(false);
    setLaptopPoseEnabled(true);
    expect(getLaptopPoseEnabled()).toBe(true);
  });
});
