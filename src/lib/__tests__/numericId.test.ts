import { describe, it, expect } from 'vitest';
import { uuidToNumericId } from '../numericId';

describe('uuidToNumericId', () => {
  it('is stable for the same id', () => {
    const id = '3f2a9c4e-1b7d-4e2a-9c1f-0a1b2c3d4e5f';
    expect(uuidToNumericId(id)).toBe(uuidToNumericId(id));
  });

  it('separates ids that share their first 8 hex chars', () => {
    const a = uuidToNumericId('00000000-0000-4000-8000-000000000101');
    const b = uuidToNumericId('00000000-0000-4000-8000-000000000102');
    expect(a).not.toBe(b);
  });

  it('always returns a positive integer, even for empty or non-hex input', () => {
    for (const v of ['', 'not-a-uuid', null, undefined, '00000000-0000-0000-0000-000000000000']) {
      const n = uuidToNumericId(v as string | null | undefined);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });

  it('has no collisions across a realistic batch', () => {
    const ids = Array.from({ length: 5000 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    expect(new Set(ids.map(uuidToNumericId)).size).toBe(ids.length);
  });
});
