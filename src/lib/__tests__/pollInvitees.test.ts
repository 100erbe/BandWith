import { describe, expect, it } from 'vitest';
import { canSeePoll, pollInvitees } from '@/lib/services/rehearsalPolls';

describe('pollInvitees (098)', () => {
  it('is null when every member is asked', () => {
    expect(pollInvitees({})).toBeNull();
    expect(pollInvitees({ invited_user_ids: null })).toBeNull();
    expect(pollInvitees({ invited_user_ids: [] })).toBeNull();
  });

  it('returns the list when the poll has one', () => {
    expect(pollInvitees({ invited_user_ids: ['a', 'b'] })).toEqual(['a', 'b']);
  });
});

describe('canSeePoll', () => {
  const poll = { invited_user_ids: ['a', 'b'], created_by: 'admin1' };

  it('shows a poll with an invite list to invitees and its creator only', () => {
    expect(canSeePoll(poll, 'a')).toBe(true);
    expect(canSeePoll(poll, 'admin1')).toBe(true);
    expect(canSeePoll(poll, 'c')).toBe(false);
  });

  it("shows it to the band's other admins, who may lock it in or delete it", () => {
    expect(canSeePoll(poll, 'admin2', true)).toBe(true);
  });

  it('shows polls for every member to everyone', () => {
    expect(canSeePoll({ invited_user_ids: [] }, 'c')).toBe(true);
  });
});
