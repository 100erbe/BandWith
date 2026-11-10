// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOfflineItem,
  setOfflineItem,
  removeOfflineItem,
  clearOfflineCache,
  getCacheKey,
} from '../storage';
import {
  enqueueMutation,
  getPendingMutations,
  removeMutation,
  setOfflineQueueUser,
} from '../syncQueue';
import { isOfflineError } from '../useNetworkStatus';

describe('Offline Storage Engine', () => {
  beforeEach(async () => {
    localStorage.clear();
  });

  it('generates consistent scoped cache keys', () => {
    const key = getCacheKey('user_123', 'band_456', 'events');
    expect(key).toBe('bw:user_123:band_456:events');

    const anonKey = getCacheKey(null, null, 'bands');
    expect(anonKey).toBe('bw:anonymous:global:bands');
  });

  it('stores and retrieves cached data', async () => {
    const testData = { name: 'The Rolling Stones', members: 4 };
    await setOfflineItem('bw:test:band', testData);

    const retrieved = await getOfflineItem<typeof testData>('bw:test:band');
    expect(retrieved).toEqual(testData);
  });

  it('removes item from storage', async () => {
    await setOfflineItem('bw:temp:key', { foo: 'bar' });
    await removeOfflineItem('bw:temp:key');

    const result = await getOfflineItem('bw:temp:key');
    expect(result).toBeNull();
  });

  it('clears cache with prefix', async () => {
    await setOfflineItem('bw:user1:data', 'val1');
    await setOfflineItem('bw:user2:data', 'val2');
    await setOfflineItem('other_key', 'keep_me');

    await clearOfflineCache('bw:');

    expect(await getOfflineItem('bw:user1:data')).toBeNull();
    expect(await getOfflineItem('bw:user2:data')).toBeNull();
    expect(localStorage.getItem('other_key')).toBe('"keep_me"');
  });

  it('default logout clear also removes offline queues, including the legacy key', async () => {
    await setOfflineItem('bw:offline_queue:user_a', [{ id: 'm1' }]);
    await setOfflineItem('bw_offline_mutation_queue', [{ id: 'm2' }]);

    await clearOfflineCache();

    expect(await getOfflineItem('bw:offline_queue:user_a')).toBeNull();
    expect(await getOfflineItem('bw_offline_mutation_queue')).toBeNull();
  });
});

describe('Offline Mutation Queue', () => {
  beforeEach(async () => {
    localStorage.clear();
    setOfflineQueueUser('user_test');
  });

  it('enqueues mutations and assigns temp IDs', async () => {
    const id = await enqueueMutation('create_event', { title: 'Secret Venue Gig' });
    expect(id).toBeDefined();

    const pending = await getPendingMutations();
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(id);
    expect(pending[0].payload.title).toBe('Secret Venue Gig');
    expect(pending[0].type).toBe('create_event');
  });

  it('removes completed mutations from queue', async () => {
    const id1 = await enqueueMutation('create_event', { title: 'Gig 1' }, 'custom_id_1');
    const id2 = await enqueueMutation('create_event', { title: 'Gig 2' }, 'custom_id_2');

    let pending = await getPendingMutations();
    expect(pending.length).toBe(2);

    await removeMutation(id1);

    pending = await getPendingMutations();
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(id2);
  });

  it('detects offline and network fetch errors reliably', () => {
    expect(isOfflineError(new Error('Failed to fetch'))).toBe(true);
    expect(isOfflineError(new Error('NetworkError when attempting to fetch resource'))).toBe(true);
    expect(isOfflineError(new Error('Offline'))).toBe(true);
    expect(isOfflineError(new Error('Permission denied'))).toBe(false);
  });
});
