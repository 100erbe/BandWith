import { describe, expect, it, vi } from 'vitest';

vi.mock('../../supabase', () => ({ supabase: {} }));

import { dueDateFor } from '../eventTasks';

describe('dueDateFor', () => {
  it('shifts the event date by the template offset', () => {
    expect(dueDateFor('2026-11-20', -7)).toBe('2026-11-13');
    expect(dueDateFor('2026-11-20', 0)).toBe('2026-11-20');
    expect(dueDateFor('2026-11-30', 2)).toBe('2026-12-02');
  });

  it('crosses months and years', () => {
    expect(dueDateFor('2027-01-03', -5)).toBe('2026-12-29');
  });

  it('accepts timestamps and returns null when unknown', () => {
    expect(dueDateFor('2026-11-20T18:00:00Z', -1)).toBe('2026-11-19');
    expect(dueDateFor(null, -1)).toBeNull();
    expect(dueDateFor('2026-11-20', undefined)).toBeNull();
    expect(dueDateFor('not a date', 3)).toBeNull();
  });
});
