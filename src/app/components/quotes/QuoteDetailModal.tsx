import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Copy, Edit2, Send, Share2, Trash2, X } from '@/app/components/icons';
import { Quote, getEventTypeLabel } from '@/app/data/quotes';
import { WeatherWidget } from '@/app/components/ui/WeatherWidget';
import { useBand } from '@/lib/BandContext';
import { QuoteShareModal } from './QuoteShareModal';
import { totalsForQuote, formatQuoteMoney } from '@/lib/services/quoteMath';
import { parseLocalDate } from '@/lib/dates';
import { currencySymbol } from '@/lib/currency';
import { DotText } from '@/app/components/bw';
import { useRailOwnsChrome } from '@/lib/railActions';
import { cn } from '@/app/components/ui/utils';
import { IconButton, NavBackButton, Tag, Card } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';
import { OnlineDepositLinks } from '@/app/components/quotes/OnlineDeposit';
import { useT } from '@/lib/i18n';

interface QuoteDetailModalProps {
  quote: Quote;
  onClose: () => void;
  onEdit?: (quote: Quote) => void;
  onSend?: (quote: Quote) => void;
  onDuplicate?: (quote: Quote) => void;
  onDelete?: (quote: Quote) => void;
  /** Client outcome recorded by the band: accepted or declined. */
  onSetOutcome?: (quote: Quote, outcome: 'ACCEPTED' | 'DECLINED') => void;
  /** A draft was shared from here and is now SENT. */
  onSent?: (quote: Quote) => void;
  onOpenBandSettings?: () => void;
}

const getCurrencySym = (currency?: string): string => currencySymbol(currency || 'EUR');

/** Figma "Event detail" key/value row: Body/MD label, Label/MD value. */
const KeyValueRow: React.FC<{ label: React.ReactNode; value: React.ReactNode; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex items-baseline justify-between gap-3 min-w-0">
    {strong ? (
      <span className="bw-label-sm text-foreground">{label}</span>
    ) : (
      <span className="bw-body-md text-muted-foreground min-w-0 [overflow-wrap:anywhere]">{label}</span>
    )}
    <span className={strong ? 'bw-value-md text-foreground shrink-0' : 'bw-label-md text-foreground shrink-0 text-right'}>{value}</span>
  </div>
);

