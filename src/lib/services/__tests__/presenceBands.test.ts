import { describe, it, expect, vi } from 'vitest';

const opened: string[] = [];
let bands = ['b1'];

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: async () => ({ remove: () => {} }) } }));
vi.mock('../../supabase', () => {
  const query: any = {
    select: () => query,
    eq: () => query,
    then: (res: (v: unknown) => void) => res({ data: bands.map((band_id) => ({ band_id })), error: null }),
  };
  return {
    supabase: {
      from: () => query,
      channel: (topic: string) => {
        opened.push(topic);
        const ch: any = { on: () => ch, subscribe: () => ch, presenceState: () => ({}), track: async () => {}, untrack: async () => {} };
        return ch;
      },
      removeChannel: async () => {},
    },
  };
});

import { initPresence, refreshPresenceBands } from '../presence';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('presence channels', () => {
  it('opens the channel of a band joined mid-session, once', async () => {
    initPresence('me');
    await flush();
    await flush();
    expect(opened).toEqual(['presence:band:b1']);

    bands = ['b1', 'b2'];
    refreshPresenceBands();
    await flush();
    refreshPresenceBands();
    await flush();
    expect(opened).toEqual(['presence:band:b1', 'presence:band:b2']);
  });
});
