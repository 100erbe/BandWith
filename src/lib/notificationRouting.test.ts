import { describe, expect, it } from 'vitest';
import { notificationBandId, notificationTarget, notificationTargetLabel } from './notificationRouting';

describe('notificationTarget', () => {
  it('opens the event of a confirmed rehearsal', () => {
    const t = notificationTarget('rehearsal_poll_finalized', { event_id: 'ev-1', poll_id: 'p' });
    expect(t).toEqual({ screen: 'event', eventId: 'ev-1' });
    expect(notificationTargetLabel(t!)).toBe('Open event');
  });

  it('opens chats only when the chat id is known', () => {
    expect(notificationTarget('chat_message', { chat_id: 'c-1' })).toEqual({ screen: 'chat', chatId: 'c-1' });
    expect(notificationTarget('chat_message', {})).toBeNull();
  });

  it('routes quotes, payments, invites and members', () => {
    expect(notificationTarget('quote_accepted', {})).toEqual({ screen: 'quotes' });
    expect(notificationTarget('payment_received', {})).toEqual({ screen: 'finance' });
    expect(notificationTarget('invite_received', {})).toEqual({ screen: 'invites' });
    expect(notificationTarget('member_joined', {})).toEqual({ screen: 'bandMembers' });
  });

  it('has no screen for someone removed from a band or unknown types', () => {
    expect(notificationTarget('member_left', { removed: true })).toBeNull();
    expect(notificationTarget('something_else', {})).toBeNull();
  });

  it('falls back to the type inside the push payload', () => {
    expect(notificationTarget('', { type: 'event_confirmed', eventId: 'e' })).toEqual({ screen: 'event', eventId: 'e' });
  });
});

describe('notificationBandId', () => {
  it('reads the band from the column, then the payload', () => {
    expect(notificationBandId({ band_id: 'b-1', data: { band_id: 'b-2' } })).toBe('b-1');
    expect(notificationBandId({ data: { bandId: 'b-3' } })).toBe('b-3');
    expect(notificationBandId({ data: {} })).toBeUndefined();
  });
});
