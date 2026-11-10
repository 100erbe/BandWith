import { supabase } from '../supabase';

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; reason: 'admin_of_bands'; bands: string[] }
  | { ok: false; reason: 'error'; message: string };

/**
 * Permanently deletes the signed-in user's account (edge function
 * `delete-account`). The caller is resolved from the session server-side.
 */
export async function deleteMyAccount(): Promise<DeleteAccountResult> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { confirm: 'DELETE' },
  });

  if (!error && data?.success) return { ok: true };

  // Non-2xx responses: the body is on error.context (a Response).
  let body: any = data;
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    body = await context.json().catch(() => null);
  }

  if (body?.code === 'account_has_bands') {
    return { ok: false, reason: 'admin_of_bands', bands: Array.isArray(body.bands) ? body.bands : [] };
  }
  return {
    ok: false,
    reason: 'error',
    message: 'We couldn’t delete your account. Check your connection and try again, or contact support@bandwith.app.',
  };
}
