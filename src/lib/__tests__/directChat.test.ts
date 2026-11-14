import { describe, it, expect } from 'vitest';
import { isDirectChatBetween } from '../directChat';

const facts = (over: Partial<Parameters<typeof isDirectChatBetween>[0]> = {}) => ({
  participantIds: [] as string[],
  createdBy: null as string | null,
  writers: [] as string[],
  foreignWriter: false,
  ...over,
});

describe('isDirectChatBetween', () => {
  it('reuses a chat with exactly the two people', () => {
    expect(isDirectChatBetween(facts({ participantIds: ['me', 'bea'], createdBy: 'me' }), 'me', 'bea')).toBe(true);
  });

  it('never reuses my old chat with someone else whose row is gone', () => {
    // Me and Carl; Carl's participant row was lost. A new DM to Bea must not land there.
    const old = facts({ participantIds: ['me'], createdBy: 'me', writers: ['me'], foreignWriter: true });
    expect(isDirectChatBetween(old, 'me', 'bea')).toBe(false);
    // Even if Carl never wrote: nothing proves the chat was ever with Bea.
    expect(isDirectChatBetween(facts({ participantIds: ['me'], createdBy: 'me', writers: ['me'] }), 'me', 'bea')).toBe(false);
  });

  it('brings back a chat with the same person when their row is gone but they wrote in it', () => {
    expect(isDirectChatBetween(facts({ participantIds: ['me'], createdBy: 'me', writers: ['me', 'bea'] }), 'me', 'bea')).toBe(true);
  });

  it('brings it back when the other person created it', () => {
    expect(isDirectChatBetween(facts({ participantIds: ['me'], createdBy: 'bea' }), 'me', 'bea')).toBe(true);
  });

  it('refuses a chat that already has a third participant or creator', () => {
    expect(isDirectChatBetween(facts({ participantIds: ['me', 'bea', 'carl'], createdBy: 'me' }), 'me', 'bea')).toBe(false);
    expect(isDirectChatBetween(facts({ participantIds: ['me', 'bea'], createdBy: 'carl' }), 'me', 'bea')).toBe(false);
  });
});
