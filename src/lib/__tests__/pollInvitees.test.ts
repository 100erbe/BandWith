import { describe, expect, it } from 'vitest';
import { pollInvitees } from '@/lib/services/rehearsalPolls';

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
