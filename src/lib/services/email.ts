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

// Send onboarding invite email
export const sendOnboardingInviteEmail = async (
  bandId: string,
  email: string,
  bandName: string,
  inviterName: string,
  inviteUrl: string,
  role?: string
): Promise<{ success: boolean; error: Error | null }> => {
  return sendEmail('onboarding_invite', {
    to: email,
    bandId,
    bandName,
    inviterName,
    inviteUrl,
    role: role || 'Musician',
  });
};

// Send invite reminder email
export const sendInviteReminderEmail = async (
  bandId: string,
  email: string,
  bandName: string,
  inviterName: string,
  inviteUrl: string,
  daysRemaining: number
): Promise<{ success: boolean; error: Error | null }> => {
  return sendEmail('onboarding_reminder', {
    to: email,
    bandId,
    bandName,
    inviterName,
    inviteUrl,
    daysRemaining,
  });
};

// Send member joined notification to admin
export const sendMemberJoinedEmail = async (
  bandId: string,
  adminEmail: string,
  bandName: string,
  newMemberName: string,
  newMemberEmail: string
): Promise<{ success: boolean; error: Error | null }> => {
  return sendEmail('member_joined', {
    to: adminEmail,
    bandId,
    bandName,
    newMemberName,
    newMemberEmail,
  });
};

export default {
  sendEmail,
  sendOnboardingInviteEmail,
  sendInviteReminderEmail,
  sendMemberJoinedEmail,
};
