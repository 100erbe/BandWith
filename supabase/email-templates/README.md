# BandWith Email Templates

Every email BandWith sends, designed as one system that matches the app: big uppercase display type, mono labels, pill buttons with ↗, and the dot/dash pattern from the welcome screen.

## The rule: Lime or Ink

Every email uses the same structure. Only the hero card changes, and **intent** decides which one:

| Hero | Used for | Look |
|---|---|---|
| **Lime** | Band moments: people joining, invites, news | Lime `#D5FB46` card, black type, white CTA |
| **Ink** | Account and security: sign-in, passwords, codes, expiries | Ink `#050505` card, white type, lime CTA |

Shared structure: page `#E5E3E0` → hero card (logo, pattern, mono kicker, headline, body, optional details table, CTA) → light info card `#F2F0ED` (fallback link, "not you?") → footer (motto, why you got it, Privacy · Terms, plus Unsubscribe on marketing).

Type: `Neue Haas Grotesk Display Pro` → `Helvetica Neue` → Arial for display and text; `SF Mono` → Menlo → Consolas for labels. Email clients rarely load web fonts, so Helvetica Neue is what most people see.

## Templates

### Supabase Auth (Go templates; paste in Dashboard → Authentication → Email Templates)

| File | Supabase template | Hero | Variables |
|---|---|---|---|
| `confirm-signup.html` | Confirm signup | Lime | `{{ .ConfirmationURL }}` `{{ .Email }}` `{{ .SiteURL }}` |
| `reset-password.html` | Reset password | Ink | `{{ .ConfirmationURL }}` `{{ .Email }}` `{{ .SiteURL }}` |
| `magic-link.html` | Magic link | Ink | `{{ .ConfirmationURL }}` `{{ .Email }}` `{{ .SiteURL }}` |
| `change-email.html` | Change email address | Ink | `{{ .ConfirmationURL }}` `{{ .Email }}` `{{ .NewEmail }}` `{{ .SiteURL }}` |
| `reauthentication.html` | Reauthentication | Ink | `{{ .Token }}` `{{ .Email }}` `{{ .SiteURL }}` |

### App emails (sent by the `send-email` Edge Function via Resend)

Placeholders are `{{Name}}`. Values must be HTML-escaped and links checked against the allowed hosts before they are substituted, as `send-email` already does.

| File | `send-email` type | Hero | Variables |
|---|---|---|---|
| `band-invite.html` | `onboarding_invite` | Lime | `BandName` `InviterName` `Role` `InviteURL` `To` `AppURL` |
| `invite-reminder.html` | `onboarding_reminder` | Lime | `BandName` `InviterName` `Role` `InviteURL` `ExpiresIn` ("in 3 days") `ExpiresInLabel` ("In 3 days") `To` `AppURL` |
| `member-joined.html` | `member_joined` (to admins) | Lime | `BandName` `NewMemberName` (name, or the address) `HeroName` (name, or "A new member": an address doesn't fit the headline) `AppURL` |
| `invite-expired.html` | `invite_expired` (to the inviting admin) | Ink | `BandName` `InviteeName` `Role` `AppURL` |
| `welcome.html` | `welcome` (after email confirmation) | Lime | `NameSuffix` (", Alex", or ", " + the address) `To` `AppURL` |
| `product-update.html` | product news (broadcast) | Lime | `IssueLabel` `Preheader` `Headline` `Intro` `CtaLabel` `CtaURL` `Item1–3Title/Text` `Item1–2URL` `UnsubscribeURL` `AppURL` |

**Names, not addresses.** Wherever an email names a person, it shows their name and falls back to their address only when there is no name. Sign-up saves the part of the address before the @ as `full_name` when no name was given, so `send-email` treats that as no name. The inviter's name is read on the server, not taken from the app.

### Who sends what

| Email | Trigger |
|---|---|
| Auth emails | Supabase Auth, automatically |
| `onboarding_invite` | The app, when an admin invites a new address (`invitations.ts`) |
| `member_joined` | Database: the `member_joined` notification (046) for each **admin** recipient → `bw_dispatch_email` (063), unless they turned email off |
| `welcome` | Database: once per user when `auth.users.email_confirmed_at` is set (063), logged in `bw_email_log` |
| `onboarding_reminder`, `invite_expired` | Not sent yet (planned: daily pg_cron job) |
| product news | Not sent yet (planned: Resend Broadcasts) |

Database calls authenticate with `x-bw-dispatch-secret` (Vault `bw_email_dispatch_secret`, checked by `bw_verify_email_dispatch_secret`) and pass the gateway with the public anon key from Vault `bw_anon_key`. The function looks up every address from the ids it receives.

## Logos

Emails load two hosted PNGs (2× resolution, shown at 172px wide):

- `assets/logo-mono-black.png` → Lime hero
- `assets/logo-white-lime.png` → Ink hero

They must be in the public `assets` bucket of Supabase Storage under the same names:
`https://elvlzpowkohjbhxjasvd.supabase.co/storage/v1/object/public/assets/<name>.png`

## Editing

The HTML files are generated. Edit `_source/build.py`, then:

```bash
cd supabase/email-templates/_source && python3 build.py
```

It writes `out/<name>.html` (real) and `out/<name>.preview.html` (logos inlined, sample data). Copy the real files up one level. `board.py` lays previews side by side (desktop and 320px mobile) for review.

Checked at 640px and 320px widths. A media query shrinks the headline on phones and again under 375px.

## Deliverability

- Send from a verified domain with SPF, DKIM and DMARC; set `EMAIL_FROM` once the domain is verified in Resend.
- Use custom SMTP (Resend) in Supabase Auth so auth emails come from the same domain.
- Before switching, test in Gmail (web and iOS), Apple Mail and Outlook.

Previous versions are in git history. Local working copies may also keep them in `_legacy/` (not committed).
