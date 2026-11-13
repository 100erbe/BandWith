import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { dbQuoteToAppQuote } from '@/lib/services/quotes';
import type { Quote as AppQuote } from '@/app/data/quotes';
import { totalsForQuote, formatQuoteMoney } from '@/lib/services/quoteMath';
import { currencySymbol, getActiveSymbol } from '@/lib/currency';
import { DotText } from '@/app/components/bw';
import { Tag } from '@/app/components/bw/Screen';
import { KeyValueRow, SectionTitle } from './parts';
import { daysUntil, formatStampShort } from './format';
import { useT, intlLocale } from '@/lib/i18n';
import { builtinText } from '@/lib/i18n/builtins';

/**
 * The quote saved with an event: by events.quote_id when set, otherwise the
 * latest quote converted to this event (quotes.converted_to_event_id).
 */
export function useLinkedQuote(eventId: string | undefined, quoteId: string | undefined, enabled: boolean) {
  const [quote, setQuote] = useState<AppQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || (!eventId && !quoteId)) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const base = supabase.from('quotes').select('*, musicians:quote_musicians(*)');
    const query = quoteId
      ? base.eq('id', quoteId).limit(1)
      : base.eq('converted_to_event_id', eventId as string).order('created_at', { ascending: false }).limit(1);
    query.then(({ data, error: qErr }) => {
      if (cancelled) return;
      setLoading(false);
      if (qErr) {
        setError(qErr.message);
        return;
      }
      setQuote(data?.[0] ? dbQuoteToAppQuote(data[0] as any) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, quoteId, enabled]);

  return { quote, loading, error };
}

interface QuoteMath {
  money: (n: number) => string;
  total: number;
  subtotal: number;
  discount: number;
  vat: number;
  vatRate: number;
  hasMath: boolean;
  itemRows: { id: string; label: string; amount: number }[];
}

/** Same math and line-item rules as QuoteDetailModal / the PDF. */
const quoteMath = (quote: AppQuote | null, fallbackTotal: number, t: ReturnType<typeof useT>): QuoteMath => {
  const sym = quote?.currency ? currencySymbol(quote.currency) : getActiveSymbol();
  const money = (n: number) => formatQuoteMoney(n, sym, intlLocale('en-US'));
  if (!quote) {
    return { money, total: fallbackTotal, subtotal: fallbackTotal, discount: 0, vat: 0, vatRate: 0, hasMath: false, itemRows: [] };
  }
  const hasMath = (quote.subtotal || 0) > 0 || (quote.lineItems?.length || 0) > 0;
  const totals = totalsForQuote(quote);
  const total = hasMath ? totals.total : quote.total || fallbackTotal;
  const itemRows =
    quote.lineItems && quote.lineItems.length > 0
      ? quote.lineItems.map((li) => ({
          id: li.id,
          label: li.quantity > 1 ? `${builtinText(li.description)} × ${li.quantity}` : builtinText(li.description),
          amount: (li.unitPrice || 0) * (li.quantity || 1),
        }))
      : [
          ...(quote.selectedMoments || []).map((m) => ({ id: `m-${m.id}`, label: builtinText(m.name), amount: m.price || 0 })),
          ...(quote.customItems || []).map((c) => ({
            id: `c-${c.id}`,
            label: builtinText(c.description || c.name) || t('Custom item'),
            amount: (c.amount ?? c.price ?? 0) * (c.quantity || 1),
          })),
        ];
  return {
    money,
    total,
    subtotal: hasMath ? totals.subtotal : total,
    discount: hasMath ? totals.discount : 0,
    vat: hasMath ? totals.vat : 0,
    vatRate: quote.vatExempt || quote.reverseCharge ? 0 : quote.vatRate || 0,
    hasMath,
    itemRows,
  };
};

