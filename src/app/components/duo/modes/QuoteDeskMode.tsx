import React, { useMemo, useState } from 'react';
import { Minus, Plus, Send } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { findCountryPreset, money } from '@/lib/currency';
import { haptic } from '@/lib/haptics';
import { calculateDepositAmount, calculateQuoteTotals, type QuoteDiscountType } from '@/lib/services/quoteMath';
import type { Quote as AppQuote } from '@/app/data/quotes';
import { FoldSplit } from '../FoldSplit';
import { DeckButton, DeckHeading, ModeEmpty, dayLabel } from './shared';
import { t, useT } from '@/lib/i18n';

/**
 * Quote desk (a quote being edited, in Laptop pose). Display: the quote as
 * the client will read it (title, client, lines, totals) with the line being
 * edited highlighted. Deck: the lines with quantity steppers, "Add line",
 * discount / VAT and Send. Totals go through `calculateQuoteTotals`
 * (src/lib/services/quoteMath.ts), like the wizard, PDF and database.
 */

export interface QuoteDeskLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** False for lines whose quantity cannot change (e.g. a set or moment). */
  adjustable?: boolean;
}

/**
 * Lines of an app quote (src/app/data/quotes.ts), in the same order as the
 * quote detail: stored line items first, else the sets/moments and custom items.
 */
export function quoteDeskLinesFromQuote(q: Partial<Pick<AppQuote, 'lineItems' | 'selectedMoments' | 'customItems'>>): QuoteDeskLine[] {
  if (q.lineItems && q.lineItems.length > 0) {
    return q.lineItems.map((li) => ({
      id: li.id,
      description: li.description,
      quantity: li.quantity || 1,
      unitPrice: li.unitPrice || 0,
    }));
  }
  return [
    ...(q.selectedMoments || [])
      .filter((m) => m.included !== false)
      .map((m) => ({ id: `m-${m.id}`, description: m.name, quantity: 1, unitPrice: m.price || 0, adjustable: false })),
    ...(q.customItems || []).map((c) => ({
      id: `c-${c.id}`,
      description: c.description || c.name || t('Custom item'),
      quantity: c.quantity || 1,
      unitPrice: c.amount ?? c.price ?? 0,
    })),
  ];
}

export interface QuoteDeskModeProps {
  title: string;
  quoteNumber?: string;
  clientName?: string;
  clientCompany?: string;
  /** YYYY-MM-DD */
  eventDate?: string;
  venue?: string;
  lines: QuoteDeskLine[];
  discountType?: QuoteDiscountType;
  discountValue?: number;
  vatRate?: number;
  vatExempt?: boolean;
  reverseCharge?: boolean;
  /** Country code of the billing country, for the tax label (IVA, MwSt…). */
  billingCountry?: string;
  depositPercentage?: number;
  /** Controlled highlighted line; otherwise the last one touched on the Deck. */
  activeLineId?: string | null;
  onActiveLineChange?: (id: string) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onAddLine?: () => void;
  onSend?: () => void;
  sending?: boolean;
  /** e.g. no client email yet. */
  sendDisabled?: boolean;
  /** See FoldSplit. Default 105: over the quote wizard / detail layer (100). */
  zIndex?: number;
}

