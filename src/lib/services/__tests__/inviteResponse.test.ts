import { describe, it, expect, vi, beforeEach } from 'vitest';

const lookup = vi.fn();
const respond = vi.fn();

vi.mock('@/lib/supabase', () => {
  const chain: any = { select: () => chain, eq: () => chain, maybeSingle: () => lookup() };
  return { supabase: { from: () => chain } };
});
vi.mock('../events', () => ({ respondToEventInvite: (...a: unknown[]) => respond(...a) }));

import { respondToOwnInvite, InviteResponseError } from '../inviteResponse';

beforeEach(() => {
  lookup.mockReset().mockResolvedValue({ data: { id: 'em-1' }, error: null });
  respond.mockReset().mockResolvedValue({ data: { id: 'em-1', status: 'confirmed' }, error: null });
});

describe('respondToOwnInvite', () => {
  it('saves the answer on the member row', async () => {
    await respondToOwnInvite('ev-1', 'u1', 'confirmed');
    expect(respond).toHaveBeenCalledWith('em-1', 'confirmed');
  });

  it('fails when the lookup fails (offline), without a raw server message', async () => {
    lookup.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } });
    await expect(respondToOwnInvite('ev-1', 'u1', 'declined')).rejects.toThrow('Could not send your RSVP. Please try again.');
    expect(respond).not.toHaveBeenCalled();
  });

  it('fails when the user is no longer on the event', async () => {
    lookup.mockResolvedValue({ data: null, error: null });
    await expect(respondToOwnInvite('ev-1', 'u1', 'confirmed')).rejects.toBeInstanceOf(InviteResponseError);
  });

  it('fails when the update saved nothing', async () => {
    respond.mockResolvedValue({ data: null, error: null });
    await expect(respondToOwnInvite('ev-1', 'u1', 'confirmed')).rejects.toThrow('Could not send your RSVP. Please try again.');
    respond.mockResolvedValue({ data: null, error: new Error('permission denied') });
    await expect(respondToOwnInvite('ev-1', 'u1', 'confirmed')).rejects.toThrow('Could not send your RSVP. Please try again.');
  });
});
