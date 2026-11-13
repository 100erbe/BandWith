"""Draft builder for BandWith emails (design exploration only).

Produces real, client-safe email HTML (tables + inline styles) and an
inline-preview fragment with the logos embedded as data URIs.
"""
import base64, pathlib, re, sys

HERE = pathlib.Path(__file__).parent
LOGO_URL = {
    "black": "https://elvlzpowkohjbhxjasvd.supabase.co/storage/v1/object/public/assets/logo-mono-black.png",
    "white": "https://elvlzpowkohjbhxjasvd.supabase.co/storage/v1/object/public/assets/logo-white-lime.png",
}
LOGO_FILE = {"black": "../assets/logo-mono-black.png", "white": "../assets/logo-white-lime.png"}

# The deployed web app. bandwith.app is NOT ours (another product), never link to it.
PUBLIC_URL = "https://bandwith-beryl.vercel.app"  # = Supabase Auth site_url

LIME = "#D5FB46"
INK = "#050505"
BG = "#E5E3E0"
CARD = "#F2F0ED"
MUTED = "#5C5B5A"
DISPLAY = "'Neue Haas Grotesk Display Pro','Helvetica Neue',Helvetica,Arial,sans-serif"
TEXT = "'Helvetica Neue',Helvetica,Arial,sans-serif"
MONO = "'SF Mono',Menlo,Consolas,'Courier New',monospace"

# Same rhythm as the landing hero (WelcomeScreen DOT_HERO), scaled for email.
DOTS = [[44, 8, 64, 8, 52, 8, 30, 8], [8, 36, 8, 58, 8, 44, 8, 26]]