export const QuoteDeskMode: React.FC<QuoteDeskModeProps> = ({
  title,
  quoteNumber,
  clientName,
  clientCompany,
  eventDate,
  venue,
  lines,
  discountType = 'none',
  discountValue = 0,
  vatRate = 0,
  vatExempt = false,
  reverseCharge = false,
  billingCountry,
  depositPercentage,
  activeLineId,
  onActiveLineChange,
  onQuantityChange,
  onAddLine,
  onSend,
  sending,
  sendDisabled,
  zIndex = 105,
}) => {
  const t = useT();
  const [touched, setTouched] = useState<string | null>(null);
  const active = activeLineId !== undefined ? activeLineId : touched;
  const focus = (id: string) => {
    setTouched(id);
    onActiveLineChange?.(id);
  };

  const totals = useMemo(
    () =>
      calculateQuoteTotals({
        lineItems: lines.map((l) => ({ amount: l.unitPrice, quantity: l.quantity })),
        discountType,
        discountValue,
        vatRate,
        vatExempt,
        reverseCharge,
      }),
    [lines, discountType, discountValue, vatRate, vatExempt, reverseCharge],
  );
  const taxLabel = findCountryPreset(billingCountry)?.taxLabel ?? t('VAT');
  const taxLine = vatExempt
    ? t('{tax} exempt', { tax: taxLabel })
    : reverseCharge
      ? t('{tax} reverse charge', { tax: taxLabel })
      : `${taxLabel} ${vatRate}%`;
  const discountLine =
    discountType === 'percentage' && discountValue > 0
      ? t('Discount {value}%', { value: discountValue })
      : discountType === 'fixed' && discountValue > 0
        ? t('Discount')
        : null;
  const deposit = depositPercentage && depositPercentage > 0 ? calculateDepositAmount(totals.total, depositPercentage) : null;

  const step = (l: QuoteDeskLine, delta: number) => {
    const next = Math.max(1, l.quantity + delta);
    focus(l.id);
    if (next === l.quantity) return;
    haptic.tap();
    onQuantityChange(l.id, next);
  };

  const display = (
    <div className="bw-fold-pad flex flex-col gap-4 pt-3 pb-4">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="bw-label-sm uppercase text-muted-foreground">{t('Quote')}{quoteNumber ? ` · ${quoteNumber}` : ''}</p>
          <h1 className="bw-h2 [overflow-wrap:anywhere]">{title || t('Untitled quote')}</h1>
          <p className="bw-body-sm text-muted-foreground">
            {[clientCompany || clientName, dayLabel(eventDate), venue].filter(Boolean).join(' · ') || t('Client not set')}
          </p>
        </div>
        <p className="flex flex-col items-end shrink-0">
          <span className="bw-label-sm uppercase text-muted-foreground">{t('Total')}</span>
          <span className="bw-value-lg tabular-nums">{money(totals.total, 'auto')}</span>
        </p>
      </header>
      {lines.length === 0 ? (
        <ModeEmpty title={t('No lines yet')} detail={t('Add a line on the Deck.')} className="py-2" />
      ) : (
        <ul className="flex flex-col">
          {lines.map((l) => {
            const isActive = l.id === active;
            return (
              <li
                key={l.id}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'flex items-baseline justify-between gap-4 py-2 border-b border-border transition-colors',
                  isActive && 'bg-accent text-accent-foreground -mx-2 px-2 rounded-[12px] border-transparent',
                )}
              >
                <span className="bw-body-md min-w-0 [overflow-wrap:anywhere]">
                  {l.description}
                  {l.quantity > 1 && <span className="opacity-60"> × {l.quantity}</span>}
                </span>
                <span className="bw-body-md tabular-nums shrink-0">{money(l.unitPrice * l.quantity, 'auto')}</span>
              </li>
            );
          })}
        </ul>
      )}
      <dl className="flex flex-col gap-1 bw-body-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">{t('Subtotal')}</dt><dd className="tabular-nums">{money(totals.subtotal, 'auto')}</dd></div>
        {discountLine && (
          <div className="flex justify-between"><dt className="text-muted-foreground">{discountLine}</dt><dd className="tabular-nums">−{money(totals.discount, 'auto')}</dd></div>
        )}
        <div className="flex justify-between"><dt className="text-muted-foreground">{taxLine}</dt><dd className="tabular-nums">{money(totals.vat, 'auto')}</dd></div>
        <div className="flex justify-between bw-h3 pt-1"><dt>{t('Total')}</dt><dd className="tabular-nums">{money(totals.total, 'auto')}</dd></div>
        {deposit !== null && (
          <div className="flex justify-between"><dt className="text-muted-foreground">{t('Deposit {percent}%', { percent: depositPercentage ?? 0 })}</dt><dd className="tabular-nums">{money(deposit, 'auto')}</dd></div>
        )}
      </dl>
    </div>
  );

  const deck = (
    <div className="min-h-full flex flex-col gap-3 px-4 pt-3 pb-3">
      <DeckHeading
        trailing={
          onAddLine ? (
            <button
              type="button"
              onClick={() => { haptic.tap(); onAddLine(); }}
              className="h-9 px-3 rounded-full bg-muted bw-button-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> {t('Add line')}
            </button>
          ) : undefined
        }
      >
        {t('Lines')}
      </DeckHeading>
      {lines.length === 0 ? (
        <ModeEmpty title={t('No lines')} className="py-2" />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {lines.map((l) => {
            const isActive = l.id === active;
            const adjustable = l.adjustable !== false;
            return (
              <li
                key={l.id}
                className={cn('flex items-center gap-2 rounded-[16px] bg-muted pl-3 pr-1.5 py-1.5 min-h-14', isActive && 'ring-2 ring-foreground')}
              >
                <button type="button" onClick={() => focus(l.id)} className="flex-1 min-w-0 text-left cursor-pointer">
                  <span className="block bw-body-md font-semibold truncate">{l.description}</span>
                  <span className="block bw-body-sm text-muted-foreground tabular-nums">{t('{price} each', { price: money(l.unitPrice, 'auto') })}</span>
                </button>
                {adjustable ? (
                  <div className="flex items-center gap-1 shrink-0" role="group" aria-label={t('Quantity of {item}', { item: l.description })}>
                    <button
                      type="button"
                      aria-label={t('Decrease')}
                      disabled={l.quantity <= 1}
                      onClick={() => step(l, -1)}
                      className="w-11 h-11 rounded-full bg-background flex items-center justify-center cursor-pointer disabled:opacity-40"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="w-8 text-center bw-h3 tabular-nums" aria-live="polite">{l.quantity}</span>
                    <button
                      type="button"
                      aria-label={t('Increase')}
                      onClick={() => step(l, 1)}
                      className="w-11 h-11 rounded-full bg-background flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <span className="bw-label-md px-2 shrink-0">× {l.quantity}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <dl className="flex flex-wrap gap-x-4 gap-y-1 bw-label-md uppercase text-muted-foreground">
        <div className="flex gap-1"><dt>{t('Discount')}</dt><dd className="text-foreground">{discountLine ? (discountType === 'percentage' ? `${discountValue}%` : money(discountValue, 'auto')) : t('None')}</dd></div>
        <div className="flex gap-1"><dt>{taxLabel}</dt><dd className="text-foreground">{vatExempt ? t('Exempt') : reverseCharge ? t('Reverse charge') : `${vatRate}%`}</dd></div>
      </dl>
      {onSend && (
        <DeckButton
          tone="accent"
          className="mt-auto"
          disabled={sending || sendDisabled || lines.length === 0}
          onClick={() => { haptic.medium(); onSend(); }}
        >
          <Send className="w-5 h-5" /> {sending ? t('Sending…') : t('Send · {amount}', { amount: money(totals.total, 'auto') })}
        </DeckButton>
      )}
    </div>
  );

  return <FoldSplit zIndex={zIndex} displayLabel={t('Quote preview')} deckLabel={t('Quote lines')} display={display} deck={deck} />;
};

export default QuoteDeskMode;
