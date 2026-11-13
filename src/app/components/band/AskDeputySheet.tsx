import React from 'react';
import { Loader2, Mail, MessageCircle, MessageSquare } from '@/app/components/icons';
import { BwSheet } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';
import { openExternal } from '@/lib/nativeFiles';
import {
  deputiesUnavailable,
  deputyRequestText,
  emailUrl,
  listDeputies,
  rankDeputies,
  smsUrl,
  whatsappUrl,
  type Deputy,
} from '@/lib/services/deputies';
import { useT } from '@/lib/i18n';

export interface DeputyRequestContext {
  bandId: string;
  bandName: string;
  eventTitle: string;
  dateLabel: string;
  timeLabel?: string | null;
  venue?: string | null;
}

/**
 * "Find a deputy" for a member who declined a gig: the band's deputies, the
 * same instrument first, each with WhatsApp / SMS / Email and a ready-made
 * request (date, venue, fee). Sent by the admin from their own phone.
 */
export const AskDeputySheet: React.FC<{
  open: boolean;
  onClose: () => void;
  ctx: DeputyRequestContext;
  /** The member being replaced. */
  member: { name: string; role?: string | null; feeLabel?: string | null } | null;
  onManage?: () => void;
  /** Money in the band's currency (a deputy's usual fee). */
  formatFee?: (n: number) => string;
}> = ({ open, onClose, ctx, member, onManage, formatFee = (n) => String(n) }) => {
  const t = useT();
  const [deputies, setDeputies] = React.useState<Deputy[] | null>(null);
  const [unavailable, setUnavailable] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [sent, setSent] = React.useState<Record<string, true>>({});

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setDeputies(null);
    setFailed(false);
    void listDeputies(ctx.bandId).then(({ data, error }) => {
      if (!alive) return;
      if (deputiesUnavailable(error)) setUnavailable(true);
      else if (error) setFailed(true);
      setDeputies(error ? [] : data);
    });
    return () => {
      alive = false;
    };
  }, [open, ctx.bandId]);

  const ranked = React.useMemo(() => rankDeputies(deputies || [], member?.role), [deputies, member?.role]);
  const role = member?.role && !/^member$/i.test(member.role) ? member.role : null;

  const send = (d: Deputy, via: 'whatsapp' | 'sms' | 'email') => {
    const text = deputyRequestText({
      deputyName: d.name,
      bandName: ctx.bandName,
      eventTitle: ctx.eventTitle,
      dateLabel: ctx.dateLabel,
      timeLabel: ctx.timeLabel,
      venue: ctx.venue,
      role,
      fee: member?.feeLabel || (d.default_fee ? formatFee(d.default_fee) : null),
    });
    const url =
      via === 'whatsapp'
        ? whatsappUrl(d.phone || '', text)
        : via === 'sms'
          ? smsUrl(d.phone || '', text)
          : emailUrl(d.email || '', t('{band}: deputy for {event}', { band: ctx.bandName, event: ctx.eventTitle }), text);
    setSent((s) => ({ ...s, [d.id]: true }));
    void openExternal(url);
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
          {t('Send a request for {event} · {date}. It opens WhatsApp, Messages or Mail with the details filled in.', { event: ctx.eventTitle, date: ctx.dateLabel })}
        </p>
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
            {ranked.map((d) => (
              <li key={d.id} className="rounded-[16px] bg-sheet-foreground/[0.08] p-3 flex flex-col gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="bw-label-md truncate">{d.name}</span>
                    <span className="bw-body-sm text-sheet-foreground/70 truncate">
                      {[d.instrument, d.default_fee ? t('usual fee {fee}', { fee: formatFee(d.default_fee) }) : null, d.notes].filter(Boolean).join(' · ') || t('Deputy')}
                    </span>
                  </span>
                  {sent[d.id] && <span className="bw-label-sm text-sheet-foreground/70 shrink-0">{t('Sent')}</span>}
                </div>
                {d.phone || d.email ? (
                  <div className="flex flex-wrap gap-2">
                    {d.phone && (
                      <PillButton size="sm" variant="primary" fullWidth={false} icon={<MessageCircle className="w-4 h-4" />} onClick={() => send(d, 'whatsapp')}>
                        WhatsApp
                      </PillButton>
                    )}
                    {d.phone && (
                      <PillButton size="sm" variant="white" fullWidth={false} icon={<MessageSquare className="w-4 h-4" />} onClick={() => send(d, 'sms')}>
                        SMS
                      </PillButton>
                    )}
                    {d.email && (
                      <PillButton size="sm" variant="white" fullWidth={false} icon={<Mail className="w-4 h-4" />} onClick={() => send(d, 'email')}>
                        {t('Email')}
                      </PillButton>
                    )}
                  </div>
                ) : (
                  <p className="bw-body-sm text-sheet-foreground/70">{t('Add a phone or email to contact them.')}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </BwSheet>
  );
};