export const QuoteDetailModal: React.FC<QuoteDetailModalProps> = ({
  quote,
  onClose,
  onEdit,
  onSend,
  onDuplicate,
  onDelete,
  onSetOutcome,
  onSent,
  onOpenBandSettings,
}) => {
  const t = useT();
  const { selectedBand } = useBand();
  const railChrome = useRailOwnsChrome();
  const [isShareOpen, setIsShareOpen] = useState(false);
  const canEdit = quote.status === 'DRAFT' || quote.status === 'SENT';
  const sym = getCurrencySym(quote.currency);
  const money = (n: number) => formatQuoteMoney(n, sym);

  const eventDate = quote.eventDate ? parseLocalDate(quote.eventDate) : null;
  const hasDate = !!eventDate && !isNaN(eventDate.getTime());

  // Same shared math as the wizard and the PDF, so the amounts always agree
  // (falls back to the stored total only for legacy rows without a subtotal / line items)
  const hasMath = (quote.subtotal || 0) > 0 || (quote.lineItems?.length || 0) > 0;
  const totals = totalsForQuote(quote);
  const displayTotal = hasMath ? totals.total : quote.total || 0;

  const STATUS_LABEL: Record<string, string> = {
    DRAFT: t('Draft'),
    SENT: t('Sent'),
    ACCEPTED: t('Accepted'),
    DECLINED: t('Declined'),
    EXPIRED: t('Expired'),
    NEGOTIATING: t('Negotiating'),
    ARCHIVED: t('Archived'),
  };

  const displayTitle = quote.eventTitle || quote.eventName || t('Untitled');
  const eventTypeLabel = quote.eventType ? getEventTypeLabel(quote.eventType) : '';
  const statusLabel = STATUS_LABEL[quote.status] || quote.status;
  const venueName = quote.venueName || quote.venueCity || t('Venue TBD');
  const venueAddress = [quote.venueAddress, quote.venueName ? quote.venueCity : ''].filter(Boolean).join(', ');

  const heroDay = hasDate ? String(eventDate!.getDate()).padStart(2, '0') : '--';
  const heroMonth = hasDate ? eventDate!.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : t('TBD');
  const heroDateTime = [
    hasDate
      ? eventDate!.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : t('Date TBD'),
    quote.eventTimeStart ? (quote.eventTimeEnd ? `${quote.eventTimeStart} – ${quote.eventTimeEnd}` : quote.eventTimeStart) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  // Line items: stored line items first, otherwise the wizard's sets + custom items.
  const itemRows: { id: string; label: string; amount: number }[] =
    quote.lineItems && quote.lineItems.length > 0
      ? quote.lineItems.map((li) => ({
          id: li.id,
          label: li.quantity > 1 ? `${li.description} × ${li.quantity}` : li.description,
          amount: (li.unitPrice || 0) * (li.quantity || 1),
        }))
      : [
          ...(quote.selectedMoments || []).map((m) => ({ id: `m-${m.id}`, label: m.name, amount: m.price || 0 })),
          ...(quote.customItems || []).map((c) => ({
            id: `c-${c.id}`,
            label: c.description || c.name || t('Custom item'),
            amount: (c.amount ?? c.price ?? 0) * (c.quantity || 1),
          })),
        ];

  const vatRate = quote.vatExempt || quote.reverseCharge ? 0 : quote.vatRate || 0;
  const dp = quote.depositPercentage || 30;

  // Validity: days left until validUntil.
  const validUntil = quote.validUntil ? parseLocalDate(quote.validUntil) : null;
  const validDays =
    validUntil && !isNaN(validUntil.getTime())
      ? Math.ceil((validUntil.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
      : null;
  const validLabel =
    validDays == null
      ? null
      : validDays < 0
        ? t('Expired')
        : validDays === 0
          ? t('Valid today')
          : validDays === 1
            ? t('Valid {count} day', { count: validDays })
            : t('Valid {count} days', { count: validDays });

  const sentAt = quote.sentAt ? new Date(quote.sentAt) : null;
  const sentLine =
    sentAt && !isNaN(sentAt.getTime())
      ? `${
          quote.clientEmail
            ? t('Sent to {email} on {date}', {
                email: quote.clientEmail,
                date: sentAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              })
            : t('Sent on {date}', { date: sentAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })
        }${quote.viewedAt ? ` · ${t('opened')}` : ''}`
      : quote.status === 'DRAFT'
        ? t('Draft · not sent yet')
        : null;

  const clientRows = [
    quote.clientCompany ? { label: t('Company'), value: quote.clientCompany } : null,
    { label: t('Contact'), value: quote.clientName || t('Client TBD') },
    quote.clientEmail ? { label: t('Email'), value: quote.clientEmail } : null,
    { label: t('Guests'), value: quote.guestCount ? `~${quote.guestCount}` : t('TBD') },
    {
      label: t('Musicians'),
      value: String(quote.musicians?.length || quote.musicianCount || 1),
    },
  ].filter(Boolean) as { label: string; value: string }[];

  const heroChipStyle: React.CSSProperties = { backgroundColor: 'var(--accent-quote-fg)', color: 'var(--accent-quote)' };
  const heroTintStyle: React.CSSProperties = { backgroundColor: 'color-mix(in srgb, currentColor 14%, transparent)' };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="bw-pane-backdrop fixed inset-0 z-[110] bg-background"
      />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        // iPhone Duo: the quote colour runs under the rail (Figma "Event detail / Quote").
        className={cn(
          'bw-pane-detail fixed inset-0 z-[120] flex flex-col overflow-y-auto overscroll-contain text-foreground',
          railChrome ? 'bg-accent-quote' : 'bg-background',
        )}
      >
        {/* ═══ HERO (quote colour) ═══ */}
        <header className="w-full bg-accent-quote text-accent-quote-foreground">
          <div
            className="max-w-[640px] mx-auto w-full px-4 pb-14 flex flex-col gap-5"
            style={{ paddingTop: 'calc(var(--wizard-header-pt, max(var(--safe-top), 44px)) + 4px)' }}
          >
            <div className="flex items-center justify-between gap-2 min-h-11 empty:hidden">
              <NavBackButton pane variant="event" onClick={onClose} />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center whitespace-nowrap" style={heroChipStyle}>
                    {t('Quote')}
                  </span>
                  <span className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center whitespace-nowrap" style={heroChipStyle}>
                    {statusLabel}
                  </span>
                  {eventTypeLabel && (
                    <span className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center whitespace-nowrap" style={heroTintStyle}>
                      {eventTypeLabel}
                    </span>
                  )}
                </div>
                <h1 className="bw-display-lg [overflow-wrap:anywhere]">{displayTitle}</h1>
              </div>
              <div
                className="shrink-0 flex flex-col items-end gap-1.5"
                style={{ '--dot-off': 'color-mix(in srgb, currentColor 18%, transparent)' } as React.CSSProperties}
              >
                <DotText text={heroDay} size={48} showGrid label={hasDate ? eventDate!.toDateString() : t('Date TBD')} />
                <span className="bw-label-xs">{heroMonth}</span>
              </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div className="flex-1 min-w-0 flex flex-col items-start gap-1.5">
                <span className="bw-label-md truncate max-w-full">{venueName}</span>
                {venueAddress && <span className="bw-label-xs opacity-70 truncate max-w-full">{venueAddress}</span>}
                <span className="mt-1.5 min-h-6 px-2 py-1 rounded-[6px] bw-label-xs inline-block max-w-full leading-[16px]" style={heroTintStyle}>
                  {heroDateTime}
                </span>
              </div>
              <div className="shrink-0">
                <WeatherWidget
                  eventDate={quote.eventDate}
                  location={quote.venueCity || quote.venueName}
                  textColor="var(--accent-quote-fg)"
                  className="bg-transparent border-0 rounded-none p-0 min-w-0 max-w-[150px] justify-end"
                />
              </div>
            </div>
          </div>
        </header>

        {/* ═══ CONTENT SHEET ═══ */}
        <div className="relative -mt-8 rounded-t-[32px] bg-background flex-1">
          <div
            className="max-w-[640px] mx-auto w-full px-4 pt-5 flex flex-col gap-8"
            style={{ paddingBottom: 'calc(var(--safe-bottom) + 32px)' }}
          >
            {/* Total */}
            <section className="dark bg-sheet text-sheet-foreground rounded-[24px] p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="bw-label-xs text-sheet-foreground/85 truncate">
                  {t('Quote')}{quote.quoteNumber ? ` ${quote.quoteNumber}` : ''}
                </span>
                {validLabel && <Tag variant={validDays != null && validDays < 0 ? 'subtle' : 'accent'}>{validLabel}</Tag>}
              </div>
              <DotText text={money(displayTotal)} size={34} label={money(displayTotal)} />
              <p className="bw-body-sm text-sheet-foreground/80">
                {[sentLine, t('Deposit {percent}% · {amount}', { percent: dp, amount: money((displayTotal * dp) / 100) })].filter(Boolean).join(' · ')}
              </p>
            </section>

            {/* Online deposit (Stripe / PayPal): visible, off during the alpha */}
            {quote.depositRequired !== false && dp > 0 && (
              <OnlineDepositLinks amount={money((displayTotal * dp) / 100)} />
            )}

            {/* Line items */}
            <section className="flex flex-col gap-4">
              <h2 className="bw-h1">{t('Line items')}</h2>
              <Card>
                {itemRows.map((row) => (
                  <KeyValueRow key={row.id} label={row.label} value={money(row.amount)} />
                ))}
                {itemRows.length > 0 && <hr className="border-0 h-px bg-border" />}
                <KeyValueRow label={t('Subtotal')} value={money(hasMath ? totals.subtotal : displayTotal)} />
                {hasMath && totals.discount > 0 && <KeyValueRow label={t('Discount')} value={`−${money(totals.discount)}`} />}
                {hasMath && <KeyValueRow label={t('VAT {rate}%', { rate: vatRate })} value={money(totals.vat)} />}
                <KeyValueRow label={t('Total')} value={money(displayTotal)} strong />
              </Card>
            </section>

            {/* Client */}
            <section className="flex flex-col gap-4">
              <h2 className="bw-h1">{t('Client')}</h2>
              <Card>
                {clientRows.map((row) => (
                  <KeyValueRow key={row.label} label={row.label} value={row.value} />
                ))}
              </Card>
            </section>

            {/* Actions */}
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2">
                <PillButton
                  variant="outline"
                  size="lg"
                  icon={<Edit2 className="w-4 h-4" />}
                  disabled={!canEdit || !onEdit}
                  onClick={() => canEdit && onEdit?.(quote)}
                >
                  {t('Edit quote')}
                </PillButton>
                <PillButton size="lg" icon={<Share2 className="w-4 h-4" />} onClick={() => setIsShareOpen(true)}>
                  {t('Share quote')}
                </PillButton>
              </div>
              {quote.status === 'DRAFT' && onSend && (
                <PillButton variant="outline" size="lg" icon={<Send className="w-4 h-4" />} onClick={() => onSend(quote)}>
                  {t('Mark as sent')}
                </PillButton>
              )}
              {onSetOutcome && ['SENT', 'VIEWED', 'NEGOTIATING'].includes(quote.status) && (
                <div className="flex flex-col gap-2">
                  <span className="bw-label-sm text-muted-foreground">{t('Client answer')}</span>
                  <div className="grid grid-cols-2 gap-2">
                    <PillButton variant="outline" size="lg" icon={<X className="w-4 h-4" />} onClick={() => onSetOutcome(quote, 'DECLINED')}>
                      {t('Declined')}
                    </PillButton>
                    <PillButton size="lg" icon={<Check className="w-4 h-4" />} onClick={() => onSetOutcome(quote, 'ACCEPTED')}>
                      {t('Accepted')}
                    </PillButton>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {onDuplicate && (
                  <button
                    type="button"
                    onClick={() => onDuplicate(quote)}
                    className="inline-flex items-center gap-1.5 min-h-11 px-3 bw-button-sm text-foreground"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {t('Duplicate')}
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(quote)}
                    className="inline-flex items-center gap-1.5 min-h-11 px-3 bw-button-sm text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('Delete this quote')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <QuoteShareModal
        isOpen={isShareOpen}
        quote={quote}
        bandId={selectedBand?.id}
        bandName={selectedBand?.name}
        onClose={() => setIsShareOpen(false)}
        onOpenBandSettings={onOpenBandSettings}
        onSent={() => onSent?.({ ...quote, status: 'SENT' })}
      />
    </>
  );
};
