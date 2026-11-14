/**
 * The bell inbox leaves chat rows out: one is written per message per
 * recipient, and they would push gig invites and polls out of the latest 20.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: Array<[string, ...unknown[]]> = [];

vi.mock('@/lib/supabase', () => {
  const chain: any = new Proxy(
    {},
    {
      get: (_t, prop: string) => {
        if (prop === 'then') {
          const p = Promise.resolve({ data: [], error: null });
          return p.then.bind(p);
        }
        return (...args: unknown[]) => {
          calls.push([prop, ...args]);
          return chain;
        };
      },
    },
  );
  return {
    supabase: { from: (table: string) => { calls.push(['from', table]); return chain; } },
    getSafeUser: async () => ({ data: { user: { id: 'u1' } } }),
  };
});

import { getNotifications, markAllAsRead, isChatNotificationType } from '../notifications';

beforeEach(() => {
  calls.length = 0;
});

const notIn = () => calls.filter(([m]) => m === 'not');

describe('notifications inbox', () => {
  it('asks the server for the latest inbox items without chat rows', async () => {
    await getNotifications({ limit: 20, excludeChat: true });
    expect(notIn()).toEqual([['not', 'type', 'in', '(chat_message,chat_mention)']]);
    expect(calls).toContainEqual(['limit', 20]);
  });

  it('keeps chat rows when not asked to leave them out', async () => {
    await getNotifications({ limit: 20 });
    expect(notIn()).toEqual([]);
  });

  it('mark all as read (the bell) leaves chat rows unread', async () => {
    await markAllAsRead();
    expect(notIn()).toEqual([['not', 'type', 'in', '(chat_message,chat_mention)']]);
  });

  it('knows the chat types', () => {
    expect(isChatNotificationType('chat_message')).toBe(true);
    expect(isChatNotificationType('chat_mention')).toBe(true);
    expect(isChatNotificationType('event_invite')).toBe(false);
  });
});
