# BandWith Email Templates

Beautiful, Swiss Editorial Modern email templates for BandWith.

## Design System

- **Background**: Pure black `#000000`
- **Card**: Near-black `#0A0A0A` with subtle border `#1C1C1E`
- **Primary accent**: Lime `#D4FB46`
- **Typography**: SF Pro Display / System fonts
- **Border radius**: 24px cards, 100px buttons, 12px secondary elements

## Templates

| Template | File | Supabase Setting |
|----------|------|------------------|
| Email Confirmation | `confirm-signup.html` | Auth → Email Templates → Confirm signup |
| Magic Link | `magic-link.html` | Auth → Email Templates → Magic Link |
| Password Reset | `reset-password.html` | Auth → Email Templates → Reset Password |
| Member Invite | `invite-member.html` | Custom (send via Edge Function) |

## Setup Instructions

### 1. Upload Logo to Supabase Storage

1. Go to **Supabase Dashboard** → **Storage**
2. Create a bucket called `assets` (make it **public**)
3. Upload `Logo - full text White.png` as `logo-white.png`
4. Copy the public URL (should be like `https://[project-id].supabase.co/storage/v1/object/public/assets/logo-white.png`)

### 2. Update Template URLs

In each template, replace the logo `src` attribute:

```html
<img src="https://elvlzpowkohjbhxjasvd.supabase.co/storage/v1/object/public/assets/logo-white.png" ...
```

With your actual Storage URL.

### 3. Configure Email Templates in Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Email Templates**
2. For each template type:
   - Click on the template name
   - Toggle "Use custom template"
   - Paste the HTML content from the corresponding file
   - Click "Save"

### 4. Configure SMTP (Production)

For production, set up a custom SMTP provider:

1. Go to **Project Settings** → **Auth** → **SMTP Settings**
2. Enable "Custom SMTP"
3. Enter your SMTP credentials (Resend, SendGrid, Postmark, etc.)

**Recommended providers:**
- [Resend](https://resend.com) - Developer-friendly, great deliverability
- [Postmark](https://postmarkapp.com) - Transactional email specialist
- [SendGrid](https://sendgrid.com) - High volume

### 5. Test Emails

1. Create a test account with a real email
2. Check that emails arrive in inbox (not spam)
3. Click links to verify they work correctly

## Template Variables

### confirm-signup.html
- `{{ .ConfirmationURL }}` - Email confirmation link

### magic-link.html
- `{{ .ConfirmationURL }}` - Magic link sign-in URL

### reset-password.html
- `{{ .ConfirmationURL }}` - Password reset link
- `{{ .Email }}` - User's email address

### invite-member.html (Custom)
- `{{ .InviteURL }}` - Invitation link
- `{{ .BandName }}` - Name of the band
- `{{ .BandInitials }}` - Band initials (e.g., "TC")
- `{{ .InviterName }}` - Name of person who sent invite
- `{{ .Role }}` - Invited member's role (e.g., "Guitarist")

## Email Deliverability Tips

1. **Verify your domain** - Set up SPF, DKIM, and DMARC records
2. **Use a subdomain** - e.g., `mail.bandwith.app` instead of `bandwith.app`
3. **Keep it simple** - Avoid spam trigger words
4. **Test everywhere** - Gmail, Outlook, Apple Mail, Yahoo
5. **Monitor reputation** - Use tools like Mail-Tester.com

## Preview

Open the HTML files in a browser to preview them locally.
