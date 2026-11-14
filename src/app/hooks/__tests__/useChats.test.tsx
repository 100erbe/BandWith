import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const getChats = vi.fn();
const store = new Map<string, unknown>();

vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'me' } }) }));
vi.mock('@/lib/services/chats', () => ({
  getChats: (...a: unknown[]) => getChats(...a),
  subscribeToNewMessages: () => () => {},
  subscribeToReceipts: () => () => {},
}));
vi.mock('@/lib/offline/storage', () => ({
  getCacheKey: (u: string, b: string | undefined, k: string) => `bw:${u}:${b || 'global'}:${k}`,
  getOfflineItem: async (k: string) => store.get(k) ?? null,
  setOfflineItem: async (k: string, v: unknown) => { store.set(k, v); },
}));

import { useChats } from '../useData';

const chat = (id: string) => ({ id, type: 'direct', participants: [] }) as any;

beforeEach(() => {
  store.clear();
  getChats.mockReset();
});

describe('useChats', () => {
  it('keeps the list when a refetch fails (offline, network blip)', async () => {
    getChats.mockResolvedValueOnce({ data: [chat('c1')], error: null });
    const { result } = renderHook(() => useChats());
    await waitFor(() => expect(result.current.chats).toHaveLength(1));
    getChats.mockResolvedValueOnce({ data: null, error: new Error('Failed to fetch') });
    await act(async () => { await result.current.refetch(); });
    expect(result.current.chats.map((c) => c.id)).toEqual(['c1']);
    expect(result.current.error).toBeTruthy();
  });

  it('shows the last list from this device while offline', async () => {
    store.set('bw:me:global:chats_list', [chat('c9')]);
    getChats.mockResolvedValue({ data: null, error: new Error('Failed to fetch') });
    const { result } = renderHook(() => useChats());
    await waitFor(() => expect(result.current.chats.map((c) => c.id)).toEqual(['c9']));
  });
});
