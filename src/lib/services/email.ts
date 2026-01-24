import { supabase } from '../supabase';

// Email types for onboarding
export type EmailType =
  | 'onboarding_invite'
  | 'onboarding_reminder'
  | 'member_joined'
  | 'invite_expired';

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
  email: string,
  bandName: string,
  inviterName: string,
  inviteUrl: string,
  role?: string
): Promise<{ success: boolean; error: Error | null }> => {
  return sendEmail('onboarding_invite', {
    to: email,
    bandName,
    inviterName,
    inviteUrl,
    role: role || 'Musician',
  });
};

// Send invite reminder email
export const sendInviteReminderEmail = async (
  email: string,
  bandName: string,
  inviterName: string,
  inviteUrl: string,
  daysRemaining: number
): Promise<{ success: boolean; error: Error | null }> => {
  return sendEmail('onboarding_reminder', {
    to: email,
    bandName,
    inviterName,
    inviteUrl,
    daysRemaining,
  });
};

// Send member joined notification to admin
export const sendMemberJoinedEmail = async (
  adminEmail: string,
  bandName: string,
  newMemberName: string,
  newMemberEmail: string
): Promise<{ success: boolean; error: Error | null }> => {
  return sendEmail('member_joined', {
    to: adminEmail,
    bandName,
    newMemberName,
    newMemberEmail,
  });
};

