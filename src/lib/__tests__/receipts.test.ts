import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { receiptFor } from '@/lib/services/chats';

const T = '2026-11-10T12:00:00.000Z';
const before = '2026-11-10T11:59:00.000Z';
const after = '2026-11-10T12:01:00.000Z';

describe('receiptFor', () => {
  it('is sent until the other phone receives it', () => {
    expect(receiptFor(T, [{ last_read_at: before, last_delivered_at: before, joined_at: before }])).toBe('sent');
  });

  it('is delivered when received but not opened', () => {
    expect(receiptFor(T, [{ last_read_at: before, last_delivered_at: after, joined_at: before }])).toBe('delivered');
  });

  it('is read when opened (read implies delivered)', () => {
    expect(receiptFor(T, [{ last_read_at: after, joined_at: before }])).toBe('read');
  });

  it('in groups waits for everyone, like WhatsApp', () => {
    const others = [
      { last_read_at: after, last_delivered_at: after, joined_at: before },
      { last_read_at: before, last_delivered_at: after, joined_at: before },
    ];
    expect(receiptFor(T, others)).toBe('delivered');
    expect(receiptFor(T, [...others, { last_read_at: undefined, last_delivered_at: undefined, joined_at: before }])).toBe('sent');
  });

  it('ignores people who joined after the message', () => {
    const others = [
      { last_read_at: after, joined_at: before },
      { last_read_at: undefined, joined_at: after },
    ];
    expect(receiptFor(T, others)).toBe('read');
  });

  it('with nobody else in the chat stays at sent', () => {
    expect(receiptFor(T, [])).toBe('sent');
  });
});