def dots(color):
    rows = []
    for row in DOTS:
        cells = "".join(
            f'<td width="{w}" height="8" style="width:{w}px;height:8px;background:{color};border-radius:8px;font-size:0;line-height:0;">&nbsp;</td>'
            f'<td width="6" style="width:6px;font-size:0;line-height:0;">&nbsp;</td>'
            for w in row
        )
        rows.append(f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px 0;"><tr>{cells}</tr></table>')
    return "".join(rows)


def label(text, color):
    return (f'<div style="font-family:{MONO};font-size:11px;line-height:14px;letter-spacing:0.08em;'
            f'text-transform:uppercase;color:{color};font-weight:500;">{text}</div>')


def button(text, href, bg, fg):
    return f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="background:{bg};border-radius:999px;">
<a href="{href}" target="_blank" style="display:block;padding:20px 26px;font-family:{DISPLAY};font-size:16px;line-height:20px;font-weight:700;letter-spacing:0.01em;text-transform:uppercase;color:{fg};text-decoration:none;">
<span style="float:right;font-size:20px;line-height:20px;">&#8599;&#xFE0E;</span>{text}</a>
</td></tr></table>'''


def hero(variant, kicker, title, body, cta, href, extra=""):
    lime = variant == "lime"
    bg, fg = (LIME, "#000000") if lime else (INK, "#FFFFFF")
    sub = "#000000" if lime else "#BDBDBD"
    logo = "black" if lime else "white"
    dotc = "#000000" if lime else LIME
    btn = "" if not cta else ('<div style="height:32px;line-height:32px;font-size:0;">&nbsp;</div>' +
           (button(cta, href, "#FFFFFF", "#000000") if lime else button(cta, href, LIME, "#000000")))
    kick = label(kicker, "#000000" if lime else LIME)
    return f'''<tr><td class="bw-hero" style="background:{bg};border-radius:32px;padding:36px 36px 40px 36px;">
<img src="{{{{LOGO_{logo}}}}}" width="172" height="20" alt="BandWith" style="display:block;width:172px;height:auto;border:0;">
<div style="height:44px;line-height:44px;font-size:0;">&nbsp;</div>
{dots(dotc)}
<div style="height:26px;line-height:26px;font-size:0;">&nbsp;</div>
{kick}
<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
<h1 class="bw-h1" style="margin:0;font-family:{DISPLAY};font-size:52px;line-height:48px;font-weight:700;letter-spacing:-0.02em;word-spacing:0.06em;text-transform:uppercase;color:{fg};word-wrap:break-word;">{title}</h1>
<div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
<p style="margin:0;font-family:{TEXT};font-size:17px;line-height:24px;color:{sub};">{body}</p>
{extra}{btn}
</td></tr>'''


def info_card(rows):
    inner = '<div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>'.join(rows)
    return f'''<tr><td style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>
<tr><td class="bw-card" style="background:{CARD};border-radius:24px;padding:26px 30px;">{inner}</td></tr>'''


def info_block(kicker, html):
    return (label(kicker, MUTED) +
            f'<p style="margin:8px 0 0 0;font-family:{TEXT};font-size:15px;line-height:22px;color:#000000;">{html}</p>')


def footer(reason, site="{{ .SiteURL }}", unsubscribe=None):
    return f'''<tr><td style="padding:34px 30px 8px 30px;">
{label("BandWith &mdash; your music, your schedule, your way", "#000000")}
<p style="margin:10px 0 0 0;font-family:{TEXT};font-size:13px;line-height:19px;color:{MUTED};">{reason}</p>
<p style="margin:10px 0 0 0;font-family:{TEXT};font-size:13px;line-height:19px;color:{MUTED};">
<a href="{site}/legal/privacy.html" style="color:#000000;text-decoration:underline;">Privacy</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="{site}/legal/terms.html" style="color:#000000;text-decoration:underline;">Terms</a>{"" if not unsubscribe else f'&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="{unsubscribe}" style="color:#000000;text-decoration:underline;">Unsubscribe</a>'}</p>
</td></tr>'''


def document(subject, preheader, rows):
    return f'''<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>{subject}</title>
<style>
:root {{ color-scheme: light only; supported-color-schemes: light only; }}
body {{ margin:0; padding:0; background:{BG}; -webkit-text-size-adjust:100%; }}
a {{ text-decoration:none; }}
@media (max-width:600px) {{
  .bw-wrap {{ padding:12px 8px 24px 8px !important; }}
  .bw-hero {{ padding:28px 24px 30px 24px !important; border-radius:28px !important; }}
  .bw-card {{ padding:22px 24px !important; }}
  .bw-h1 {{ font-size:40px !important; line-height:38px !important; }}
  .bw-code {{ font-size:34px !important; letter-spacing:0.14em !important; }}
}}
@media (max-width:374px) {{
  .bw-h1 {{ font-size:33px !important; line-height:32px !important; }}
}}
</style>
</head>
<body style="margin:0;padding:0;background:{BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">{preheader}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{BG};">
<tr><td class="bw-wrap" align="center" style="padding:32px 12px 40px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
{"".join(rows)}
</table>
</td></tr></table>
</body>
</html>'''


def fallback_link(url):
    return info_block("Button not working?",
                      f'Paste this link into your browser:<br><a href="{url}" style="font-family:{MONO};font-size:12px;line-height:18px;color:#000000;text-decoration:underline;word-break:break-all;">{url}</a>')


# Rule: LIME = band moments (joining, people, news). INK = account & security.
def confirm_signup(variant="lime"):
    return document(
        "Confirm your email",
        "One tap and your BandWith account is ready.",
        [
            hero(variant, "Confirm your email", "One tap<br>and you&rsquo;re in.",
                 "Confirm this address to finish setting up BandWith &mdash; gigs, rehearsals and your whole band in one calendar.",
                 "Confirm email", "{{ .ConfirmationURL }}"),
            info_card([
                fallback_link("{{ .ConfirmationURL }}"),
                info_block("Not you?",
                           "If you didn&rsquo;t sign up for BandWith, ignore this email. No account is created until the address is confirmed."),
            ]),
            footer("You&rsquo;re getting this because someone signed up for BandWith with {{ .Email }}."),
        ],
    )


def reset_password(variant="ink"):
    return document(
        "Reset your BandWith password",
        "Choose a new password for your BandWith account.",
        [
            hero(variant, "Password reset", "New password,<br>same band.",
                 "We got a request to reset the password for {{ .Email }}. Choose a new one and you&rsquo;re back on stage.",
                 "Set new password", "{{ .ConfirmationURL }}"),
            info_card([
                fallback_link("{{ .ConfirmationURL }}"),
                info_block("Didn&rsquo;t ask for this?",
                           "Ignore this email &mdash; your password stays the same. Nothing changes unless someone opens this link, and it works only once."),
            ]),
            footer("You&rsquo;re getting this because a password reset was requested for {{ .Email }}."),
        ],
    )


def magic_link(variant="ink"):
    return document(
        "Your BandWith sign-in link",
        "Tap to sign in to BandWith. No password needed.",
        [
            hero(variant, "Sign-in link", "Your way<br>back in.",
                 "Tap below to sign in to BandWith as {{ .Email }}. No password needed.",
                 "Sign in", "{{ .ConfirmationURL }}"),
            info_card([
                fallback_link("{{ .ConfirmationURL }}"),
                info_block("Didn&rsquo;t ask for this?",
                           "Ignore this email &mdash; nobody can sign in without this link, and it works only once."),
            ]),
            footer("You&rsquo;re getting this because a sign-in link was requested for {{ .Email }}."),
        ],
    )


def change_email(variant="ink"):
    return document(
        "Confirm your new email",
        "Confirm the new address for your BandWith account.",
        [
            hero(variant, "Change email", "New address,<br>same account.",
                 "Confirm that you want to move your BandWith account from {{ .Email }} to {{ .NewEmail }}. Your band, gigs and calendar come with you.",
                 "Confirm new email", "{{ .ConfirmationURL }}"),
            info_card([
                fallback_link("{{ .ConfirmationURL }}"),
                info_block("Didn&rsquo;t ask for this?",
                           "Ignore this email and your address stays {{ .Email }}. If you didn&rsquo;t request the change, set a new password from the app."),
            ]),
            footer("You&rsquo;re getting this because an email change was requested for your BandWith account."),
        ],
    )


def details(rows, variant="lime"):
    line = "#AFCE3A" if variant == "lime" else "#2A2A2A"
    lab = "#000000" if variant == "lime" else "#9A9A9A"
    val = "#000000" if variant == "lime" else "#FFFFFF"
    trs = "".join(
        f'<tr><td style="border-top:1px solid {line};padding:12px 0;font-family:{MONO};font-size:11px;line-height:14px;letter-spacing:0.08em;text-transform:uppercase;color:{lab};">{k}</td>'
        f'<td align="right" style="border-top:1px solid {line};padding:12px 0;font-family:{DISPLAY};font-size:15px;line-height:18px;font-weight:700;color:{val};">{v}</td></tr>'
        for k, v in rows)
    return ('<div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid {line};">{trs}</table>')


APP = "{{AppURL}}"


def band_invite(variant="lime"):
    return document(
        "Join {{BandName}} on BandWith",
        "{{InviterName}} invited you to join {{BandName}}.",
        [
            hero(variant, "Band invite", "Join<br>{{BandName}}.",
                 "{{InviterName}} wants you in the band. Accept to see gigs, rehearsals and setlists the moment they&rsquo;re scheduled.",
                 "Accept invite", "{{InviteURL}}",
                 details([("Band", "{{BandName}}"), ("Your role", "{{Role}}"), ("Invited by", "{{InviterName}}")])),
            info_card([
                fallback_link("{{InviteURL}}"),
                info_block("Not expecting this?",
                           "Ignore it &mdash; you won&rsquo;t join any band unless you accept. The invite expires in 7 days."),
            ]),
            footer("You&rsquo;re getting this because {{InviterName}} invited {{To}} to a band on BandWith.", APP),
        ],
    )


def invite_reminder(variant="lime"):
    return document(
        "Reminder: {{BandName}} is waiting for you",
        "Your invite to {{BandName}} expires {{ExpiresIn}}.",
        [
            hero(variant, "Invite reminder", "The band&rsquo;s<br>still waiting.",
                 "{{InviterName}} invited you to join {{BandName}}. Your invite expires {{ExpiresIn}} &mdash; accept it before it does.",
                 "Accept invite", "{{InviteURL}}",
                 details([("Band", "{{BandName}}"), ("Your role", "{{Role}}"), ("Expires", "{{ExpiresInLabel}}")])),
            info_card([
                fallback_link("{{InviteURL}}"),
                info_block("Not for you?",
                           "Ignore this email and the invite simply expires. Nothing else happens."),
            ]),
            footer("You&rsquo;re getting this because {{InviterName}} invited {{To}} to a band on BandWith.", APP),
        ],
    )


def member_joined(variant="lime"):
    return document(
        "{{NewMemberName}} joined {{BandName}}",
        "{{NewMemberName}} just joined {{BandName}}.",
        [
            hero(variant, "New member", "{{HeroName}}<br>is in.",
                 "{{NewMemberName}} just joined {{BandName}}. They can now see your gigs, rehearsals and setlists.",
                 "Open BandWith", APP,
                 details([("Band", "{{BandName}}"), ("New member", "{{NewMemberName}}")])),
            info_card([
                info_block("Need to change something?",
                           "You can update their role or remove them anytime from the band&rsquo;s member list in the app."),
            ]),
            footer("You&rsquo;re getting this because you&rsquo;re an admin of {{BandName}} on BandWith.", APP),
        ],
    )


def chips(items):
    pills = "".join(
        f'<span style="display:inline-block;margin:0 6px 8px 0;padding:8px 13px;background:#FFFFFF;border-radius:999px;font-family:{MONO};font-size:11px;line-height:13px;letter-spacing:0.06em;text-transform:uppercase;color:#000000;white-space:nowrap;">{t}</span>'
        for t in items)
    return f'<div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div><div style="font-size:0;line-height:0;">{pills}</div>'


def steps(rows):
    out = []
    for i, (title, text) in enumerate(rows, 1):
        border = "" if i == 1 else "border-top:1px solid #D3D1CE;"
        out.append(
            f'<tr><td valign="top" width="44" style="{border}padding:16px 0;width:44px;font-family:{MONO};font-size:13px;line-height:20px;color:{MUTED};">0{i}</td>'
            f'<td valign="top" style="{border}padding:16px 0;">'
            f'<div style="font-family:{DISPLAY};font-size:16px;line-height:20px;font-weight:700;letter-spacing:0.01em;text-transform:uppercase;color:#000000;">{title}</div>'
            f'<div style="margin-top:4px;font-family:{TEXT};font-size:15px;line-height:22px;color:#000000;">{text}</div></td></tr>')
    return (label("Get going in five minutes", MUTED) +
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">{"".join(out)}</table>')


def welcome(variant="lime"):
    return document(
        "Welcome to BandWith",
        "Your music, your schedule, your way. Here&rsquo;s how to get going.",
        [
            hero(variant, "Welcome{{NameSuffix}}", "Your music.<br>Your schedule.<br>Your way.",
                 "Your account is ready. Gigs, rehearsals, quotes and setlists now live in one calendar your whole band can see.",
                 "Open BandWith", APP,
                 chips(["Shared calendars", "Automated quotes", "Rehearsal costs", "Setlist builder"])),
            info_card([
                steps([
                    ("Set up your band", "Create a band, join one with an invite code, or go solo with your own calendar."),
                    ("Add your first gig", "Date, venue and fee &mdash; everyone in the band sees it the moment you save."),
                    ("Bring the band in", "Invite members by email or share a link. Roles keep admins and members apart."),
                ]),
            ]),
            footer("You&rsquo;re getting this because you created a BandWith account with {{To}}.", APP),
        ],
    )


def invite_expired(variant="ink"):
    return document(
        "{{InviteeName}}&rsquo;s invite to {{BandName}} expired",
        "The invite wasn&rsquo;t accepted in time. Send a new one in a tap.",
        [
            hero(variant, "Invite expired", "This invite<br>ran out.",
                 "The invite you sent to {{InviteeName}} for {{BandName}} wasn&rsquo;t accepted within 7 days, so it no longer works. Send a new one when you&rsquo;re ready.",
                 "Send a new invite", APP,
                 details([("Band", "{{BandName}}"), ("Invited", "{{InviteeName}}"), ("Role", "{{Role}}")], variant)),
            info_card([
                info_block("Why did it expire?",
                           "Invites last 7 days to keep your band private. Old links stop working, so nobody can join with a forgotten one."),
            ]),
            footer("You&rsquo;re getting this because you&rsquo;re an admin of {{BandName}} on BandWith.", APP),
        ],
    )


def code_box(code):
    return ('<div style="height:26px;line-height:26px;font-size:0;">&nbsp;</div>'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
            f'<td align="center" style="background:#1C1C1C;border-radius:24px;padding:26px 12px;">'
            f'<div style="font-family:{MONO};font-size:11px;line-height:14px;letter-spacing:0.08em;text-transform:uppercase;color:#9A9A9A;">Your code</div>'
            f'<div class="bw-code" style="margin-top:10px;font-family:{MONO};font-size:44px;line-height:48px;font-weight:700;letter-spacing:0.22em;color:{LIME};">{code}</div>'
            '</td></tr></table>')


def reauthentication(variant="ink"):
    return document(
        "Your BandWith verification code",
        "Use this code to confirm it&rsquo;s you.",
        [
            hero(variant, "Verification code", "Confirm<br>it&rsquo;s you.",
                 "Enter this code in BandWith to finish the change you started on {{ .Email }}.",
                 None, None, code_box("{{ .Token }}")),
            info_card([
                info_block("Didn&rsquo;t ask for this?",
                           "Someone may be trying to change your account. Don&rsquo;t share this code with anyone &mdash; BandWith will never ask for it &mdash; and set a new password from the app."),
            ]),
            footer("You&rsquo;re getting this because a change that needs extra confirmation was requested on your BandWith account."),
        ],
    )


def tag(text, solid):
    st = f"background:#000000;color:{LIME};" if solid else "background:transparent;color:#000000;border:1px solid #000000;"
    return (f'<span style="display:inline-block;padding:5px 10px;border-radius:999px;{st}font-family:{MONO};'
            f'font-size:11px;line-height:12px;letter-spacing:0.08em;text-transform:uppercase;">{text}</span>')


def update_items(items):
    out = []
    for i, (t, solid, title, text, link) in enumerate(items):
        border = "" if i == 0 else "border-top:1px solid #D3D1CE;"
        out.append(
            f'<tr><td style="{border}padding:20px 0;">{tag(t, solid)}'
            f'<div style="margin-top:12px;font-family:{DISPLAY};font-size:22px;line-height:24px;font-weight:700;letter-spacing:-0.01em;text-transform:uppercase;color:#000000;">{title}</div>'
            f'<div style="margin-top:6px;font-family:{TEXT};font-size:15px;line-height:22px;color:#000000;">{text}</div>'
            + ("" if not link else f'<a href="{link}" style="display:inline-block;margin-top:10px;font-family:{DISPLAY};font-size:13px;line-height:16px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:#000000;text-decoration:underline;">Try it &#8599;&#xFE0E;</a>') +
            '</td></tr>')
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">{"".join(out)}</table>'


def product_update(variant="lime"):
    return document(
        "What&rsquo;s new in BandWith &mdash; {{IssueLabel}}",
        "{{Preheader}}",
        [
            hero(variant, "What&rsquo;s new &middot; {{IssueLabel}}", "{{Headline}}",
                 "{{Intro}}",
                 "{{CtaLabel}}", "{{CtaURL}}"),
            info_card([update_items([
                ("New", True, "{{Item1Title}}", "{{Item1Text}}", "{{Item1URL}}"),
                ("Improved", False, "{{Item2Title}}", "{{Item2Text}}", "{{Item2URL}}"),
                ("Fixed", False, "{{Item3Title}}", "{{Item3Text}}", None),
            ])]),
            footer("You&rsquo;re getting this because you have a BandWith account. Turn product news off anytime with Unsubscribe, or in Settings &rarr; Notifications.", APP,
                   unsubscribe="{{UnsubscribeURL}}"),
        ],
    )


TEMPLATES = {
    "reauthentication": reauthentication,
    "product-update": product_update,
    "welcome": welcome,
    "invite-expired": invite_expired,
    "band-invite": band_invite,
    "invite-reminder": invite_reminder,
    "member-joined": member_joined,
    "confirm-signup": confirm_signup,
    "reset-password": reset_password,
    "magic-link": magic_link,
    "change-email": change_email,
}


def real(html):
    for k, url in LOGO_URL.items():
        html = html.replace("{{LOGO_" + k + "}}", url)
    return html


def preview(html):
    for k, f in LOGO_FILE.items():
        b64 = base64.b64encode((HERE / f).read_bytes()).decode()
        html = html.replace("{{LOGO_" + k + "}}", f"data:image/png;base64,{b64}")
    html = (html.replace("{{ .ConfirmationURL }}", PUBLIC_URL + "/auth/callback?token=8f2c1a…")
                .replace("{{ .Email }}", "alex@example.com")
                .replace("{{ .NewEmail }}", "alex.drums@example.com")
                .replace("{{ .SiteURL }}", PUBLIC_URL)
                .replace("{{ .Token }}", "48291375"))
    for k, v in {"BandName": "The Night Shift", "InviterName": "Marco Rossi", "Role": "Drums",
                 "InviteURL": PUBLIC_URL + "/?invite=k3x9q2…", "AppURL": PUBLIC_URL,
                 "To": "alex@example.com", "ExpiresIn": "in 3 days", "ExpiresInLabel": "In 3 days",
                 "NewMemberName": "Alex Bianchi", "HeroName": "Alex Bianchi", "FirstName": "Alex", "NameSuffix": ", Alex", "IssueLabel": "November 2026",
                 "Preheader": "Setlists that time themselves, faster quotes and a calmer calendar.",
                 "Headline": "Setlists that<br>time themselves.",
                 "Intro": "This month: the setlist builder adds up your set length as you go, quotes go out faster, and the calendar got a little calmer.",
                 "CtaLabel": "See what&rsquo;s new", "CtaURL": PUBLIC_URL,
                 "Item1Title": "Set length, live", "Item1Text": "Drag songs into a setlist and see the total running time update as you build it.", "Item1URL": PUBLIC_URL,
                 "Item2Title": "Quotes in two taps", "Item2Text": "Reuse a past quote as a template and send it to the client without retyping a thing.", "Item2URL": PUBLIC_URL,
                 "Item3Title": "Quieter reminders", "Item3Text": "Rehearsal reminders no longer arrive twice when an event is edited.", "Item3URL": PUBLIC_URL,
                 "UnsubscribeURL": PUBLIC_URL + "/unsubscribe", "InviteeName": "Giulia Verdi", "NewMemberEmail": "alex@example.com"}.items():
        html = html.replace("{{" + k + "}}", v)
    return html


# Plain-text subjects for the app emails ({{Key}} placeholders, raw values).
APP_EMAILS = {
    "band-invite": "Join {{BandName}} on BandWith",
    "invite-reminder": "Reminder: {{BandName}} is waiting for you",
    "member-joined": "{{NewMemberName}} joined {{BandName}}",
    "invite-expired": "Your invite to {{InviteeName}} for {{BandName}} expired",
    "welcome": "Welcome to BandWith",
    "product-update": "What’s new in BandWith — {{IssueLabel}}",
}
AUTH_EMAILS = ["confirm-signup", "reset-password", "magic-link", "change-email", "reauthentication"]
TS_MODULE = HERE.parent.parent / "functions" / "_shared" / "email-templates.ts"


def write_ts_module():
    import json
    entries = []
    for name, subject in APP_EMAILS.items():
        html = real(TEMPLATES[name]())
        entries.append(f"  {json.dumps(name)}: {{\n    subject: {json.dumps(subject, ensure_ascii=False)},\n    html: {json.dumps(html, ensure_ascii=False)},\n  }},")
    TS_MODULE.write_text(
        "// GENERATED by supabase/email-templates/_source/build.py — do not edit by hand.\n"
        "// Designs: supabase/email-templates/README.md (Lime = band moments, Ink = account & security).\n\n"
        "export const EMAIL_TEMPLATES = {\n" + "\n".join(entries) + "\n} as const;\n\n"
        "export type EmailTemplateName = keyof typeof EMAIL_TEMPLATES;\n\n"
        "const escapeHtml = (value: string): string =>\n"
        "  value.replace(/&/g, \"&amp;\").replace(/</g, \"&lt;\").replace(/>/g, \"&gt;\")\n"
        "    .replace(/\"/g, \"&quot;\").replace(/'/g, \"&#39;\");\n\n"
        "/**\n"
        " * Fill a template. `vars` are RAW values: they are HTML-escaped here for the body.\n"
        " * Keys ending in \"URL\" must already be validated by the caller (allowed host, https).\n"
        " * Unknown placeholders are left empty so a missing value never leaks `{{Key}}`.\n"
        " * Line breaks in a value become <br> (after escaping).\n"
        " */\n"
        "export function renderEmail(name: EmailTemplateName, vars: Record<string, string>): { subject: string; html: string } {\n"
        "  const t = EMAIL_TEMPLATES[name];\n"
        "  const value = (key: string) => vars[key] ?? \"\";\n"
        "  const html = t.html.replace(/\\{\\{([A-Za-z0-9]+)\\}\\}/g, (_m, key: string) =>\n"
        "    key.endsWith(\"URL\") ? value(key).replace(/\"/g, \"%22\") : escapeHtml(value(key)).replace(/\\n/g, \"<br>\"));\n"
        "  const subject = t.subject.replace(/\\{\\{([A-Za-z0-9]+)\\}\\}/g, (_m, key: string) => value(key))\n"
        "    .replace(/[\\r\\n]+/g, \" \").trim();\n"
        "  return { subject, html };\n"
        "}\n"
    )


if __name__ == "__main__":
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    for name, fn in TEMPLATES.items():
        h = fn()
        (out / f"{name}.html").write_text(real(h))
        (out / f"{name}.preview.html").write_text(preview(h))
    if "--ts" in sys.argv:
        write_ts_module()
        print("wrote", TS_MODULE)
    print("ok")
