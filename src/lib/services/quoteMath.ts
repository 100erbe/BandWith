/**
 * Shared, pure quote arithmetic.
 *
 * Every place that shows or stores quote money (wizard, detail modal, PDF, DB insert)
 * goes through `calculateQuoteTotals` so screen, PDF and database always agree.
 *
 * Rules:
 * - Amounts are rounded to cents with round-half-up (away from zero): first each line
 *   total (amount x quantity), then subtotal, discount, net, VAT and total.
 * - Percentage discount is clamped to [0, 100]; fixed discount to [0, subtotal].
 * - VAT rate below 0 (or not a number) counts as 0; VAT is 0 when exempt / reverse charge.
 * - Non-finite inputs count as 0 and the subtotal never goes below 0.
 */

export type QuoteDiscountType = 'none' | 'percentage' | 'fixed';

export interface QuoteMathLineItem {
  amount: number;
  quantity?: number;
}

export interface QuoteTotalsInput {
  lineItems: QuoteMathLineItem[];
  discountType?: QuoteDiscountType | string | null;
  discountValue?: number | null;
  vatRate?: number | null;
  vatExempt?: boolean;
  reverseCharge?: boolean;
}

export interface QuoteTotals {
  subtotal: number;
  discount: number;
  net: number;
  vat: number;
  total: number;
}

const finite = (n: unknown): number => {
  const v = typeof n === 'string' ? parseFloat(n) : (n as number);
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/**
 * Round to cents, half-up (away from zero). `toFixed(6)` first removes binary
 * representation noise so e.g. 1.005 (stored as 1.00499999...) rounds to 1.01.
 */
export const roundCents = (value: number): number => {
  const v = finite(value);
  if (v === 0) return 0;
  const sign = v < 0 ? -1 : 1;
  const cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
  const result = (sign * cents) / 100;
  return result === 0 ? 0 : result; // normalise -0
};

export const calculateQuoteTotals = ({
  lineItems,
  discountType,
  discountValue,
  vatRate,
  vatExempt = false,
  reverseCharge = false,
}: QuoteTotalsInput): QuoteTotals => {
  const lineTotals = (lineItems || []).map(li =>
    roundCents(finite(li.amount) * (li.quantity === undefined || li.quantity === null ? 1 : finite(li.quantity)))
  );
  const subtotal = Math.max(0, roundCents(lineTotals.reduce((sum, t) => sum + t, 0)));

  const rawDiscount = finite(discountValue);
  let discount = 0;
  if (discountType === 'percentage') {
    discount = roundCents(subtotal * (clamp(rawDiscount, 0, 100) / 100));
  } else if (discountType === 'fixed') {
    discount = roundCents(clamp(rawDiscount, 0, subtotal));
  }
  discount = clamp(discount, 0, subtotal);

  const net = roundCents(subtotal - discount);
  const rate = vatExempt || reverseCharge ? 0 : Math.max(0, finite(vatRate));
  const vat = roundCents(net * (rate / 100));
  const total = roundCents(net + vat);

  return { subtotal, discount, net, vat, total };
};

/** Totals for an already-known subtotal (e.g. a stored quote or a package option). */
export const calculateTotalsFromSubtotal = (
  subtotal: number,
  opts: Omit<QuoteTotalsInput, 'lineItems'>
): QuoteTotals => calculateQuoteTotals({ ...opts, lineItems: [{ amount: subtotal, quantity: 1 }] });

/** Minimal quote shape (camelCase app quote) needed to derive its totals. */
export interface QuoteLikeForTotals {
  subtotal?: number;
  lineItems?: Array<{ unitPrice: number; quantity: number }>;
  discountType?: QuoteDiscountType | string;
  discountValue?: number;
  discountAmount?: number;
  vatRate?: number;
  vatExempt?: boolean;
  reverseCharge?: boolean;
}

/**
 * Totals of a stored/app quote via the shared math. Uses `subtotal` when known
 * (else the legacy line items, else `fallbackSubtotal`). Legacy rows that only have
 * a discount amount and no discount type are treated as a fixed discount.
 */
export const totalsForQuote = (
  q: QuoteLikeForTotals,
  fallback: { subtotal?: number; vatRate?: number } = {}
): QuoteTotals => {
  const hasType = q.discountType === 'percentage' || q.discountType === 'fixed' || q.discountType === 'none';
  const legacyFixed = !hasType && finite(q.discountAmount) > 0;
  const opts = {
    discountType: legacyFixed ? 'fixed' : q.discountType,
    discountValue: legacyFixed ? q.discountAmount : q.discountValue,
    vatRate: q.vatRate ?? fallback.vatRate,
    vatExempt: q.vatExempt,
    reverseCharge: q.reverseCharge,
  };
  if (typeof q.subtotal === 'number' && Number.isFinite(q.subtotal) && q.subtotal > 0) {
    return calculateTotalsFromSubtotal(q.subtotal, opts);
  }
  if (q.lineItems && q.lineItems.length > 0) {
    return calculateQuoteTotals({
      ...opts,
      lineItems: q.lineItems.map(li => ({ amount: li.unitPrice, quantity: li.quantity })),
    });
  }
  return calculateTotalsFromSubtotal(finite(fallback.subtotal ?? q.subtotal), opts);
};

/** Deposit amount (cents-rounded) for a total and a deposit percentage clamped to [0, 100]. */
export const calculateDepositAmount = (total: number, depositPercentage: number): number =>
  roundCents(finite(total) * (clamp(finite(depositPercentage), 0, 100) / 100));

/**
 * Money formatting shared by the wizard and the PDF: whole amounts without decimals,
 * otherwise two decimals (e.g. "€1,250" / "€1,250.50").
 */
export const formatQuoteMoney = (amount: number, sym = '€', tag: string | undefined = 'en-US'): string => {
  const v = roundCents(amount);
  const hasCents = Math.round(Math.abs(v) * 100) % 100 !== 0;
  return `${sym}${v.toLocaleString(tag, {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
};
