import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const store = new Map<string, unknown>();
const pending = () => new Promise(() => {});
const quotesFor = vi.fn();

vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'me' } }) }));
vi.mock('@/lib/offline/useNetworkStatus', () => ({ getIsNetworkOnline: () => true }));
vi.mock('@/lib/offline/syncQueue', () => ({ getPendingMutations: async () => [] }));
vi.mock('@/lib/offline/storage', () => ({
  getCacheKey: (u: string, b: string | null, k: string) => `bw:${u}:${b || 'global'}:${k}`,
  getOfflineItem: async (k: string) => store.get(k) ?? null,
  setOfflineItem: async (k: string, v: unknown) => { store.set(k, v); },
}));
vi.mock('@/lib/services/events', () => ({
  getEventStats: async () => ({ data: { totalEvents: 1, confirmedEvents: 1, totalRevenue: 0, upcomingEvents: 1 }, error: null }),
  getUpcomingEvents: async () => ({ data: [], error: null }),
  getMemberPersonalStats: async () => ({ data: null, error: null }),
}));
vi.mock('@/lib/services/quotes', () => ({
  getQuoteStats: async () => ({ data: null, error: null }),
  getQuotes: (bandId: string) => quotesFor(bandId),
}));
vi.mock('@/lib/supabase', () => {
  const ch: any = { on: () => ch, subscribe: () => ch };
  return { supabase: { channel: () => ch, removeChannel: () => {} }, getSafeUser: async () => ({ data: { user: { id: 'me' } } }) };
});

import { useDashboardData } from '../useData';

beforeEach(() => {
  store.clear();
  quotesFor.mockReset();
});

describe('useDashboardData', () => {
  it("does not show the previous band's draft quotes after a band switch", async () => {
    quotesFor.mockImplementation((b: string) => (b === 'b1' ? Promise.resolve({ data: [{ id: 'q-b1' }], error: null }) : pending()));
    const { result, rerender } = renderHook(({ band }) => useDashboardData(band), { initialProps: { band: 'b1' } });
    await waitFor(() => expect(result.current.data.recentQuotes.map((q: any) => q.id)).toEqual(['q-b1']));
    await act(async () => { rerender({ band: 'b2' }); });
    expect(result.current.data.recentQuotes).toEqual([]);
  });

  it("does not seed a band from another band's fallback cache", async () => {
    store.set('bw:me:global:dashboard_data_fallback', { bandId: 'b1', eventStats: { totalEvents: 9 }, quoteStats: null, memberStats: null, upcomingEvents: [], recentQuotes: [{ id: 'q-b1' }] });
    quotesFor.mockImplementation(() => pending());
    const { result } = renderHook(() => useDashboardData('b2'));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(result.current.data.recentQuotes).toEqual([]);
  });
});
