import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCurrentKey } from '../useCurrentKey';

describe('useCurrentKey', () => {
  it('follows the rendered key', () => {
    const { result, rerender } = renderHook(({ k }) => useCurrentKey(k), { initialProps: { k: 'a' as string | null } });
    expect(result.current.isCurrent('a')).toBe(true);
    rerender({ k: 'b' });
    expect(result.current.isCurrent('a')).toBe(false);
    expect(result.current.isCurrent('b')).toBe(true);
    rerender({ k: null });
    expect(result.current.isCurrent('b')).toBe(false);
    expect(result.current.isCurrent(null)).toBe(false);
  });

  it('a late answer for A is dropped once B is open (RSVP race)', () => {
    const { result, rerender } = renderHook(({ k }) => useCurrentKey(k), { initialProps: { k: null as string | null } });
    // Open A, then B before A's membership arrives.
    result.current.markCurrent('A');
    result.current.markCurrent('B');
    expect(result.current.isCurrent('A')).toBe(false);
    rerender({ k: 'B' });
    expect(result.current.isCurrent('A')).toBe(false);
    expect(result.current.isCurrent('B')).toBe(true);
  });

  it('a mark made before the re-render counts right away', () => {
    const { result, rerender } = renderHook(({ k }) => useCurrentKey(k), { initialProps: { k: 'A' as string | null } });
    // Accept on A closes the detail: the answer must not land on anything.
    result.current.markCurrent(null);
    expect(result.current.isCurrent('A')).toBe(false);
    rerender({ k: null });
    // Reopening A later makes A's answer welcome again.
    rerender({ k: 'A' });
    expect(result.current.isCurrent('A')).toBe(true);
  });

  it('keeps a mark while the rendered key has not changed', () => {
    const { result, rerender } = renderHook(({ k }) => useCurrentKey(k), { initialProps: { k: 'A' as string | null } });
    result.current.markCurrent('B');
    rerender({ k: 'A' });
    expect(result.current.isCurrent('B')).toBe(true);
  });
});
