import React from 'react';
import { Capacitor } from '@capacitor/core';
import { Loader2, Mail, MessageCircle, MessageSquare } from '@/app/components/icons';
import { BwSheet } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';
import { openExternal } from '@/lib/nativeFiles';
import {
  cancelDeputyRequest,
  deputiesUnavailable,
  deputyRecapText,
  deputyReplyUrl,
  deputyRequestsUnavailable,
  deputyRequestText,
  deputyUpdateText,
  emailUrl,
  latestRequestByDeputy,
  listDeputies,
  listDeputyRequests,
  openDeputyRequest,
  rankDeputies,
  smsUrl,
  whatsappUrl,
  type Deputy,
  type DeputyRequest,
  type DeputyRequestStatus,
} from '@/lib/services/deputies';
import { useT } from '@/lib/i18n';

export interface DeputyRequestContext {
  bandId: string;
  bandName: string;
  eventId: string;
  eventTitle: string;
  dateLabel: string;
  timeLabel?: string | null;
  loadInLabel?: string | null;
  venue?: string | null;
  /** Venue with the street address: only in the recap and updates (after a yes). */
  venueFull?: string | null;
}

type Mode = 'request' | 'recap' | 'update';

/** What the deputy said, in the admin's words. */
export const DEPUTY_STATUS_LABEL: Record<DeputyRequestStatus, string> = {
  pending: 'Asked · no answer yet',
  available: 'Available',
  maybe: 'Will confirm later',
  unavailable: "Can't make it",
  cancelled: 'Request cancelled',
};

/** Which message fits: a request, the recap after a yes, or an update after a change. */
export function deputyMessageMode(r: DeputyRequest | undefined): Mode {
  if (!r || r.status === 'cancelled') return 'request';
  if ((r.status === 'available' || r.status === 'maybe') && r.changes && r.changes.length > 0) return 'update';
  if (r.status === 'available') return 'recap';
  return 'request';
}

/**
 * "Find a deputy" for a member who declined a gig: the band's deputies, the
 * same instrument first, each with WhatsApp / SMS / Email. The message
 * carries a reply link (/deputy.html, migration 084) where the deputy
 * answers without an account; the admins get a push. Each deputy shows
 * their answer; after a yes the buttons send a recap, and after the gig
 * changes they send the update. Sent by the admin from their own phone.
 */
