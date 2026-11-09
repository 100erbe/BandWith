/**
 * Band invitation helpers: invite code / link parsing and RPC error mapping.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (fn: string, args?: unknown) => mockRpc(fn, args),
    functions: { invoke: (name: string, opts: unknown) => mockInvoke(name, opts) },
  },
}));

vi.mock('../email', () => ({
  sendOnboardingInviteEmail: vi.fn(async () => ({ success: true, error: null })),
}));

import {
  parseInviteCode,
  inviteTokenFromUrl,
  previewInvitation,
  acceptInvitation,
  inviteToBand,
  InviteError,
} from '../invitations';
import { sendOnboardingInviteEmail } from '../email';

const TOKEN = '3f2b6c1e-8a4d-4c2e-9b7a-0d1e2f3a4b5c';

describe('parseInviteCode', () => {
  it('accepts a bare token, case-insensitively', () => {
    expect(parseInviteCode(TOKEN)).toBe(TOKEN);
    expect(parseInviteCode(`  ${TOKEN.toUpperCase()}  `)).toBe(TOKEN);
  });

  it('extracts the token from an invite link', () => {
    expect(parseInviteCode(`https://bandwith.app/?invite=${TOKEN}`)).toBe(TOKEN);
    expect(parseInviteCode(`Join us! https://bandwith.app/?invite=${TOKEN} see you`)).toBe(TOKEN);
  });

  it('rejects things that are not a token', () => {
    expect(parseInviteCode('')).toBeNull();
    expect(parseInviteCode('ABC123')).toBeNull();
    expect(parseInviteCode('https://bandwith.app/?invite=nope')).toBeNull();
  });
});

describe('inviteTokenFromUrl', () => {
  it('reads ?invite= from web and native URLs', () => {
    expect(inviteTokenFromUrl(`https://bandwith.app/?invite=${TOKEN}`)).toBe(TOKEN);
    expect(inviteTokenFromUrl(`com.bandwith.app://invite?invite=${TOKEN}`)).toBe(TOKEN);
  });

  it('ignores URLs without a valid invite param', () => {
    expect(inviteTokenFromUrl('https://bandwith.app/')).toBeNull();
    expect(inviteTokenFromUrl('https://bandwith.app/?code=abc')).toBeNull();
    expect(inviteTokenFromUrl('not a url')).toBeNull();
  });
});

describe('previewInvitation', () => {
  beforeEach(() => mockRpc.mockReset());

  it('maps the RPC row to InviteData', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        id: 'inv-1', band_id: 'band-1', email: 'a@b.co', role: 'member', status: 'pending',
        created_at: '2026-11-01T10:00:00Z', expires_at: '2026-11-08T10:00:00Z',
        band_name: 'The Lines', band_logo_url: null, band_description: null,
        member_count: '4', inviter_name: 'Sam',
      }],
      error: null,
    });
    const data = await previewInvitation(TOKEN);
    expect(mockRpc).toHaveBeenCalledWith('bw_preview_invitation', { p_token: TOKEN });
    expect(data.band.name).toBe('The Lines');
    expect(data.member_count).toBe(4);
    expect(data.inviter?.full_name).toBe('Sam');
  });

  it('throws invite_not_found when nothing matches', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await expect(previewInvitation(TOKEN)).rejects.toMatchObject({ code: 'invite_not_found' });
  });
});

describe('acceptInvitation', () => {
  beforeEach(() => mockRpc.mockReset());

  it('accepts by token or by id', async () => {
    mockRpc.mockResolvedValue({ data: 'band-1', error: null });
    await expect(acceptInvitation({ token: TOKEN })).resolves.toBe('band-1');
    expect(mockRpc).toHaveBeenLastCalledWith('bw_accept_invitation', { p_token: TOKEN, p_invitation_id: null });
    await acceptInvitation({ invitationId: 'inv-1' });
    expect(mockRpc).toHaveBeenLastCalledWith('bw_accept_invitation', { p_token: null, p_invitation_id: 'inv-1' });
  });

  it('maps server errors to user-facing InviteErrors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'invite_email_mismatch' } });
    const err = await acceptInvitation({ token: TOKEN }).catch((e) => e);
    expect(err).toBeInstanceOf(InviteError);
    expect(err.code).toBe('invite_email_mismatch');
    expect(err.message).toMatch(/different email/);

    mockRpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    await expect(acceptInvitation({ token: TOKEN })).rejects.toMatchObject({ code: 'network' });
  });
});

describe('inviteToBand', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    vi.mocked(sendOnboardingInviteEmail).mockClear();
  });

  it('existing users get an in-app invite, no email', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, userExists: true }, error: null });
    await expect(inviteToBand({ bandId: 'b', email: 'x@y.co' })).resolves.toEqual({ kind: 'existing_user' });
    expect(sendOnboardingInviteEmail).not.toHaveBeenCalled();
  });

  it('new users get the invite link by email', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, invited: true, token: TOKEN, inviteUrl: `https://bandwith.app/?invite=${TOKEN}`, bandName: 'The Lines' },
      error: null,
    });
    const result = await inviteToBand({ bandId: 'b', email: 'x@y.co', inviterName: 'Sam' });
    expect(result).toMatchObject({ kind: 'invited', token: TOKEN, emailSent: true });
    expect(sendOnboardingInviteEmail).toHaveBeenCalledWith(
      'b', 'x@y.co', 'The Lines', 'Sam', `https://bandwith.app/?invite=${TOKEN}`, 'Musician'
    );
  });
});
