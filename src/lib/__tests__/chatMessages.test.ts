import { describe, it, expect } from 'vitest';
import { mergeLatestPage, prependOlder, normalizeChatType, appendIncoming } from '../chatMessages';
import type { Message } from '@/lib/services/chats';

const msg = (i: number, over: Partial<Message> = {}): Message => ({
  id: `m${i}`,
  chat_id: 'c1',
  sender_id: 'u1',
  content: `text ${i}`,
  message_type: 'text',
  edited: false,
  deleted: false,
  created_at: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString(),
  ...over,
});
const range = (a: number, b: number) => Array.from({ length: b - a }, (_, k) => msg(a + k));
const ids = (list: Message[]) => list.map((m) => m.id);

describe('mergeLatestPage (3 s poll)', () => {
  it('returns the same array when nothing changed, so the list does not re-render or scroll', () => {
    const prev = range(0, 50);
    expect(mergeLatestPage(prev, range(0, 50))).toBe(prev);
  });

  it('appends new messages', () => {
    const next = mergeLatestPage(range(0, 50), range(1, 51));
    expect(ids(next)).toEqual(ids(range(0, 51)));
  });

  it('keeps older messages loaded with "Load earlier messages"', () => {
    const prev = range(0, 100);
    const next = mergeLatestPage(prev, range(51, 101));
    expect(ids(next)).toEqual(ids(range(0, 101)));
  });

  it('takes edits from the server', () => {
    const next = mergeLatestPage(range(0, 3), [msg(0), msg(1, { content: 'fixed', edited: true }), msg(2)]);
    expect(next[1].content).toBe('fixed');
  });

  it('keeps optimistic messages at the end until the server has them', () => {
    const temp = msg(99, { id: 'temp-1', content: 'sending…' });
    const next = mergeLatestPage([...range(0, 2), temp], range(0, 2));
    expect(ids(next)).toEqual(['m0', 'm1', 'temp-1']);
  });

  it('an empty page (chat cleared) empties the list as before', () => {
    expect(mergeLatestPage(range(0, 3), [])).toEqual([]);
  });

  it('hides only the server copy of a pending message, not older messages with the same text', () => {
    const old = msg(0, { content: 'ok', sender_id: 'me' });
    const temp = msg(99, { id: 'temp-1', content: 'ok', sender_id: 'me' });
    const copy = msg(2, { content: 'ok', sender_id: 'me' });
    const next = mergeLatestPage([old, msg(1), temp], [old, msg(1), copy]);
    expect(ids(next)).toEqual(['m0', 'm1', 'temp-1']);
  });

  it("does not hide someone else's message with the same text", () => {
    const temp = msg(99, { id: 'temp-1', content: 'ok', sender_id: 'me' });
    const theirs = msg(2, { content: 'ok', sender_id: 'u1' });
    const next = mergeLatestPage([msg(1), temp], [msg(1), theirs]);
    expect(ids(next)).toEqual(['m1', 'm2', 'temp-1']);
  });
});

describe('appendIncoming (realtime)', () => {
  it("keeps my pending bubble when someone else's message arrives", () => {
    const temp = msg(99, { id: 'temp-1', content: 'hi', sender_id: 'me' });
    const next = appendIncoming([msg(0), temp], msg(1, { content: 'hey', sender_id: 'u1' }));
    expect(ids(next)).toEqual(['m0', 'm1', 'temp-1']);
  });

  it('replaces the pending bubble with its server copy', () => {
    const temp = msg(99, { id: 'temp-1', content: 'hi', sender_id: 'me' });
    const next = appendIncoming([msg(0), temp], msg(1, { content: 'hi', sender_id: 'me' }));
    expect(ids(next)).toEqual(['m0', 'm1']);
  });

  it('ignores a message already in the list', () => {
    const prev = range(0, 3);
    expect(appendIncoming(prev, msg(1))).toBe(prev);
  });
});

describe('prependOlder', () => {
  it('puts the older page first and skips duplicates', () => {
    const next = prependOlder(range(50, 100), range(10, 51));
    expect(ids(next)).toEqual(ids(range(10, 100)));
  });
});

describe('normalizeChatType', () => {
  it('maps the stored chat type to the three the UI knows', () => {
    expect(normalizeChatType('direct')).toBe('direct');
    expect(normalizeChatType('band')).toBe('band');
    expect(normalizeChatType('group')).toBe('band');
    expect(normalizeChatType('event')).toBe('event');
    expect(normalizeChatType(undefined)).toBeNull();
  });
});