export const AskDeputySheet: React.FC<{
  open: boolean;
  onClose: () => void;
  ctx: DeputyRequestContext;
  /** The member being replaced. */
  member: { userId?: string | null; name: string; role?: string | null; fee?: number | null } | null;
  onManage?: () => void;
  /** Money in the band's currency. */
  formatFee?: (n: number) => string;
  /** After a request is created or cancelled. */
  onRequestsChange?: () => void;
}> = ({ open, onClose, ctx, member, onManage, formatFee = (n) => String(n), onRequestsChange }) => {
  const t = useT();
  const [deputies, setDeputies] = React.useState<Deputy[] | null>(null);
  const [unavailable, setUnavailable] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [requests, setRequests] = React.useState<DeputyRequest[]>([]);
  // Without migration 084 the messages go out without a link, as before.
  const [noLinks, setNoLinks] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const loadRequests = React.useCallback(async () => {
    const { data, error: e } = await listDeputyRequests(ctx.eventId);
    if (deputyRequestsUnavailable(e)) setNoLinks(true);
    else if (!e) setRequests(data);
  }, [ctx.eventId]);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setDeputies(null);
    setFailed(false);
    setError(null);
    void listDeputies(ctx.bandId).then(({ data, error: e }) => {
      if (!alive) return;
      if (deputiesUnavailable(e)) setUnavailable(true);
      else if (e) setFailed(true);
      setDeputies(e ? [] : data);
    });
    void loadRequests();
    // Back from WhatsApp / Mail: the deputy may have answered meanwhile.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadRequests();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [open, ctx.bandId, loadRequests]);

  const ranked = React.useMemo(() => rankDeputies(deputies || [], member?.role), [deputies, member?.role]);
  const latest = React.useMemo(() => latestRequestByDeputy(requests), [requests]);
  const role = member?.role && !/^member$/i.test(member.role) ? member.role : null;

  const send = async (d: Deputy, via: 'whatsapp' | 'sms' | 'email') => {
    if (busy) return;
    setError(null);
    const req = latest[d.id];
    const mode = deputyMessageMode(req);
    const feeNumber = member?.fee && member.fee > 0 ? member.fee : d.default_fee;
    // A browser blocks pop-ups opened after an await: open the tab now.
    const popup = !Capacitor.isNativePlatform() && via === 'whatsapp' ? window.open('', '_blank') : null;
    let token = req && req.status !== 'cancelled' ? req.token : null;
    if (!token && !noLinks) {
      setBusy(d.id);
      const { data, error: e } = await openDeputyRequest({
        eventId: ctx.eventId,
        deputyId: d.id,
        replacesUserId: member?.userId ?? null,
        role,
        fee: feeNumber ?? null,
      });
      setBusy(null);
      if (e && !deputyRequestsUnavailable(e)) {
        popup?.close();
        setError(t('Could not create the request. Try again.'));
        return;
      }
      if (deputyRequestsUnavailable(e)) setNoLinks(true);
      token = data?.token ?? null;
    }
    const gig = {
      deputyName: d.name,
      bandName: ctx.bandName,
      eventTitle: ctx.eventTitle,
      dateLabel: ctx.dateLabel,
      timeLabel: ctx.timeLabel,
      loadInLabel: ctx.loadInLabel,
      venue: mode === 'request' ? ctx.venue : ctx.venueFull || ctx.venue,
      role: req?.role ?? role,
      fee: req?.fee_offered != null ? formatFee(req.fee_offered) : feeNumber ? formatFee(feeNumber) : null,
      link: token ? deputyReplyUrl(token) : null,
    };
    const text = mode === 'recap' ? deputyRecapText(gig) : mode === 'update' ? deputyUpdateText(gig) : deputyRequestText(gig);
    const subject =
      mode === 'recap'
        ? t("{band}: you're confirmed for {event}", { band: ctx.bandName, event: ctx.eventTitle })
        : mode === 'update'
          ? t('{band}: {event} has changed', { band: ctx.bandName, event: ctx.eventTitle })
          : t('{band}: deputy for {event}', { band: ctx.bandName, event: ctx.eventTitle });
    const url =
      via === 'whatsapp'
        ? whatsappUrl(d.phone || '', text)
        : via === 'sms'
          ? smsUrl(d.phone || '', text)
          : emailUrl(d.email || '', subject, text);
    if (popup) popup.location.href = url;
    else void openExternal(url);
    if (!req || req.status === 'cancelled') {
      void loadRequests();
      onRequestsChange?.();
    }
  };

  const cancel = async (r: DeputyRequest) => {
    setBusy(r.deputy_id);
    const { error: e } = await cancelDeputyRequest(r.id);
    setBusy(null);
    if (e) setError(t('Could not cancel the request. Try again.'));
    await loadRequests();
    onRequestsChange?.();
  };

  const copyLink = async (r: DeputyRequest) => {
    try {
      await navigator.clipboard.writeText(deputyReplyUrl(r.token));
      setCopied(r.id);
      window.setTimeout(() => setCopied((c) => (c === r.id ? null : c)), 2000);
    } catch {
      setError(t('Could not copy the link.'));
    }
  };

  const sendLabel: Record<Mode, string> = {
    request: t('Send request'),
    recap: t('Send recap'),
    update: t('Send update'),
  };

  return (
    <BwSheet
      open={open}
      onClose={onClose}
      overline={member ? `${t('Replacing {name}', { name: member.name })}${role ? ` · ${role}` : ''}` : ctx.eventTitle}
      title={t('Find a deputy')}
      zIndex={120}
    >
      <div className="@container flex flex-col gap-3">
        <p className="bw-body-sm text-sheet-foreground/80">
          {noLinks
            ? t('Send a request for {event} · {date}. It opens WhatsApp, Messages or Mail with the details filled in.', { event: ctx.eventTitle, date: ctx.dateLabel })
            : t('Send a request for {event} · {date}. It opens WhatsApp, Messages or Mail with the details and a link: the deputy answers in one tap, no app needed, and you get a notification.', { event: ctx.eventTitle, date: ctx.dateLabel })}
        </p>
        {error && (
          <p role="alert" className="bw-body-sm text-destructive">
            {error}
          </p>
        )}
        {deputies == null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-sheet-foreground/70" />
          </div>
        ) : unavailable ? (
          <p className="bw-body-sm text-sheet-foreground/80 py-4">{t('The deputies list will be available as soon as the server is updated.')}</p>
        ) : failed ? (
          <p role="alert" className="bw-body-sm text-destructive py-4">{t('Could not load the deputies. Try again.')}</p>
        ) : ranked.length === 0 ? (
          <div className="flex flex-col gap-3 py-4">
            <p className="bw-body-sm text-sheet-foreground/80">{t('No deputies yet. Add them in Band members → Deputies.')}</p>
            {onManage && (
              <PillButton variant="white" size="md" onClick={onManage}>
                {t('Add deputies')}
              </PillButton>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-1 @min-[600px]:grid-cols-2 gap-2" aria-label={t('Deputies')}>
            {ranked.map((d) => {
              const req = latest[d.id];
              const mode = deputyMessageMode(req);
              const active = !!req && req.status !== 'cancelled';
              return (
                <li key={d.id} className="rounded-[16px] bg-sheet-foreground/[0.08] p-3 flex flex-col gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="bw-label-md truncate">{d.name}</span>
                      <span className="bw-body-sm text-sheet-foreground/70 truncate">
                        {[d.instrument, d.default_fee ? t('usual fee {fee}', { fee: formatFee(d.default_fee) }) : null, d.notes].filter(Boolean).join(' · ') || t('Deputy')}
                      </span>
                    </span>
                    {busy === d.id && <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-1" />}
                  </div>
                  {req && (
                    <div className="flex flex-col gap-1" role="status">
                      <span className="flex items-center gap-2 bw-label-sm">
                        <span
                          aria-hidden="true"
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            background:
                              req.status === 'available'
                                ? 'var(--success)'
                                : req.status === 'unavailable'
                                  ? 'var(--destructive-solid)'
                                  : req.status === 'cancelled'
                                    ? 'currentColor'
                                    : 'var(--warning)',
                            opacity: req.status === 'cancelled' ? 0.4 : 1,
                          }}
                        />
                        {t(DEPUTY_STATUS_LABEL[req.status])}
                      </span>
                      {req.reply_note && <span className="bw-body-sm text-sheet-foreground/80">“{req.reply_note}”</span>}
                      {mode === 'update' && (
                        <span className="bw-body-sm text-sheet-foreground">{t('The gig changed after their answer: send them the update.')}</span>
                      )}
                    </div>
                  )}
                  {d.phone || d.email ? (
                    <div className="flex flex-col gap-2">
                      {req && <span className="bw-label-xs text-sheet-foreground/70 uppercase">{sendLabel[mode]}</span>}
                      <div className="flex flex-wrap gap-2">
                        {d.phone && (
                          <PillButton size="sm" variant="primary" fullWidth={false} disabled={!!busy} icon={<MessageCircle className="w-4 h-4" />} onClick={() => void send(d, 'whatsapp')}>
                            WhatsApp
                          </PillButton>
                        )}
                        {d.phone && (
                          <PillButton size="sm" variant="white" fullWidth={false} disabled={!!busy} icon={<MessageSquare className="w-4 h-4" />} onClick={() => void send(d, 'sms')}>
                            SMS
                          </PillButton>
                        )}
                        {d.email && (
                          <PillButton size="sm" variant="white" fullWidth={false} disabled={!!busy} icon={<Mail className="w-4 h-4" />} onClick={() => void send(d, 'email')}>
                            {t('Email')}
                          </PillButton>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="bw-body-sm text-sheet-foreground/70">{t('Add a phone or email to contact them.')}</p>
                  )}
                  {active && req && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <button type="button" className="bw-label-sm underline underline-offset-2 min-h-[32px]" onClick={() => void copyLink(req)}>
                        {copied === req.id ? t('Link copied') : t('Copy link')}
                      </button>
                      <button type="button" className="bw-label-sm underline underline-offset-2 min-h-[32px]" disabled={!!busy} onClick={() => void cancel(req)}>
                        {t('Cancel request')}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </BwSheet>
  );
};