/** Dark quote card (Figma 23:862): number, validity, total, sent / opened. */
export const QuoteSummaryCard: React.FC<{
  quote: AppQuote | null;
  loading: boolean;
  error: string | null;
  fallbackTotal: number;
}> = ({ quote, loading, error, fallbackTotal }) => {
  const t = useT();
  const m = quoteMath(quote, fallbackTotal, t);
  const validDays = daysUntil(quote?.validUntil);
  const validLabel =
    validDays == null
      ? null
      : validDays < 0
        ? t('EXPIRED')
        : validDays === 0
          ? t('VALID TODAY')
          : validDays === 1
            ? t('VALID {count} DAY', { count: validDays })
            : t('VALID {count} DAYS', { count: validDays });
  const sent = formatStampShort(quote?.sentAt);
  const opened = formatStampShort(quote?.viewedAt);
  const sentLine = sent
    ? quote?.clientEmail
      ? opened
        ? t('Sent to {email} on {date} · opened {opened}', { email: quote.clientEmail, date: sent, opened })
        : t('Sent to {email} on {date}', { email: quote.clientEmail, date: sent })
      : opened
        ? t('Sent on {date} · opened {opened}', { date: sent, opened })
        : t('Sent on {date}', { date: sent })
    : quote?.status === 'DRAFT'
      ? t('Draft · not sent yet')
      : null;

  return (
    <section className="dark bg-sheet text-sheet-foreground rounded-[16px] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="bw-label-sm truncate">{quote?.quoteNumber ? t('QUOTE {number}', { number: quote.quoteNumber }) : t('QUOTE')}</span>
        {validLabel && <Tag variant={validDays != null && validDays < 0 ? 'subtle' : 'accent'}>{validLabel}</Tag>}
      </div>
      <DotText text={m.money(m.total)} size={32} label={m.money(m.total)} />
      {loading ? (
        <p className="bw-label-xs text-sheet-foreground/70">{t('LOADING QUOTE…')}</p>
      ) : error ? (
        <p role="alert" className="bw-body-sm text-destructive">{t('Could not load the quote: {error}', { error })}</p>
      ) : sentLine ? (
        <p className="bw-body-sm text-sheet-foreground/80 [overflow-wrap:anywhere]">{sentLine}</p>
      ) : null}
    </section>
  );
};

/** LINE ITEMS: items, Subtotal, VAT, TOTAL. */
export const QuoteLineItems: React.FC<{ quote: AppQuote | null; fallbackTotal: number }> = ({ quote, fallbackTotal }) => {
  const t = useT();
  const m = quoteMath(quote, fallbackTotal, t);
  if (!quote && fallbackTotal <= 0) return null;
  return (
    <section className="flex flex-col gap-6">
      <SectionTitle title={t('LINE ITEMS')} />
      <div className="bg-card rounded-[16px] p-4 flex flex-col gap-3">
        {m.itemRows.map((row) => (
          <KeyValueRow key={row.id} label={row.label} value={m.money(row.amount)} muted />
        ))}
        {m.itemRows.length > 0 && <hr className="border-0 h-px bg-border" />}
        <KeyValueRow label={t('Subtotal')} value={m.money(m.subtotal)} muted />
        {m.discount > 0 && <KeyValueRow label={t('Discount')} value={`−${m.money(m.discount)}`} muted />}
        {m.hasMath && <KeyValueRow label={t('VAT {rate}%', { rate: m.vatRate })} value={m.money(m.vat)} muted />}
        <KeyValueRow label={t('TOTAL')} value={m.money(m.total)} strong />
      </div>
    </section>
  );
};

/** CLIENT: Company / Contact / Guests (only what is known), then notes. */
export const QuoteClientSection: React.FC<{
  quote: AppQuote | null;
  fallback: { company?: string; contact?: string; guests?: number };
  notes?: string;
}> = ({ quote, fallback, notes }) => {
  const t = useT();
  const company = quote?.clientCompany || fallback.company;
  const contact = quote?.clientName || fallback.contact;
  const guests = quote?.guestCount || fallback.guests;
  const rows = [
    company ? { label: t('Company'), value: company } : null,
    contact ? { label: t('Contact'), value: contact } : null,
    guests ? { label: t('Guests'), value: `~${guests}` } : null,
  ].filter(Boolean) as { label: string; value: string }[];
  if (rows.length === 0 && !notes) return null;
  return (
    <section className="flex flex-col gap-6">
      <SectionTitle title={t('CLIENT')} />
      <div className="bg-card rounded-[16px] p-4 flex flex-col gap-3">
        {rows.map((r) => (
          <KeyValueRow key={r.label} label={r.label} value={r.value} muted />
        ))}
        {notes && <p className="bw-body-md whitespace-pre-wrap line-clamp-4 select-text">{notes}</p>}
      </div>
    </section>
  );
};
