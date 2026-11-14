import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const update = vi.fn();
const eq = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (v: unknown) => {
        update(v);
        return { eq: (...a: unknown[]) => eq(...a) };
      },
    }),
  },
}));

import { setLocalePref } from '../index';
import { useServerLocaleSync } from '../serverLocale';

describe('server language for pushes', () => {
  beforeEach(() => {
    update.mockReset();
    eq.mockReset().mockResolvedValue({ error: null });
    setLocalePref('it');
  });

  it('writes the app language once when the profile has another', async () => {
    const { rerender } = renderHook(({ lang }) => useServerLocaleSync('u1', lang), { initialProps: { lang: 'en' as string | null } });
    expect(update).toHaveBeenCalledWith({ preferred_language: 'it' });
    expect(eq).toHaveBeenCalledWith('id', 'u1');
    rerender({ lang: 'en' });
    expect(update).toHaveBeenCalledTimes(1);
    await act(async () => setLocalePref('de'));
    expect(update).toHaveBeenLastCalledWith({ preferred_language: 'de' });
  });

  it('writes the old language again when switching back to it', async () => {
    const { rerender } = renderHook(({ lang }) => useServerLocaleSync('u1', lang), { initialProps: { lang: 'en' as string | null } });
    expect(update).toHaveBeenLastCalledWith({ preferred_language: 'it' });
    // The profile in memory still says 'en' (not read again after the write).
    await act(async () => setLocalePref('en'));
    rerender({ lang: 'en' });
    expect(update).toHaveBeenLastCalledWith({ preferred_language: 'en' });
    expect(update).toHaveBeenCalledTimes(2);
    // Profile read again with the value we wrote: nothing more to send.
    rerender({ lang: 'en' });
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('does nothing signed out or when it already matches', () => {
    renderHook(() => useServerLocaleSync(null, 'en'));
    renderHook(() => useServerLocaleSync('u1', 'it'));
    expect(update).not.toHaveBeenCalled();
  });
});
