import { supabase } from '../supabase';

// Email types for onboarding
export type EmailType =
  | 'onboarding_invite'
  | 'onboarding_reminder'
  | 'member_joined'
  | 'invite_expired'
  | 'welcome';

// The HTML for every type lives server-side in supabase/functions/_shared/email-templates.ts
// (generated from supabase/email-templates/_source/build.py).

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Send email via Supabase Edge Function
export const sendEmail = async (
  type: EmailType,
  data: Record<string, any>
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: { type, data },
    });

    if (error) throw error;

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Error sending email:', err);
    return { success: false, error: err };
  }
};

// Send the invite email for a pending invitation. The server takes the
// recipient, band, role and link from the invitation row (by token); the
// other values are only a fallback for older servers.
export const sendOnboardingInviteEmail = async (
  bandId: string,
  email: string,
  bandName: string,
  inviterName: string,
  inviteUrl: string,
  role: string | undefined,
  token: string
): Promise<{ success: boolean; error: Error | null }> => {
  return sendEmail('onboarding_invite', {
    to: email,
    bandId,
    bandName,
    inviterName,
    inviteUrl,
    role: role || 'Musician',
    token,
  });
};

export default {
  sendEmail,
  sendOnboardingInviteEmail,
};
