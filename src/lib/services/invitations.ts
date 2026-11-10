import { supabase } from '../supabase';
import { sendOnboardingInviteEmail } from './email';
import type { InviteData } from '@/app/components/onboarding/JoinerInviteLanding';

/**
 * Band invitations (table `band_invitations`, migration 044).
 *
 * - An invitation has a random UUID token. The invite link is `<app>/?invite=<token>`
 *   and the token itself is the "invite code" people can paste.
 * - Joining always goes through the `bw_accept_invitation` RPC, which checks
 *   that the invitation email matches the signed-in account.
 */

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Extracts the invitation token from a pasted code or invite link. */
export function parseInviteCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get('invite');
    if (fromQuery && UUID_RE.test(fromQuery)) return fromQuery.match(UUID_RE)![0].toLowerCase();
  } catch {
    // not a URL
  }
  const match = trimmed.match(UUID_RE);
  return match ? match[0].toLowerCase() : null;
}

/** Reads `?invite=<token>` from a URL (web location or native deep link). */
export function inviteTokenFromUrl(href: string): string | null {
  try {
    const url = new URL(href);
    const raw = url.searchParams.get('invite');
    return raw ? parseInviteCode(raw) : null;
  } catch {
    return null;
  }
}

export type InviteErrorCode =
  | 'invite_not_found'
  | 'invite_expired'
  | 'invite_email_mismatch'
  | 'not_authenticated'
  | 'invalid_code'
  | 'network';

export class InviteError extends Error {
  constructor(public code: InviteErrorCode, message?: string) {
    super(message ?? inviteErrorMessage(code));
    this.name = 'InviteError';
  }
}

export function inviteErrorMessage(code: InviteErrorCode): string {
  switch (code) {
    case 'invalid_code':
      return 'That doesn’t look like an invite code. Paste the full code or the invite link.';
    case 'invite_not_found':
      return 'This invite isn’t valid any more. Ask your bandmate to send a new one.';
    case 'invite_expired':
      return 'This invite has expired. Ask your bandmate to send a new one.';
    case 'invite_email_mismatch':
      return 'This invite was sent to a different email. Sign in with that email to join.';
    case 'not_authenticated':
      return 'Sign in to join the band.';
    default:
      return 'We couldn’t check the invite. Check your connection and try again.';
  }
}

function toInviteError(error: { message?: string } | null | undefined): InviteError {
  const msg = error?.message ?? '';
  const known: InviteErrorCode[] = [
    'invite_not_found',
    'invite_expired',
    'invite_email_mismatch',
    'not_authenticated',
  ];
  const code = known.find((c) => msg.includes(c)) ?? 'network';
  return new InviteError(code);
}

interface PreviewRow {
  id: string;
  band_id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  band_name: string;
  band_logo_url: string | null;
  band_description: string | null;
  member_count: number | string | null;
  inviter_name: string | null;
}

export function previewRowToInviteData(row: PreviewRow): InviteData {
  return {
    id: row.id,
    band_id: row.band_id,
    email: row.email,
    role: row.role === 'admin' ? 'admin' : 'member',
    status: row.status,
    created_at: row.created_at,
    expires_at: row.expires_at,
    band: {
      id: row.band_id,
      name: row.band_name,
      logo_url: row.band_logo_url ?? undefined,
      description: row.band_description ?? undefined,
    },
    member_count: Number(row.member_count ?? 0),
    inviter: row.inviter_name ? { full_name: row.inviter_name } : undefined,
  };
}

/** Band details for an invite token. Throws InviteError. */
export async function previewInvitation(token: string): Promise<InviteData> {
  const { data, error } = await supabase.rpc('bw_preview_invitation', { p_token: token });
  if (error) throw toInviteError(error);
  const row = (Array.isArray(data) ? data[0] : data) as PreviewRow | undefined;
  if (!row) throw new InviteError('invite_not_found');
  return previewRowToInviteData(row);
}

/** Joins the band. Returns the band id. Throws InviteError. */
export async function acceptInvitation(
  ref: { token: string } | { invitationId: string }
): Promise<string> {
  const params =
    'token' in ref
      ? { p_token: ref.token, p_invitation_id: null }
      : { p_token: null, p_invitation_id: ref.invitationId };
  const { data, error } = await supabase.rpc('bw_accept_invitation', params);
  if (error) throw toInviteError(error);
  return data as string;
}

export async function declineInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc('bw_decline_invitation', { p_invitation_id: invitationId });
  if (error) throw toInviteError(error);
}

export interface PendingInvitation {
  id: string;
  bandId: string;
  bandName: string;
  bandLogoUrl?: string;
  role: 'admin' | 'member';
  memberCount: number;
  inviterName?: string;
  expiresAt: string | null;
}

/** Invitations waiting for the signed-in user. Never throws. */
export async function getMyPendingInvitations(): Promise<PendingInvitation[]> {
  const { data, error } = await supabase.rpc('bw_my_pending_invitations');
  if (error || !Array.isArray(data)) {
    if (error) console.warn('Could not load pending invitations:', error.message);
    return [];
  }
  return data.map((row: any) => ({
    id: row.id,
    bandId: row.band_id,
    bandName: row.band_name,
    bandLogoUrl: row.band_logo_url ?? undefined,
    role: row.role === 'admin' ? 'admin' : 'member',
    memberCount: Number(row.member_count ?? 0),
    inviterName: row.inviter_name ?? undefined,
    expiresAt: row.expires_at ?? null,
  }));
}

export type InviteToBandResult =
  /** The person already has an account: they see the invite in the app. */
  | { kind: 'existing_user' }
  /** New person: share `inviteUrl` (also emailed when `emailSent`). */
  | { kind: 'invited'; token: string; inviteUrl: string | null; emailSent: boolean };

/**
 * Invites someone to a band (admins only, enforced by the `invite-member`
 * edge function). New users also get an email with the invite link.
 */
export async function inviteToBand(input: {
  bandId: string;
  /** Either an email, or the id of an existing user from member search. */
  email?: string;
  userId?: string;
  role?: 'admin' | 'member';
  inviterName?: string;
}): Promise<InviteToBandResult> {
  const { data, error } = await supabase.functions.invoke('invite-member', {
    body: { bandId: input.bandId, email: input.email, userId: input.userId, role: input.role ?? 'member' },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Could not send the invite');

  if (data.userExists) return { kind: 'existing_user' };

  const inviteUrl: string | null = data.inviteUrl ?? null;
  let emailSent = false;
  if (inviteUrl && input.email) {
    const { success } = await sendOnboardingInviteEmail(
      input.bandId,
      input.email,
      data.bandName ?? '',
      input.inviterName ?? 'A bandmate',
      inviteUrl,
      input.role === 'admin' ? 'Admin' : 'Musician'
    );
    emailSent = success;
  }
  return { kind: 'invited', token: data.token, inviteUrl, emailSent };
}