// Generate email HTML templates
export const generateOnboardingEmailHtml = (
  type: EmailType,
  data: Record<string, any>
): { subject: string; html: string } => {
  const baseStyles = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background-color: #0A0A0B;
    color: #ffffff;
  `;

  const buttonStyle = `
    display: inline-block;
    padding: 18px 48px;
    background-color: #D4FB46;
    color: #000000;
    text-decoration: none;
    font-size: 16px;
    font-weight: 700;
    border-radius: 14px;
    box-shadow: 0 4px 24px rgba(212, 251, 70, 0.3);
  `;

  switch (type) {
    case 'onboarding_invite':
      return {
        subject: `🎸 You're invited to join "${data.bandName}" on BandWith!`,
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="${baseStyles} margin: 0; padding: 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #1C1C1E; border-radius: 24px; overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                      <td align="center" style="padding: 48px 40px 32px;">
                        <div style="width: 72px; height: 72px; background-color: #D4FB46; border-radius: 20px; text-align: center; line-height: 72px; font-size: 36px;">🎸</div>
                        <h1 style="margin: 20px 0 0; font-size: 28px; font-weight: 700; color: #FFFFFF;">
                          Band<span style="color: #D4FB46;">With</span>
                        </h1>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 0 40px 40px;">
                        <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #FFFFFF; text-align: center;">
                          You're invited! 🎉
                        </h2>
                        
                        <p style="margin: 0 0 24px; font-size: 16px; line-height: 26px; color: #A1A1AA; text-align: center;">
                          ${data.inviterName} invited you to join
                        </p>
                        
                        <!-- Band Card -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #2C2C2E; border-radius: 16px; margin-bottom: 32px;">
                          <tr>
                            <td style="padding: 24px; text-align: center;">
                              <h3 style="margin: 0; font-size: 28px; font-weight: 800; color: #D4FB46;">"${data.bandName}"</h3>
                              <p style="margin: 8px 0 0; font-size: 14px; color: #71717A;">as ${data.role}</p>
                            </td>
                          </tr>
                        </table>
                        
                        <!-- CTA Button -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td align="center">
                              <a href="${data.inviteUrl}" style="${buttonStyle}">
                                Accept Invitation
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 24px 0 0; font-size: 13px; line-height: 20px; color: #52525B; text-align: center;">
                          If the button doesn't work, copy and paste this link:
                        </p>
                        <p style="margin: 8px 0 0; font-size: 12px; line-height: 18px; color: #D4FB46; text-align: center; word-break: break-all;">
                          ${data.inviteUrl}
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Features -->
                    <tr>
                      <td style="padding: 0 40px 32px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top: 1px solid #2C2C2E; padding-top: 32px;">
                          <tr>
                            <td style="padding-top: 32px;">
                              <p style="margin: 0 0 20px; font-size: 14px; font-weight: 600; color: #FFFFFF; text-align: center;">
                                What you'll be able to do:
                              </p>
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                  <td width="33%" align="center" style="padding: 12px;">
                                    <div style="font-size: 24px; margin-bottom: 8px;">📅</div>
                                    <p style="margin: 0; font-size: 12px; color: #A1A1AA;">View gigs &<br>availability</p>
                                  </td>
                                  <td width="33%" align="center" style="padding: 12px;">
                                    <div style="font-size: 24px; margin-bottom: 8px;">💵</div>
                                    <p style="margin: 0; font-size: 12px; color: #A1A1AA;">Track your<br>earnings</p>
                                  </td>
                                  <td width="33%" align="center" style="padding: 12px;">
                                    <div style="font-size: 24px; margin-bottom: 8px;">💬</div>
                                    <p style="margin: 0; font-size: 12px; color: #A1A1AA;">Chat with<br>your band</p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 24px 40px 40px; background-color: #141416;">
                        <p style="margin: 0 0 16px; font-size: 13px; color: #52525B; text-align: center;">
                          Need help? Contact us at
                          <a href="mailto:support@bandwith.app" style="color: #D4FB46; text-decoration: none;">support@bandwith.app</a>
                        </p>
                        <p style="margin: 0; font-size: 11px; color: #3F3F46; text-align: center;">
                          © 2026 BandWith. All rights reserved.<br>
                          You're receiving this because you were invited to join a band.<br>
                          If you don't want to join, you can ignore this email.
                        </p>
                      </td>
                    </tr>
                    
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      };

    case 'onboarding_reminder':
      return {
        subject: `⏰ Reminder: ${data.inviterName} is waiting for you to join ${data.bandName}`,
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="${baseStyles} margin: 0; padding: 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #1C1C1E; border-radius: 24px; overflow: hidden;">
                    
                    <tr>
                      <td align="center" style="padding: 48px 40px 32px;">
                        <div style="width: 72px; height: 72px; background-color: #FF4F28; border-radius: 20px; text-align: center; line-height: 72px; font-size: 36px;">⏰</div>
                        <h1 style="margin: 20px 0 0; font-size: 24px; font-weight: 700; color: #FFFFFF;">
                          Don't miss out!
                        </h1>
                      </td>
                    </tr>
                    
                    <tr>
                      <td style="padding: 0 40px 40px; text-align: center;">
                        <p style="font-size: 16px; color: #A1A1AA; margin-bottom: 24px;">
                          ${data.inviterName} invited you to join <strong style="color: #D4FB46;">"${data.bandName}"</strong> 
                          and is waiting for your response.
                        </p>
                        
                        <p style="font-size: 14px; color: #FF4F28; margin-bottom: 32px;">
                          Your invite expires in ${data.daysRemaining} days
                        </p>
                        
                        <a href="${data.inviteUrl}" style="${buttonStyle}">
                          Accept Invitation
                        </a>
                      </td>
                    </tr>
                    
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      };

    case 'member_joined':
      return {
        subject: `🎉 ${data.newMemberName} joined ${data.bandName}!`,
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="${baseStyles} margin: 0; padding: 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #1C1C1E; border-radius: 24px; overflow: hidden;">
                    
                    <tr>
                      <td align="center" style="padding: 48px 40px 32px;">
                        <div style="width: 72px; height: 72px; background-color: #D4FB46; border-radius: 20px; text-align: center; line-height: 72px; font-size: 36px;">🎉</div>
                        <h1 style="margin: 20px 0 0; font-size: 24px; font-weight: 700; color: #FFFFFF;">
                          New Member!
                        </h1>
                      </td>
                    </tr>
                    
                    <tr>
                      <td style="padding: 0 40px 40px; text-align: center;">
                        <p style="font-size: 18px; color: #FFFFFF; margin-bottom: 8px;">
                          <strong>${data.newMemberName}</strong>
                        </p>
                        <p style="font-size: 14px; color: #A1A1AA; margin-bottom: 24px;">
                          just joined <strong style="color: #D4FB46;">"${data.bandName}"</strong>
                        </p>
                        
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color: #2C2C2E; border-radius: 12px; margin: 0 auto;">
                          <tr>
                            <td style="padding: 16px 24px;">
                              <p style="margin: 0; font-size: 13px; color: #71717A;">Email</p>
                              <p style="margin: 4px 0 0; font-size: 15px; color: #FFFFFF;">${data.newMemberEmail}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      };

    default:
      return {
        subject: 'BandWith Notification',
        html: `<p>${JSON.stringify(data)}</p>`,
      };
  }
};

export default {
  sendEmail,
  sendOnboardingInviteEmail,
  sendInviteReminderEmail,
  sendMemberJoinedEmail,
  generateOnboardingEmailHtml,
};
