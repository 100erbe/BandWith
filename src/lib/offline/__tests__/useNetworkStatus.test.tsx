// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  processSyncQueue: vi.fn(),
  subscribeToSyncQueue: vi.fn(),
}));

vi.mock('../syncQueue', () => ({
  processSyncQueue: mocks.processSyncQueue,
  subscribeToSyncQueue: mocks.subscribeToSyncQueue,
}));

import { useNetworkStatus } from '../useNetworkStatus';

const result = (over: Record<string, unknown> = {}) => ({ synced: 0, failed: 0, dropped: 0, droppedMutations: [], ...over });

beforeEach(() => {
  mocks.processSyncQueue.mockReset().mockResolvedValue(result());
  mocks.subscribeToSyncQueue.mockReset().mockReturnValue(() => {});
});

describe('useNetworkStatus', () => {
  it('syncs once on mount, not on every render with an inline callback', async () => {
    const { rerender } = renderHook(() => useNetworkStatus((msg) => void msg));
    for (let i = 0; i < 5; i++) rerender();
    await act(async () => {});
    expect(mocks.processSyncQueue).toHaveBeenCalledTimes(1);
  });

  it('uses the latest callbacks without re-running the sync', async () => {
    mocks.processSyncQueue.mockImplementation(async (toast?: (m: string) => void) => {
      toast?.('done');
      return result({ synced: 1 });
    });
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, result: hook } = renderHook(({ cb }: { cb: (m: string) => void }) => useNetworkStatus(cb), { initialProps: { cb: first } });
    await act(async () => {});
    rerender({ cb: second });
    await act(async () => { await hook.current.triggerSync(); });
    expect(second).toHaveBeenCalledWith('done');
    expect(mocks.processSyncQueue).toHaveBeenCalledTimes(2);
  });

  it('syncs again when the connection comes back', async () => {
    renderHook(() => useNetworkStatus());
    await act(async () => {});
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(mocks.processSyncQueue).toHaveBeenCalledTimes(2);
  });

  it('a manual sync ignores the retry backoff', async () => {
    const { result: hook } = renderHook(() => useNetworkStatus());
    await act(async () => {});
    expect(mocks.processSyncQueue.mock.calls[0][1]).toBeUndefined();
    await act(async () => { await hook.current.triggerSync(); });
    expect(mocks.processSyncQueue.mock.calls[1][1]).toEqual({ force: true });
  });

  it('reports the changes the queue had to discard', async () => {
    const dropped = [{ mutation: { id: 'm1' }, error: 'rls', reason: 'max_retries' }];
    mocks.processSyncQueue.mockResolvedValue(result({ failed: 1, dropped: 1, droppedMutations: dropped }));
    const onDropped = vi.fn();
    renderHook(() => useNetworkStatus(undefined, onDropped));
    await act(async () => {});
    expect(onDropped).toHaveBeenCalledWith(dropped);
  });
});
